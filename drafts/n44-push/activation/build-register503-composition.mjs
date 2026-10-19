/** AI: only changed service graph; no old bundle/evidence overwritten. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
if(esbuild.version!=='0.28.1')throw Error('n44_builder_version');
const hash=b=>createHash('sha256').update(b).digest('hex'),out='drafts/n44-push/activation/register503-composition/';
const r=await esbuild.build({entryPoints:['supabase/functions/n44-notifications/index.ts'],bundle:true,format:'esm',target:'es2022',platform:'neutral',packages:'external',write:false,metafile:true,logLevel:'silent'});
const manifest={aiAuthored:true,taskId:'continuous-n44-register503-existing-service-repair-20261019',runId:'0bc1d68d-dc66-4230-8172-3f77449f23f6',purpose:'Remove demonstrated duplicate registration snapshot under unchanged12s fence; original hosted503 phase unknown',sources:{},outputs:{'edge.mjs':hash(r.outputFiles[0].contents)},globalDelivery:false,cron:[],liveRegistrations:0,providerSendAttempts:0,consumedDiagnosticPreserved:true};
for(const p of Object.keys(r.metafile.inputs).sort())manifest.sources[p]=hash((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
await mkdir(out,{recursive:true});await writeFile(out+'edge.mjs',r.outputFiles[0].contents);await writeFile(out+'manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({sourceOnly:true,bundleSha256:manifest.outputs['edge.mjs']}));
