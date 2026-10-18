/** AI-authored: exact metadata comparison, no provider access or personal rows. */
import {readFile,writeFile} from 'node:fs/promises';
const [actualPath,expectedPath]=process.argv.slice(2);
const actual=JSON.parse(await readFile(actualPath,'utf8')).identities;
const expectedDocument=JSON.parse(await readFile(expectedPath,'utf8'));
const expected=expectedDocument.identities??expectedDocument;
const differences=[];
function compare(a,b,p){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],p+'.'+k);}else differences.push({path:p,actual:a,expected:b});}
compare(actual,expected,'identities');
const receipt={status:differences.length?'FAIL':'PASS',actualPath,expectedPath,differences};
await writeFile(actualPath.replace('.json','-comparison.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));if(differences.length)process.exitCode=1;
