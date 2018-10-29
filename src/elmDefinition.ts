'use strict';

import * as vscode from 'vscode';

import { ElmWorkspaceSymbolProvider } from './elmWorkspaceSymbols';
import { ModuleParser, ImportStatement } from 'elm-module-parser';

export class ElmDefinitionProvider implements vscode.DefinitionProvider {
  public constructor(
    private languagemode: vscode.DocumentFilter,
    private workspaceSymbolProvider: ElmWorkspaceSymbolProvider,
  ) { }

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location> {
    let wordRange = document.getWordRangeAtPosition(position);
    let lineText = document.lineAt(position.line).text;
    let word = wordRange ? document.getText(wordRange) : '';

    if (!wordRange || lineText.startsWith('--') || word.match(/^\d+.?\d+$/)) {
      return null;
    }

    try {
      const parsedModule = ModuleParser(document.getText());

      let symbolName = word.substring(word.lastIndexOf('.') + 1);
      let moduleAlias = word.substring(0, word.lastIndexOf('.'));

      const exactMatchingImport: ImportStatement = parsedModule.imports.find(i => {
        if (moduleAlias === '') {
          const matchedExposing = i.exposing.find(e => {
            switch (e.type) {
              case 'all':
                return false;
              default:
                return e.name === symbolName;
            }
          });

          return matchedExposing != null;
        } else {
          return i.alias === moduleAlias || i.module === moduleAlias;
        }
      });

      const moduleToSearch = exactMatchingImport != null
        ? exactMatchingImport.module
        : parsedModule.name;

      const query = `${moduleToSearch}:${symbolName}`;

      const exactMatch = await this.workspaceSymbolProvider.provideWorkspaceSymbols(query, token);

      if (exactMatch.length > 0) {
        return exactMatch[0].location;
      } else if (moduleAlias === '') {
        const allImported = parsedModule.imports.filter(i => i.exposing.find(e => e.type === 'all'));

        // This could find non-exposed symbols
        const fuzzyMatches = await Promise.all(allImported.map(i => {
          return this.workspaceSymbolProvider.provideWorkspaceSymbols(`${i.module}:${symbolName}`, token);
        }));

        const firstFuzzy = fuzzyMatches.reduce((acc, x) => acc.concat(x), [])[0];

        return firstFuzzy != null ? firstFuzzy.location : null;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }
}
