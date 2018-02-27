import {
  CodeLensProvider,
  CancellationToken,
  TextDocument,
  CodeLens,
  Range,
  Position,
  Command,
  TextLine,
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

const isDefinition = function (line: TextLine): boolean {
  return !line.isEmptyOrWhitespace
    && line.text.indexOf(' ')
    && !line.text.startsWith('module ')
    && !line.text.startsWith('import ')
    && !line.text.startsWith('type ');
};

const firstSymbol = function (line: TextLine): string {
  return line.text.substring(0, line.text.indexOf(' '));
};

export class ElmFunctionHeaderProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {

    const exposed: string[] = [];
    const definitions: Map<string, number> = new Map();
    let line: TextLine;
    let symbol: string;

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      line = document.lineAt(lineNumber);

      if (isDefinition(line)) {
        symbol = firstSymbol(line);
        if (!definitions.has(symbol)) {
          definitions.set(symbol, lineNumber);
        }
      }
    }

    return Array.from(definitions.entries()).reduce((list, position) =>
      list.concat([new CodeLens(new Range(new Position(position['1'], 0), new Position(position['1'], 0)), {
        command: '',
        title: printReferences(0),
      }), new CodeLens(new Range(new Position(position['1'], 0), new Position(position['1'], 0)), {
        command: '',
        title: printExposure(false),
      })]), []);
  }

  resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
    return codeLens;
  }
}
