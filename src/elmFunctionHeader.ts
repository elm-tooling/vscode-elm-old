import {
  CodeLensProvider,
  CancellationToken,
  TextDocument,
  CodeLens,
} from 'vscode';

//
// Module List exposing (map)
//
//
// 0 references | exposed
// map : (a -> b) -> List a -> List b
// map op list =
//     case list of
//         [] ->
//             []
//         head :: tail ->
//             op head :: map op tail
//

const printReferences = function (count: number): string {
  return `${count} reference${Math.abs(count) === 1 ? '' : 's'}`;
};

const printExposure = function (exposed: boolean): string {
  return exposed ? 'exposed' : 'hidden';
};

export class ElmFunctionHeaderProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
    throw new Error('Method not implemented.');
  }
  resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
    throw new Error('Method not implemented.');
  }
}