import * as vscode from 'vscode';

export class ElmCodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Thenable<vscode.Command[]> {
    let wordRange = document.getWordRangeAtPosition(range.start);
    let currentWord: string = document.getText(wordRange);
    let currentWordPrefix = currentWord.substring(
      0,
      currentWord.lastIndexOf('.')
    );
    let currentWordSuffix = currentWord.substr(
      currentWord.lastIndexOf('.') + 1
    );
    let annotationWordCriteria =
      'Top-level value `' +
      currentWord +
      '` does not have a type annotation. - I inferred the type annotation so you can copy it into your code:';
    let modelFieldMissingCriteria =
      'Hint: The record fields do not match up. Maybe you made one of these typos?';

    let suggestionsCriterias = [
      'Cannot find variable `' +
        currentWord +
        '` - Maybe you want one of the following?',
      'Cannot find variable `' +
        currentWord +
        '`. - `' +
        currentWordPrefix +
        '` does not expose `' +
        currentWordSuffix +
        '`. Maybe you want one of the following?',
      'Cannot find variable `' +
        currentWord +
        '`. - No module called `' +
        currentWordPrefix +
        '` has been imported. Maybe you want one of the following?',
      'Cannot find pattern `' +
        currentWord +
        '`. - `' +
        currentWordPrefix +
        '` does not expose `' +
        currentWordSuffix +
        '`. Maybe you want one of the following?',
      'Cannot find pattern `' +
        currentWord +
        '` - Maybe you want one of the following?',
      'Cannot find type `' +
        currentWord +
        '` - Maybe you want one of the following?',
      'Cannot find type `' +
        currentWord +
        '`. - `' +
        currentWordPrefix +
        '` does not expose `' +
        currentWordSuffix +
        '`. Maybe you want one of the following?',
    ];

    let promises = context.diagnostics.map(diag => {
      if (diag.message.indexOf(annotationWordCriteria) >= 0) {
        return [
          {
            title: 'Add function type annotation',
            command: 'elm.codeActionAnnotateFunction',
            arguments: [
              diag.message.substr(annotationWordCriteria.length + 1).trim(),
            ],
          },
        ];
      } else if (
        suggestionsCriterias.some(function(v) {
          return diag.message.indexOf(v) >= 0;
        })
      ) {
        let suggestions = diag.message
          .substr(diag.message.indexOf('\n'))
          .trim();
        let commands = suggestions
          .split('\n')
          .map(val => val.trim())
          .map(val => {
            return {
              title: 'Change to: ' + val,
              command: 'elm.codeActionReplaceSuggestedVariable',
              arguments: [[currentWord, val]],
            };
          });
        return commands;
      } else if (diag.message.indexOf(modelFieldMissingCriteria) >= 0) {
        let modelName = currentWord.substring(0, currentWord.indexOf('.') + 1);
        let message = diag.message.split('\n');
        let suggestions = message[message.length - 1].trim().split('<->');

        let commands = suggestions
          .map(val => modelName + val.trim())
          .map(val => {
            return {
              title: 'Change to: ' + val,
              command: 'elm.codeActionReplaceSuggestedVariable',
              arguments: [[currentWord, val]],
            };
          });
        return commands;
      }
      return [];
    });

    return Promise.all(promises).then(arrs => {
      let results = {};
      for (let segment of arrs) {
        for (let item of segment) {
          results[item.title] = item;
        }
      }
      let ret = [];
      for (let title of Object.keys(results).sort()) {
        ret.push(results[title]);
      }
      return ret;
    });
  }
}

function annotateFunction(msg: string) {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No editor is active.');
    return;
  }
  if (editor.document.languageId !== 'elm') {
    vscode.window.showInformationMessage('Language is not Elm');
    return;
  }
  let position = vscode.window.activeTextEditor.selection.active;
  let msgList = msg.split('\n');
  if (msgList.length >= 1) {
    let annotation = msgList.map((val: string) => val.trim()).join(' ');
    editor.edit(editBuilder => {
      editBuilder.insert(position.translate(-1), annotation);
    });
  } else {
    vscode.window.showInformationMessage(
      'Could not resolve function type annotation'
    );
  }
}

function replaceSuggestedVariable(msg: string[]) {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No editor is active.');
    return;
  }
  if (editor.document.languageId !== 'elm') {
    vscode.window.showInformationMessage('Language is not Elm');
    return;
  }
  let position = vscode.window.activeTextEditor.selection.active;
  let wordRange = editor.document.getWordRangeAtPosition(position);
  let currentWord: string = editor.document.getText(wordRange);
  if (msg.length === 2 && msg[0] === currentWord) {
    editor.edit(editBuilder => {
      editBuilder.replace(wordRange, msg[1]);
    });
  } else {
    vscode.window.showInformationMessage('Could not find variable to replace');
  }
}

export function activateCodeActions(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.codeActionAnnotateFunction', msg =>
      annotateFunction(msg)
    ),
    vscode.commands.registerCommand(
      'elm.codeActionReplaceSuggestedVariable',
      msg => replaceSuggestedVariable(msg)
    ),
  ];
}
