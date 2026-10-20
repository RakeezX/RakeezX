/** AI: changed Edge graph only; private document/carrier bytes are untouched. */
import assert from 'node:assert/strict';import {readFile,writeFile,unlink} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const dir='drafts/n88-student-portal/activation/',sha=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(await readFile(dir+'manifest.json','utf8'));
const prior=manifest.outputs['edge/index.mjs'];assert.equal(prior,'420a57e65cc242652f266693c5280f9b112791cdeb556910f90796c39d5b0253');
const native=await readFile('tests/n88-hosted-failure-20261020/native-before.tmp.mjs','utf8'),old=await readFile(dir+'bundle/edge/index.mjs','utf8');assert.equal(native,old+'\n');await unlink('tests/n88-hosted-failure-20261020/native-before.tmp.mjs');
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const b=await esbuild.build({entryPoints:['supabase/functions/n88-student-portal/index.ts'],bundle:true,platform:'neutral',format:'esm',target:'es2022',external:['node:*','pg','@supabase/auth-js'],write:false,metafile:true,logLevel:'silent'});
const source=sha(b.outputFiles[0].contents);assert.notEqual(source,prior);await writeFile(dir+'bundle/edge/index.mjs',b.outputFiles[0].contents);manifest.outputs['edge/index.mjs']=source;
manifest.graphs['edge/index.mjs']={inputs:Object.keys(b.metafile.inputs).sort(),imports:Object.values(b.metafile.outputs).flatMap(o=>o.imports)};
for(const p of [...manifest.graphs['edge/index.mjs'].inputs,'src/lib/student-portal-runtime.js','src/views/student-portal-class.js','src/styles/student-portal-class.css'])manifest.sources[p]=sha((await readFile(p,'utf8')).replaceAll('\r\n','\n'));
manifest.hosted1336={taskId:'continuous-n88-hosted-failure-after-deadline-fix-20261020',runId:'63d4981f-2d89-4240-acc3-26ea973b4f79',priorNativeVersion:49,priorSource:prior,source,privateAssetsChanged:false,actualTeacherSuccess:'NOT_PROVEN'};
await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.hosted1336));
