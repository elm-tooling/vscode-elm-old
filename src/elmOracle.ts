import * as cp from 'child_process';
import * as path from 'path';
import {pluginPath, detectProjectRoot} from './elmUtils';
import * as vscode from 'vscode';

interface IOracleResult {
  name: string;
  fullName: string;
  href: string;
  signature: string;
  comment: string;
}

let oraclePath = pluginPath + path.sep + 'node_modules' + path.sep + 'elm-oracle' + path.sep + 'bin' + path.sep + 'elm-oracle';

export function GetOracleResults(document: vscode.TextDocument, position: vscode.Position): Thenable<IOracleResult[]> {
  return new Promise((resolve: Function, reject: Function) => {
      let p: cp.ChildProcess;
      let filename: string = document.fileName;
      let cwd = detectProjectRoot(document.fileName) || vscode.workspace.rootPath;
      let fn = path.relative(cwd, filename)
      let wordAtPosition = document.getWordRangeAtPosition(position);
      let currentWord: string = document.getText(wordAtPosition);
      let oracleCmd = oraclePath + ' "' + fn + '" ' + currentWord;
    
      p = cp.exec('node ' + oracleCmd, { cwd: cwd }, (err: Error, stdout: Buffer, stderr: Buffer) => {
        try {
          if (err) {
            return resolve(null);
          }
          let result: IOracleResult[] = JSON.parse(stdout.toString());
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
}