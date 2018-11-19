import * as cp from 'child_process';
import * as path from 'path';
import * as utils from './elmUtils';
import * as vscode from 'vscode';

import { isWindows } from './elmUtils';

let reactor: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Reactor');
let statusBarStopButton: vscode.StatusBarItem;

function getReactorAndArguments(
  host: string,
  port: string,
  subdir: string,
): [string, string, string[]] {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const dummyPath = path.join(vscode.workspace.rootPath, 'dummyfile');
  const reactor018Command: string = 'elm-reactor';
  const compiler: string = <string>config.get('compiler');
  const [cwd, elmVersion] = utils.detectProjectRootAndElmVersion(
    dummyPath,
    vscode.workspace.rootPath,
  );
  const args018 = ['-a=' + host, 'p=' + port];
  const args019 = ['reactor', '--port=' + port];
  const cwdWithSubdir = path.join(cwd, subdir);
  const args = utils.isElm019(elmVersion) ? args019 : args018;
  const reactorCommand = utils.isElm019(elmVersion)
    ? compiler
    : reactor018Command;

  return [cwdWithSubdir, reactorCommand, args];
}

function startReactor(): void {
  try {
    stopReactor(/*notify*/ false);

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      'elm',
    );
    const host: string = <string>config.get('reactorHost');
    const port: string = <string>config.get('reactorPort');
    const subdir: string = <string>config.get('reactorSubdir');
    const [cwd, reactorCommand, args] = getReactorAndArguments(
      host,
      port,
      subdir,
    );

    if (isWindows) {
      reactor = cp.exec(reactorCommand + ' ' + args.join(' '), { cwd: cwd });
    } else {
      reactor = cp.spawn(reactorCommand, args, { cwd: cwd, detached: true });
    }

    reactor.stdout.on('data', (data: Buffer) => {
      if (data && data.toString().startsWith('| ') === false) {
        oc.append(data.toString());
      }
    });

    reactor.stderr.on('data', (data: Buffer) => {
      if (data) {
        oc.append(data.toString());
      }
    });
    oc.show(vscode.ViewColumn.Three);
    statusBarStopButton.show();
  } catch (e) {
    console.error('Starting Elm reactor failed', e);
    vscode.window.showErrorMessage('Starting Elm reactor failed');
  }
}

function stopReactor(notify: boolean): void {
  if (reactor) {
    if (isWindows) {
      cp.spawn('taskkill', ['/pid', reactor.pid.toString(), '/f', '/t']);
    } else {
      process.kill(-reactor.pid, 'SIGKILL');
    }
    reactor = null;
    statusBarStopButton.hide();
    oc.dispose();
    oc.hide();
  } else {
    if (notify) {
      vscode.window.showInformationMessage('Elm Reactor not running');
    }
  }
}

export function activateReactor(): vscode.Disposable[] {
  statusBarStopButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  statusBarStopButton.text = '$(primitive-square)';
  statusBarStopButton.command = 'elm.reactorStop';
  statusBarStopButton.tooltip = 'Stop reactor';
  return [
    vscode.commands.registerCommand('elm.reactorStart', startReactor),
    vscode.commands.registerCommand('elm.reactorStop', () =>
      stopReactor(/*notify*/ true),
    ),
  ];
}

export function deactivateReactor(): void {
  stopReactor(/*notify*/ false);
}
