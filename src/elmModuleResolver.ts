import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ModuleParser, Module } from 'elm-module-parser';

export class ElmModuleResolver {
  private sourceDirs = null;
  private cache = {};

  public async loadModule(moduleName: string): Promise<Module> {
    if (this.cache[moduleName] != null) {
      return this.cache[moduleName];
    }

    if (this.sourceDirs == null) {
      this.sourceDirs = await this.getSourceDirs();
    }

    const possiblePaths = this.moduleNameToPaths(moduleName);

    for (const modulePath of possiblePaths) {
      const textDocument = await this.openTextDocumentOrNull(modulePath);

      if (textDocument != null) {
        try {
          const parsedModule = ModuleParser(textDocument.getText());

          this.cache[modulePath] = {
            modulePath: modulePath,
            moduleName: moduleName,
            parsed: parsedModule,
          };
          return parsedModule;
        } catch (error) {
          return null;
        }
      }
    }

    return null;
  }

  public async moduleFromPath(modulePath: string): Promise<Module> {
    const textDocument = await this.openTextDocumentOrNull(modulePath);

    if (textDocument != null) {
      try {
        const parsedModule = ModuleParser(textDocument.getText());

        this.cache[modulePath] = {
          modulePath: modulePath,
          moduleName: parsedModule.name,
          parsed: parsedModule,
        };

        return parsedModule;
      } catch (error) {
        return null;
      }
    }
  }

  public invalidatePath(modulePath: string): ElmModuleResolver {
    delete this.cache[modulePath];
    return this;
  }

  public invalidateModule(moduleName: string): ElmModuleResolver {
    for (const modulePath of this.moduleNameToPaths(moduleName)) {
      this.invalidatePath(modulePath);
    }

    return this;
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

  private moduleNameToPaths(moduleName: string): string[] {
    if (this.sourceDirs == null) {
      return [];
    }

    const moduleNameAsPath = moduleName.replace(/[.]/g, path.sep);

    return this.sourceDirs.map(d => path.join(d, moduleNameAsPath));
  }
}

const globalModuleResolver = new ElmModuleResolver();

export function getGlobalModuleResolver(): ElmModuleResolver {
  return globalModuleResolver;
}
