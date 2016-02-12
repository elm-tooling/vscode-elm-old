import * as vscode from 'vscode';
import * as cp from 'child_process';

let pack: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Package');

function runInstall(): void {
  try {
    const cwd: string = vscode.workspace.rootPath;
    pack = cp.spawn('elm-package', ['install', '--yes' ], { cwd: cwd })
    pack.stdout.on('data', (data: Buffer) => {
        if (data) {
          oc.append(data.toString());
        }
      });
    pack.stderr.on('data', (data: Buffer) => {
      if (data) {
        oc.append(data.toString());
      }
    });
    oc.show(vscode.ViewColumn.Three);
  }
  catch(e){
     console.error('Running Elm Package failed', e);
     vscode.window.showErrorMessage('Running Elm Package failed');
  }
}

export function activatePackage(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.install', runInstall)];
}