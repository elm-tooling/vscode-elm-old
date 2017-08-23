import * as oracle from './elmOracle';
import * as vscode from 'vscode';

export class ElmCompletionProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Thenable<vscode.CompletionItem[]> {
    let wordRange = document.getWordRangeAtPosition(position);
    let currentWord: string = document.getText(wordRange);
    return oracle
      .GetOracleResults(document, position, oracle.OracleAction.IsAutocomplete)
      .then(result => {
        if (result == null) {
          return [];
        }
        let r = result.map((v, i, arr) => {
          let ci: vscode.CompletionItem = new vscode.CompletionItem(
            v.fullName.trim(),
          );
          ci.kind = v.kind !== undefined ? v.kind : 0;
          if (currentWord.substr(-1) !== '.') {
            ci.insertText = v.name.startsWith(currentWord)
              ? v.name
              : v.fullName;
          }
          ci.detail = v.signature;
          ci.documentation = v.comment;
          if (currentWord.substr(-1) === '.') {
            let fullNameSplit = v.fullName.trim().split('.');
            let lastWordFullName = fullNameSplit[fullNameSplit.length - 1];
            ci.textEdit = {
              range: new vscode.Range(position, position),
              newText: lastWordFullName,
            };
          }

          return ci;
        });
        return r;
      });
  }
}
