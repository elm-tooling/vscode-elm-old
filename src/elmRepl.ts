import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './elmUtils';
import { TextEditor, window, workspace } from 'vscode';

let replTerminal: vscode.Terminal;

function getElmRepl(): string {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
  const dummyPath = path.join(vscode.workspace.rootPath, 'dummyfile');
  const repl018Command: string = 'elm-repl';
  const compiler: string = <string>config.get('compiler');
  const [cwd, elmVersion] = utils.detectProjectRootAndElmVersion(dummyPath, vscode.workspace.rootPath);
  const replCommand = utils.isElm019(elmVersion) ? `${compiler} repl` : repl018Command;
  return replCommand;
}

function isPowershell() {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
  const t: string = <string>config.get('terminal.integrated.shell.windows');
  return t.toLowerCase().includes('powershell');
}


function getReplLaunchCommands(replCommand: string): [string, string] {
  if (utils.isWindows) {
    if (isPowershell()) {
      return [`cmd /c ${replCommand}`, 'clear'];

    } else {
      return [`${replCommand}`, 'cls'];
    }
  } else { return [replCommand, 'clear']; }
}

function startRepl() {
  try {
    let replCommand = getElmRepl();
    if (replTerminal !== undefined) { replTerminal.dispose(); }
    replTerminal = window.createTerminal('Elm repl');
    let [replLaunchCommand, clearCommand] = getReplLaunchCommands(replCommand);
    replTerminal.sendText(clearCommand, true);
    replTerminal.sendText(replLaunchCommand, true);
    replTerminal.show(true);
  } catch (error) {
    vscode.window.showErrorMessage( 'Cannot start Elm REPL.');
  }

}

function send(editor: TextEditor, msg: string) {
  if (editor.document.languageId !== 'elm') {
    return;
  }
  if (replTerminal === undefined) { startRepl(); }
  const // Multiline input has to have '\' at the end of each line
    inputMsg = msg.replace(/\n/g, '\\\n') + '\n';

  replTerminal.sendText(inputMsg, false);
}

function sendLine(editor: TextEditor) {
  send(editor, editor.document.lineAt(editor.selection.start).text);
}

function sendSelection(editor: vscode.TextEditor): void {
  send(editor, editor.document.getText(editor.selection));
}

function sendFile(editor: vscode.TextEditor): void {
  send(editor, editor.document.getText());
}

let closeReplTerminalListener = function(terminal: vscode.Terminal) {
  if (terminal.name === 'Elm repl') {
    replTerminal = undefined;
  }
};

vscode.window.onDidCloseTerminal(closeReplTerminalListener);

export function activateRepl(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.replStart', () =>
      startRepl(),
    ),
    vscode.commands.registerTextEditorCommand('elm.replSendLine', sendLine),
    vscode.commands.registerTextEditorCommand( 'elm.replSendSelection', sendSelection),
    vscode.commands.registerTextEditorCommand('elm.replSendFile', sendFile),
  ];
}
