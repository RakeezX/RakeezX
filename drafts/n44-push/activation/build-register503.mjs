/** AI: source-only affected Edge bundle; no service/fixture operation. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
if(esbuild.version!=='0.28.1')throw Error('n44_builder_version');
const hash=b=>createHash('sha256').update(b).digest('hex'),out='drafts/n44-push/activation/register503/';
const r=await esbuild.build({entryPoints:['supabase/functions/n44-notifications/index.ts'],bundle:true,format:'esm',target:'es2022',platform:'neutral',packages:'external',write:false,metafile:true,logLevel:'silent'});
const manifest={aiAuthored:true,taskId:'continuous-n44-register503-existing-service-repair-20261019',runId:'f6beb7aa-5700-4ef2-b759-129b88b7ac11',purpose:'Finite registration failure observability; original503 cause remains unproven',sources:{},outputs:{'edge.mjs':hash(r.outputFiles[0].contents)},deliveryEnabled:false,cron:[],registrations:0,sends:0};
for(const p of Object.keys(r.metafile.inputs).sort())manifest.sources[p]=hash((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
await mkdir(out,{recursive:true});await writeFile(out+'edge.mjs',r.outputFiles[0].contents);await writeFile(out+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sourceOnly:true,edgeSha256:manifest.outputs['edge.mjs']}));
