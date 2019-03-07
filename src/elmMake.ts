import * as cp from 'child_process';
import * as path from 'path';
import * as utils from './elmUtils';
import * as elmTest from './elmTest';
import * as vscode from 'vscode';

let make: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Make');

function getMakeAndArguments(file, warn: boolean): [string, string, string[]] {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const name: string = <string>config.get('makeOutput');
  const make018Command: string = <string>config.get('makeCommand');
  const compiler: string = <string>config.get('compiler');
  const elmTestCompiler: string = <string>config.get('elmTestCompiler');
  const [cwd, elmVersion] = utils.detectProjectRootAndElmVersion(
    file,
    vscode.workspace.rootPath,
  );
  const specialFile: string = <string>config.get('makeSpecialFile');
  const isTestFile = elmTest.fileIsTestFile(file);

  if (specialFile.length > 0) {
    file = path.resolve(cwd, specialFile);
  }
  if (utils.isWindows) {
    file = '"' + file + '"';
  }
  const args018 = [file, '--yes', '--output=' + name];
  if (warn) {
    args018.push('--warn');
  }

  const args019 = ['make', file, '--output=' + name];
  const args = utils.isElm019(elmVersion) ? args019 : args018;
  const makeCommand = utils.isElm019(elmVersion)
    ? isTestFile
      ? elmTestCompiler
      : compiler
    : make018Command;
  return [cwd, makeCommand, args];
}

function execMake(editor: vscode.TextEditor, warn: boolean): void {
  try {
    if (editor.document.languageId !== 'elm') {
      return;
    }
    if (make) {
      make.kill();
      oc.clear();
    }
    let file = editor.document.fileName;
    let [cwd, makeCommand, args] = getMakeAndArguments(file, warn);

    make = cp.exec(makeCommand + ' ' + args.join(' '), { cwd: cwd });
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
  } catch (e) {
    console.error('Running Elm Make failed', e);
    vscode.window.showErrorMessage('Running Elm Make failed');
  }
}

function runMake(editor: vscode.TextEditor): void {
  execMake(editor, false);
}

function runMakeWarn(editor: vscode.TextEditor): void {
  execMake(editor, true);
}

export function activateMake(): vscode.Disposable[] {
  return [
    vscode.commands.registerTextEditorCommand('elm.make', runMake),
    vscode.commands.registerTextEditorCommand('elm.makeWarn', runMakeWarn),
  ];
}
