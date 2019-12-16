import * as vscode from 'vscode';

export function activate(ctx: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("This plugin is deprecated. For modern Elm support in VSCode use https://marketplace.visualstudio.com/items?itemName=Elmtooling.elm-ls-vscode");
}

export function deactivate() {
}
