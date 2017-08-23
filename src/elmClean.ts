import * as path from 'path';
import * as rimraf from 'rimraf';
import * as utils from './elmUtils';
import * as vscode from 'vscode';

function runClean(editor: vscode.TextEditor) {
  try {
    const cwd: string = editor.document
      ? utils.detectProjectRoot(editor.document.fileName)
      : vscode.workspace.rootPath;
    const elmStuffDir = path.join(cwd, 'elm-stuff', 'build-artifacts');
    rimraf(elmStuffDir, error => {
      if (error) {
        vscode.window.showErrorMessage('Running Elm Clean failed');
      } else {
        vscode.window.showInformationMessage(
          'Successfully deleted the build-artifacts folder',
        );
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage('Running Elm Clean failed');
  }
}

export function activateClean(): vscode.Disposable[] {
  return [vscode.commands.registerCommand('elm.clean', runClean)];
}
