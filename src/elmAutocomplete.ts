import * as vscode from 'vscode';
import * as oracle from './elmOracle'

export class ElmCompletionProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
    return oracle.GetOracleResults(document, position)
      .then((result) => {
        var r = result.map((v, i, arr) => {
          var ci : vscode.CompletionItem = new vscode.CompletionItem();
          ci.kind = 0;
          ci.label = v.fullName;
          ci.insertText = v.fullName;
          ci.detail = v.signature;
          ci.documentation = v.comment;
          return ci;
        });
        return r;
      });
    }
}
