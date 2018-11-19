import * as assert from 'assert';
import { Range, SymbolInformation, SymbolKind, workspace } from 'vscode';
import { join as pathJoin } from 'path';
import { ElmSymbolProvider } from '../src/elmSymbol';

/** Basic tests for the ElmSymbolProvider to check it's working
 * and to prevent regressions.
 */
suite('elmSymbol', () => {

  const symbolProvider = new ElmSymbolProvider();

  test('Empty file has no symbols', () => {
    const filePath = pathJoin(__dirname, '../../test/fixtures/src/Empty.elm')
    const expectedSymbols: SymbolInformation[] = []

    return workspace.openTextDocument(filePath)
      .then(doc => symbolProvider.provideDocumentSymbols(doc))
      .then(actualSymbols => assert.deepEqual(actualSymbols, expectedSymbols));
  });

  test('Symbols for document found', async () => {
    const filePath = pathJoin(__dirname, '../../test/fixtures/src/Symbols.elm');

    const expectedSymbols: SymbolInformation[] = [
      new SymbolInformation('Module', SymbolKind.Module,
        new Range(1, 0, 27, 16)),
      new SymbolInformation('TypeAlias', SymbolKind.Class,
        new Range(5, 0, 5, 29)),
      new SymbolInformation('Type', SymbolKind.Class,
        new Range(7, 0, 7, 39)),
      new SymbolInformation('Constructor1', SymbolKind.Constructor,
        new Range(7, 12, 7, 24), undefined, 'Type'),
      new SymbolInformation('Constructor2', SymbolKind.Constructor,
        new Range(7, 27, 7, 39), undefined, 'Type'),
      new SymbolInformation('function', SymbolKind.Variable,
        new Range(10, 0, 10, 22)),
      new SymbolInformation('%%', SymbolKind.Variable,
        new Range(13, 0, 13, 15)),
      new SymbolInformation('somePort', SymbolKind.Interface,
        new Range(17, 0, 17, 33)),
      new SymbolInformation('multiLineFunction', SymbolKind.Variable,
        new Range(20, 0, 27, 16)),
    ];

    const textDocument = await workspace.openTextDocument(filePath);
    const actualSymbols = await symbolProvider.provideDocumentSymbols(textDocument);

    assert.equal(actualSymbols.length, expectedSymbols.length, 'Number of found symbols mismatch');
    assert.equal(actualSymbols.map(x => x.name).sort(), expectedSymbols.map(x => x.name).sort());
  });
});
