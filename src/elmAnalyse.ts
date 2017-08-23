import * as vscode from 'vscode';
import * as cp from 'child_process';
import WebSocket = require('ws');
const request = require('request');
import * as utils from './elmUtils';
import * as path from 'path';
import * as readline from 'readline';
import { isWindows, execCmd, ExecutingCmd } from './elmUtils';
import { runLinter, IElmIssue } from './elmLinter';

enum ElmAnalyseServerState {
  NotRunning = 1,
  PortInUse,
  Running,
}

export class ElmAnalyse {
  private statusBarStopButton: vscode.StatusBarItem;
  private statusBarInformation: vscode.StatusBarItem;
  private analyseSocket: WebSocket;
  private analyse: ExecutingCmd;
  private updateLinterInterval;
  private unprocessedMessage = false;
  private oc: vscode.OutputChannel = vscode.window.createOutputChannel(
    'Elm Analyse',
  );
  private messageDescriptionsMap: Map<string, string>;
  private messageDescriptions: {
    messageType: string;
    description: string;
  }[] = [
    {
      messageType: 'DebugCrash',
      description:
        'This check will look if a Debug.crash is used within the code. You may not want to ship this to your end users.',
    },
    {
      messageType: 'DebugLog',
      description:
        'This check will look if a Debug.log is used within the code. \
        This is nice for development, but you do not want to ship this code to package users or your endusers.',
    },
    {
      messageType: 'DropConcatOfLists',
      description:
        'If you concatenate two lists ([...] ++ [...]), then you can merge them into one list.',
    },
    {
      messageType: 'DropConsOfItemAndList',
      description:
        'If you cons an item to a literal list (x :x [1, 2, 3]), then you can just put the item into the list.',
    },
    {
      messageType: 'DuplicateImport',
      description:
        'This check will look for imports that are defined twice. \
        The Elm compiler will not fail on this, but it is better to merge these two imports into one.',
    },
    {
      messageType: 'ExposeAll',
      description:
        'This check will look for modules that expose all their definitions. \
        This is not a best practice. You want to be clear about the API that a module defined.',
    },
    {
      messageType: 'ImportAll',
      description:
        'This check will look for imports that expose all functions from a module (..). \
        When other people read your code, it would be nice if the origin of a used function can be traced back to the providing module.',
    },
    {
      messageType: 'LineLengthExceeded',
      description:
        'This check will mark files that contain lines that exceed over 150 characters (#18 allows configuring this variable).',
    },
    {
      messageType: 'MultiLineRecordFormatting',
      description:
        'This check will if records in type aliases are formatted on multiple lines if the type alias has multiple fields.',
    },
    {
      messageType: 'NoTopLevelSignature',
      description:
        'This check will look for function declarations without a signature. \
        We want our readers to understand our code. Adding a signature is a part of this. \
        This check will skip definitions in let statements.',
    },
    {
      messageType: 'NoUncurriedPrefix',
      description:
        'It is unneeded to use an operator in prefix notation when you apply both arguments directly. \
        This check will look for these kind of usages',
    },
    {
      messageType: 'RedefineVariable',
      description:
        'You should not redefine a variable in a new lexical scope. This is confusing and may lead to bugs.',
    },
    {
      messageType: 'UnnecessaryListConcat',
      description:
        'You should not use List.concat to concatenate literal lists. Just join the lists together.',
    },
    {
      messageType: 'UnnecessaryParens',
      description:
        'If you want parenthesis, then you might want to look into Lisp. \
        It is good to know when you do not need them in Elm and this check will let you know. \
        This check follows this discussion from elm-format.',
    },

    {
      messageType: 'UnusedImport',
      description: 'Imports that have no meaning should be removed.',
    },
    {
      messageType: 'UnusedImportAlias',
      description:
        'Sometimes you defined an alias for an import (import Foo as F), but it turns out you never use it. \
        This check shows where you have unused import aliases.',
    },
    {
      messageType: 'UnusedImportedVariable',
      description:
        'When a function is imported from a module but unused, it is better to remove it.',
    },
    {
      messageType: 'UnusedPatternVariable',
      description:
        'Variables in pattern matching that are unused should be replaced with _ to avoid unnecessary noice.',
    },
    {
      messageType: 'UnusedTopLevel',
      description:
        'Functions that are unused in a module and not exported are dead code. These should be removed.',
    },
    {
      messageType: 'UnusedTypeAlias',
      description:
        'When you defined an type alias, but you do not use it in any signature or expose it, \
        then it is just filling up space. It is better to remove it.',
    },
    {
      messageType: 'UnusedVariable',
      description:
        'Variables that are not used could be removed or marked as _ to avoid unnecessary noise.',
    },
    {
      messageType: 'UseConsOverConcat',
      description:
        'If you concatenate two lists, but the right hand side is a single element list, then you should use the cons operator.  ',
    },
  ];
  public constructor(public elmAnalyseIssues: IElmIssue[]) {
    this.statusBarStopButton = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
    );
    this.statusBarInformation = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
    );
    this.statusBarStopButton.text =
      '$(primitive-square)' + ' Stop Elm-analyse process';
    this.statusBarStopButton.command = 'elm.analyseStop';
    this.statusBarStopButton.tooltip = 'Stop elm-analyse process';
    this.analyse = {} as ExecutingCmd;
    this.messageDescriptionsMap = new Map();
    this.messageDescriptions.forEach(element => {
      this.messageDescriptionsMap.set(element.messageType, element.description);
    });
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      'elm',
    );
    const enabledOnStartup: boolean = <boolean>config.get('analyseEnabled');
    if (enabledOnStartup) {
      this.execActivateAnalyseProcesses();
    }
  }

  public activateAnalyse(): vscode.Disposable[] {
    return [
      vscode.commands.registerTextEditorCommand('elm.analyseStart', () =>
        this.execActivateAnalyseProcesses(),
      ),
      vscode.commands.registerCommand('elm.analyseStop', () =>
        this.execStopAnalyse(/*notify*/ true),
      ),
    ];
  }
  public deactivateAnalyse(): void {
    this.execStopAnalyse(/*notify*/ false);
  }

  private initSocketClient() {
    try {
      const cwd: string = vscode.workspace.rootPath;
      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
        'elm',
      );
      const analyseCommand: string = <string>config.get('analyseCommand');
      const port: string = <string>config.get('analysePort');
      const wsPath = 'ws://localhost:' + port + '/state';
      if (this.analyseSocket) {
        this.analyseSocket.close();
      }
      this.analyseSocket = new WebSocket(wsPath);
      this.analyseSocket.on('open', () => {
        this.analyseSocket.send('PING');
        this.statusBarInformation.text =
          'elm-analyse websocket listening on port ' + port;
      });
      this.analyseSocket.on('message', stateJson => {
        try {
          this.elmAnalyseIssues = [];
          const state = JSON.parse(stateJson);
          const messages = state.messages;
          messages.forEach(message => {
            if (
              message.hasOwnProperty('data') &&
              message.data.hasOwnProperty('type')
            ) {
              let messageType = message.data.type;
              if (message.data.hasOwnProperty(messageType)) {
                const messageTypeInfo = message.data[messageType];
                const messageInfoFileSrc = messageTypeInfo.file;
                const messageInfoFileRange = this.parseMessageInfoFileRange(
                  messageTypeInfo,
                );
                const detail = this.parseMessageInfoDetail(messageType);
                const issue: IElmIssue = {
                  tag: 'analyser',
                  overview: messageType,
                  subregion: '',
                  details: detail,
                  region: this.correctRange(messageInfoFileRange),
                  type: 'warning',
                  file: path.join(cwd, messageInfoFileSrc),
                };
                this.elmAnalyseIssues.push(issue);
              }
            }
          });
          this.unprocessedMessage = true;
        } catch (e) {
          vscode.window.showErrorMessage(
            'Running websocket against Elm-analyse failed. Check if elm-analyse has been configured correctly.',
          );
        }
      });
      this.analyseSocket.on('error', e => {
        vscode.window.showErrorMessage(
          'Running websocket against Elm-analyse failed. Check if elm-analyse has been configured correctly.',
        );
      });
    } catch (e) {
      vscode.window.showErrorMessage(
        'Running websocket against Elm-analyse failed. If set to external - check if elm-analyse has been started in separate console.',
      );
    }
  }

  private parseMessageInfoFileRange(messageTypeInfo) {
    let messageInfoFileRange = [0, 0, 0, 0];
    if (messageTypeInfo.hasOwnProperty('range')) {
      messageInfoFileRange = messageTypeInfo.range.real;
    }
    return messageInfoFileRange;
  }

  private parseMessageInfoDetail(messageType: string) {
    let detail = '';
    if (this.messageDescriptionsMap.has(messageType)) {
      detail = this.messageDescriptionsMap.get(messageType);
    }
    return detail;
  }

  private correctRange(range: number[]) {
    return {
      start: {
        line: range[0] + 1,
        column: range[1] + 1,
      },
      end: {
        line: range[2] + 1,
        column: range[3] + 1,
      },
    };
  }

  private startAnalyseProcess(
    analyseCommand: string,
    analysePort: string,
    fileName: string,
    forceRestart = false,
  ): Thenable<boolean> {
    if (this.analyse.isRunning) {
      vscode.window.showErrorMessage(
        'Elm-analyse is already running in vscode. Please run the stop command if you want to restart elm-analyse.',
      );
      return Promise.resolve(false);
    }

    return checkElmAnalyseServerState(analysePort).then(state => {
      if (state === ElmAnalyseServerState.Running) {
        return true;
      } else if (state === ElmAnalyseServerState.PortInUse) {
        vscode.window.showErrorMessage(
          'Port already in use by another process. Please stop the running process or select another port for elm-analyse.',
        );
        return false;
      } else {
        this.analyse = execCmd(analyseCommand, {
          fileName: fileName,
          cmdArguments: ['-s', '-p', analysePort],
          showMessageOnError: true,
          onStart: () => this.analyse.stdin.write.bind(this.analyse.stdin),

          onStdout: data => {
            if (data) {
              let info = data.toString();
              this.oc.append(info);
            }
          },

          onStderr: data => {
            if (data) {
              this.oc.append(data.toString());
            }
          },

          notFoundText: 'Install Elm-analyse using npm i elm-analyse -g',
        });
        this.oc.show(vscode.ViewColumn.Three);
        return true;
      }
    });
  }

  private execActivateAnalyseProcesses(): void {
    let editor = vscode.window.activeTextEditor;
    if (editor.document.languageId !== 'elm') {
      return;
    }
    try {
      const cwd: string = vscode.workspace.rootPath;

      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
        'elm',
      );
      const analyseCommand: string = <string>config.get('analyseCommand');
      const analysePort: string = <string>config.get('analysePort');

      this.startAnalyseProcess(
        analyseCommand,
        analysePort,
        editor.document.fileName,
      ).then(processReady => {
        if (processReady) {
          // Had to implement this timeout as this sometimes causes error when server has not been started yet.
          this.statusBarInformation.text =
            'elm-analyse websocket waiting 3 seconds to ensure server has started...';
          this.statusBarInformation.show();
          setTimeout(() => {
            this.initSocketClient();
            this.updateLinterInterval = setInterval(
              () => this.updateLinter(),
              500,
            );
          }, 3000);
        }
      });
    } catch (e) {
      console.error('Running Elm-analyse command failed', e);
      vscode.window.showErrorMessage('Running Elm-analyse failed');
    }
  }

  private execStopAnalyse(notify: boolean) {
    this.elmAnalyseIssues = [];
    if (this.analyse.isRunning) {
      this.analyse.kill();
      if (this.analyseSocket) {
        this.analyseSocket.removeAllListeners();
        this.analyseSocket.close();
      }
      this.updateLinterInterval = clearInterval(this.updateLinterInterval);
      this.statusBarStopButton.hide();
      this.statusBarInformation.hide();
      this.oc.clear();
      if (notify) {
        this.oc.appendLine('Elm-analyse process stopped');
      }
      this.oc.dispose();
    } else {
      if (notify) {
        vscode.window.showErrorMessage(
          'Cannot stop Elm-analyse. Elm-analyse is not running.',
        );
      }
    }
  }

  private updateLinter() {
    if (this.unprocessedMessage) {
      runLinter(vscode.window.activeTextEditor.document, this);
      this.unprocessedMessage = false;
    }
  }
}

function checkElmAnalyseServerState(
  port: string,
): Thenable<ElmAnalyseServerState> {
  let result = getElmAnalyseServerInfo('http://localhost:' + port).then(
    info => {
      if (info.match(/Elm Analyse/)) {
        return ElmAnalyseServerState.Running;
      } else {
        return ElmAnalyseServerState.PortInUse;
      }
    },
    err => {
      return ElmAnalyseServerState.NotRunning;
    },
  );
  return result;
}

function getElmAnalyseServerInfo(url: string): Thenable<any> {
  const titleRegex = /(<\s*title[^>]*>(.+?)<\s*\/\s*title)>/gi;
  return new Promise((resolve, reject) => {
    request(url, (err, _, body) => {
      if (err) {
        reject(err);
      } else {
        let info = '';
        try {
          const match = titleRegex.exec(body);
          if (match && match[2]) {
            console.log(match[2]);
            info = match[2];
          }
        } catch (e) {
          reject(e);
        }
        resolve(info);
      }
    });
  });
}
