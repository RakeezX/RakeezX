/** AI: established source-derived private bundle recipe. Preparation only; no provider API. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const dir='tests/n88-student-quiet-fast-return-20261021/';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const brandAssets=['header-light-standard.svg','header-light-compact.svg','header-dark-standard.svg','header-dark-compact.svg','icon-192.png'];
const absolute={name:'actual-app-absolute-imports',setup(build){build.onResolve({filter:/^\/src\//},args=>({path:path.resolve('.'+args.path)}));}};
const privateAssets={name:'private-document-asset-urls',setup(build){build.onLoad({filter:/[\\/]src[\\/](lib[\\/]brand|views[\\/]student-portal-login)\.js$/},async({path:file})=>{
 let contents=await readFile(file,'utf8');
 if(path.basename(file)==='brand.js')for(const asset of brandAssets)contents=contents.replace(`new URL('../../assets/${asset}', import.meta.url)`,`new URL('/n88-private/assets/brand/${asset}', import.meta.url)`);
 else contents=contents.replace("new URL('../styles/student-portal-login.css', import.meta.url)","new URL('/n88-private/styles/student-portal-login.css', import.meta.url)");
 return {contents,loader:'js',resolveDir:path.dirname(file)};
});}};
const built=await esbuild.build({entryPoints:['drafts/n88-student-portal/client/student-entry.js'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[absolute,privateAssets]});
assert.equal(built.outputFiles.length,1);
const student=Buffer.from(built.outputFiles[0].contents),css=Buffer.from((await readFile('src/styles/student-portal-login.css','utf8')).replaceAll('\r\n','\n'));
const outputs={'drafts/n88-student-portal/activation/bundle/private/assets/student.mjs':student,'drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css':css};
const prior=await readFile('tests/n88-student-pending-return-finite-diagnostic-20261021/carrier.mjs','utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(prior),'6978352dfa73746a9c4a2cc85e822545483427d4834f172a04abb963f136068e');
const prefix='var privateAssets = Object.freeze(',start=prior.indexOf(prefix)+prefix.length,end=prior.indexOf(');',start);
assert(start>=prefix.length&&end>start);
const before=JSON.parse(prior.slice(start,end)),replacements={'/n88-private/assets/student.mjs':student,'/n88-private/styles/student-portal-login.css':css};
let prepared=prior;
for(const [key,bytes] of Object.entries(replacements)){
 const old=before[key].base64,next=bytes.toString('base64');assert.equal(prepared.split(old).length,2);prepared=prepared.replace(old,next);
}
const after=JSON.parse(prepared.slice(start,prepared.indexOf(');',start)));assert.deepEqual(Object.keys(after),Object.keys(before));
let restored=prepared;
for(const name of Object.keys(before)){
 if(!Object.hasOwn(replacements,name))assert.deepEqual(after[name],before[name]);
 else {assert.equal(after[name].type,before[name].type);assert.deepEqual(Buffer.from(after[name].base64,'base64'),replacements[name]);restored=restored.replace(after[name].base64,before[name].base64);}
}
assert.equal(restored,prior); // Every non-student-module/style carrier byte is identical.
outputs[dir+'carrier.mjs']=Buffer.from(prepared);
for(const [file,bytes] of Object.entries(outputs)){
 if(process.argv.includes('--check'))assert.deepEqual(await readFile(file),bytes);else await writeFile(file,bytes);
}
const report={status:'PASS',publication:'NOT_RUN',priorCarrierSha256:sha(prior),carrierSha256:sha(prepared),studentSha256:sha(student),styleSha256:sha(css),changedPrivateAssets:Object.keys(replacements),allOtherCarrierBytesIdentical:true};
if(!process.argv.includes('--check'))await writeFile(dir+'bundle-preparation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
