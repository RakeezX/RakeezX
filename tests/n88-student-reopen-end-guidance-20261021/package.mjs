/** AI: established private bundle recipe, scoped to the allowed student asset only. No publication. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import path from 'node:path';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const brandAssets=['header-light-standard.svg','header-light-compact.svg','header-dark-standard.svg','header-dark-compact.svg','icon-192.png'];
const absolute={name:'actual-app-absolute-imports',setup(build){build.onResolve({filter:/^\/src\//},args=>({path:path.resolve('.'+args.path)}));}};
const privateAssets={name:'private-document-asset-urls',setup(build){build.onLoad({filter:/[\\/]src[\\/](lib[\\/]brand|views[\\/]student-portal-login)\.js$/},async({path:file})=>{let contents=await readFile(file,'utf8');if(path.basename(file)==='brand.js')for(const asset of brandAssets)contents=contents.replace(`new URL('../../assets/${asset}', import.meta.url)`,`new URL('/n88-private/assets/brand/${asset}', import.meta.url)`);else contents=contents.replace("new URL('../styles/student-portal-login.css', import.meta.url)","new URL('/n88-private/styles/student-portal-login.css', import.meta.url)");return {contents,loader:'js',resolveDir:path.dirname(file)};});}};
const built=await esbuild.build({entryPoints:['drafts/n88-student-portal/client/student-entry.js'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[absolute,privateAssets]});
assert.equal(built.outputFiles.length,1);
const target='drafts/n88-student-portal/activation/bundle/private/assets/student.mjs';
if(process.argv.includes('--check'))assert.deepEqual(await readFile(target),Buffer.from(built.outputFiles[0].contents));else await writeFile(target,built.outputFiles[0].contents);
// The draft activation carrier predates the published transport/region fixes.
// Prepare against the immutable source in its recorded exact provider readback.
const prior=await readFile('tests/n88-student-session-quiet-progress-20261021/carrier.mjs','utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(prior),'6108647af490b79e5cfff9c0909726aa2282628f034eb9bbea5076f35dc83e3b');
const prefix='var privateAssets = Object.freeze(',start=prior.indexOf(prefix)+prefix.length,end=prior.indexOf(');',start);
assert(start>=prefix.length&&end>start);
const assets=JSON.parse(prior.slice(start,end)),key='/n88-private/assets/student.mjs';
const old=assets[key].base64,next=Buffer.from(built.outputFiles[0].contents).toString('base64');
assert.equal(prior.split(old).length,2);
const prepared=prior.replace(old,next),carrier='tests/n88-student-reopen-end-guidance-20261021/carrier.mjs';
const after=JSON.parse(prepared.slice(start,prepared.indexOf(');',start)));
assert.deepEqual(Object.keys(after),Object.keys(assets));
for(const name of Object.keys(assets))if(name!==key)assert.deepEqual(after[name],assets[name]);
assert.equal(prepared.replace(next,old),prior); // Every other carrier byte is retained.
if(process.argv.includes('--check'))assert.equal(await readFile(carrier,'utf8'),prepared);else await writeFile(carrier,prepared);
console.log('Prepared source-derived private student bundle; carrier publication NOT_RUN');
