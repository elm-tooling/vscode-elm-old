import * as vscode from 'vscode';
import { execCmd } from './elmUtils';

let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Package');

function runInstall(): Thenable<void> {
  oc.show(vscode.ViewColumn.Three);
  
  return execCmd('elm-package install --yes', {
    onStdout: (data) => oc.append(data),
    onStderr: (data) => oc.append(data),
    showMessageOnError: true
  }).then(() => { });
}

export function activatePackage(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.install', runInstall)];
}