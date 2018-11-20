'use strict';

import * as vscode from 'vscode';
import { ElmWorkspaceSymbolProvider } from './elmWorkspaceSymbols';
import { parseElmModule, ModuleImport } from 'elm-module-parser';
import * as _ from 'lodash';

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
      const parsedModule = parseElmModule(document.getText());

      let symbolName = word.substring(word.lastIndexOf('.') + 1);
      let moduleAlias = word.substring(0, word.lastIndexOf('.'));

      const exactMatchingImport: ModuleImport = parsedModule.imports.find(
        i => {
          if (moduleAlias === '') {
            const matchedExposing = i.exposing.find(e => {
              return e.name === symbolName;
            });

            return matchedExposing != null;
          } else {
            return i.alias === moduleAlias || i.module === moduleAlias;
          }
        },
      );

      const moduleToSearch =
        exactMatchingImport != null
          ? exactMatchingImport.module
          : parsedModule.name;

      const query = `${moduleToSearch}:${symbolName}`;

      const exactMatch = await this.workspaceSymbolProvider.provideWorkspaceSymbols(
        query,
        token,
      );

      if (exactMatch.length > 0) {
        return exactMatch[0].location;
      } else if (moduleAlias === '') {
        const allImported = parsedModule.imports.filter(i => {
          return i.exposes_all || i.exposing.find(e => e.type === 'constructor');
        });

        // This could find non-exposed symbols
        const fuzzyMatches = await Promise.all(
          allImported.map(i => {
            return this.workspaceSymbolProvider.provideWorkspaceSymbols(
              `${i.module}:${symbolName}`,
              token,
            );
          }),
        );

        const firstFuzzy = _.flatMap(fuzzyMatches, m => m)[0];

        return firstFuzzy != null ? firstFuzzy.location : null;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }
}
