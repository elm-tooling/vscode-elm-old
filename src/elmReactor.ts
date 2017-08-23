import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

import { isWindows } from './elmUtils';

let reactor: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Reactor');
let statusBarStopButton: vscode.StatusBarItem;

function startReactor(): void {
  try {
    stopReactor(/*notify*/ false);

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      'elm',
    );
    const host: string = <string>config.get('reactorHost');
    const port: string = <string>config.get('reactorPort');
    const subdir: string = <string>config.get('reactorSubdir');
    const args = ['-a=' + host, '-p=' + port],
      cwd = path.join(vscode.workspace.rootPath, subdir);

    if (isWindows) {
      reactor = cp.exec('elm-reactor ' + args.join(' '), { cwd: cwd });
    } else {
      reactor = cp.spawn('elm-reactor', args, { cwd: cwd, detached: true });
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
