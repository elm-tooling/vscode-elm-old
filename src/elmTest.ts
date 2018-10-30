import * as utils from './elmUtils';
import * as vscode from 'vscode';
import * as path from 'path';

export function fileIsTestFile(filename) {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const elmTestLocationMatcher: string = <string>(
    config.get('elmTestFileMatcher')
  );
  const [cwd, elmVersion] = utils.detectProjectRootAndElmVersion(
    filename,
    vscode.workspace.rootPath,
  );
  if (utils.isElm019(elmVersion) === false) {
    // we didn't differentiate test/app code for 0.18
    return false;
  }

  const pathFromRoute = path.relative(vscode.workspace.rootPath, filename);
  const isTestFile = pathFromRoute.indexOf(elmTestLocationMatcher) > -1;

  return isTestFile;
}
