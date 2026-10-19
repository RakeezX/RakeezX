/** AI: affected Edge-only offline packaging, preserving ingress/scheduler bytes. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const dir='drafts/n44-push/activation/',hash=b=>createHash('sha256').update(b).digest('hex');
const tool='C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js',esbuild=createRequire(import.meta.url)(tool);
const m=JSON.parse(await readFile(dir+'manifest.json','utf8'));assert.equal(esbuild.version,'0.28.1');assert.equal(hash((await readFile(tool,'utf8')).replaceAll('\r\n','\n')),m.tools.esbuildMainSha256);
for(const p of ['cloudflare/worker.mjs','scheduler/worker.mjs'])assert.equal(hash(await readFile(dir+'bundle/'+p)),m.outputs[p]);
const absolute={name:'actual-app-absolute-imports',setup(b){b.onResolve({filter:/^\/src\//},a=>({path:path.resolve('.'+a.path)}));}};
const result=await esbuild.build({entryPoints:['supabase/functions/n44-notifications/index.ts'],bundle:true,format:'esm',target:'es2022',platform:'neutral',packages:'external',write:false,metafile:true,logLevel:'silent',plugins:[absolute]});
assert.equal(result.outputFiles.length,1);await writeFile(dir+'bundle/edge/index.mjs',result.outputFiles[0].contents);m.outputs['edge/index.mjs']=hash(result.outputFiles[0].contents);
m.graphs['edge/index.mjs']={inputs:Object.keys(result.metafile.inputs).sort(),imports:Object.values(result.metafile.outputs).flatMap(o=>o.imports)};
for(const p of Object.keys(result.metafile.inputs))m.sources[p]=hash((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
await writeFile(dir+'manifest.json',JSON.stringify(m,null,2)+'\n');console.log('Affected Edge-only bundle '+m.outputs['edge/index.mjs']+'; ingress/scheduler unchanged.');
