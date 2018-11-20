import * as vscode from 'vscode';
import { ElmProjectManager } from 'elm-project-inspect';
import * as _ from 'lodash';

export const getGlobalProjectManager = _.memoize(() => {
  return new ElmProjectManager((vscode.workspace.workspaceFolders || []).map(x => x.uri.fsPath));
});
