// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import cp = require('child_process');
import path = require('path');
import os = require('os');
import fs = require('fs');

export interface ICheckResult {
	tag: string;
	overview: string;
	subregion: string;
	details: string;
	region: {
		start: {
			line: number;
			column: number;
		}
		end: {
			line: number;
			column: number;
		}
	}
	type: string;
	file: string;
}

export function checkForErrors(filename): Promise<ICheckResult[]> {
  return new Promise((resolve, reject) => {
	var cmd = 'elm-make ' + filename + ' --report=json --output /dev/null'
	cp.exec(cmd, {}, (err, stdout, stderr) => {
  	  try {
		if (err && (<any>err).code == "ENOENT") {
			vscode.window.showInformationMessage("The 'elm-make' compiler is not available.  Install Elm from http://elm-lang.org/.");
			return resolve([]);
		}
		console.log('stdout', stdout.toString());
		var lines:ICheckResult[] = JSON.parse(stdout.toString());
		resolve(lines);
	  } catch(e) {
		reject(e);
	  }
	});

  });
}


export function createDiagnostics(document: vscode.TextDocument) {
	if (document.languageId != "elm") {
		return;
	}
	let diagnostics: vscode.Diagnostic[] = [];
	let compileErrors = vscode.languages.createDiagnosticCollection("compile");
	let uri = document.uri;

	checkForErrors(uri.fsPath).then((compilerErrors) => {
		diagnostics = compilerErrors.map((error) => {
			let lineRange = new vscode.Range(
				error.region.start.line - 1,
				error.region.start.column - 1,
				error.region.end.line - 1,
				error.region.end.column - 1
				);
			return new vscode.Diagnostic(lineRange, error.details.replace(/\[\d+m/g, ''), vscode.DiagnosticSeverity.Error);
		})
		compileErrors.set(document.uri, diagnostics);
		console.log('check success', compilerErrors);
	}, (error) => {
		compileErrors.set(document.uri, []);
		console.log('check error', error)
	})
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(disposables: vscode.Disposable[]) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Extension "elm" is now active!');

//    vscode.workspace.onDidChangeTextDocument(event => {
//        createDiagnostics(event.document)
//    }, undefined, disposables);

    vscode.workspace.onDidOpenTextDocument(document => {
        createDiagnostics(document)
    });

	vscode.workspace.onDidSaveTextDocument(document => {
		createDiagnostics(document)
	})
}