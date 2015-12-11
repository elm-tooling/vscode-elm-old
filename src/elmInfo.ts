import * as vscode from 'vscode';
import * as oracle from './elmOracle'

export class ElmHoverProvider implements vscode.HoverProvider {
  public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
    return oracle.GetOracleResults(document, position)
      .then((result) => {
        if (result.length > 0) {
            let text = result[0].signature + '\n\n' + result[0].comment;
            let hover = new vscode.Hover({ language: 'elm', value: text });
            return hover;
        }
        else {
          return null;
        }})
  }
}
