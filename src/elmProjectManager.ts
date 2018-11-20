import * as vscode from 'vscode';
import { ElmProjectManager } from 'elm-project-inspect';
import * as _ from 'lodash';

export const getGlobalProjectManager = _.memoize(() => new ElmProjectManager(([vscode.workspace.rootPath] || [])));
