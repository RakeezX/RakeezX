/** AI: reuse the certified esbuild pipeline options for ingress ONLY, offline. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const dir='drafts/n44-push/activation/',hash=b=>createHash('sha256').update(b).digest('hex');
const tool='C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js';
const esbuild=createRequire(import.meta.url)(tool),manifest=JSON.parse(await readFile(dir+'manifest.json','utf8'));
assert.equal(esbuild.version,'0.28.1');assert.equal(hash((await readFile(tool,'utf8')).replaceAll('\r\n','\n')),manifest.tools.esbuildMainSha256);
for(const name of ['edge/index.mjs','scheduler/worker.mjs'])assert.equal(hash(await readFile(dir+'bundle/'+name)),manifest.outputs[name]);
const result=await esbuild.build({entryPoints:['drafts/n44-push/cloudflare-entry.mjs'],bundle:true,format:'esm',target:'es2022',platform:'browser',packages:'external',write:false,metafile:true,logLevel:'silent'});
assert.equal(result.outputFiles.length,1);const name='cloudflare/worker.mjs';
await writeFile(dir+'bundle/'+name,result.outputFiles[0].contents);manifest.outputs[name]=hash(result.outputFiles[0].contents);
manifest.graphs[name]={inputs:Object.keys(result.metafile.inputs).sort(),imports:Object.values(result.metafile.outputs).flatMap(o=>o.imports)};
assert.deepEqual(manifest.graphs[name].imports,[]);
for(const file of manifest.graphs[name].inputs)manifest.sources[file]=hash((await readFile(file,'utf8')).replaceAll('\r\n','\n'));
await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('N44 ingress-only offline bundle '+manifest.outputs[name]+'; Edge/scheduler unchanged.');
