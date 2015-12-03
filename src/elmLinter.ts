import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as utils from './elmUtils';

interface IElmIssue {
  tag: string;
  overview: string;
  subregion: string;
  details: string;
  region: {
    start: { line: number; column: number; }
    end: { line: number; column: number; }
  };
  type: string;
  file: string;
}

function severityStringToDiagnosticSeverity(severity: string): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    default: return vscode.DiagnosticSeverity.Error;
  }
}

function elmMakeIssueToDiagnostic(issue: IElmIssue): vscode.Diagnostic {
  let lineRange: vscode.Range = new vscode.Range(
    issue.region.start.line - 1,
    issue.region.start.column - 1,
    issue.region.end.line - 1,
    issue.region.end.column - 1
  );
  return new vscode.Diagnostic(
    lineRange,
    issue.overview + ' - ' + issue.details.replace(/\[\d+m/g, ''),
    severityStringToDiagnosticSeverity(issue.type)
  );
}

function checkForErrors(filename): Promise<IElmIssue[]> {
  return new Promise((resolve, reject) => {
    const cwd: string = utils.detectProjectRoot(vscode.window.activeTextEditor) || vscode.workspace.rootPath;
    let cmd: string = 'elm-make ' + filename + ' --report=json --output /dev/null';

    cp.exec(cmd, { cwd: cwd }, (err: Error, stdout: Buffer, stderr: Buffer) => {
      try {
        if (err && (<any>err).code === 'ENOENT') {
          vscode.window.showInformationMessage("The 'elm-make' compiler is not available.  Install Elm from http://elm-lang.org/.");
          return resolve([]);
        }
        if (stderr) {
          let errorResult: IElmIssue = {
            tag: 'error',
            overview: '',
            subregion: '',
            details: stderr.toString(),
            region: {
              start: {
                line: 1,
                column: 1
              },
              end: {
                line: 1,
                column: 1
              }
            },
            type: 'error',
            file: filename
          };
          resolve([errorResult]);
        }

        let lines: IElmIssue[] = JSON.parse(stdout.toString());
        resolve(lines);
      } catch (e) {
        reject(e);
      }
    });

  });
}

export function runLinter(document: vscode.TextDocument): void {
  if (document.languageId !== 'elm') {
    return;
  }
  let diagnostics: vscode.Diagnostic[] = [];
  let compileErrors: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('elm');
  let uri: vscode.Uri = document.uri;

  checkForErrors(uri.fsPath)
    .then((compilerErrors: IElmIssue[]) => {
      diagnostics = compilerErrors.map((error) => elmMakeIssueToDiagnostic(error));
      compileErrors.set(document.uri, diagnostics);
    })
    .catch((error) => {
      compileErrors.set(document.uri, []);
    });
}
