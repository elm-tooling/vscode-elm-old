import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as utils from './elmUtils';

let make: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Make');

function execMake(editor : vscode.TextEditor, warn : boolean) : void {
  try {
    if (editor.document.languageId !== 'elm') {
      return;
    }
    if (make) {
      make.kill();
      oc.clear();
    }
    const file = editor.document.fileName
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
    const name: string = <string>config.get('makeOutput');
    const cwd: string = utils.detectProjectRoot(file) || vscode.workspace.rootPath;
    let args = [file, '--yes', '--output=' + name];
    if (warn) {
      args.push("--warn");
    }
    if (utils.isWindows) {
      make = cp.exec('elm-make ' + args.join(' '), { cwd: cwd });
    }
    else {
      make = cp.spawn('elm-make', args, { cwd: cwd });
    }
    make.stdout.on('data', (data: Buffer) => {
      if (data) {
        oc.append(data.toString());
      }
    });
    make.stderr.on('data', (data: Buffer) => {
      if (data) {
        oc.append(data.toString());
      }
    });
    oc.show(vscode.ViewColumn.Three);
  }
  catch(e){
     console.error('Running Elm Make failed', e);
     vscode.window.showErrorMessage('Running Elm Make failed');
  }
}

function runMake(editor: vscode.TextEditor) : void {
  execMake(editor, false);
}

function runMakeWarn(editor: vscode.TextEditor) : void {
  execMake(editor, true);
}

export function activateMake(): vscode.Disposable[] {
  return [
    vscode.commands.registerTextEditorCommand('elm.make', runMake),
    vscode.commands.registerTextEditorCommand('elm.makeWarn', runMakeWarn)];
}
