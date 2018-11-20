import * as assert from 'assert';
import * as path from 'path';
import { Range, SymbolInformation, SymbolKind, workspace } from 'vscode';
import { ElmSymbolProvider } from '../src/elmSymbol';
import * as _ from 'lodash';

suite('elmSymbol', () => {
  const symbolProvider = new ElmSymbolProvider();

  test('Empty file has no symbols', async () => {
    const filePath = path.join(__dirname, '../../test/fixtures/src/Empty.elm');

    const textDocument = await workspace.openTextDocument(filePath);
    const actualSymbols = await symbolProvider.provideDocumentSymbols(
      textDocument,
    );

    assert.deepEqual(actualSymbols, []);
  });

  test('Symbols for document found', async () => {
    const filePath = path.join(
      __dirname,
      '../../test/fixtures/src/Symbols.elm',
    );
    const textDocument = await workspace.openTextDocument(filePath);

    const expectedSymbols: SymbolInformation[] = [
      new SymbolInformation(
        'Full.Module.Name',
        SymbolKind.Module,
        new Range(1, 7, 1, 23),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'TypeAlias',
        SymbolKind.Class,
        new Range(5, 11, 5, 20),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'Type',
        SymbolKind.Class,
        new Range(7, 5, 7, 9),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'Constructor1',
        SymbolKind.Constructor,
        new Range(7, 12, 7, 24),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'Constructor2',
        SymbolKind.Constructor,
        new Range(7, 27, 7, 39),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'function',
        SymbolKind.Variable,
        new Range(10, 0, 10, 8),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        '%%',
        SymbolKind.Variable,
        new Range(13, 0, 13, 4),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'somePort',
        SymbolKind.Interface,
        new Range(16, 5, 16, 13),
        textDocument.uri,
        'Full.Module.Name',
      ),

      new SymbolInformation(
        'multiLineFunction',
        SymbolKind.Variable,
        new Range(20, 0, 20, 17),
        textDocument.uri,
        'Full.Module.Name',
      ),
    ];

    const actualSymbols = await symbolProvider.provideDocumentSymbols(
      textDocument,
    );

    assert.deepEqual(
      _.orderBy(actualSymbols, x => x.name),
      _.orderBy(expectedSymbols, x => x.name),
    );
  });
});
