import * as vscode from 'vscode';

import { execCmd } from './elmUtils';

const request = require('request');

let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Package');

function browsePackage(): Promise<void> {
  const quickPickPackageOptions: vscode.QuickPickOptions = {
    matchOnDescription: true,
    placeHolder: 'Choose a package',
  };
  const quickPickVersionOptions: vscode.QuickPickOptions = {
    matchOnDescription: false,
    placeHolder: 'Choose a version, or press <esc> to browse the latest',
  };

  return getJSON()
    .then(transformToPackageQuickPickItems)
    .then(packages =>
      vscode.window.showQuickPick(packages, quickPickPackageOptions),
    )
    .then(selectedPackage => {
      if (selectedPackage === undefined) {
        return; // no package
      }
      return vscode.window
        .showQuickPick(
          transformToPackageVersionQuickPickItems(selectedPackage),
          quickPickVersionOptions,
        )
        .then(selectedVersion => {
          oc.show(vscode.ViewColumn.Three);
          let uri = selectedVersion
            ? vscode.Uri.parse(
                'http://package.elm-lang.org/packages/' +
                  selectedPackage.label +
                  '/' +
                  selectedVersion.label,
              )
            : vscode.Uri.parse(
                'http://package.elm-lang.org/packages/' +
                  selectedPackage.label +
                  '/latest',
              );
          vscode.commands.executeCommand('vscode.open', uri, 3);
        });
    });
}

interface ElmPackageQuickPickItem extends vscode.QuickPickItem {
  info: any;
}

function transformToPackageQuickPickItems(
  packages: any[],
): ElmPackageQuickPickItem[] {
  return packages.map(item => {
    return { label: item.name, description: item.summary, info: item };
  });
}

function transformToPackageVersionQuickPickItems(
  selectedPackage: ElmPackageQuickPickItem,
): vscode.QuickPickItem[] {
  return selectedPackage.info.versions.map(version => {
    return { label: version, description: null };
  });
}

function runInstall(): Thenable<void> {
  const quickPickOptions: vscode.QuickPickOptions = {
    matchOnDescription: true,
    placeHolder:
      'Choose a package, or press <esc> to install all packages in elm-package.json',
  };

  return getJSON()
    .then(transformToQuickPickItems)
    .then(items => vscode.window.showQuickPick(items, quickPickOptions))
    .then(value => {
      const packageName = value ? value.label : '';
      oc.show(vscode.ViewColumn.Three);

      return execCmd(`elm-package install ${packageName} --yes`, {
        onStdout: data => oc.append(data),
        onStderr: data => oc.append(data),
        showMessageOnError: true,
      }).then(() => {});
    });
}

function getJSON(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    request('http://package.elm-lang.org/all-packages', (err, _, body) => {
      if (err) {
        reject(err);
      } else {
        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          reject(e);
        }
        resolve(json);
      }
    });
  });
}

function transformToQuickPickItems(json: any[]): vscode.QuickPickItem[] {
  return json.map(item => ({ label: item.name, description: item.summary }));
}

export function activatePackage(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.install', runInstall),
    vscode.commands.registerCommand('elm.browsePackage', browsePackage),
  ];
}
