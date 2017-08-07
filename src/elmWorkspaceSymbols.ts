import * as vscode from 'vscode';

import { TextDocument } from 'vscode';
import { processDocument } from './elmSymbol';

const config = vscode.workspace.getConfiguration('elm');

export class ElmWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider {
  private symbols: Thenable<vscode.SymbolInformation[]>;
  public constructor(private languagemode: vscode.DocumentFilter) {
    this.symbols = null;
  }

  public update(document: TextDocument) {
    if (this.symbols != null) {
      this.symbols.then(s => {
        let otherSymbols = s.filter(
          docSymbol => docSymbol.location.uri !== document.uri,
        );

        symbolsFromFile(document).then(symbolInfo => {
          let updated = otherSymbols.concat(symbolInfo);
          this.symbols = Promise.resolve(updated);
        });
      });
    }
  }

  provideWorkspaceSymbols = (
    query: string,
    token: vscode.CancellationToken,
  ): Thenable<vscode.SymbolInformation[]> => {
    if (this.symbols != null) {
      return this.symbols;
    } else {
      let result = Promise.resolve(processWorkspace(query));
      this.symbols = result;
      return result;
    }
  };
}
function symbolsFromFile(document): Thenable<vscode.SymbolInformation[]> {
  let processed = processTextDocuments([document]).then(
    val => {
      let res = val[0] as vscode.SymbolInformation[];
      return res;
    },
    err => {
      return [] as vscode.SymbolInformation[];
    },
  );
  return processed;
}

function openTextDocuments(uris: vscode.Uri[]): Thenable<TextDocument[]> {
  return Promise.all(
    uris.map(uri => vscode.workspace.openTextDocument(uri).then(doc => doc)),
  );
}

function processTextDocuments(
  documents: TextDocument[],
): Thenable<vscode.SymbolInformation[][]> {
  return Promise.all(documents.map(document => processDocument(document)));
}

function processWorkspace(query: string): Thenable<vscode.SymbolInformation[]> {
  let maxFiles = config['maxWorkspaceFilesUsedBySymbols'];
  let excludePattern = config['workspaceFilesExcludePatternUsedBySymbols'];
  let docs = vscode.workspace
    .findFiles('**/*.elm', excludePattern, maxFiles)
    .then(
      workspaceFiles => {
        let openedTextDocuments = openTextDocuments(workspaceFiles);
        let processedTextDocuments = openedTextDocuments.then(
          results => {
            return processTextDocuments(results);
          },
          err => {
            return [];
          },
        );
        let symbolInformation = processedTextDocuments.then(
          symbols => {
            return [].concat.apply([], symbols) as vscode.SymbolInformation[];
          },
          err => {
            return [] as vscode.SymbolInformation[];
          },
        );
        return symbolInformation;
      },
      fileError => {
        return [];
      },
    );
  return <any>docs;
}
