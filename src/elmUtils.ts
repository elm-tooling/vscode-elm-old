import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs'
import * as path from 'path'

export const isWindows = process.platform == "win32";

export function execCmd(cmd: string, opt: {}): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      cp.exec(cmd, opt, (err, stdout, stder) => {
        if (err) {
          reject(err);
        }
        if (stder && stder.toString() && stder.toString() != null && stder.toString() !== '') {
          reject(stder.toString());
        }
        resolve(stdout.toString());
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function findProj(dir: string): string {
  if (fs.lstatSync(dir).isDirectory())
  {
    const files = fs.readdirSync(dir);
    const file = files.find((v, i) => v == "elm-package.json");
    if (file != undefined) return dir + path.sep + file;
    var parent = "";
    if (dir.lastIndexOf(path.sep) > 0) {
      parent = dir.substr(0, dir.lastIndexOf(path.sep));
    }
    if (parent == "")
    {
      return "";
    }
    else {
      return findProj(parent);
    }

  }
}

export function detectProjectRoot(editor: vscode.TextEditor): string {
  const proj = findProj(path.dirname(editor.document.fileName));
  if (proj !== "")
  {
    return path.dirname(proj);
  }
  return undefined;
}


export function getIndicesOf(searchStr : string, str : string) : number[] {
  var startIndex = 0, searchStrLen = searchStr.length;
  var index, indices = [];
  while ((index = str.indexOf(searchStr, startIndex)) > -1) {
    indices.push(index);
    startIndex = index + searchStrLen;
  }
  return indices;
}

export const pluginPath = (isWindows ? process.env["USERPROFILE"] : process.env["HOME"]) + path.sep + '.vscode' + path.sep + 'extensions' + path.sep + 'sbrink.elm'