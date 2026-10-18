/** AI: deterministic offline packaging, no install/provider/secret/network operation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const tool=process.argv[2];assert.ok(tool,'Pass installed esbuild main.js');
const esbuild=createRequire(import.meta.url)(path.resolve(tool));assert.equal(esbuild.version,'0.28.1');
const dir='drafts/n44-push/activation/',out=dir+'bundle/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const textHash=async f=>hash((await readFile(f,'utf8')).replaceAll('\r\n','\n'));
const manifest={aiAuthored:true,sourceOnly:true,enabled:false,projectId:'xlrubcwjqktzzunrvuns',migrationVersion:'20261018044448',
 metadata:JSON.parse(await readFile(dir+'metadata-contract.json','utf8')).inputSha256,
 sourceHashEncoding:'UTF-8 LF (Git canonical text); bundle outputs SHA256 of exact bytes',
 tools:{...JSON.parse(await readFile(dir+'toolchain.json','utf8')).tools,esbuildMainSha256:await textHash(tool)},
 sources:{},outputs:{},graphs:{},externalDependencies:JSON.parse(await readFile('drafts/n44-push/package.json','utf8')).dependencies,
 gates:{edgeEnabled:false,cloudflareEnabled:false,schedulerEnabled:false,deliveryEnabled:false,browserEnabled:false,serviceWorkerEnabled:false,routes:[],cron:[]}};
const absolute={name:'actual-app-absolute-imports',setup(build){build.onResolve({filter:/^\/src\//},args=>({path:path.resolve('.'+args.path)}));}};
for(const [name,entry,platform] of [
 ['edge/index.mjs','supabase/functions/n44-notifications/index.ts','neutral'],
 ['cloudflare/worker.mjs','drafts/n44-push/cloudflare-entry.mjs','browser'],
 ['scheduler/worker.mjs','drafts/n44-push/scheduler-entry.mjs','browser']
]) {
 const result=await esbuild.build({entryPoints:[entry],bundle:true,format:'esm',target:'es2022',platform,packages:'external',write:false,metafile:true,logLevel:'silent',plugins:[absolute]});
 assert.equal(result.outputFiles.length,1);await mkdir(path.dirname(out+name),{recursive:true});
 await writeFile(out+name,result.outputFiles[0].contents);manifest.outputs[name]=hash(result.outputFiles[0].contents);
 manifest.graphs[name]={inputs:Object.keys(result.metafile.inputs).sort(),imports:Object.values(result.metafile.outputs).flatMap(o=>o.imports)};
 for(const file of Object.keys(result.metafile.inputs))manifest.sources[file]=await textHash(file);
}
for(const name of ['deno.json','deno.lock']) {
 const source='supabase/functions/n44-notifications/'+name,content=(await readFile(source,'utf8')).replaceAll('\r\n','\n');
 await writeFile(out+'edge/'+name,content);manifest.outputs['edge/'+name]=hash(content);manifest.sources[source]=await textHash(source);
}
const importMap=JSON.stringify({imports:JSON.parse(await readFile(out+'edge/deno.json','utf8')).imports},null,2)+'\n';
await writeFile(out+'edge/import_map.json',importMap);manifest.outputs['edge/import_map.json']=hash(importMap);
for(const file of ['scripts/n44-activation-prepare.mjs','scripts/n44-activation-bundle.mjs','scripts/n44-activation-readback.mjs',
 'supabase/migrations/20261018044448_n44_exact_activation_staged.sql',
 ...['metadata-contract.json','preflight.inactive.sql','readback.inactive.sql','identities.inactive.sql','expected-identities.json','deploy.staged.json','supabase.staged.toml','wrangler.staged.toml','scheduler.staged.toml','toolchain.json','client-readiness.json','.gitattributes'].map(f=>dir+f),
 ...['schema-proposal.sql','existing-host.inactive.sql','canonical-source.inactive.sql','package-lock.json','deployment.inactive.json'].map(f=>'drafts/n44-push/'+f)])manifest.sources[file]=await textHash(file);
await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('N44 exact Edge/ingress/private scheduler bundled OFFLINE, all flags OFF.');
