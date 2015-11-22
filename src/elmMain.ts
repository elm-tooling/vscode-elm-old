import * as vscode from 'vscode';
import {createDiagnostics} from './elmCheck';

// this method is called when your extension is activated
export function activate(ctx: vscode.ExtensionContext) {
	ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
		createDiagnostics(document);
	}))
}
