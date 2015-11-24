'use strict';

import * as vscode from 'vscode';

export class ElmDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition(document: vscode.TextDocument, position: vscode.Position,
                           token: vscode.CancellationToken): Thenable<vscode.Location> {
    return new Promise((resolve, reject) => {
      // with the definition provider you can jump e.g. to the declaration of a file
      // there's nothing like godef in elm. we need to figure out how to do this
      // leaving this file here due to bad VS Code documentation atm
      resolve();
    });
  }
}
