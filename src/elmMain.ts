import * as vscode from 'vscode';
import {runLinter} from './elmLinter';

// this method is called when your extension is activated
export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    runLinter(document);
  }));
}
