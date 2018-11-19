import * as vscode from 'vscode';
import * as utils from './elmUtils';
import * as path from 'path';

import { Range, StatusBarItem, TextEdit } from 'vscode';

import { execCmd } from './elmUtils';

export class ElmFormatProvider
  implements vscode.DocumentFormattingEditProvider {
  private showError;
  private clearError;
  constructor(statusBarItem: StatusBarItem) {
    statusBarItem.hide();
    this.showError = statusBarMessage(statusBarItem);
    this.clearError = clearStatus(statusBarItem);
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options?: vscode.FormattingOptions,
    token?: vscode.CancellationToken,
  ): Thenable<TextEdit[]> {
    return elmFormat(document)
      .then(({ stdout }) => {
        this.clearError();
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

export class ElmRangeFormatProvider
  implements vscode.DocumentRangeFormattingEditProvider {
  private showError;
  private clearError;
  constructor(statusBarItem: StatusBarItem) {
    statusBarItem.hide();
    this.showError = statusBarMessage(statusBarItem);
    this.clearError = clearStatus(statusBarItem);
  }

  /*
  Formatting range is the same as formatting whole document,
  rather than user's current selection.
  */
  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options?: vscode.FormattingOptions,
    token?: vscode.CancellationToken,
  ): Thenable<TextEdit[]> {
    return elmFormat(document)
      .then(({ stdout }) => {
        this.clearError();
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

function elmFormat(document: vscode.TextDocument) {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const formatCommand: string = <string>config.get('formatCommand');
  const dummyPath = path.join(vscode.workspace.rootPath, 'dummyfile');
  const [_, elmVersion] = utils.detectProjectRootAndElmVersion(
    dummyPath,
    vscode.workspace.rootPath,
  );
  const args = utils.isElm019(elmVersion)
    ? ['--stdin', '--elm-version 0.19', '--yes']
    : ['--stdin', '--elm-version 0.18', '--yes'];
  const options = {
    cmdArguments: args,
    notFoundText: 'Install Elm-format from https://github.com/avh4/elm-format',
  };
  const format = execCmd(formatCommand, options);

  format.stdin.write(document.getText());
  format.stdin.end();

  return format;
}

function clearStatus(statusBarItem: StatusBarItem) {
  return function() {
    statusBarItem.text = '';
    statusBarItem.hide();
  };
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
