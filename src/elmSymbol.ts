import * as vscode from 'vscode';
import { SymbolInformation, TextDocument, DocumentSymbol } from 'vscode';
import { parseElmModule, Location } from 'elm-module-parser';
import * as _ from 'lodash';

export class ElmSymbolProvider implements vscode.DocumentSymbolProvider {
  public async provideDocumentSymbols(doc: TextDocument): Promise<DocumentSymbol[]> {
    return getDocumentSymbols(doc);
  }
}

function locationToRange(location: Location): vscode.Range {
  return new vscode.Range(
    location.start.line - 1, location.start.column - 1,
    location.end.line - 1, location.end.column - 1,
  );
}

export function processDocument(doc: TextDocument): SymbolInformation[] {
  try {
    const parsedModule = parseElmModule(doc.getText());

    const moduleTypes = _.flatMap(
      parsedModule.types.map(t => {
        if (t.type === 'custom-type') {
          const constructorDefinition = new SymbolInformation(
            t.name,
            vscode.SymbolKind.Class,
            parsedModule.name,
            new vscode.Location(
              doc.uri,
              locationToRange(t.location),
            ),
          );

          return t.constructors
            .map(ctor => {
              return new SymbolInformation(
                ctor.name,
                vscode.SymbolKind.Constructor,
                parsedModule.name,
                new vscode.Location(
                  doc.uri,
                  locationToRange(ctor.location),
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
              locationToRange(t.location),
            ),
          );

          return [typeAliasSymbol];
        } else {
          const _exhaustiveCheck: never = t;
          return [];
        }
      }),
    );

    const moduleFunctions = parsedModule.function_declarations.map(f => {
      return new SymbolInformation(
        f.name,
        vscode.SymbolKind.Variable,
        parsedModule.name,
        new vscode.Location(
          doc.uri,
          locationToRange(f.location),
        ),
      );
    });

    const portAnnotations = parsedModule.port_annotations.map(p => {
      return new SymbolInformation(
        p.name,
        vscode.SymbolKind.Interface,
        parsedModule.name,
        new vscode.Location(
          doc.uri,
          locationToRange(p.location),
        ),
      );
    });

    const moduleDefinition = new SymbolInformation(
      parsedModule.name,
      vscode.SymbolKind.Module,
      parsedModule.name,
      new vscode.Location(
        doc.uri,
        locationToRange(parsedModule.location),
      ),
    );

    const allSymbols = _.concat(moduleDefinition, moduleTypes, moduleFunctions, portAnnotations);

    return allSymbols;
  } catch (error) {
    return [];
  }
}


export function getDocumentSymbols(doc: TextDocument): DocumentSymbol[] {
  try {
    const parsedModule = parseElmModule(doc.getText());

    const moduleTypes =
      parsedModule.types.map(t => {
        if (t.type === 'custom-type') {
          const customTypeSymbol = new DocumentSymbol(
            t.name,
            "",
            vscode.SymbolKind.Class,
            locationToRange(t.location),
            locationToRange(t.location)
          );

          const ctorSymbols = t.constructors
            .map(ctor =>
              new DocumentSymbol(
                ctor.name,
                "",
                vscode.SymbolKind.Constructor,
                locationToRange(ctor.location),
                locationToRange(ctor.location)
              )
            );

          customTypeSymbol.children = ctorSymbols;
          return customTypeSymbol;

        } else if (t.type === 'type-alias') {
          const typeAliasSymbol = new DocumentSymbol(
            t.name,
            "",
            vscode.SymbolKind.Class,
            locationToRange(t.location),
            locationToRange(t.location),
          );

          return typeAliasSymbol;

        } else {
          return null;
        }
      });


    const moduleFunctions = parsedModule.function_declarations.map(f => {
      return new DocumentSymbol(
        f.name,
        "",
        vscode.SymbolKind.Variable,
        locationToRange(f.location),
        locationToRange(f.location),
      );
    });

    const portAnnotations = parsedModule.port_annotations.map(p => {
      return new DocumentSymbol(
        p.name,
        "",
        vscode.SymbolKind.Interface,
        locationToRange(p.location),
        locationToRange(p.location)
      );
    });

    const moduleDefinition = new DocumentSymbol(
      parsedModule.name,
      "",
      vscode.SymbolKind.Module,
      locationToRange(parsedModule.location),
      locationToRange(parsedModule.location)
    );

    const allSymbols = _.concat(moduleDefinition, moduleTypes, moduleFunctions, portAnnotations);

    return allSymbols;
  } catch (error) {
    return [];
  }
}
