/** AI: affected source-only bundles; never replace historical deployed readbacks. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const tool='C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js';
const build=createRequire(import.meta.url)(tool);assert.equal(build.version,'0.28.1');
const hash=b=>createHash('sha256').update(b).digest('hex');
const base='drafts/n44-push/activation/',out=base+'device-optin/';await mkdir(out,{recursive:true});
const m={aiAuthored:true,sourceOnly:true,deployed:false,taskId:'continuous-n44-single-device-optin-ready-20261019',runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',priorNativeReadback:base+'runtime-final-native.json',priorNativeReadbackSha256:hash(await readFile(base+'runtime-final-native.json')),sources:{},outputs:{},graphs:{},globalDeliveryEnabled:false,cron:[],actualRegistrations:0,providerSendAttempts:0};
for(const [name,entry,platform] of [['edge.mjs','supabase/functions/n44-notifications/index.ts','neutral'],['ingress.mjs','drafts/n44-push/cloudflare-entry.mjs','browser']]) {
 const r=await build.build({entryPoints:[entry],bundle:true,format:'esm',target:'es2022',platform,packages:'external',write:false,metafile:true,logLevel:'silent'});
 assert.equal(r.outputFiles.length,1);await writeFile(out+name,r.outputFiles[0].contents);m.outputs[name]=hash(r.outputFiles[0].contents);
 m.graphs[name]=Object.keys(r.metafile.inputs).sort();
 for(const p of m.graphs[name])m.sources[p]=hash((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
}
for(const p of ['src/lib/notification-push-runtime.js','src/lib/notification-push-gateway.js','sw.js'])m.sources[p]=hash((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
const deployed=JSON.parse(await readFile(base+'runtime-final-native.json','utf8'));
assert.equal(deployed.version,32);assert.equal(deployed.sourceSha256,'705a2df980bc411a8a64f5f25b5b72e1f1f58abfdb8671d10125a48cf93a052f');
assert.notEqual(m.outputs['edge.mjs'],deployed.sourceSha256);
await writeFile(out+'manifest.json',JSON.stringify(m,null,2)+'\n');
console.log('Prepared affected Edge/ingress bundles locally; v32 provider evidence untouched; deployment NOT_RUN.');
