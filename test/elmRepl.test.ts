import * as assert from 'assert';
import { commands } from 'vscode';
import { execCmd, isWindows } from '../src/elmUtils';

suite('ElmRepl', () => {
  test('Starts Elm Repl', function() {
    this.timeout(5000);

    return commands.executeCommand('elm.replStart')
      .then(wait(3000))
      .then(() => checkForProcess('elm-repl', true));
  });
});

/** setTimeout as a promise */
const wait = (ms: number) => <T>(value: T) =>
  new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

/** Check if process is running or not */
function checkForProcess(processName, isRunning) {
  const
    cmd = isWindows ? 'tasklist' : 'ps -axc -o comm',
    expected = isRunning ? 1 : 0;

  return execCmd(cmd).then(({stdout}) => {
    const matches = stdout.split('\n')
      .filter(line => line.startsWith(processName))
      .length;
    assert.equal(matches, expected,
      `${expected} ${processName} should be running`);
  });
}
