import * as vscode from 'vscode';
import {runLinter} from './elmLinter';
import {activateRepl} from './elmRepl';
import {activateReactor} from './elmReactor';

// this method is called when your extension is activated
export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    runLinter(document);
  }));
  activateRepl().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateReactor().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));

}
