import * as vscode from 'vscode';
import { TextDocument, SymbolInformation } from 'vscode';
import { extractDocumentSymbols } from './elmSymbol';
import { getGlobalModuleResolver } from './elmModuleResolver';

export interface ModuleSymbols {
  modulePath: string;
  moduleName: string;
  symbols: vscode.SymbolInformation[];
}

export class ElmWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider {

  private symbolsByModule: { [moduleName: string]: ModuleSymbols };
  private symbolsByPath: { [modulePath: string]: ModuleSymbols };
  private workspaceIndexTime: Date;

  public constructor(private languagemode: vscode.DocumentFilter) {
    this.symbolsByModule = {};
    this.symbolsByPath = {};
  }

  public async update(document: TextDocument): Promise<void> {
    await this.indexDocument(document);
  }

  public async provideWorkspaceSymbols(query: string, cancelToken: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
    const [sourceModule, symbolName] = query.split(':', 2);

    if (symbolName == null) {
      return this.searchWorkspaceSymbols(sourceModule);
    }

    return this.searchModuleSymbols(sourceModule, symbolName);
  }

  private async searchWorkspaceSymbols(symbol: string): Promise<SymbolInformation[]> {
    if (this.workspaceIndexTime == null) {
      await this.indexWorkspace();
    }

    // When searching entire workspace use a lenient search
    const matchingSymbols = Object.keys(this.symbolsByPath).map((modulePath: string) => {
      const cached = this.symbolsByPath[modulePath];
      return cached.symbols.filter(s => s.name.startsWith(symbol));
    }).reduce((acc, x) => acc.concat(x), []);

    return matchingSymbols;
  }

  private async searchModuleSymbols(moduleName: string, symbol: string): Promise<SymbolInformation[]> {
    const moduleSymbols = this.symbolsByModule[moduleName];

    if (moduleSymbols == null) {
      await this.indexModule(moduleName);
    }

    // When searching by module use exact match
    return this.symbolsByModule[moduleName] == null
      ? []
      : this.symbolsByModule[moduleName].symbols.filter(s => s.name === symbol);
  }

  private async indexWorkspace(): Promise<void> {
    const config = vscode.workspace.getConfiguration('elm');
    const maxFiles = config['maxWorkspaceFilesUsedBySymbols'];
    const excludePattern = config['workspaceFilesExcludePatternUsedBySymbols'];
    const workspaceFiles = await vscode.workspace.findFiles('**/*.elm', excludePattern, maxFiles);

    try {
      await Promise.all(
        workspaceFiles.map(async uri => this.indexDocument(await vscode.workspace.openTextDocument(uri))),
      );

      this.workspaceIndexTime = new Date();
    } catch (error) {
      return;
    }
  }

  private async indexModule(moduleName: string): Promise<void> {
    const modulePath = moduleName.replace(/\./g, '/') + '.elm';
    const matchedFiles = await vscode.workspace.findFiles('**/*/' + modulePath, null, 1);

    if (matchedFiles.length === 1) {
      await this.indexDocument(await vscode.workspace.openTextDocument(matchedFiles[0]));
    }
  }

  private async indexDocument(document: TextDocument): Promise<void> {
    const documentPath = document.fileName;
    getGlobalModuleResolver().invalidatePath(documentPath);

    // Clean up existing index entries for this document
    const existingSymbols = this.symbolsByPath[documentPath];

    if (existingSymbols != null) {
      delete this.symbolsByModule[existingSymbols.moduleName];
    }

    delete this.symbolsByPath[documentPath];

    const newSymbols = await extractDocumentSymbols(document);

    if (newSymbols.length > 0) {
      const moduleName = newSymbols[0].containerName;

      this.symbolsByPath[documentPath] = {
        symbols: newSymbols,
        modulePath: documentPath,
        moduleName: moduleName,
      };

      this.symbolsByModule[moduleName] = this.symbolsByPath[documentPath];
    }
  }
}
