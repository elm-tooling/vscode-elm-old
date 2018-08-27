import * as cp from 'child_process';
import * as readline from 'readline';
import * as utils from './elmUtils';
import * as vscode from 'vscode';
import { ElmAnalyse } from './elmAnalyse';

export interface IElmIssueRegion {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface IElmIssue {
  tag: string;
  overview: string;
  subregion: string;
  details: string;
  region: IElmIssueRegion;
  type: string;
  file: string;
}

function severityStringToDiagnosticSeverity(
  severity: string,
): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

function elmMakeIssueToDiagnostic(issue: IElmIssue): vscode.Diagnostic {
  let lineRange: vscode.Range = new vscode.Range(
    issue.region.start.line - 1,
    issue.region.start.column - 1,
    issue.region.end.line - 1,
    issue.region.end.column - 1,
  );
  return new vscode.Diagnostic(
    lineRange,
    issue.overview + ' - ' + issue.details.replace(/\[\d+m/g, ''),
    severityStringToDiagnosticSeverity(issue.type),
  );
}

function parseErrorsElm019(line) {
  const returnLines = []
  const errorObject = JSON.parse(line);

  if (errorObject.type === 'compile-errors') {
    errorObject.errors.forEach(error => {
      const problems = error.problems.map(problem => ({
        tag: 'error',
        overview: problem.title,
        subregion: '',
        details: problem.message
          .map(
            message =>
              typeof message === 'string' ? message : message.string
          )
          .join(''),
        region: problem.region,
        type: 'error',
        file: error.path
      }));

      returnLines.push(...problems);
    });
  } else if (errorObject.type === 'error') {
    const problem = {
      tag: 'error',
      overview: errorObject.title,
      subregion: '',
      details: errorObject.message
        .map(
          message =>
            typeof message === 'string' ? message : message.string
        )
        .join(''),
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
      file: errorObject.path
    };

    returnLines.push(problem);
  }

  return returnLines
}

function parseErrorsElm018(line) {
  if (line.startsWith('Successfully generated')) {
    // ignore compiler successes
    return []
  }
  // elm make returns an array of issues
  return (<IElmIssue[]>(JSON.parse(line)))
}

function checkForErrors(filename): Promise<IElmIssue[]> {
  return new Promise((resolve, reject) => {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      'elm',
    );
    const make018Command: string = <string>config.get('makeCommand');
    const compiler: string = <string>config.get('compiler');
    const [cwd, elmVersion] = utils.detectProjectRootAndElmVersion(filename, vscode.workspace.rootPath)
    let make;
    if (utils.isWindows) {
      filename = "\"" + filename + "\""
    }
    const args018 = [filename, '--report', 'json', '--output', '/dev/null'];
    const args019 = ['make', filename, '--report', 'json', '--output', '/dev/null'];
    const args = utils.isElm019(elmVersion) ? args019 : args018;
    const makeCommand = utils.isElm019(elmVersion) ? compiler : make018Command;

    if (utils.isWindows) {
      make = cp.exec(makeCommand + ' ' + args.join(' '), { cwd: cwd });
    } else {
      make = cp.spawn(makeCommand, args, { cwd: cwd });
    }
    // output is actually optional
    // (fixed in https://github.com/Microsoft/vscode/commit/b4917afe9bdee0e9e67f4094e764f6a72a997c70,
    // but unreleased at this time)
    const errorLinesFromElmMake = readline.createInterface({
      // elm 0.19 uses stderr, elm 0.18 uses stdout
      input: utils.isElm019(elmVersion) ? make.stderr : make.stdout,
      output: undefined
    });

    const lines = [];

    const elm018stderr: Buffer[] = [];

    errorLinesFromElmMake.on('line', line => {
      if (utils.isElm019(elmVersion)) {
        const newLines = parseErrorsElm019(line)
        newLines.forEach(l => lines.push(l))
      } else {
        const newLines = parseErrorsElm018(line)
        newLines.forEach(l => lines.push(l))
      }
    })

    if (utils.isElm019(elmVersion) === false) {
      // we listen to stderr for Elm 0.18
      // as this is where a whole file issue would go
      make.stderr.on('data', (data: Buffer) => {
        if (data) {
          elm018stderr.push(data)
        }
      })
    }

    make.on('error', err => {
      errorLinesFromElmMake.close();
      if (err && err.code === 'ENOENT') {
        vscode.window.showInformationMessage(
          "The 'elm-make' compiler is not available.  Install Elm from http://elm-lang.org/."
        );
        resolve([]);
      } else {
        reject(err);
      }
    });

    make.on('close', (code, signal) => {

      errorLinesFromElmMake.close();

      if (elm018stderr.length) {
        let errorResult: IElmIssue = {
          tag: 'error',
          overview: '',
          subregion: '',
          details: elm018stderr.join(''),
          region: {
            start: {
              line: 1,
              column: 1,
            },
            end: {
              line: 1,
              column: 1,
            },
          },
          type: 'error',
          file: filename,
        };
        resolve([errorResult]);
      } else {
        resolve(lines);
      }
    });
  });
}

let compileErrors: vscode.DiagnosticCollection;

export function runLinter(
  document: vscode.TextDocument,
  elmAnalyse: ElmAnalyse,
): void {
  if (document.languageId !== 'elm' || document.uri.scheme !== 'file') {
    return;
  }

  let uri: vscode.Uri = document.uri;

  if (!compileErrors) {
    compileErrors = vscode.languages.createDiagnosticCollection('elm');
  } else {
    compileErrors.clear();
  }

  checkForErrors(uri.fsPath)
    .then((compilerErrors: IElmIssue[]) => {
      const cwd: string =
        utils.detectProjectRoot(uri.fsPath) || vscode.workspace.rootPath;
      let splitCompilerErrors: Map<string, IElmIssue[]> = new Map();

      compilerErrors.forEach((issue: IElmIssue) => {
        // If provided path is relative, make it absolute
        if (issue.file.startsWith('.')) {
          issue.file = cwd + issue.file.slice(1);
        }
        if (splitCompilerErrors.has(issue.file)) {
          splitCompilerErrors.get(issue.file).push(issue);
        } else {
          splitCompilerErrors.set(issue.file, [issue]);
        }
      });
      // Turn split arrays into diagnostics and associate them with correct files in VS
      splitCompilerErrors.forEach((issue: IElmIssue[], path: string) => {
        compileErrors.set(
          vscode.Uri.file(path),
          issue.map(error => elmMakeIssueToDiagnostic(error)),
        );
      });
    })
    .catch(error => {
      compileErrors.set(document.uri, []);
    });

  if (elmAnalyse.elmAnalyseIssues.length > 0) {
    let splitCompilerErrors: Map<string, IElmIssue[]> = new Map();
    elmAnalyse.elmAnalyseIssues.forEach((issue: IElmIssue) => {
      if (splitCompilerErrors.has(issue.file)) {
        splitCompilerErrors.get(issue.file).push(issue);
      } else {
        splitCompilerErrors.set(issue.file, [issue]);
      }
      splitCompilerErrors.forEach(
        (analyserIssue: IElmIssue[], path: string) => {
          compileErrors.set(
            vscode.Uri.file(path),
            analyserIssue.map(error => elmMakeIssueToDiagnostic(error)),
          );
        },
      );
    });
  }
}
