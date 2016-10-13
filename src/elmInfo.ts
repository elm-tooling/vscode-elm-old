import * as vscode from 'vscode';
import * as oracle from './elmOracle'

export class ElmHoverProvider implements vscode.HoverProvider {
  public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
    return oracle.GetOracleResults(document, position)
      .then((result) => {
        if (result.length > 0) {
          let text =  this.formatSig(result[0].signature) + '\n\n' + result[0].comment;
          let hover = new vscode.Hover(text);
          return hover;
        }
        else {
          return null;
        }})
  }
  private formatSig(signature: String): String {
    return '~~~\n' 
      + signature
        .replace(/\{/g, '  {')        //spaces before open brace
        .replace(/\s?,/g, '\n  ,')    //newlines + spaces before comma
        .replace(/\}\s?/g, '\n  }\n') //newline + spaces before close brace + newline after  
      + '\n~~~';
  }
}
