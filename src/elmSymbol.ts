import * as vscode from 'vscode';
import { SymbolInformation, TextDocument } from 'vscode';
import { parseElmModule } from 'elm-module-parser';
import * as _ from 'lodash';

export class ElmSymbolProvider implements vscode.DocumentSymbolProvider {
  public async provideDocumentSymbols(doc: TextDocument) {
    return processDocument(doc);
  }
}

export function processDocument(doc: TextDocument): vscode.SymbolInformation[] {
  try {
    const parsedModule = parseElmModule(doc.getText());

    const moduleTypes = _.flatMap(parsedModule.types
      .map(t => {
        if (t.type === 'custom-type') {
          const constructorDefinition = new SymbolInformation(
            t.name,
            vscode.SymbolKind.Class,
            parsedModule.name,
            new vscode.Location(
              doc.uri,
              doc.positionAt(t.location.start.offset),
            ),
          );

          return t.constructors
            .map(ctor => {
              return new SymbolInformation(
                ctor.name,
                vscode.SymbolKind.Class,
                parsedModule.name,
                new vscode.Location(
                  doc.uri,
                  doc.positionAt(ctor.location.start.offset),
                ),
              );
            })
            .concat(constructorDefinition);
        } else if (t.type === 'type-alias') {
          const typeAliasSymbol = new SymbolInformation(
            t.name,
            vscode.SymbolKind.Class,
            parsedModule.name,
            new vscode.Location(
              doc.uri,
              doc.positionAt(t.location.start.offset),
            ),
          );

          return [typeAliasSymbol];
        } else {
          const _exhaustiveCheck: never = t;
          return [];
        }
      }));

    const moduleFunctions = parsedModule.function_declarations.map(f => {
      return new SymbolInformation(
        f.name,
        vscode.SymbolKind.Function,
        parsedModule.name,
        new vscode.Location(
          doc.uri,
          doc.positionAt(f.location.start.offset),
        ),
      );
    });

    const moduleDefinition = new SymbolInformation(
      parsedModule.name,
      vscode.SymbolKind.Module,
      parsedModule.name,
      new vscode.Location(doc.uri, new vscode.Position(0, 0)),
    );

    const allSymbols = moduleTypes.concat(moduleFunctions).concat(moduleDefinition);

    return allSymbols;
  } catch (error) {
    return [];
  }
}
