'use strict';

import * as vscode from 'vscode';

import { ElmWorkspaceSymbolProvider } from './elmWorkspaceSymbols';
import { SymbolInformation } from 'vscode';

export function definitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  workspaceSymbolProvider: ElmWorkspaceSymbolProvider,
): Thenable<SymbolInformation> {
  let wordRange = document.getWordRangeAtPosition(position);
  let lineText = document.lineAt(position.line).text;
  let word = wordRange ? document.getText(wordRange) : '';
  let imports: { [key: string]: string[] } = document.getText().split('\n')
    .filter(x => x.startsWith('import '))
    .map(x => x.match(/import ([^\s]+)(?: as [^\s]+)?(?: exposing (\(.+\)))?/))
    .filter(x => x)
    .reduce((acc, matches) => {
      const importedMembers = matches[2] || '()';
      acc[matches[1]] = importedMembers === '(..)'
        ? ['*'] : importedMembers.split(/[(),]/).map(x => x.trim()).filter(x => x === '');
      return acc;
    }, {});

  // also check keywords, in-string etc.
  if (!wordRange || lineText.startsWith('--') || word.match(/^\d+.?\d+$/)) {
    return Promise.resolve(null);
  }

  let lastWordPart = word.substring(word.lastIndexOf('.') + 1);
  let wordContainerName = word.substring(0, word.lastIndexOf('.'));

  return workspaceSymbolProvider.provideWorkspaceSymbols(lastWordPart, null).then(
    symbols => {
      if (symbols == null) {
        return Promise.resolve(null);
      }
      let matchingSymbols = symbols
        .filter(s => s.name === lastWordPart)
        .map(s => {
          const importedMembers = imports[s.containerName] || [];

          return {
            matchesExactly: wordContainerName && wordContainerName !== '' && s.containerName === wordContainerName,
            inThisDocument: s.location.uri === document.uri,
            matchesImportedName: importedMembers.indexOf(s.name) >= 0,
            possibleMatch: importedMembers.indexOf('*') >= 0,
            definition: s,
          };
        });

      function* findMatch () {
        yield matchingSymbols.find(m => m.matchesExactly);

        yield matchingSymbols.find(m => m.inThisDocument);

        yield matchingSymbols.find(m => m.matchesImportedName);

        yield matchingSymbols.find(m => m.possibleMatch);

        yield matchingSymbols[0];
      }

      for (let match of findMatch()) {
        if (match) {
          return match.definition;
        }
      }

      return Promise.resolve(null);
    },
    err => {
      return Promise.resolve(null);
    },
  );
}

export class ElmDefinitionProvider implements vscode.DefinitionProvider {
  public constructor(
    private languagemode: vscode.DocumentFilter,
    private workspaceSymbolProvider: ElmWorkspaceSymbolProvider,
  ) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Thenable<vscode.Location> {
    return definitionLocation(
      document,
      position,
      this.workspaceSymbolProvider,
    ).then(
      definitionInfo => {
        if (definitionInfo == null || definitionInfo.location == null) {
          return null;
        }
        let definitionResource = definitionInfo.location.uri;
        let pos = new vscode.Position(
          definitionInfo.location.range.start.line,
          0,
        );
        return new vscode.Location(definitionResource, pos);
      },
      err => {
        if (err) {
          console.log(err);
        }
        return Promise.resolve(null);
      },
    );
  }
}
