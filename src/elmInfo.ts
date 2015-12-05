'use strict';

import {HoverProvider, Hover, TextDocument, Position, Range, CancellationToken} from 'vscode';
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

export class ElmHoverProvider implements HoverProvider {
  public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
    return new Promise((resolve: Function, reject: Function) => {
      let p: cp.ChildProcess;
      let filename: string = document.fileName;
      let cwd = detectProjectRoot(vscode.window.activeTextEditor) || vscode.workspace.rootPath;
      let fn = path.relative(cwd, filename)
      let wordAtPosition: Range = document.getWordRangeAtPosition(position);
      let currentWord: string = document.getText(wordAtPosition);
      let oracle = pluginPath + path.sep + 'node_modules' + path.sep + '.bin' + path.sep + 'elm-oracle \"' + fn + '\" ' + currentWord;

      p = cp.exec('node ' + oracle, { cwd: cwd }, (err: Error, stdout: Buffer, stderr: Buffer) => {
        try {
          if (err) {
            return resolve(null);
          }
          let result: IOracleResult[] = JSON.parse(stdout.toString());

          if (result.length > 0) {
            let text: string = result[0].signature + '\n\n' + result[0].comment;
            let hover: Hover = new Hover({ language: 'elm', value: text });
            return resolve(hover);
          } else {
            return resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
      p.stdin.end(document.getText());
    });
  }
}
