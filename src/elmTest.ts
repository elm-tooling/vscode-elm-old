import * as utils from './elmUtils';
import * as vscode from 'vscode';
import * as path from 'path';

export function fileIsTestFile(filename: string) {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'elm',
  );
  const testMatcher: string = <string>(
    config.get('elmTestFileMatcher')
  );
  const [_, elmVersion] = utils.detectProjectRootAndElmVersion(
    filename,
    vscode.workspace.rootPath,
  );
  if (utils.isElm019(elmVersion) === false) {
    // we didn't differentiate test/app code for 0.18
    return false;
  }

  const pathFromRoot = path.relative(vscode.workspace.rootPath, filename);
  const pathParts = path.parse(pathFromRoot);
  const pathNormalized = path.posix.format(pathParts);

  const testMatcherParts = path.parse(testMatcher);
  const testMatcherNormalized = path.posix.format(testMatcherParts);

  const isTestFile = pathNormalized.includes(testMatcherNormalized);
  return isTestFile;
}
