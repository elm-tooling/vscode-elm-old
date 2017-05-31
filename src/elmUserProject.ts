import * as vscode from 'vscode';
import { detectProjectRoot } from './elmUtils';
import { IOracleResult, OracleAction } from './elmOracle';
import * as fs from 'fs';
import * as path from 'path';

interface Imports {
  module: string;
  exposing: string[];
}

const config = vscode.workspace.getConfiguration('elm');

let gSrcDirs = [];
let gCwd = '';
let gImports = [];
let gOriginalWord = ''

function exposingList(exposing): string[] {
  const separated = exposing.split(',');

  if (separated.length === 0) {
    //Handles (..) or single module imports
    return [exposing];
  } else {
    return separated;
  }
}

function toLowerOrHover(action: OracleAction, text:string): string {
  return (action === OracleAction.IsAutocomplete ? text.toLowerCase() : text)
}

export function userProject(document: vscode.TextDocument, position: vscode.Position, currentWord: string, action: OracleAction) {
  const fullText = document.getText();
  const lines: string[] = fullText.split(/\r?\n/g);
  let imports: Imports[] = [];
  let results: IOracleResult[] = [];

  let cwd = detectProjectRoot(document.fileName) || vscode.workspace.rootPath;
  gCwd = cwd;

  for (let i = 0; i < lines.length; i++) {
    let match;
    if (match = lines[i].match(/^import/)) {
      let exposingMatch;
      if (exposingMatch = lines[i].match(/exposing \(/)) {
        let asMatch;
        if (asMatch = lines[i].match(/as/)) {
          imports.push({
            module: lines[i].split(' ')[3],
            exposing: exposingList(lines[i].split('(')[1].replace(')', ''))
          });
        }
        else {
          imports.push({
            module: lines[i].split(' ')[1],
            exposing: exposingList(lines[i].split('(')[1].replace(')', ''))
          });
        }
      } else {
        let asMatch;
        if (asMatch = lines[i].match(/as/)) {
          imports.push({
            module: lines[i].split(' ')[3],
            exposing: []
          });
        }
        else {
          imports.push({
            module: lines[i].split(' ')[1],
            exposing: []
          });
        }
      }
    } else if (lines[i].trim() !== '' && !lines[i].match(/^module/)) {
      break;
    }
  }

  //Add the list of imports to the list of autocomplete suggestions
  if (action === OracleAction.IsAutocomplete && currentWord.substr(-1) !== '.') {
    imports.map(item => {
      results.push({
        name: item.module,
        fullName: item.module,
        signature: 'import ' + item.module + (item.exposing.length > 0 ? ' exposing(' + item.exposing.join(', ') + ')' : ''),
        href: document.fileName.toString(),
        kind: vscode.CompletionItemKind.Module,
        comment: 'Module imported at the top of this file'
      });
    })
  }

  gImports = imports;
  let elmPackageString: string = fs.readFileSync(path.join(cwd, 'elm-package.json'), 'utf-8');
  let elmPackage = JSON.parse(elmPackageString);
  let srcDirs = elmPackage['source-directories']; //must use array notation for the key because of hyphen

  //Look in the current file for autocomplete information
  results = [
    ...results,
    ...localFunctions(document.fileName, null, action, lines, position, currentWord, null, srcDirs)
  ];

  //Look for imported functions - must scan for src in elm-package.json file
  let parseImports = true;
  if (parseImports) {
    let uri = document.uri;

    if (currentWord.substr(-1) === '.') {
      imports = imports.filter(item => item.module === currentWord.split('.')[0]);
      //Set up the current word so that regex matching in localFunctions will find everything;
      //We are looking for all properties of the module name the user has fully qualified
      gOriginalWord = currentWord;
      currentWord = '[a-zA-Z]';
    }

    gSrcDirs = srcDirs;

    srcDirs.forEach(dir => {
      imports.forEach(moduleFile => {
        let filePath = path.join(cwd, dir, moduleFile.module + '.elm');
        try {
          let importText = fs.readFileSync(filePath, 'utf-8');
          let importResults = localFunctions(filePath, document.fileName, action, importText.split(/\r?\n/g), position, currentWord, imports, srcDirs);
          results = [ ...results, ...importResults ];

        } catch (e) {
          //File is an imported module, you won't find it
        }
      });
    })
  }

  return results;
}

const splitOnSpace = (config["includeParamsInUserAutocomplete"] === true ? null : ' ');
/**
 * localFunctions - Helper function to userProject which will find all type, type alias, and functions
 *                  Calls itself to look up type alias
 * @param filename from the vscode.TextDocument
 * @param callerFile optional parameter. If not set, we are looking in the current file, otherwise we are looking in an imported module
 * @param action from elmOracle. Whether the user is hovering or looking for autocomplete
 * @param lines array of lines of the current file
 * @param position the vscode.Position
 * @param currentWord the current word being hovered/autocompleted. Will get overridden to [a-zA-Z] when looking for members of a module
 * @param imports Optional parameter. The list of modules imported in the current file
 * @param srcDirs Optional parameter. The source directories in elm-package
 * @param isTypeAlias Optional parameter. True if localFunctions is being called to look for a type alias
 */
function localFunctions(filename: string, callerFile: string, action: OracleAction, lines: string[], position: vscode.Position, currentWord: string, imports?: Imports[], srcDirs?: string[], isTypeAlias?:boolean): IOracleResult[] {
  let results: IOracleResult[] = [];
  let test = new RegExp("^" + (action === OracleAction.IsAutocomplete ? currentWord.toLowerCase() : currentWord + ' '));
  let foundTypeAlias = false;
  let lookForTypeAlias = currentWord.substr(-1) === '.';
  for (let i = 0; i < lines.length; i++) {

    //Step 1: Get intellisense for type aliases
    //Caller file is only null if this is the first call to localFunctions
    if (callerFile === null && lookForTypeAlias) {
      if (currentWord.substr(-1) === '.') {
        if (/^[a-z]/.test(currentWord)) { //Only do this if it begins in lowercase (otherwise it would be a module)
          let foundParams = false;
          let foundSignature = false;
          let paramIndex = 0;
          let currentLine = '';
          let trimmedLine = '';

          if (foundTypeAlias) { continue; }

          //Walk backwards through the file (starting at the current line) to see if this is a parameter in the current function
          for (let j = position.line-1; j > 0; j--) {
            currentLine = lines[j];
            trimmedLine = currentLine.trim();

            if (trimmedLine === '') { continue }

            let params = currentLine.split(' ');
            if (currentLine.includes('=') && params.filter((item, i) => {
              if (item === currentWord.slice(0, -1) && item.trim() !== '') {
                paramIndex = i;
                return true;
              } else {
                return false;
              }
            }).length > 0) {
              //This item is a function parameter
              foundParams = true;
            }

            if (foundParams) {
              //Try and find the type signature of this function parameter based on the
              //function signature, if found.
              if (currentLine.includes(':')) {
                let signaturePieces = currentLine.split(/(?:\:|->)/g);
                let typeAlias;

                typeAlias = signaturePieces[paramIndex].trim();

                //Check if the type alias is defined in the calling file
                let aliasResults = localFunctions(filename, filename, action, lines, position, typeAlias, null, null,true)
                if (aliasResults.length === 0) {
                  //Then check the imported files for it
                  srcDirs.forEach(dir => {
                    gImports.forEach(moduleFile => {
                      let filePath = path.join(gCwd, dir, moduleFile.module + '.elm')
                      try {
                        if (aliasResults.length === 0) {
                          let importText = fs.readFileSync(filePath, 'utf-8');
                          let importResults = localFunctions(filePath, gCwd, action, importText.split(/\r?\n/g), position, typeAlias, null, null, true);
                          aliasResults = [...aliasResults, ...importResults];
                        }
                      } catch (e) {
                        //File is an imported module, you won't find it
                      }
                    });
                  })
                }
                if (aliasResults.length > 0) {
                  foundTypeAlias = true;
                  results = [...results, ...aliasResults];
                  break;
                }
              }
            }
          }
          //We finished walking all the way back through the file.  Either we found the type alias or we didn't
          //Do not look for it on the next line
          lookForTypeAlias = false;
        }
      }
    }

    //Step 2: See if the item we are looking up is qualified with a module name
    if (currentWord.includes('.')) {
      let importName = currentWord.split('.')[0];
      let func = currentWord.split('.')[1];

      //If this is a module and we aren't in the module file, we won't find any info for the current word
      if (!filename.includes(importName + '.elm')) {
        continue;
      } else {
        //TODO: I must have added this for a reason but it is not used.  let namespaceName = filename.substr(filename.lastIndexOf('\\') + 1);
        //namespaceName = namespaceName.replace('.elm', '');
        currentWord = func;
        test = new RegExp("^" + currentWord);
      }
    }

    //Step 3: Look for this item as a function. If this is an autocomplete, ignore case
    //If it is a hover, assume that the compiler would have caught a case mismatch by now and respect case.
    if (!isTypeAlias && test.test(toLowerOrHover(action, lines[i]))) {
      let typeSignature = '';
      let functionDefinition = '';
      if (lines[i].includes(' : ')) {
        //found a type signature
        typeSignature = lines[i];
        i++; //There will never be a type declaration on its own, the function would follow
      }

      if (lines[i].includes('=') && !/^type alias/.test(lines[i])) {
        //found a function definition - use this if type signature is empty
        functionDefinition = lines[i].substr(0, lines[i].indexOf('='));
      }

      //We found something, add it to the autocomplete/hover results
      if (typeSignature.length + functionDefinition.length > 0) {
        results.push({
          name: (functionDefinition != '' ? functionDefinition : 'function definition blank: ' + lines[i]).split(splitOnSpace)[0].trim(),//currentWord,
          fullName: (functionDefinition != '' ? functionDefinition : 'function definition blank: ' + lines[i].split(splitOnSpace)[0].trim()),
          signature: (typeSignature !== '' ? typeSignature : functionDefinition),
          href: filename,
          kind: vscode.CompletionItemKind.Function,
          comment: (callerFile === null ? '--Function in this file' : '--' + filename) + (typeSignature === '' ? ' (no type signature)' : '')
        });
      }
    }

    //Step 4: Search for a type declaration (type alias is later on)
    let suggestionList = [];
    if (!isTypeAlias && /^type (?!alias)/.test(lines[i])) {
      let returnInfo = lines[i].substr(lines[i].indexOf('=') + 1);
      let foundCurrentWord: boolean = false;
      let typeSignature: string = '';
      let j = 0;

      while (lines[i].trim() !== '' && !lines[i].match(/^module/)) {
        i++;

        if (action === OracleAction.IsAutocomplete) {
          if (lines[i].toLowerCase().includes((currentWord !== '[a-zA-Z]' ? currentWord.toLowerCase() : ''))) {
            foundCurrentWord = true;
            typeSignature = lines[i];
            if (typeSignature !== '') { suggestionList.push(typeSignature); }
          }
        } else {
          if (lines[i].includes(currentWord)) {
            foundCurrentWord = true;
            typeSignature = lines[i];
            if (typeSignature !== '') { suggestionList.push(typeSignature); }
          }
        }

        returnInfo += '\n' + lines[i];
        j++;
        if (j > config['userProjectMaxCommentSize']) {
          returnInfo += '\n...';
          break;
        }
      }

      suggestionList.map(item => {
        results.push({
          name: (item != '' ? item : currentWord).replace('|', '').replace('=', '').trim().split(splitOnSpace)[0].trim(),
          fullName: (item != '' ? item : currentWord).replace('|', '').replace('=', '').trim().split(splitOnSpace)[0].trim(),
          signature: item.replace('|', '').replace('=', '').trim(),
          href: filename,
          kind: vscode.CompletionItemKind.Enum,
          comment: returnInfo + '\n--' + filename
        });
      })
    }

    //Step 5: Look up type aliases
    if (/^(type alias)/.test(lines[i].toLowerCase())) {
      let returnInfo = '';
      suggestionList = [];
      if (toLowerOrHover(action, lines[i]).includes('type alias ' + (currentWord !== '[a-zA-Z]' ? currentWord.toLowerCase() + ' ' : gOriginalWord.split('.')[1].trim()))) {
        let j = 0;
        returnInfo = lines[i];
        if (action === OracleAction.IsHover || currentWord === '[a-zA-Z]') {
          suggestionList.push(lines[i].replace('type alias ', '').replace('=', '').trim());
        }

        while (lines[i].trim() !== '' && !lines[i].match(/^module/)) {
          i++;

          if (action === OracleAction.IsAutocomplete && currentWord !== '[a-zA-Z]') {
            if (lines[i].trim() !== '' && lines[i].trim() !== '}') {
              suggestionList.push(lines[i]);
            }
          }
          returnInfo += '\n' + lines[i];

          j++;
          if (j > config['userProjectMaxCommentSize']) {
            returnInfo += '\n...';
            break;
          }
        }

        suggestionList.map(item => {
          let field = item.split(':')[0];
          let cleanField = field.replace('{', '').replace(',', '').trim();
          results.push({
            name: cleanField,
            fullName: cleanField,
            signature: item.replace('{', '').trim(),
            href: filename,
            kind: (action === OracleAction.IsHover ? vscode.CompletionItemKind.Interface : vscode.CompletionItemKind.Property),
            comment: returnInfo + '\n--' + filename
          });
        });
      }
    }
  }

  return results;
}