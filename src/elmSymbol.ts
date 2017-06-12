import * as vscode from 'vscode';
import { Position, Range, SymbolInformation, SymbolKind, TextDocument, TextLine } from 'vscode';

export class ElmSymbolProvider implements vscode.DocumentSymbolProvider {

  provideDocumentSymbols = (doc: TextDocument, _) =>
    Promise.resolve(processDocument(doc));
}

export function processDocument(doc: TextDocument) {

  const docRange = doc.validateRange(
    new Range(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))

  return getSymbolsForRange(docRange, /^(?=\S)/m, 0, rootProcessor());

  // -- Helper functions -- //

  /** Tuple type that stores a Range and text associated with that range
   *  Keeping the 2 values avoids having to call doc.getText(range) for the
   *  text each time, and also in a couple of cases they differ.
   */
  type RangeAndText = [Range, string];

  /** Get the symbols in a range */
  function getSymbolsForRange
    (range: Range, splitter: RegExp, splitterLength, subProcessor: RangeProcessor)
    : SymbolInformation[] {
    // get the whole text for the range & split it with the splitter
    const
      text = doc.getText(range),
      texts = text.split(splitter);

    // convert split strings into RangeAndText tuples
    const range_texts: RangeAndText[] = [];
    for (let p = doc.offsetAt(range.start), i = 0; i < texts.length; i++) {
      const
        text = texts[i],
        startPos = doc.positionAt(p),
        endPos = doc.positionAt(p + text.length);
      range_texts.push([new Range(startPos, endPos), text]);
      p += text.length + splitterLength;
    }

    // process these tuples to extract symbols
    const symbols = range_texts
      // concatMap
      .map(range_text => {
        const [range, text] = trimRange(range_text);
        return subProcessor([range, text]);
      })
      .reduce((acc, x) => acc.concat(x), [])

    return symbols
  }

  /** A function that processes a range into a array or zero or more symbols */
  type RangeProcessor = (rt: RangeAndText) => SymbolInformation[];

  /** Takes the first word of the given text as the name and creates a symbol
   *  with the given kind
   */
  function defaultProcessor(kind: SymbolKind): RangeProcessor {
    return function([range, text]: [Range, string]): SymbolInformation[] {
      const
        // this RegExp could be improved
        nameMatch = text.match(/^(([\w']+)|\(.*?\))\s*/),
        name = nameMatch && nameMatch[0];
      // Filter out type annotations too
      if (name && text.substr(name.length).charAt(0) !== ':') {
        return [new SymbolInformation(name.trim(), kind, range, doc.uri)]
      }
      else {
        return []
      }
    }
  }

  /** For ignoring the range eg import, infix, ... */
  function ignoreProcessor(_) {
    return [];
  }

  /** Processes module... statements. Extends the range to the whole document */
  function moduleProcessor([range, text]) {
    return defaultProcessor(SymbolKind.Module)
      ([new Range(range.start, docRange.end), text])
  }

  /** Processor for ranges found at the top level of the document.
   *  Processes according to type of statement
   */
  function rootProcessor(): RangeProcessor {

    const types: [string, RangeProcessor][] = [
      ['module ', moduleProcessor],
      ['type alias ', defaultProcessor(SymbolKind.Class)],
      ['type ', typeProcessor],
      ['port ', defaultProcessor(SymbolKind.Interface)],
      ['import ', ignoreProcessor],
      ['infix ', ignoreProcessor],
      ['infixl ', ignoreProcessor],
      ['infixr ', ignoreProcessor],
      ['', defaultProcessor(SymbolKind.Variable)],
    ];

    return function([range, text]) {
      for (let [prefix, processor] of types) {
        if (text.startsWith(prefix)) {
          return processor([range, text.substr(prefix.length).trim()])
        }
      }
    }
  }

  /** For type ... statements. Splits rest of text by | to create s symbol
   *  for each constructor
   */
  function typeProcessor([range, text]: RangeAndText) {
    const
      symbols = defaultProcessor(SymbolKind.Class)([range, text]),
      allText = doc.getText(range),
      equalPos = allText.indexOf('='),
      childrenStart = doc.positionAt(doc.offsetAt(range.start) + equalPos + 1);

    if (equalPos > -1) {
      const constructorSymbols = getSymbolsForRange(
        new Range(childrenStart, range.end),
        /\|/, 1, defaultProcessor(SymbolKind.Constructor))
      constructorSymbols.forEach(s => s.containerName = symbols[0].name)

      return symbols.concat(constructorSymbols)
    }
    else {
      return symbols
    }
  }

  /** Strip whitespace and comments from start & end of range */
  function trimRange([range, text]: RangeAndText): RangeAndText {
    let startOffset = doc.offsetAt(range.start) + text.length;
    text = text.replace(/^(\s*((--.*)|({-[\s\S]*?-})))*\s*/, "");
    startOffset -= text.length;

    let endOffset = doc.offsetAt(range.end) - text.length;
    text = text.replace(/\s+$/, "");
    endOffset += text.length

    return [
      new Range(doc.positionAt(startOffset), doc.positionAt(endOffset)),
      text
    ];
  }
}