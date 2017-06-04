'use strict';

import * as vscode from 'vscode';
import {ElmWorkspaceSymbolProvider} from './elmWorkspaceSymbols';
import { Position, Range, SymbolInformation, SymbolKind, TextDocument, TextLine } from 'vscode';


export function definitionLocation(document: vscode.TextDocument, position: vscode.Position, workspaceSymbolProvider : ElmWorkspaceSymbolProvider ): Thenable<SymbolInformation> {
  let wordRange = document.getWordRangeAtPosition(position);
  let lineText = document.lineAt(position.line).text;
  let word = wordRange ? document.getText(wordRange) : '';

  // also check keywords, in-string etc.
  if (!wordRange || lineText.startsWith('--') || word.match(/^\d+.?\d+$/) ) {
  	return Promise.resolve(null);
  }
  return workspaceSymbolProvider.provideWorkspaceSymbols(word, null)
    .then(definitions => {
      if (definitions == null) return Promise.resolve(null);
      let filteredDefinitions = definitions
        .filter((val, index, arr) => val.name == word);
      if (filteredDefinitions.length > 0) {
        return filteredDefinitions[0];
      }
      else {
  	  return Promise.resolve(null);
      }
    }, err => {
  	  return Promise.resolve(null);
    }
  );
}

export class ElmDefinitionProvider implements vscode.DefinitionProvider {
	public constructor( private languagemode: vscode.DocumentFilter, private workspaceSymbolProvider : ElmWorkspaceSymbolProvider) { }

  public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
		return definitionLocation(document, position, this.workspaceSymbolProvider).then(definitionInfo => {
			if (definitionInfo == null || definitionInfo.location == null) return null;
      let definitionResource = definitionInfo.location.uri;
			let pos = new vscode.Position(definitionInfo.location.range.start.line, 0);
			return new vscode.Location(definitionResource, pos);
		}, err => {
			if (err) {
				console.log(err);
			}
			return Promise.resolve(null);
		});
  }
}
