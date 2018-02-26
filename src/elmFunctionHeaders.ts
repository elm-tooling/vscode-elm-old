import {
  CodeLensProvider,
  CancellationToken,
  TextDocument,
  CodeLens,
} from 'vscode';

export class ElmFunctionHeaderProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
    throw new Error('Method not implemented.');
  }
  resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
    throw new Error('Method not implemented.');
  }
}
