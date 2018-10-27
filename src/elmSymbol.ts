import * as vscode from 'vscode';

import { SymbolInformation, TextDocument } from 'vscode';
import { ModuleParser } from 'elm-module-parser';

export class ElmSymbolProvider implements vscode.DocumentSymbolProvider {
  public async provideDocumentSymbols(doc: TextDocument, _) {
    return processDocument(doc);
  }
}

export function processDocument(doc: TextDocument): vscode.SymbolInformation[] {
  try {
    const parsedModule = ModuleParser(doc.getText());

    const moduleTypes = parsedModule.types.map(t => {
      if (t.type === 'custom-type') {
        const constructorDefn = new SymbolInformation(
          t.name, vscode.SymbolKind.Class, parsedModule.name,
          new vscode.Location(doc.uri, new vscode.Position(t.location.line - 1, 0)),
        );

        return t.constructors.map(ctor => {
          return new SymbolInformation(
            ctor.name, vscode.SymbolKind.Class, parsedModule.name,
            new vscode.Location(doc.uri, new vscode.Position(ctor.location.line - 1, 0)),
          );
        }).concat(constructorDefn);
      } else if (t.type === 'type-alias') {
        const typeAliasSymbol = new SymbolInformation(
          t.name, vscode.SymbolKind.Class, parsedModule.name,
          new vscode.Location(doc.uri, new vscode.Position(t.location.line - 1, 0)),
        );

        return [typeAliasSymbol];
      } else {
        const _exhaustiveCheck: never = t;
        return [];
      }
    }).reduce((acc: SymbolInformation[], c: SymbolInformation[]): SymbolInformation[] => acc.concat(c), []);

    const moduleFunctions = parsedModule.functions.map(f => {
      return new SymbolInformation(
        f.name, vscode.SymbolKind.Function, parsedModule.name,
        new vscode.Location(doc.uri, new vscode.Position(f.location.line - 1, 0)),
      );
    });

    const moduleDefn = new SymbolInformation(
      parsedModule.name, vscode.SymbolKind.Module, parsedModule.name,
      new vscode.Location(doc.uri, new vscode.Position(0, 0)),
    );

    const allSymbols = moduleTypes.concat(moduleFunctions).concat(moduleDefn);

    return allSymbols;
  } catch (error) {
    return [];
  }
}
