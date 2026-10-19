/** AI: explicit OFFLINE esbuild packaging. No provider invocation, listener or secret input. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const tool=process.argv[2];assert.ok(tool,'Pass installed esbuild main.js; never install/fetch implicitly');
const esbuild=createRequire(import.meta.url)(path.resolve(tool));assert.equal(esbuild.version,'0.28.1');
const dir='drafts/n88-student-portal/activation/',out=dir+'bundle/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const textHash=async f=>sha((await readFile(f,'utf8')).replaceAll('\r\n','\n'));
const manifest={aiAuthored:true,sourceOnly:true,enabled:false,projectId:'xlrubcwjqktzzunrvuns',serviceRevision:'n88-integrated-class-v1',baselineEvidence:'prior-task-guidance-manifest.json (delivered H baseline; final merged four dependency sources plus guidance freshly hashed)',credentialContract:{format:'six-v1',pattern:'^1[0-9]{5}$',capacity:100000},migrationGeneration:{cliVersion:'2.120.0',command:'npm exec --offline -- supabase migration new n88_task_guidance_staged',version:'20261018125611'},metadata:JSON.parse(await readFile(dir+'metadata-contract.json','utf8')).inputSha256,
  taskGuidanceContract:JSON.parse(await readFile(dir+'deploy.staged.json','utf8')).taskGuidanceContract,
  recoveryContract:{"revision": "teacher-active-code-aead-v1", "algorithm": "AES-256-GCM", "envelopeVersion": 1, "nonceBytes": 12, "tagBytes": 16, "keyBytes": 32, "nonceLedger": "append-only UNIQUE(key_version,nonce), retained across revoked credentials/rewrap/restarts; eight fresh-nonce collision attempts only", "aad": ["envelopeId", "envelopeVersion", "algorithm", "keyVersion", "credentialId", "credentialVersion", "ownerId", "studentId", "format", "generation"], "legacy": "honest hash-only, explicit selective rotate only", "unknownCommit": "freshly authorized current list may recover only proven current credential; no reissue inference", "retention": "private append-only encrypted generations and permanent nonce tombstones; never reveal revoked/historical generations"},
  budgetContract:{revision:'committed-success-settlement-v1',windowMs:900000,failedGuesses:{source:6,global:100},allRequests:{source:120,global:1200},maxAttempts:10000,unknownCommit:'retain-charge-no-automatic-recovery'},
  sourceHashEncoding:'UTF-8 LF (Git text canonical form); output SHA256 hashes exact bundle bytes',
  tools:{...JSON.parse(await readFile(dir+'toolchain.json','utf8')).tools,esbuild:{version:esbuild.version,mainSha256:await textHash(tool),...JSON.parse(await readFile(dir+'toolchain.json','utf8')).tools.esbuild}},sources:{},outputs:{},graphs:{},
  externalDependencies:{pg:'8.23.1','@supabase/auth-js':'2.118.0'},
  gates:{edgeEnabled:false,cloudflareEnabled:false,browserReadiness:false,routes:[],cron:[]}};
const absolute={name:'actual-app-absolute-imports',setup(build){build.onResolve({filter:/^\/src\//},args=>({path:path.resolve('.'+args.path)}));}};
const boundary=JSON.parse(await readFile(dir+'error-boundary-contract.json','utf8'));
const membershipRepair='supabase/migrations/20261018195100_n88_guard_membership_inherit_staged.sql';
manifest.privateMembershipCorrection={source:membershipRepair,sha256:await textHash(membershipRepair),placement:'after source-bound M1, before M2',role:'n88_guard',member:'postgres',grantor:'postgres',inheritBefore:true,inheritAfter:false,adminUnchanged:false,setUnchanged:false,allOtherEdgesAndFlagsUnchanged:true,originalExpectedIdentityUnchanged:true,localEvidence:'tests/n88-official-activation-membership.json',hostedApplied:false};
const hostedOutcomePath=dir+'hosted-activation-outcome.json';
const hostedOutcome=JSON.parse(await readFile(hostedOutcomePath,'utf8'));
manifest.hostedActivationOutcome={path:hostedOutcomePath,sha256:await textHash(hostedOutcomePath),state:hostedOutcome.state,appliedHistory:hostedOutcome.history,readiness:false,restrictedSession:hostedOutcome.connection.result,sqlstate:hostedOutcome.connection.sqlstate,loginDisarmed:hostedOutcome.finalDisposition.roles.every(r=>!r.login)};
manifest.hostedActivationOutcome.historical=true;
const continuationPath=dir+'continuation-9190735f.json',continuation=JSON.parse(await readFile(continuationPath,'utf8'));
manifest.hostedContinuation={path:continuationPath,sha256:await textHash(continuationPath),state:continuation.state,protocol:continuation.protocol,direct:continuation.direct,providerVersion:continuation.deployedOriginalFunction.providerVersion,finalDisposition:continuation.finalDisposition,blocker:continuation.blocker};
manifest.sources[continuationPath]=await textHash(continuationPath);
manifest.privateMembershipCorrection.hostedApplied=hostedOutcome.history.some(h=>h.sha256===manifest.privateMembershipCorrection.sha256);
for(const file of [membershipRepair,'tests/n88-official-activation-membership.mjs','tests/n88-official-activation-membership.json'])manifest.sources[file]=await textHash(file);
manifest.privateErrorBoundary={revision:'typed-private-boundary-v1',migration:boundary.migration,
  routines:boundary.operations.length,contractSha256:await textHash(dir+'error-boundary-contract.json'),
  identitiesSha256:await textHash(dir+'error-boundary-identities.json'),security:'INVOKER',executeGrantee:'n88_backend',
  hostedApplied:false,readbackRequiredBeforePrivateQuery:true,localEvidence:'tests/n88-official-activation-error-boundary.json'};
manifest.privateErrorBoundary.hostedApplied=hostedOutcome.history.some(h=>h.sha256===boundary.migration.sha256);
for(const file of [boundary.migration.path,dir+'build-error-boundary.mjs',dir+'error-boundary-contract.json',dir+'error-boundary-identities.json',dir+'private-error-boundary.mjs',
  'tests/n88-official-activation-error-boundary.mjs','tests/n88-official-activation-error-boundary.json'])manifest.sources[file]=await textHash(file);
manifest.privateDatabaseTransport={projectId:'xlrubcwjqktzzunrvuns',host:'db.xlrubcwjqktzzunrvuns.supabase.co',port:5432,mode:'direct-original-Edge-IPv6',role:'n88_backend',tls:{verifyHostname:true,rejectUnauthorized:true,minVersion:'TLSv1.2',ca:JSON.parse(await readFile(dir+'ca/provenance.json','utf8'))},publicChallengeEvidence:dir+'hosted-scram-restored-challenge.json',original16384CredentialUnchanged:true,restrictedSessionReadbackRequired:true};
manifest.signedReadiness={path:'/functions/v1/n88-student-portal/readiness',metadataOnly:true,key:'N88_HMAC_KEY',domain:'n88-readiness-v1',productEnabled:false};
for(const file of [dir+'server-first.mjs',dir+'database-transport.mjs',dir+'readiness-entry.mjs',dir+'hosted-scram-public-challenge.json',dir+'hosted-scram-restored-challenge.json','tests/n88-official-activation-direct-readiness.mjs','tests/n88-official-activation-direct-readiness.json'])manifest.sources[file]=await textHash(file);
for(const file of ['drafts/n88-student-portal/official-activation.mjs',dir+'ca/supabase-prod-ca-2021.crt',dir+'ca/provenance.json','tests/n88-official-activation-session-pooler.mjs','tests/n88-official-activation-session-pooler.json','tests/n88-official-activation-scram.mjs','tests/n88-official-activation-scram.json'])manifest.sources[file]=await textHash(file);
// Bundled import.meta.url is the output module, not the original source file.
// Keep the shared app sources intact and pin only this private document's assets.
const brandAssets=['header-light-standard.svg','header-light-compact.svg','header-dark-standard.svg','header-dark-compact.svg','icon-192.png'];
const privateAssets={name:'private-document-asset-urls',setup(build){
  build.onLoad({filter:/[\\/]src[\\/](lib[\\/]brand|views[\\/]student-portal-login)\.js$/},async({path:file})=>{
    let contents=await readFile(file,'utf8');
    if(path.basename(file)==='brand.js')for(const asset of brandAssets)
      contents=contents.replace(`new URL('../../assets/${asset}', import.meta.url)`,`new URL('/n88-private/assets/brand/${asset}', import.meta.url)`);
    else contents=contents.replace("new URL('../styles/student-portal-login.css', import.meta.url)","new URL('/n88-private/styles/student-portal-login.css', import.meta.url)");
    return {contents,loader:'js',resolveDir:path.dirname(file)};
  });
}};
for(const [name,entry,options]of [
  ['edge/index.mjs','supabase/functions/n88-student-portal/index.ts',{platform:'neutral',external:['node:*','pg','@supabase/auth-js']}],
  ['private/assets/student.mjs','drafts/n88-student-portal/client/student-entry.js',{platform:'browser',plugins:[absolute,privateAssets]}]
]) {
  const result=await esbuild.build({entryPoints:[entry],bundle:true,format:'esm',target:'es2022',write:false,metafile:true,logLevel:'silent',...options});
  assert.equal(result.outputFiles.length,1);
  const output=out+name;await mkdir(path.dirname(output),{recursive:true});await writeFile(output,result.outputFiles[0].contents);
  manifest.outputs[name]=sha(result.outputFiles[0].contents);
  manifest.graphs[name]={inputs:Object.keys(result.metafile.inputs).sort(),imports:Object.values(result.metafile.outputs).flatMap(o=>o.imports)};
  for(const specifier of Object.keys(result.metafile.inputs)){
    const file=specifier.split('?')[0];
    // Record transitive source inputs even when tree-shaken; never mutate shared app inputs.
    manifest.sources[file]=await textHash(file);
  }
}
// Record actual account class dependency graph without introducing a second teacher artifact.
const teacherGraph=await esbuild.build({entryPoints:['src/views/student-portal-class.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,logLevel:'silent',plugins:[absolute]});
manifest.graphs.teacherClass={inputs:Object.keys(teacherGraph.metafile.inputs).sort(),delivery:'existing account application and source offline shell; no separate teacher bundle'};
for(const input of manifest.graphs.teacherClass.inputs)manifest.sources[input.split('?')[0]]=await textHash(input.split('?')[0]);
const copies={
  'edge/deno.json':'supabase/functions/n88-student-portal/deno.json',
  'edge/deno.lock':'supabase/functions/n88-student-portal/deno.lock',
  'private/styles/app.css':'src/styles/app.css',
  'private/styles/student-portal-login.css':'src/styles/student-portal-login.css'
};
for(const [name,source]of Object.entries(copies)) {
  const sourceText=(await readFile(source,'utf8')).replaceAll('\r\n','\n');
  const content=name.endsWith('.css')?sourceText.replace(/[\t ]+$/gm,''):sourceText;
  await mkdir(path.dirname(out+name),{recursive:true});await writeFile(out+name,content);
  manifest.sources[source]=sha(sourceText);manifest.outputs[name]=sha(content);
}
const importMap=JSON.stringify({imports:JSON.parse(await readFile(out+'edge/deno.json','utf8')).imports},null,2)+'\n';
await writeFile(out+'edge/import_map.json',importMap);manifest.outputs['edge/import_map.json']=sha(importMap);
manifest.binarySources={};
for(const asset of brandAssets){
  const source='assets/'+asset,name='private/assets/brand/'+asset;
  const content=asset.endsWith('.svg')?(await readFile(source,'utf8')).replaceAll('\r\n','\n'):await readFile(source);
  await mkdir(path.dirname(out+name),{recursive:true});await writeFile(out+name,content);
  if(asset.endsWith('.svg'))manifest.sources[source]=sha(content);else manifest.binarySources[source]=sha(content);
  manifest.outputs[name]=sha(content);
}
// Transform ONLY existing app document asset URLs; no replacement UI/template.
let html=(await readFile('drafts/n88-student-portal/client/student.html','utf8')).replaceAll('\r\n','\n')
  .replace('/src/styles/app.css','/n88-private/styles/app.css').replace('/src/styles/student-portal-login.css','/n88-private/styles/student-portal-login.css')
  .replace('/drafts/n88-student-portal/client/student-entry.js','/n88-private/assets/student.mjs');
await writeFile(out+'private/student.html',html);manifest.outputs['private/student.html']=sha(html);
manifest.sources['drafts/n88-student-portal/client/student.html']=await textHash('drafts/n88-student-portal/client/student.html');
// Original ingress serves only this exact compiled app document/asset allowlist.
// No Pages build hook, broad directory mount, account-app fallback or subrequest.
const documents={'/student':{type:'text/html; charset=utf-8',base64:Buffer.from(html).toString('base64')}};
for(const asset of JSON.parse(await readFile(dir+'deploy.staged.json','utf8')).privateDocument.assetAllowlist){
  const type=asset.endsWith('.mjs')?'text/javascript; charset=utf-8':asset.endsWith('.css')?'text/css; charset=utf-8':asset.endsWith('.svg')?'image/svg+xml':'image/png';
  documents['/n88-private/'+asset]={type,base64:(await readFile(out+'private/'+asset)).toString('base64')};
}
const documentModule=dir+'private-document.mjs';
await writeFile(documentModule,'// AI: generated exact compiled application assets; no private config.\nexport const privateAssets=Object.freeze('+JSON.stringify(documents)+');\n');
const workerBuild=await esbuild.build({entryPoints:['drafts/n88-student-portal/cloudflare-entry.mjs'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true,logLevel:'silent'});
await mkdir(out+'cloudflare/',{recursive:true});await writeFile(out+'cloudflare/worker.mjs',workerBuild.outputFiles[0].contents);
manifest.outputs['cloudflare/worker.mjs']=sha(workerBuild.outputFiles[0].contents);
manifest.graphs['cloudflare/worker.mjs']={inputs:Object.keys(workerBuild.metafile.inputs).sort(),imports:Object.values(workerBuild.metafile.outputs).flatMap(o=>o.imports)};
for(const file of manifest.graphs['cloudflare/worker.mjs'].inputs)manifest.sources[file]=await textHash(file);
manifest.stagedActivation={phase:'owner-restricted-pilot',defaultMode:'off',publicEnabled:false,protectedBindings:['N88_ROLLOUT_MODE','N88_PILOT_BINDING'],maxOwners:1,maxStudents:2,teacherFrontend:'normal authenticated list admission before controls',privateDocumentDelivery:'original private ingress exact embedded assets',deferredChecks:['n88_official_hosted_fabricated_teacher_student_ack_and_isolation','n88_official_publisher_readiness_route_and_served_behavior'],originalAcceptance:'canonical card stagedActivation retained; no full Product readiness'};
// Runtime stylesheet and brand URLs are pinned by privateAssets above.
const worker=await readFile(out+'cloudflare/worker.mjs','utf8');assert.ok(!worker.includes('node:'));
const browser=await readFile(out+'private/assets/student.mjs','utf8');
assert.match(browser,/mode: "pilot"/);assert.ok(!/serviceWorker\.register|registerSW\(/.test(browser));
const wrangler=`# AI: generated inactive config; existing zone only, no route or preview.\nname = "rakeez-n88-private-ingress"\nmain = "bundle/cloudflare/worker.mjs"\ncompatibility_date = "2026-10-01"\nworkers_dev = false\npreview_urls = false\nroutes = []\n[vars]\nN88_ENABLED = "false"\n[observability]\nenabled = false\n`;
await writeFile(dir+'wrangler.staged.toml',wrangler);
for(const file of ['drafts/n88-student-portal/task-guidance.mjs','drafts/n88-student-portal/task-guidance.inactive.sql','supabase/migrations/20261018125611_n88_task_guidance_staged.sql',dir+'task-guidance-preflight.inactive.sql','drafts/n88-student-portal/task-guidance-review.mjs','drafts/n88-student-portal/deployment.inactive.json','tests/n88-task-guidance.mjs','tests/n88-task-guidance-review.mjs','tests/n88-task-guidance-artifacts.mjs','drafts/n88-student-portal/code-recovery.mjs','drafts/n88-student-portal/code-recovery.inactive.sql','supabase/migrations/20261018115648_n88_code_recovery_staged.sql',dir+'recovery-preflight.inactive.sql','tests/n88-six-digit-recovery.mjs','tests/n88-six-digit-recovery-context.mjs','tests/n88-six-digit-recovery-launcher.mjs','tests/n88-six-digit-recovery-artifacts.mjs','drafts/n88-student-portal/shared-network-budget.inactive.sql','supabase/migrations/20261018114113_n88_shared_network_budget_staged.sql',dir+'shared-network-preflight.inactive.sql','tests/n88-six-digit-shared-network.mjs','tests/n88-six-digit-shared-launcher.mjs','tests/n88-six-digit-shared-artifacts.mjs','tests/n88-six-digit-shared-flood-window.mjs','drafts/n88-student-portal/ACTIVATION.md','drafts/n88-student-portal/six-digit-schema.inactive.sql','supabase/migrations/20261018110713_n88_six_digit_staged.sql',dir+'six-digit-preflight.inactive.sql','tests/n88-six-digit-redaction.mjs','tests/n88-six-digit-security.mjs','drafts/n88-student-portal/integrated-bundle.mjs','drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/integrated-schema.inactive.sql','index.html','src/app.js','src/lib/app-update.js','drafts/n88-student-portal/current-review.mjs','drafts/n88-student-portal/current-review-launch.ps1','drafts/n88-student-portal/integrated-review.mjs','tests/fixtures/n88-integrated-class/bootstrap.js','tests/fixtures/n88-integrated-class/canonical-extension.sql','tests/fixtures/n88-integrated-class/seed.sql','tests/fixtures/n88-integrated-class/native-pg.mjs','src/router.js','src/lib/student-portal-runtime.js','src/views/student-portal-class.js','src/lib/student-portal-class-client.js','src/styles/student-portal-class.css','src/views/teaching-hub.js','src/views/students.js','sw.js','supabase/migrations/20261018102843_n88_integrated_class_staged.sql',dir+'integrated-preflight.inactive.sql',dir+'integrated-metadata-contract.json',dir+'integrated-identities.inactive.sql',dir+'integrated-expected-identities.json','drafts/n88-student-portal/integrated-readback.mjs','src/views/student-portal-teacher.js',
  'supabase/migrations/20261018034356_n88_exact_activation_staged.sql',dir+'preflight.inactive.sql',dir+'readback.inactive.sql',dir+'identities.inactive.sql',dir+'expected-identities.json',dir+'wrangler.staged.toml',dir+'deploy.staged.json',dir+'toolchain.json',dir+'.gitattributes',
  dir+'metadata-contract.json',dir+'supabase.staged.toml',...['schema-proposal.sql','postgres-repository-schema.sql','canonical-state-schema.inactive.sql','canonical-lock.inactive.sql','auth-session.inactive.sql','ingress.inactive.sql','roles.inactive.sql'].map(f=>'drafts/n88-student-portal/'+f),
  'supabase/functions/n88-student-portal/config.inactive.toml','drafts/n88-student-portal/package-lock.json'])manifest.sources[file]=await textHash(file);
await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('N88 offline Edge/Cloudflare/private actual-app document graphs bundled; all activation switches OFF.');
