import * as cp from 'child_process';

export function execCmd(cmd: string, opt: {}): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      cp.exec(cmd, opt, (err, stdout, stder) => {
        if (err) {
          reject(err);
        }
        if (stder && stder.toString() && stder.toString() != null && stder.toString() !== '') {
          reject(stder.toString());
        }
        resolve(stdout.toString());
      });
    } catch (e) {
      reject(e);
    }
  });
}
  
  
export function getIndicesOf(searchStr : string, str : string) : number[] {
  var startIndex = 0, searchStrLen = searchStr.length;
  var index, indices = [];
  while ((index = str.indexOf(searchStr, startIndex)) > -1) {
    indices.push(index);
    startIndex = index + searchStrLen;
  }
  return indices;
}