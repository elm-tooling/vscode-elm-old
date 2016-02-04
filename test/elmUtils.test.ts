//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as elmMain from './../src/elmMain';
import * as elmUtils from './../src/elmUtils';
import * as path from 'path'

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

	// Defines a Mocha unit test
  test("findProj finds the correct folder", () => {
    var expected = path.join(__dirname, '../../test/fixtures/elm-package.json');
    console.log(expected);
    var check = (p:string) => {
      var resolvedDir = path.join(__dirname, '../../', p);
      return elmUtils.findProj(resolvedDir);
    }
    assert.equal(check('test/fixtures/src'), expected);
    assert.equal(check('test/fixtures'), expected);
    assert.equal(check('test'), '');
	});
});