import * as vscode from 'vscode';

import {ElmCodeActionProvider, activateCodeActions} from './elmCodeAction';
import {ElmFormatProvider, runFormatOnSave} from './elmFormat';
import {activateReactor, deactivateReactor} from './elmReactor';

import {ElmCompletionProvider} from './elmAutocomplete';
import {ElmDefinitionProvider} from './elmDefinition';
import {ElmHoverProvider} from './elmInfo';
import {ElmSymbolProvider} from './elmSymbol';
import {ElmWorkspaceSymbolProvider} from './elmWorkspaceSymbols';
import {activateClean} from './elmClean';
import {activateMake} from './elmMake';
import {activatePackage} from './elmPackage';
import {activateRepl} from './elmRepl';
import {configuration} from './elmConfiguration';
import {runLinter} from './elmLinter';

const ELM_MODE: vscode.DocumentFilter = { language: 'elm', scheme: 'file' };

// this method is called when your extension is activated
export function activate(ctx: vscode.ExtensionContext) {
  const elmFormatStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    runLinter(document);
  }));
  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    runFormatOnSave(document, elmFormatStatusBar);
  }));
  activateRepl().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateReactor().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateMake().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activatePackage().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateClean().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));
  activateCodeActions().forEach((d: vscode.Disposable) => ctx.subscriptions.push(d));

  let workspaceProvider = new ElmWorkspaceSymbolProvider(ELM_MODE);

  ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elm', configuration));
  ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELM_MODE, new ElmHoverProvider()));
  ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELM_MODE, new ElmCompletionProvider(), '.'));
  ctx.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(ELM_MODE, new ElmSymbolProvider()));
  ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELM_MODE, new ElmDefinitionProvider(ELM_MODE, workspaceProvider)));
  ctx.subscriptions.push(vscode.languages.registerCodeActionsProvider(ELM_MODE, new ElmCodeActionProvider()));
  ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(ELM_MODE, new ElmFormatProvider(elmFormatStatusBar)));
  ctx.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(workspaceProvider));

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    if (document === vscode.window.activeTextEditor.document && document.languageId === ELM_MODE.language) {
      workspaceProvider.update(document);
    }
  });
}

export function deactivate() {
  deactivateReactor();
}
