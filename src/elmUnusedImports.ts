import * as vscode from 'vscode';
import { ModuleParser, Module, ImportStatement, CustomTypeDeclaration, Exposed, Location } from 'elm-module-parser';
import { getGlobalModuleResolver } from './elmModuleResolver';

let unusedImportDiagnostics: vscode.DiagnosticCollection = null;

export function activateUnusedImportsDiagnostics() {
  if (unusedImportDiagnostics != null) {
    return;
  }

  unusedImportDiagnostics = vscode.languages.createDiagnosticCollection('elm');

  const isEnabled = (): boolean => vscode.workspace.getConfiguration('elm').get('enableUnusedImports', true);

  vscode.workspace.onDidChangeConfiguration(() => {
    if (!isEnabled()) {
      unusedImportDiagnostics.clear();
    }
  });

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    if (!isEnabled()) {
      return;
    }

    detectUnusedImports(document)
      .then(unusedImports => {
        unusedImportDiagnostics.set(document.uri, unusedImports);
      })
      .catch(error => {
        unusedImportDiagnostics.set(document.uri, undefined);
      });
  });
}

export async function detectUnusedImports(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
  const parsedModule: Module = await getGlobalModuleResolver().moduleFromPath(document.fileName);

  if (parsedModule == null) {
    return [];
  }

  const moduleText = document.getText();

  const lastImport = parsedModule.imports[parsedModule.imports.length - 1];
  const nextNewline = (offset: number) => moduleText.indexOf('\n', offset);
  const offsetAfterImports = nextNewline(lastImport.location.end.offset);
  const textAfterImports = moduleText.substr(offsetAfterImports);

  // This is used to lazily execute the regex over the text to find a suitable match
  function* matchesAfterImports(matcherRegex: string): IterableIterator<RegExpExecArray> {
    const matcher = new RegExp(matcherRegex, 'g');

    let match: RegExpExecArray = null;
    while (match = matcher.exec(textAfterImports)) {
      yield match;
    }
  }

  const diagnosticsByImport = await Promise.all(parsedModule.imports.map(async (importDeclaration): Promise<vscode.Diagnostic[]> => {
    const importRange = locationToRange(importDeclaration.location);

    const makeDiag = (message: string, range?: vscode.Range) => {
      return new vscode.Diagnostic(range || importRange, message, vscode.DiagnosticSeverity.Information);
    };

    const requiresQualifiedName = !importDeclaration.exposes_all && importDeclaration.exposing.length === 0;

    if (requiresQualifiedName) {
      return qualifiedNameRequiredDiagnostics(importDeclaration, matchesAfterImports, makeDiag);
    }

    const aliasDiag = aliasDiagnostics(importDeclaration, matchesAfterImports, makeDiag);

    const pickedImportDiag = await pickedImportsDiagnostics(importDeclaration, matchesAfterImports, makeDiag);

    const importsAllDiag = await importAllDiagnostics(importDeclaration, matchesAfterImports, makeDiag);

    return aliasDiag.concat(pickedImportDiag).concat(importsAllDiag);
  }));

  return diagnosticsByImport.reduce((acc, x) => acc.concat(x), []);
}

/**No items exposed from referenced module.
 *
 * Requires alias or fully qualified module name usage.
 *
 * import List.Extra
 * List.Extra.last[1, 2, 3]
 *
 * import List.Extra as LE
 * LE.last[1, 2, 3]
 *
 */
function qualifiedNameRequiredDiagnostics(
  importDeclaration: ImportStatement,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): vscode.Diagnostic[] {
  const identifierToSearch = importDeclaration.alias || importDeclaration.module;

  const matchesIterable = matcher(
    `[^.\\w](${escapeDots(identifierToSearch)}[.]\\w)`);

  for (const m of matchesIterable) {
    // test if the match is legitimate
    return [];
  }

  return [makeDiagnostic(`${identifierToSearch} is not used.`)];
}

/**
 * import List.Extra as LE
 * LE.last[1, 2, 3]
 *
 */
function aliasDiagnostics(
  importDeclaration: ImportStatement,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): vscode.Diagnostic[] {
  if (importDeclaration.alias == null) {
    return [];
  }

  const aliasMatchesIterable = matcher(
    `[^.\\w](${importDeclaration.alias})[.]`);

  for (const m of aliasMatchesIterable) {
    // test if the match is legitimate
    return [];
  }

  return [makeDiagnostic(`Alias ${importDeclaration.alias} is not used.`)];
}

/** Imports all from module.
 *
 * import List.Extra exposing (..)
 * last [ 1, 2, 3 ]
 */
async function importAllDiagnostics(
  importDeclaration: ImportStatement,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): Promise<vscode.Diagnostic[]> {
  if (!importDeclaration.exposes_all) {
    return [];
  }

  const importedModule: Module = await getGlobalModuleResolver().moduleFromName(importDeclaration.module);

  // Since we can't load the module we don't want to say anything about it.
  if (importedModule == null) {
    return [];
  }

  const anyImportedNameIsUsed = (): boolean => {
    if (importedModule.exposes_all) {
      // If all things are exposed then do ANY names appear in this modules?
      for (let n of iterateModuleNames(importedModule)) {
        if (nameMatchExists([n], matcher)) {
          return true;
        }
      }

      return false;
    }

    for (const exposed of importedModule.exposing) {
      if (exposed.type === 'function' || exposed.type === 'type') {
        if (nameMatchExists([exposed.name], matcher)) {
          return true;
        }
      } else if (exposed.type === 'constructor') {
        const referencedCustomType =
          importedModule.types.find(x => x.type === 'custom-type' && x.name === exposed.name) as CustomTypeDeclaration;

        if (referencedCustomType == null) {
          continue;
        }

        const constructorNames = referencedCustomType.constructors.map(c => c.name);

        if (nameMatchExists(constructorNames, matcher)) {
          return true;
        }
      } else {
        const _exhaustiveCheck: never = exposed;
      }
    }

    return false;
  };

  if (!anyImportedNameIsUsed()) {
    return [makeDiagnostic(`${importDeclaration.module} is not used.`)];
  }

  return [];
}

/**Imports specific functions or types
 *
 * import Modules.Api exposing (makeThingRequest, GetThingResult(..), ThatThing)
 *
 */
async function pickedImportsDiagnostics(
  importDeclaration: ImportStatement,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string, range: vscode.Range) => vscode.Diagnostic,
): Promise<vscode.Diagnostic[]> {
  const results = await Promise.all(importDeclaration.exposing.map(async pickedImport => {
    if (pickedImport.type === 'function' || pickedImport.type === 'type') {
      if (nameMatchExists([pickedImport.name], matcher)) {
        return null;
      }

      const message = `Exposed ${pickedImport.type} ${pickedImport.name} from module ${importDeclaration.module} is not used.`;

      return makeDiagnostic(message, locationToRange(pickedImport.location));
    } else if (pickedImport.type === 'constructor') {
      const referencedModule = await getGlobalModuleResolver().moduleFromName(importDeclaration.module);

      // Can't check what we can't load.
      if (referencedModule == null) {
        return null;
      }

      const referencedCustomType =
        referencedModule.types.find(x => x.type === 'custom-type' && x.name === pickedImport.name) as CustomTypeDeclaration;

      // Don't bother checking if it's exposed from the other module because it will manifest itself as a compile error.
      if (referencedCustomType == null) {
        return null;
      }

      const constructorNames = referencedCustomType.constructors.map(c => c.name);

      if (nameMatchExists(constructorNames, matcher)) {
        return null;
      }

      const message = `No constructors for ${pickedImport.name} from ${importDeclaration.module} are being used.`;

      return makeDiagnostic(message, locationToRange(pickedImport.location));
    } else {
      const _exhaustiveCheck: never = pickedImport;
      return null;
    }
  }));

  return results.filter(x => x != null);
}

function* iterateModuleNames(module: Module) {
  for (let f of module.function_declarations) {
    yield f.name;
  }

  for (let t of module.types) {
    if (t.type === 'custom-type') {
      yield t.name;

      for (let c of t.constructors) {
        yield c.name;
      }
    } else if (t.type === 'type-alias') {
      yield t.name;
    } else {
      const _exhaustiveCheck: never = t;
    }
  }
}

function escapeDots(value: string) {
  return value.replace(/[.]/g, '[.]');
}

function nameMatchExists(names: string[], matcher: (regex: string) => IterableIterator<RegExpExecArray>) {
  const matchIterator = matcher(`.\\b(${names.join('|')})\\b[\\s\\S]?`);

  for (const [match] of matchIterator) {
    if (match.startsWith('.') || match.endsWith('.')) {
      continue;
    }

    return true;
  }

  return false;
}

function locationToRange(location: Location): vscode.Range {
  return new vscode.Range(
    location.start.line - 1, location.start.column - 1,
    location.end.line - 1, location.end.column - 1,
  );
}
