import * as vscode from 'vscode';
import * as oracle from './elmOracle'

export class ElmCompletionProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
    let wordRange = document.getWordRangeAtPosition(position);
    let currentWord: string = document.getText(wordRange);
    return oracle.GetOracleResults(document, position, oracle.OracleAction.IsAutocomplete)
      .then((result) => {
        if (result == null) {
          return [];
        }
        var r = result.map((v, i, arr) => {
          var ci: vscode.CompletionItem = new vscode.CompletionItem(v.fullName.trim());
          ci.kind = (v.kind !== undefined ? v.kind : 0);
          if (currentWord.substr(-1) !== '.') {
            ci.insertText = v.name.startsWith(currentWord) ? v.name : v.fullName;
          }
          ci.detail = v.signature;
          ci.documentation = v.comment;
          if (currentWord.substr(-1) === '.') {
            ci.textEdit = {
              range: new vscode.Range(position, position),
              newText: v.fullName.trim().substr(currentWord.length)
            };
          }

          return ci;
        });
        return r;
      });
  }
}
