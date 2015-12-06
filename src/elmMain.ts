import * as vscode from 'vscode';
import {runLinter} from './elmLinter';
import {activateRepl} from './elmRepl';
import {activateReactor} from './elmReactor';
import {activateMake} from './elmMake';
import {ElmDefinitionProvider} from './elmDefinition';
import {ElmHoverProvider} from './elmInfo';
import {configuration} from './elmConfiguration';

const ELM_MODE: vscode.DocumentFilter = { language: 'elm', scheme: 'file' };

// this method is called when your extension is activated
export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    runLinter(document);
  }));
  activateRepl().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateReactor().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateMake().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));

  ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elm', configuration))
  ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELM_MODE, new ElmHoverProvider()));

  // ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELM_MODE, new ElmDefinitionProvider()));
}
