import * as vscode from 'vscode';
import * as path from 'path';
import { detectProjectRoot } from './elmUtils';
import {GeneratorType, createDecoder, createEncoder, createEverything} from './elmJsonToElm';


function createJsonEncoderDecoderFromSelection(editor: vscode.TextEditor, generatorType : GeneratorType) {
  const toplevelAliasDialogOptions: vscode.InputBoxOptions = { placeHolder: 'Example: User', prompt: 'Please enter toplevel alias name', value: 'Something' };
  try {
    let selection = editor.selection;
    let selectionText = editor.document.getText(selection);
    let validJsonString = JSON.parse(selectionText);
    let outputChoices = [
      'Output to new file',
      'Output to bottom of an existing file',
      'Output into bottom of current file'
    ];
    let result = vscode.window.showInputBox(toplevelAliasDialogOptions)
      .then(okInput => {
        if (okInput !== undefined) {
          let generatedCode = createEverything(selectionText, okInput, true, generatorType);
          vscode.window.showQuickPick(outputChoices)
            .then(outputChoice => {
              if (outputChoice !== undefined) {
                if (outputChoice == outputChoices[2]) { // this file
                  insertIntoCurrentFileFromResult(generatedCode, editor); 
                }
                else if (outputChoice == outputChoices[0]) { // new file
                  createNewFileFromResult(generatedCode, editor.document); 
                }
                else if (outputChoice == outputChoices[1]) { //existing file
                  insertIntoExistingFileFromResult(generatedCode);
                }
              }
              else {
                console.log('Choice canceled');
              }
            }
          )
        }
        else {
          vscode.window.showErrorMessage('Canceled or invalid toplevel alias name. Aborted json-to-elm.');
        }
      }, err => {
        console.log('err');
    })
  }
  catch (e) {
    if (e.message.startsWith('Unexpected token')) {
      vscode.window.showErrorMessage('Running Elm Create Json Decoder failed. This does not seem to be valid json');
    }
    else {
      vscode.window.showErrorMessage('Running Elm Create Json Decoder failed');
    }
  }
}

function createNewFileFromResult(fileInput: string, document: vscode.TextDocument) {
  let root = detectProjectRoot(document.uri.fsPath);
  let filePath = path.join(root, 'Please-choose-save-as-new-file-name.elm')
  var setting: vscode.Uri = vscode.Uri.parse("untitled:" + filePath);
  const openTextSettings : any = {language: 'elm'} // Set to any type to disable old vscode dev version warning
  vscode.workspace.openTextDocument(openTextSettings).then((a: vscode.TextDocument) => {
      vscode.window.showTextDocument(a).then(e => {
          e.edit(edit => {
              edit.insert(new vscode.Position(0, 0), fileInput);
          });
      });
  }, (error: any) => {
      console.error(error);
      debugger;
  });
}

function insertIntoCurrentFileFromResult(fileInput: string, editor: vscode.TextEditor) {
  editor.edit(edit => {
      edit.insert(new vscode.Position(editor.document.lineCount + 1, 0), '-- Created with json-to-elm\n\n' + fileInput);
  });
}

function insertIntoExistingFileFromResult(fileInput: string) {
  const config = vscode.workspace.getConfiguration('elm');
  let maxFiles = config['maxWorkspaceFilesUsedBySymbols'];
  let excludePattern = config['workspaceFilesExcludePatternUsedBySymbols'];
  let docs = vscode.workspace.findFiles('**/*.elm', excludePattern, maxFiles)
    .then(workspaceFiles => {
      const uris = workspaceFiles.map(value => value.fsPath)
      vscode.window.showQuickPick(uris, {placeHolder:'Choose one of the existing files in your workspace..'})
        .then(selectedFile => {
          if (selectedFile !== undefined) {
            vscode.workspace.openTextDocument(selectedFile)
              .then(openedFile => {
                let workspaceEdit = new vscode.WorkspaceEdit();
                const edit = workspaceEdit.insert(openedFile.uri, new vscode.Position(openedFile.lineCount +1, 0),'-- Created with json-to-elm\n\n' + fileInput)
                vscode.workspace.applyEdit(workspaceEdit);
                vscode.window.showTextDocument(openedFile);
            })
          }
      })
    }
  )
}

function runCreateJsonDecoderFromSelection(editor: vscode.TextEditor) {
  createJsonEncoderDecoderFromSelection(editor, GeneratorType.Decoder);
}

function runCreateJsonEncoderFromSelection(editor: vscode.TextEditor) {
  createJsonEncoderDecoderFromSelection(editor, GeneratorType.Encoder);
}

export function activateJson(): vscode.Disposable[] {
  return [
    vscode.commands.registerTextEditorCommand('elm.createJsonDecoderFromSelection', runCreateJsonDecoderFromSelection),
    vscode.commands.registerTextEditorCommand('elm.createJsonEncoderFromSelection', runCreateJsonEncoderFromSelection)
  ];
}