import * as vscode from 'vscode';
import * as cp from 'child_process';

let reactor: cp.ChildProcess;
let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Reactor');


function startReactor() {
  try {
    if (reactor) {
      reactor.kill();
      oc.clear();
    }
    const config = vscode.workspace.getConfiguration('elm');
    const host = config.get('reactorHost');
    const port = config.get('reactorPort');
    reactor = cp.spawn('elm', ['reactor', '-a=' + host, '-p=' + port], { cwd: vscode.workspace.rootPath });
    reactor.stdout.on('data', (data: Buffer) => {
      if (data && data.toString().startsWith('| ') === false) {
        oc.append(data.toString());
      }
    });
    reactor.stderr.on('data', (data: Buffer) => {
      if (data) {
        oc.append(data.toString());
      }
    });
    oc.show(vscode.ViewColumn.Three);
  }
  catch (e) {
    console.error("Starting Elm reactor failed", e);
    vscode.window.showErrorMessage("Starting Elm reactor failed");
  }
}

function stopReactor()
{
  if (reactor)
  {
    reactor.kill();
    reactor = null;
  } 
  else
  {
    vscode.window.showInformationMessage('Elm Reactor not running')
  }
    
}

export function activateReactor(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.reactorStart', startReactor),  
    vscode.commands.registerCommand('elm.reactorStop', stopReactor) ]
}