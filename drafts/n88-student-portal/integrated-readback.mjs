/** AI: offline comparison of separately authorized metadata readback. No service calls. */
import {isDeepStrictEqual} from 'node:util';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function verifyIntegratedReadback(actual,expected){
  if(actual.projectId!=='xlrubcwjqktzzunrvuns'||actual.mode!=='metadata-only'||actual.personalRowsRead!==0||actual.enabled!==false||!Number.isFinite(Date.parse(actual.capturedAt))||
    !isDeepStrictEqual(actual.migrationVersions,expected.migrationVersions)||!isDeepStrictEqual(actual.identities,expected.identities))throw Error('N88 integrated metadata identity mismatch; keep activation OFF');
  return 'N88 integrated migration/helper/role/grant/policy identities match; live activation remains separate';
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==4)throw Error('Pass actual metadata-only JSON and integrated-expected-identities.json');
  console.log(verifyIntegratedReadback(JSON.parse(await readFile(process.argv[2],'utf8')),JSON.parse(await readFile(process.argv[3],'utf8'))));
}
