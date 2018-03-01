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

const hasDefinition = function (line: TextLine): boolean {
  return !line.isEmptyOrWhitespace
    && line.text.indexOf(' ')
    && !line.text.startsWith('module ')
    && !line.text.startsWith('import ')
    && !line.text.startsWith('type ');
};

const firstSymbol = function (line: TextLine): string {
  return line.text.substring(0, line.text.indexOf(' '));
};

const findDefinitions = function (document: TextDocument): Map<string, number> {
  const definitions: Map<string, number> = new Map();
  let line: TextLine;
  let symbol: string;

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
    line = document.lineAt(lineNumber);

    if (hasDefinition(line)) {
      symbol = firstSymbol(line);
      if (!definitions.has(symbol)) {
        definitions.set(symbol, lineNumber);
      }
    }
  }

  return definitions;
};

export class ElmFunctionHeaderProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {

    const exposed: string[] = [];
    const definitions: Map<string, number> = findDefinitions(document);

    return Array.from(definitions.entries()).reduce((list, lineNumber) => {

      let position = new Position(lineNumber['1'], 0);
      let range = new Range(position, position);

      return list.concat([new CodeLens(range, {
        command: '',
        title: printReferences(0),
      }), new CodeLens(range, {
        command: '',
        title: printExposure(exposed.indexOf(lineNumber['0']) !== -1),
      })]);
    }, []);
  }

  resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
    return codeLens;
  }
}
