import * as vscode from 'vscode';

import { ExecutingCmd, execCmd } from './elmUtils';
import { TextEditor, window, workspace } from 'vscode';

let repl = {} as ExecutingCmd;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm REPL');

function startRepl(
  fileName: string,
  forceRestart = false,
): Promise<(data: string) => void> {
  if (repl.isRunning) {
    return Promise.resolve(repl.stdin.write.bind(repl.stdin));
  } else {
    return new Promise(resolve => {
      repl = execCmd('elm-repl', {
        fileName: fileName,
        cmdArguments: [],
        showMessageOnError: true,
        onStart: () => resolve(repl.stdin.write.bind(repl.stdin)),

        // strip output text of leading '>'s and '|'s
        onStdout: data => oc.append(data.replace(/^((>|\|)\s*)+/gm, '')),

        onStderr: data => oc.append(data),

        notFoundText: 'Install Elm from http://elm-lang.org/.',
      });

      oc.show(vscode.ViewColumn.Three);
    });
  }
}

function stopRepl() {
  if (repl.isRunning) {
    repl.kill();
    oc.clear();
    oc.dispose();
    vscode.window.showInformationMessage('Elm REPL stopped.');
  } else {
    vscode.window.showErrorMessage(
      'Cannot stop Elm REPL. The REPL is not running.',
    );
  }
}
function send(editor: TextEditor, msg: string) {
  if (editor.document.languageId !== 'elm') {
    return;
  }

  startRepl(editor.document.fileName).then(writeToRepl => {
    const // Multiline input has to have '\' at the end of each line
      inputMsg = msg.replace(/\n/g, '\\\n') + '\n',
      // Prettify input for display
      displayMsg = '> ' + msg.replace(/\n/g, '\n| ') + '\n';

    writeToRepl(inputMsg);
    oc.append(displayMsg);

    // when the output window is first shown it steals focus
    // switch it back to the text document
    window.showTextDocument(editor.document);
  });
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

export function activateRepl(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.replStart', () =>
      startRepl(workspace.rootPath + '/x'),
    ),
    vscode.commands.registerCommand('elm.replStop', () => stopRepl()),
    vscode.commands.registerTextEditorCommand('elm.replSendLine', sendLine),
    vscode.commands.registerTextEditorCommand(
      'elm.replSendSelection',
      sendSelection,
    ),
    vscode.commands.registerTextEditorCommand('elm.replSendFile', sendFile),
  ];
}
