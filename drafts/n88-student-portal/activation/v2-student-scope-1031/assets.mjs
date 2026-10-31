/** AI: offline current-main service/student/gateway closure. No network, upload or activation. */
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {privateAssets as baseline} from '../private-document.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),dir=fileURLToPath(new URL('./',import.meta.url));
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/4657ece8094f916a/node_modules/esbuild');
if(esbuild.version!=='0.28.1')throw Error('n88_exact_builder_required');
const source=async f=>(await readFile(f,'utf8')).replaceAll('\r\n','\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
const build=async(entry,platform,external=[],plugins=[])=>esbuild.build({absWorkingDir:root,entryPoints:[entry],bundle:true,write:false,format:'esm',platform,target:'es2022',external,plugins,metafile:true,logLevel:'silent'});
const student=await build('drafts/n88-student-portal/client/student-entry.js','browser',[],[{name:'current-src',setup(b){b.onResolve({filter:/^\/src\//},a=>({path:path.join(root,a.path.slice(1))}));}}]);
const assets=structuredClone(baseline);
assets['/n88-private/assets/student.mjs']={type:'text/javascript; charset=utf-8',base64:Buffer.from(student.outputFiles[0].contents).toString('base64')};
for(const name of ['app.css','student-portal-login.css','student-portal.css'])assets['/n88-private/styles/'+name]={type:'text/css; charset=utf-8',base64:Buffer.from(await source(path.join(root,'src/styles/'+name))).toString('base64')};
await writeFile(path.join(dir,'private-assets.inactive.mjs'),'// AI: generated exact current published source; no activation.\nexport const privateAssets=Object.freeze('+JSON.stringify(assets)+');\n');
await writeFile(path.join(dir,'student.prepared.mjs'),student.outputFiles[0].contents);
const service=await build('supabase/functions/n88-student-portal/index.ts','neutral',['node:*','pg','@supabase/auth-js']);await writeFile(path.join(dir,'service.prepared.mjs'),service.outputFiles[0].contents);
const gateway=await build('drafts/n88-student-portal/activation/v2-student-scope-1031/gateway.inactive.mjs','browser');await writeFile(path.join(dir,'gateway.prepared.mjs'),gateway.outputFiles[0].contents);
const inputs={};for(const result of [student,service,gateway])for(const file of Object.keys(result.metafile.inputs))if(!inputs[file])inputs[file]=sha(await source(path.join(root,file)));
const record={aiAuthored:true,sourceEncoding:'utf8-lf-preserve-bom',preparedEncoding:'utf8-lf-preserve-bom (normalize CRLF before upload; embedded asset base64 decodes exact bytes)',sourceBase:'5b77024e36f254a6568a0224abb9ea25d78698af',publishedUiDependency:'5b77024e36f254a6568a0224abb9ea25d78698af',publicationControlsDependency:'current-main src/views/student-portal-class.js (exclusive V2/V1 controls preserved)',enabled:false,flags:{N88_PUBLICATION_V2_ENABLED:false,PUBLICATION_V2_READINESS:false,V1Readiness:true},installed:false,builder:'esbuild@'+esbuild.version,inputs,outputs:{student:sha(student.outputFiles[0].contents),service:sha(service.outputFiles[0].contents),gateway:sha(gateway.outputFiles[0].contents)},assets:Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,{type:v.type,sha256:sha(Buffer.from(v.base64,'base64')),changed:baseline[k]?.base64!==v.base64}])),externalServiceImports:Object.keys(service.metafile.outputs).flatMap(k=>service.metafile.outputs[k].imports),denoImports:JSON.parse(await readFile(path.join(root,'supabase/functions/n88-student-portal/deno.json'),'utf8')).imports};
await writeFile(path.join(dir,'assets-manifest.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({outputs:record.outputs,assets:Object.keys(assets).length,enabled:false,installed:false}));
const sql=JSON.parse(await source(path.join(dir,'manifest.json')));
const delivery={version:1,aiAuthored:true,taskId:sql.taskId,runId:sql.runId,sourceBase:record.sourceBase,enabled:false,installed:false,hostedOperations:0,
 sqlBundleSha256:sql.bundleSha256,installerSha256:sql.installerSha256,disableSha256:sql.disableSha256,readbackSha256:sql.readbackSha256,
 outputs:record.outputs,assetAllowlist:Object.keys(assets).sort(),flags:record.flags,privateReaders:[sql.labelRead],storage14Unchanged:true};
delivery.deliverySha256=sha(JSON.stringify(delivery));
await writeFile(path.join(dir,'delivery-manifest.json'),JSON.stringify(delivery,null,2)+'\n');
