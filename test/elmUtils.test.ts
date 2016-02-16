import * as assert from 'assert';
import * as path from 'path'
import * as vscode from 'vscode';
import { window } from 'vscode';
import { execCmd, findProj } from '../src/elmUtils';

suite("ElmUtils.execCmd", () => {

  suite("Non-existant command", () => {

    test("With showMessageOnError: false, rejects", () => {
      return execCmd("cmdThatDoesntExist").then(
        () => { assert.fail("Command should reject not resolve"); },
        () => { /* Do nothing, this is what we want */ }
      );
    });

    test("With showMessageOnError: true, shows message and doesn't resolve or reject", (done) => {
      // poor-man's spy
      let shownMsg, _showErrorMessage = window.showErrorMessage
      window.showErrorMessage = function(msg) {
        shownMsg = msg;
        return Promise.resolve(undefined);
      }

      execCmd("cmdThatDoesntExist", { showMessageOnError: true }).then(
        () => { assert.fail("Command should not resolve"); },
        () => { assert.fail("Command should not reject"); }
      ).catch(e => { throw e });
      
      setTimeout(() => {
        assert.equal(shownMsg,
          "cmdThatDoesntExist is not available in your path. " +
          "Install Elm from http://elm-lang.org/.");
        window.showErrorMessage = _showErrorMessage;
        done();
      }, 1000);
    });
  });
});

suite("ElmUtils.findProj", () => {

  test("findProj finds the correct folder", () => {
    var expected = path.join(__dirname, '../../test/fixtures/elm-package.json');
    var check = (p: string) => {
      var resolvedDir = path.join(__dirname, '../../', p);
      return findProj(resolvedDir);
    }
    assert.equal(check('test/fixtures/src'), expected);
    assert.equal(check('test/fixtures'), expected);
    assert.equal(check('test'), '');
  });
});