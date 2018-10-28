import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ModuleParser, Module } from 'elm-module-parser';

class ModuleResolver {
  private sourceDirs = null;
  private cache = {};

  public async loadModule(moduleName: string): Promise<Module> {
    if (this.cache[moduleName] != null) {
      return this.cache[moduleName];
    }

    if (this.sourceDirs == null) {
      this.sourceDirs = await this.getSourceDirs();
    }

    const moduleNameAsPath = moduleName.replace(/[.]/g, path.sep);

    for (const d of this.sourceDirs) {
      const textDocument = await this.openTextDocumentOrNull(path.join(d, `${moduleNameAsPath}.elm`));

      if (textDocument != null) {
        try {
          const parsedModule = ModuleParser(textDocument.getText());
          this.cache[moduleName] = parsedModule;
          return parsedModule;
        } catch (error) {
          return null;
        }
      }
    }

    return null;
  }

  private async openTextDocumentOrNull(documentPath: string): Promise<vscode.TextDocument> {
    try {
      return await vscode.workspace.openTextDocument(documentPath);
    } catch (error) {
      return null;
    }
  }

  private async getSourceDirs(): Promise<string[]> {
    // vscode.workspace.getConfiguration('elm').workspaceConfig['useWorkSpaceRootForElmRoot']

    const workingDir = vscode.workspace.rootPath;

    const readFile = (fileName: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        fs.readFile(fileName, (err, data) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(data.toString('utf-8'));
          }
        });
      });
    };

    const loadElmProjectOrNull = async (projectFilePath: string): Promise<any> => {
      try {
        return JSON.parse(await readFile(projectFilePath));
      } catch (error) {
        return null;
      }
    };

    const elm18Package = path.join(workingDir, 'elm-package.json');
    const elm19Package = path.join(workingDir, 'elm.json');

    const elmProject = await loadElmProjectOrNull(elm19Package) || await loadElmProjectOrNull(elm18Package);

    if (elmProject == null) {
      return [workingDir];
    } else {
      const sourceDirs: string[] = elmProject['source-directories'];
      return sourceDirs.map(d => path.join(workingDir, d));
    }
  }
}

const moduleResolver = new ModuleResolver();

export async function detectUnusedImports(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
  const moduleText = document.getText();
  const parsedModule = ModuleParser(moduleText);

  const lastImport = parsedModule.imports[parsedModule.imports.length - 1];
  const nextNewline = (offset: number) => moduleText.indexOf('\n', offset);
  const nextNewLineAfterImports = nextNewline(lastImport.location.offset);
  const nameAppearsAfterImports = (name: string): boolean => {
    return moduleText.includes(name, nextNewLineAfterImports);
  };

  const unusedImportDiagnostics = await Promise.all(parsedModule.imports.map(async (importDeclaration): Promise<vscode.Diagnostic[]> => {
    const importRange = new vscode.Range(
      document.positionAt(importDeclaration.location.offset),
      document.positionAt(importDeclaration.location.offset));

    const importDiag = (message: string) => {
      return new vscode.Diagnostic(importRange, message, vscode.DiagnosticSeverity.Information);
    };

    /* No imports specified. Using fully qualified module or alias.
     *
     * import List.Extra
     * List.Extra.last [ 1, 2, 3 ]
     *
     * import List.Extra as LE
     * LE.last [ 1, 2, 3]
     */
    const requiresQualifiedName = importDeclaration.exposing.length === 0;

    if (requiresQualifiedName) {
      if (nameAppearsAfterImports(`${importDeclaration.alias || importDeclaration.module}.`)) {
        return [];
      }

      return [
        importDiag(`${importDeclaration.module} is not used.`),
      ];
    }

    if (importDeclaration.alias != null) {
      if (nameAppearsAfterImports(`${importDeclaration.alias}.`)) {
        return [];
      }

      return [
        importDiag(`Alias ${importDeclaration.alias} is not used.`),
      ];
    }

    /* Imports specific functions or Types
     *
     * import Modules.Api exposing (makeThingRequest, GetThingResult(..), ThatThing)
     * case result of
     * OkResult thing ->
     * ...
     *
     * foo : Int -> ThatThing
     * foo a = makeThingRequest a
     */
    const pickedImports = importDeclaration.exposing.find(e => e.type !== 'all') != null;

    if (pickedImports) {
      return importDeclaration.exposing.map(pickedImport => {
        if (pickedImport.type === 'all') {
          return null;
        } else if (pickedImport.type === 'function' || pickedImport.type === 'constructor' || pickedImport.type === 'type') {
          if (nameAppearsAfterImports(pickedImport.name)) {
            return null;
          }

          return importDiag(`${pickedImport.name} is not used.`);
        } else {
          const _exhaustiveCheck: never = pickedImport;
        }
      }).filter(x => x != null);
    }

    /* Imports all from module.
     *
     * import List.Extra exposing (..)
     * last [ 1, 2, 3 ]
     */
    const importsAll = importDeclaration.exposing.find(e => e.type === 'all') != null;

    if (importsAll) {
      const getImportsAllDiagnostics = async (): Promise<vscode.Diagnostic[]> => {
        const importedModule: Module = await moduleResolver.loadModule(importDeclaration.module);

        // Since we can't load the module we don't want to say anything about it.
        if (importedModule === null) {
          return [];
        }

        const anyImportedNameIsUsed = (): boolean => {
          for (const exposed of importedModule.exposing) {
            if (exposed.type === 'all') {
              // If all things are exposed then do ANY names appear in this modules?
              for (let n of iterateModuleNames(importedModule)) {
                if (nameAppearsAfterImports(n)) {
                  return true;
                }
              }

              return false;
            } else if (exposed.type === 'constructor' || exposed.type === 'function' || exposed.type === 'type') {
              return nameAppearsAfterImports(exposed.name);
            } else {
              const _exhaustiveCheck: never = exposed;
            }
          }

          return false;
        };

        if (anyImportedNameIsUsed()) {
          return [];
        }

        return [
          importDiag(`${importDeclaration.module} is not used.`),
        ];
      };

      return getImportsAllDiagnostics();
    }

    return [];
  }));

  return unusedImportDiagnostics.reduce((acc, x) => acc.concat(x), []);
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
