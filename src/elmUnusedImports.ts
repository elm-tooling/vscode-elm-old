import * as vscode from 'vscode';
import { ModuleParser, Module, ImportStatement } from 'elm-module-parser';
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
      .catch(() => {
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
  const nextNewLineAfterImports = nextNewline(lastImport.location.offset);
  const textAfterImports = moduleText.substr(nextNewLineAfterImports);

  // This is used to lazily execute the regex over the text to find a suitable match
  function* matchesAfterImports(matcherRegex: string): IterableIterator<RegExpExecArray> {
    const matcher = new RegExp(matcherRegex, 'g');

    let match: RegExpExecArray = null;
    while (match = matcher.exec(textAfterImports)) {
      yield match;
    }
  }

  const diagnosticsByImport = await Promise.all(parsedModule.imports.map(async (importDeclaration): Promise<vscode.Diagnostic[]> => {
    const importRange = new vscode.Range(
      document.positionAt(importDeclaration.location.offset),
      document.positionAt(importDeclaration.location.offset));

    const makeDiag = (message: string) => {
      return new vscode.Diagnostic(importRange, message, vscode.DiagnosticSeverity.Information);
    };

    const requiresQualifiedName = importDeclaration.exposing.length === 0;

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

/** No imports specified.Using fully qualified module or alias.
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
  const importsAll = importDeclaration.exposing.find(e => e.type === 'all') != null;

  if (!importsAll) {
    return [];
  }

  const importedModule: Module = await getGlobalModuleResolver().moduleFromName(importDeclaration.module);

  // Since we can't load the module we don't want to say anything about it.
  if (importedModule === null) {
    return [];
  }

  const anyImportedNameIsUsed = (): boolean => {
    for (const exposed of importedModule.exposing) {
      if (exposed.type === 'all') {
        // If all things are exposed then do ANY names appear in this modules?
        for (let n of iterateModuleNames(importedModule)) {
          const nameMatchesIterable = matcher(n);
          const nameMatches = [...nameMatchesIterable];

          if (nameMatches.length > 0) {
            return true;
          }
        }

        return false;
      } else if (exposed.type === 'constructor' || exposed.type === 'function' || exposed.type === 'type') {
        const nameMatchesIterable = matcher(exposed.name);
        const nameMatches = [...nameMatchesIterable];
        return nameMatches.length > 0;
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
 * case result of
 * OkResult thing ->
 * ...
 *
 * foo : Int -> ThatThing
 * foo a = makeThingRequest a
 */
async function pickedImportsDiagnostics(
  importDeclaration: ImportStatement,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): Promise<vscode.Diagnostic[]> {
  for (const pickedImport of importDeclaration.exposing) {
    if (pickedImport.type === 'all') {
      continue;
    } else if (pickedImport.type === 'function' || pickedImport.type === 'constructor' || pickedImport.type === 'type') {
      const nameMatchesIterable = matcher(pickedImport.name);

      let matchFound = false;
      for (const n of nameMatchesIterable) {
        // TODO: verify the match is correct
        matchFound = true;
        break;
      }

      if (!matchFound) {
        return [makeDiagnostic(`${pickedImport.name} is not used.`)];
      }
    } else {
      const _exhaustiveCheck: never = pickedImport;
    }
  }

  return [];
}

function* iterateModuleNames(module: Module) {
  for (let f of module.functions) {
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
