import * as assert from 'assert';

import { execCmd, isWindows } from '../src/elmUtils';

import { commands } from 'vscode';

suite('ElmReactor', () => {
  test('Starts & stops Elm Reactor', function() {
    this.timeout(10000);

    return commands
      .executeCommand('elm.reactorStart')
      .then(wait(3000))
      .then(() => checkForProcess('elm-reactor', true))
      .then(() => commands.executeCommand('elm.reactorStop'))
      .then(wait(3000))
      .then(() => checkForProcess('elm-reactor', false));
  });
});

/** setTimeout as a promise */
const wait = (ms: number) => <T>(value: T) =>
  new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

/** Check if process is running or not */
function checkForProcess(processName, isRunning) {
  const cmd = isWindows ? 'tasklist' : 'ps -axc -o comm',
    expected = isRunning ? 1 : 0;

  return execCmd(cmd).then(({ stdout }) => {
    const matches = stdout
      .split('\n')
      .filter(line => line.startsWith(processName)).length;
    assert.equal(
      matches,
      expected,
      `${expected} ${processName} should be running`,
    );
  });
}
