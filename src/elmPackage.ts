import * as vscode from 'vscode';
import { execCmd } from './elmUtils';
const request = require('request');

let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Package');

function runInstall(): Thenable<void> {
  
  const quickPickOptions: vscode.QuickPickOptions = {
    matchOnDescription: true,
    placeHolder: "Choose a package, or press <esc> to install all packages in elm-package.json",
  };
  
  return getJSON()
    .then(transformToQuickPickItems)
    .then(items => vscode.window.showQuickPick(items, quickPickOptions))
    .then(value => {
      const packageName = value ? value.label : '';
      oc.show(vscode.ViewColumn.Three);
      
      return execCmd(`elm-package install ${packageName} --yes`, {
        onStdout: (data) => oc.append(data),
        onStderr: (data) => oc.append(data),
        showMessageOnError: true
      }).then(() => { });
    })
}

function getJSON(): Thenable<any[]> {
  return new Promise((resolve, reject) => {
    request('http://package.elm-lang.org/all-packages', (err, _, body) => {
      if (err) {
        reject(err);
      }
      else {
        let json;
        try {
          json = JSON.parse(body);
        }
        catch (e) {
          reject(e)
        }
        resolve(json);
      }
    })
  });
}

function transformToQuickPickItems(json: any[]): vscode.QuickPickItem[] { 
  return json.map(item => ({ label: item.name, description: item.summary }));
}

export function activatePackage(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.install', runInstall)];
}