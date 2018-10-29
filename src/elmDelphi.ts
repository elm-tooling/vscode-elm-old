let fs = require('fs');
let process = require('process');
let path = require('path');
let os = require('os');

interface ElmDocModuleValue {
  name: string;
  comment: string;
  type: string;
}

interface ElmDocModule {
  name: string;
  comment: string;
  values: ElmDocModuleValue[];
}

interface ElmJsonDependencies {
  [key: string]: string;
}

interface ElmJson {
  dependencies: {
    direct: ElmJsonDependencies,
    indirect: ElmJsonDependencies,
  };
}

interface ElmOracleCompatibleResult {
  name: string;
  fullName: string;
  href: string;
  signature: string;
  comment: string;
}

declare global {
  interface Array<T> {
    flatMap: <V>(predicate: (value: T) => V[]) => V[];
  }
}

Array.prototype.flatMap = function <T, V>(predicate: (value: T) => V[]) {
  return [].concat.apply([], this.map(predicate));
};


function readFile(filePath: string) {
  return fs.readFileSync(filePath, { encoding: 'UTF-8', flag: 'r' }) as string;
}

function parseImports(elmCode: string) {
  return elmCode
    .split('\n')
    .filter(x => x.startsWith('import '))
    .map(x => x.match(/import ([^\s]+)(?: as ([^\s]+))?(?: exposing (\(.+\)))?/))
    .filter(x => x != null)
    .map(matches => {
      const importedMembers = matches[3];
      const exposed = importedMembers === undefined
        ? null
        : importedMembers
          .split(/[(),]/)
          .map(x => x.trim())
          .filter(x => x !== '');

      return {
        moduleName: matches[1],
        alias: matches[2] || matches[1],
        exposed: exposed,
      };
    });
}

function getAllDependenciesFromElmJson(elmPath: string) {
  const elmJsonPath = path.join(elmPath, 'elm.json');
  const elmJson = JSON.parse(readFile(elmJsonPath)) as ElmJson;
  return elmJson.dependencies.direct;
}

function loadDocsForDependencies(packageFolderPath: string, dependencies: ElmJsonDependencies) {
  let allDocs: ElmDocModule[] = [];
  for (const dependencyKey of Object.keys(dependencies)) {
    const version = dependencies[dependencyKey];
    const docPath = path.join(packageFolderPath, dependencyKey, version, 'documentation.json');
    const moduleDocs = JSON.parse(readFile(docPath)) as ElmDocModule[];
    allDocs = allDocs.concat(moduleDocs);
  }
  return allDocs;
}

function classifyQuery(query: string) {
  const parts = query.split('.');
  if (parts.length === 1) {
    return { name: query };
  }
  if (parts.length > 1) {
    const name = parts[parts.length - 1];
    return { module: parts.slice(0, parts.length - 1).join('.'), name: name };
  }
  throw 'Illegal query: ' + query;
}

function searchByModuleName(docs: ElmDocModule[], moduleName: string, name: string): ElmOracleCompatibleResult[] {
  return docs
    .filter(doc => doc.name === moduleName)
    .flatMap(doc => {
      return doc
        .values
        .filter(v => v.name.startsWith(name))
        .map(v => {
          return {
            name: v.name,
            fullName: moduleName + '.' + v.name,
            href: 'http://elm-lang.org',
            signature: v.type,
            comment: v.comment,
          };
        });
    });
}

// --- Program proper ---

export function askOracle(windowsOS: boolean, projectPath: string, elmFilename: string, query: string) {
  const elmCode =
    `import Basics exposing (..)
import List exposing (List, (::))
import Maybe exposing (Maybe(..))
import Result exposing (Result(..))
import String exposing (String)
import Char exposing (Char)
import Tuple

import Debug

import Platform exposing ( Program )
import Platform.Cmd as Cmd exposing ( Cmd )
import Platform.Sub as Sub exposing ( Sub )
` + readFile(path.join(projectPath, elmFilename));

  const imports = parseImports(elmCode);
  const classifiedQuery = classifyQuery(query);

  const hasElmJson = fs.existsSync(path.join(projectPath, 'elm.json'));
  if (!hasElmJson) {
    throw 'Cannot find elm.json in project path';
  }

  const elmRoot = windowsOS ? path.join(process.env.appdata, 'elm') : path.join(os.homedir(), '.elm');
  const packageFolderPath = path.join(elmRoot, '0.19.0/package');

  const dependencies = getAllDependenciesFromElmJson(projectPath);
  const docs = loadDocsForDependencies(packageFolderPath, dependencies);

  let result: ElmOracleCompatibleResult[] = [];
  if (classifiedQuery.module) {
    const refImport = imports.find(imp => imp.alias === classifiedQuery.module);
    if (refImport !== undefined) {
      result = searchByModuleName(docs, refImport.moduleName, classifiedQuery.name);
    }
  } else {
    const modulesToSearch =
      imports
        .filter(x => x.exposed === null ? false : x.exposed.some(e => e === '..' || e.startsWith(classifiedQuery.name)))
        .map(x => x.moduleName);

    result = modulesToSearch
      .flatMap(moduleName => searchByModuleName(docs, moduleName, classifiedQuery.name));
  }
  return result;
}
