import * as vscode from 'vscode'
import { Range, TextEdit } from 'vscode'

import { execCmd } from './elmUtils' 

export class ElmFormatProvider implements vscode.DocumentFormattingEditProvider {
  
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken)
    : Thenable<TextEdit[]>
  {
    const format = execCmd('elm-format --stdin');
    
    format.stdin.write(document.getText());
    format.stdin.end();
    
    return format
      .then(({ stdout }) => {
        const wholeDocument = new Range(0, 0, document.lineCount, document.getText().length);
        return [TextEdit.replace(wholeDocument, stdout)];
      })
      .catch((err) => { 
        const message = (<string>err.message).includes('SYNTAX PROBLEM')
          ? "Running elm-format failed. Check the file for syntax errors."
          : "Running elm-format failed. Install from "
          + "https://github.com/avh4/elm-format and make sure it's on your path";
        
        return vscode.window.showErrorMessage(message).then(() => [])
      })
  }
}