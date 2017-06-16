import * as vscode from 'vscode';
import * as cp from 'child_process';
import WebSocket = require("ws");
import * as utils from './elmUtils';
import * as path from 'path';
import * as readline from 'readline';
import {isWindows} from './elmUtils';
import {runLinter, IElmIssue} from './elmLinter';

export class ElmAnalyse {
  public constructor(public elmAnalyseIssues: IElmIssue[]) {
    this.statusBarStopButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarInformation = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarStopButton.text = '$(primitive-square)' + ' Stop Elm-analyse process';
    this.statusBarStopButton.command = 'elm.analyseStop';
    this.statusBarStopButton.tooltip = 'Stop elm-analyse process';
   }
  private statusBarStopButton: vscode.StatusBarItem;
  private statusBarInformation: vscode.StatusBarItem;
  private analyseSocket: WebSocket;
  private analyse: cp.ChildProcess;
  private oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Analyse');

  private initSocketClient() {
    try {
      const cwd: string = vscode.workspace.rootPath;
      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
      const analyseCommand: string = <string>config.get('analyseCommand');
      const port: string = <string>config.get('analysePort');
      const wsPath = "ws://localhost:" + port + "/state";
      if (this.analyseSocket) {
        this.analyseSocket.close();
      }
      this.analyseSocket = new WebSocket(wsPath);
      this.analyseSocket.on("open", () => {
        this.analyseSocket.send("PING");
        this.statusBarInformation.text = 'elm-analyse websocket listening on port ' + port;
        this.statusBarInformation.show();
      });
      this.analyseSocket.on("message", (stateJson) => {
        try {
          this.elmAnalyseIssues = [];
          const state = JSON.parse(stateJson);
          const messages = state.messages;
          messages.forEach(message => {
            if (message.hasOwnProperty("data") && message.data.hasOwnProperty("type")) {
              let messageType = message.data.type;
              if (message.data.hasOwnProperty(messageType)) {
                let messageTypeInfo = message.data[messageType];
                let messageInfoFileSrc = messageTypeInfo.file;
                let messageInfoFileRange = [0, 0, 0, 0];
                if (messageTypeInfo.hasOwnProperty("range")) {
                  messageInfoFileRange = messageTypeInfo.range.real;
                }
                let issue: IElmIssue = {
                  tag: 'analyser',
                  overview: messageType,
                  subregion: '',
                  details: messageType,
                  region: this.correctRange(messageInfoFileRange),
                  type: 'warning',
                  file: path.join(cwd, messageInfoFileSrc)
                };
                this.elmAnalyseIssues.push(issue);
              }
            }
          });
          runLinter(vscode.window.activeTextEditor.document, this)
        }
        catch (e) {
          vscode.window.showErrorMessage('Running websocket against Elm-analyse failed. Check if elm-analyse has been configured correctly.');
          console.log("Socket not open error", e);
        }
      });
      this.analyseSocket.on("error", (e) => {
        vscode.window.showErrorMessage('Running websocket against Elm-analyse failed. Check if elm-analyse has been configured correctly.');
        console.log("ERROR", e);
      });
    }
    catch (e) {
      vscode.window.showErrorMessage('Running websocket against Elm-analyse failed. If set to external - check if elm-analyse has been started in separate console.');
      console.log("Could not start websocket against elm-analyse", e);
    }
  }

private execAnalyse(): void {
  this.execStopAnalyse(/*notify*/ false);
	let editor = vscode.window.activeTextEditor;
  try {
    if (editor.document.languageId !== 'elm') {
      return;
    }
    const cwd: string = vscode.workspace.rootPath;

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
    const analyseCommand: string = <string>config.get('analyseCommand');
    const analysePort: string = <string>config.get('analysePort');
    const analyseAsExternalProcess: boolean = <boolean>config.get('analyseAsExternalProcess');


    if (!analyseAsExternalProcess) {
      let args = ['-s', '-p '+ analysePort];
      if (utils.isWindows) {
        this.analyse = cp.exec(analyseCommand + ' ' + args.join(' '), { cwd: cwd });
      }
      else {
        this.analyse = cp.spawn(analyseCommand, args, { cwd: cwd });
      }
      this.analyse.stdout.on('data', (data: Buffer) => {
        if (data) {
          let info = data.toString();
          this.oc.append(info);
          if (info.match(/^Found \d* message/) && (this.analyseSocket === undefined || this.analyseSocket.CLOSED == 1)) {
            this.initSocketClient();
            this.statusBarStopButton.show();
          }
        }
      });
      this.analyse.stderr.on('data', (data: Buffer) => {
        if (data) {
          this.oc.append(data.toString());
        }
      });
      this.oc.show(vscode.ViewColumn.Three);
    }
    else {
      this.initSocketClient();
    }
  }
  catch(e){
     console.error('Running Elm-analyse command failed', e);
     vscode.window.showErrorMessage('Running Elm-analyse failed');
  }
}


private execStopAnalyse(notify: boolean) {
  this.elmAnalyseIssues = [];
  if (this.analyse) {
    if (isWindows) {
      cp.spawn('taskkill', ['/pid', this.analyse.pid.toString(), '/f', '/t' ])
    } else {
      process.kill(-this.analyse.pid, 'SIGKILL');
    }
    if (this.analyseSocket) {
      this.analyseSocket.close();
    }
    this.statusBarStopButton.hide();
    this.statusBarInformation.hide();
    this.oc.clear();
    if (notify) {
      this.oc.appendLine("Elm-analyse process stopped");
    }
    this.analyse = null;
    this.oc.dispose();
  }
  else {
    if (notify) {
      vscode.window.showErrorMessage("Cannot stop Elm-analyse. Elm-analyse is not running.")
    }
  }
}

private correctRange(range : number[]) {
  return {
    start: {
      line: range[0] + 1,
      column: range[1] + 1
    },
    end: {
      line: range[2] + 1,
      column: range[3] + 1
    }
  }
}

public activateAnalyse(): vscode.Disposable[] {
  return [
    vscode.commands.registerTextEditorCommand('elm.analyseStart', () => this.execAnalyse()),
    vscode.commands.registerCommand('elm.analyseStop', () => this.execStopAnalyse(/*notify*/ true)),
  ]
}
public deactivateAnalyse(): void {
  this.execStopAnalyse(/*notify*/ false);
}

}
