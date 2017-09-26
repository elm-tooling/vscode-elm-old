import * as vscode from 'vscode';

import { Range, StatusBarItem, TextEdit } from 'vscode';

import { execCmd } from './elmUtils';

export class ElmFormatProvider
  implements vscode.DocumentFormattingEditProvider {
  private showError;
  constructor(statusBarItem: StatusBarItem) {
    statusBarItem.hide();
    this.showError = statusBarMessage(statusBarItem);
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options?: vscode.FormattingOptions,
    token?: vscode.CancellationToken,
  ): Thenable<TextEdit[]> {
    return elmFormat(document)
      .then(({ stdout }) => {
        const lastLineId = document.lineCount - 1;
        const wholeDocument = new Range(
          0,
          0,
          lastLineId,
          document.lineAt(lastLineId).text.length,
        );
        return [TextEdit.replace(wholeDocument, stdout)];
      })
      .catch(this.showError);
  }
}

const ignoreNextSave = new WeakSet<vscode.TextDocument>();
export function runFormatOnSave(
  document: vscode.TextDocument,
  statusBarItem: StatusBarItem,
): Thenable<vscode.TextEdit[]> {
  statusBarItem.hide();
  if (document.languageId !== 'elm' || ignoreNextSave.has(document)) {
    return;
  }
  const showError = statusBarMessage(statusBarItem);
  const config = vscode.workspace.getConfiguration('elm');
  const active = vscode.window.activeTextEditor;

  if (config['formatOnSave'] && active.document === document) {
    const provider = new ElmFormatProvider(statusBarItem);
    ignoreNextSave.add(document);
    return provider
      .provideDocumentFormattingEdits(document)
      .then(edits => {
        ignoreNextSave.delete(document);
        return edits;
      });
  }
}

function elmFormat(document: vscode.TextDocument) {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const formatCommand: string = <string>config.get('formatCommand');
  const options = {
    cmdArguments: [],
    notFoundText: 'Install Elm-format from https://github.com/avh4/elm-format',
  };
  const format = execCmd(formatCommand + ' --stdin', options);

  format.stdin.write(document.getText());
  format.stdin.end();

  return format;
}

function statusBarMessage(statusBarItem: StatusBarItem) {
  return function(err) {
    const message = (<string>err.message).includes('SYNTAX PROBLEM')
      ? 'Running elm-format failed. Check the file for syntax errors.'
      : 'Running elm-format failed. Install from ' +
        "https://github.com/avh4/elm-format and make sure it's on your path";
    let editor = vscode.window.activeTextEditor;
    if (editor) {
      statusBarItem.text = message;
      statusBarItem.show();
    }
    return;
  };
}
