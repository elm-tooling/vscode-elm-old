import * as vscode from 'vscode';
import { ElmProjectManager } from 'elm-project-inspect';
import * as _ from 'lodash';

const initializeElmProjectManager = () => {
  return new ElmProjectManager(
    (vscode.workspace.workspaceFolders || []).map(x => x.uri.fsPath),
  );
};

let elmProjectManager = initializeElmProjectManager();

vscode.workspace.onDidChangeWorkspaceFolders(() => {
  elmProjectManager = initializeElmProjectManager();
});

export const getGlobalProjectManager = () => elmProjectManager;
