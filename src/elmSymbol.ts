import * as vscode from 'vscode';
import { SymbolInformation, TextDocument } from 'vscode';
import { getGlobalModuleResolver } from './elmModuleResolver';
import { Location } from 'elm-module-parser';
import * as _ from 'lodash';

export class ElmSymbolProvider implements vscode.DocumentSymbolProvider {
  public async provideDocumentSymbols(doc: TextDocument): Promise<vscode.SymbolInformation[]> {
    return extractDocumentSymbols(doc);
  }
}

function locationToRange(location: Location): vscode.Range {
  return new vscode.Range(
    location.start.line - 1, location.start.column - 1,
    location.end.line - 1, location.end.column - 1,
  );
}

export async function extractDocumentSymbols(
  doc: TextDocument,
): Promise<vscode.SymbolInformation[]> {
  try {
    const parsedModule = await getGlobalModuleResolver().moduleFromPath(
      doc.fileName,
    );

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
