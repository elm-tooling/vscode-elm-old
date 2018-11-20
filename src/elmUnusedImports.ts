import * as vscode from 'vscode';
import { Module, ModuleImport, CustomTypeDeclaration } from 'elm-module-parser';
import * as _ from 'lodash';
import { locationToRange } from './elmUtils';
import { getGlobalProjectManager } from './elmProjectManager';
import { ElmProjectDefinition } from '../node_modules/elm-project-inspect/dist';

let unusedImportDiagnostics: vscode.DiagnosticCollection = null;

export function activateUnusedImportsDiagnostics() {
  if (!_.isNil(unusedImportDiagnostics)) {
    return;
  }

  unusedImportDiagnostics = vscode.languages.createDiagnosticCollection(
    'elm-unused-imports',
  );

  const isEnabled = (): boolean =>
    vscode.workspace.getConfiguration('elm').get('enableUnusedImports', true);

  vscode.workspace.onDidChangeConfiguration(() => {
    if (!isEnabled()) {
      unusedImportDiagnostics.clear();
    }
  });

  const checkUnusedImportsIfEnabled = (document: vscode.TextDocument) => {
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
  };

  vscode.workspace.onDidOpenTextDocument(checkUnusedImportsIfEnabled);

  vscode.workspace.onDidSaveTextDocument(checkUnusedImportsIfEnabled);
}

export async function detectUnusedImports(
  document: vscode.TextDocument,
): Promise<vscode.Diagnostic[]> {
  const modulePath = document.fileName;

  const projectManager = getGlobalProjectManager();

  const parsedModule: Module = await projectManager.moduleFromPath(modulePath);
  const elmProject = await projectManager.projectDefinitionForPath(modulePath);

  if (_.isNil(parsedModule) || _.isNil(elmProject)) {
    return [];
  }

  const explicitImports = parsedModule.imports.filter(x => x.type === 'import');

  if (_.isEmpty(explicitImports)) {
    return [];
  }

  const moduleText = document.getText();
  const lastImport = explicitImports[explicitImports.length - 1];
  const nextNewline = (offset: number) => moduleText.indexOf('\n', offset);
  const offsetAfterImports = nextNewline(lastImport.location.end.offset);
  const textAfterImports = moduleText.substr(offsetAfterImports);

  // This is used to lazily execute the regex over the text to find a suitable match
  function* matchesAfterImports(
    matcherRegex: string,
  ): IterableIterator<RegExpExecArray> {
    const matcher = new RegExp(matcherRegex, 'g');

    let match: RegExpExecArray = null;
    while ((match = matcher.exec(textAfterImports))) {
      yield match;
    }
  }

  const diagnosticsByImport = await Promise.all(
    explicitImports.map(
      async (importDeclaration): Promise<vscode.Diagnostic[]> => {
        const importRange = locationToRange(importDeclaration.location);

        const makeDiag = (message: string, range?: vscode.Range) => {
          const diagnostic = new vscode.Diagnostic(
            range || importRange,
            `Elm Unused Imports: ${message}`,
            vscode.DiagnosticSeverity.Hint,
          );

          diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];

          return diagnostic;
        };

        const makeDiagHighlight = (message: string, highlightRegex: RegExp) => {
          const importText = document.getText(importRange);
          const matches = importText.match(highlightRegex);

          if (!_.isNil(matches)) {
            const matchStart =
              importDeclaration.location.start.offset + matches.index;
            const matchEnd = matchStart + matches[0].length;

            return new vscode.Diagnostic(
              new vscode.Range(
                document.positionAt(matchStart),
                document.positionAt(matchEnd),
              ),
              message,
              vscode.DiagnosticSeverity.Information,
            );
          }

          return null;
        };

        const requiresQualifiedName =
          !importDeclaration.exposes_all &&
          _.isEmpty(importDeclaration.exposing);

        if (requiresQualifiedName) {
          return qualifiedNameDiagnostics(
            importDeclaration,
            matchesAfterImports,
            makeDiag,
          );
        }

        const aliasDiag = aliasDiagnostics(
          importDeclaration,
          matchesAfterImports,
          makeDiagHighlight,
        );

        const pickedImportDiag = await pickedImportsDiagnostics(
          elmProject,
          importDeclaration,
          matchesAfterImports,
          makeDiag,
        );

        const importsAllDiag = await importAllDiagnostics(
          elmProject,
          importDeclaration,
          matchesAfterImports,
          makeDiag,
        );

        return _.concat(aliasDiag, pickedImportDiag, importsAllDiag);
      },
    ),
  );

  return _.flatten(diagnosticsByImport);
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
function qualifiedNameDiagnostics(
  importDeclaration: ModuleImport,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): vscode.Diagnostic[] {
  const identifierToSearch =
    importDeclaration.alias || importDeclaration.module;

  const matchesIterable = matcher(
    `[^.\\w](${escapeDots(identifierToSearch)}[.]\\w)`,
  );

  for (const m of matchesIterable) {
    // test if the match is legitimate
    return [];
  }

  return [makeDiagnostic(`${importDeclaration.module} is not used.`)];
}

/**
 * import List.Extra as LE
 * LE.last[1, 2, 3]
 *
 */
function aliasDiagnostics(
  importDeclaration: ModuleImport,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (
    message: string,
    highlightRegex: RegExp,
  ) => vscode.Diagnostic,
): vscode.Diagnostic[] {
  if (_.isNil(importDeclaration.alias)) {
    return [];
  }

  const aliasMatchesIterable = matcher(
    `[^.\\w](${importDeclaration.alias})[.]`,
  );

  for (const m of aliasMatchesIterable) {
    // test if the match is legitimate
    return [];
  }

  return [
    makeDiagnostic(
      `Alias ${importDeclaration.alias} is not used.`,
      new RegExp(`\\sas ${importDeclaration.alias}`),
    ),
  ];
}

/** Imports all from module.
 *
 * import List.Extra exposing (..)
 * last [ 1, 2, 3 ]
 */
async function importAllDiagnostics(
  elmProject: ElmProjectDefinition,
  importDeclaration: ModuleImport,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string) => vscode.Diagnostic,
): Promise<vscode.Diagnostic[]> {
  if (!importDeclaration.exposes_all) {
    return [];
  }

  const importedModule: Module = await getGlobalProjectManager().moduleFromName(
    elmProject.path,
    importDeclaration.module,
  );

  // Since we can't load the module we don't want to say anything about it.
  if (_.isNil(importedModule)) {
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
        const referencedCustomType = importedModule.types.find(
          x => x.type === 'custom-type' && x.name === exposed.name,
        ) as CustomTypeDeclaration;

        if (_.isNil(referencedCustomType)) {
          continue;
        }

        const constructorNames = referencedCustomType.constructors.map(
          c => c.name,
        );

        if (nameMatchExists(constructorNames, matcher)) {
          return true;
        }
      } else {
        const _exhaustiveCheck: never = exposed.type;
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
  elmProject: ElmProjectDefinition,
  importDeclaration: ModuleImport,
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
  makeDiagnostic: (message: string, range: vscode.Range) => vscode.Diagnostic,
): Promise<vscode.Diagnostic[]> {
  const results = await Promise.all(
    importDeclaration.exposing.map(async pickedImport => {
      if (pickedImport.type === 'function' || pickedImport.type === 'type') {
        if (nameMatchExists([pickedImport.name], matcher)) {
          return null;
        }

        const message = `Exposed ${pickedImport.type} ${
          pickedImport.name
        } from module ${importDeclaration.module} is not used.`;

        return makeDiagnostic(message, locationToRange(pickedImport.location));
      } else if (pickedImport.type === 'constructor') {
        const referencedModule = await getGlobalProjectManager().moduleFromName(
          elmProject.path,
          importDeclaration.module,
        );

        // Can't check what we can't load.
        if (_.isNil(referencedModule)) {
          return null;
        }

        const referencedCustomType = referencedModule.types.find(
          x => x.type === 'custom-type' && x.name === pickedImport.name,
        ) as CustomTypeDeclaration;

        // Don't bother checking if it's exposed from the other module because it will manifest itself as a compile error.
        if (_.isNil(referencedCustomType)) {
          return null;
        }

        const constructorNames = referencedCustomType.constructors
          .map(c => c.name)
          .concat([referencedCustomType.name]);

        if (nameMatchExists(constructorNames, matcher)) {
          return null;
        }

        const message = `Custom type ${pickedImport.name} from ${
          importDeclaration.module
        } is not used.`;

        return makeDiagnostic(message, locationToRange(pickedImport.location));
      } else {
        const _exhaustiveCheck: never = pickedImport.type;
        return null;
      }
    }),
  );

  const diagnostics = results.filter(x => !_.isNil(x));

  if (
    !_.isEmpty(importDeclaration.exposing) &&
    importDeclaration.exposing.length === diagnostics.length
  ) {
    // Perhaps the module isn't being used at all
    const qualifiedNameDiagnostic = qualifiedNameDiagnostics(
      importDeclaration,
      matcher,
      msg => makeDiagnostic(msg, null),
    );

    return diagnostics.concat(qualifiedNameDiagnostic);
  }

  return diagnostics;
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

function nameMatchExists(
  names: string[],
  matcher: (regex: string) => IterableIterator<RegExpExecArray>,
) {
  const matchIterator = matcher(
    `.\\b(${names.map(escapeDots).join('|')})\\b[\\s\\S]?`,
  );

  for (const [match] of matchIterator) {
    if (match.startsWith('.') || match.endsWith('.')) {
      continue;
    }

    return true;
  }

  return false;
}
