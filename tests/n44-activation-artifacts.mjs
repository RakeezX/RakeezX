/** AI: affected offline artifact/default-OFF/reuse tests; no new browser or live proof. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {verifyReadback} from '../scripts/n44-activation-readback.mjs';
const dir='drafts/n44-push/activation/',hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(dir+'manifest.json','utf8')),checks=[],reuse=[];
const pass=(name,evidence)=>checks.push({name,status:'PASS',evidence});
for(const [file,expected]of Object.entries(manifest.sources))assert.equal(hash((await readFile(file,'utf8')).replaceAll('\r\n','\n')),expected,file);
for(const [file,expected]of Object.entries(manifest.outputs))assert.equal(hash(await readFile(dir+'bundle/'+file)),expected,file);
assert.deepEqual(manifest.graphs['cloudflare/worker.mjs'].imports,[]);assert.deepEqual(manifest.graphs['scheduler/worker.mjs'].imports,[]);
for(const i of manifest.graphs['edge/index.mjs'].imports)assert.ok(i.external&&(/^(node:|pg$|web-push$|ipaddr\.js$|@supabase\/auth-js$|@noble\/curves\/nist\.js$)/.test(i.path)),i.path);
const lock=JSON.parse(await readFile(dir+'bundle/edge/deno.lock','utf8')),pkg=JSON.parse(await readFile('drafts/n44-push/package-lock.json','utf8'));
for(const [name,version]of Object.entries(manifest.externalDependencies)) {
 const record=Object.entries(lock.npm).find(([key])=>key===name+'@'+version||key.startsWith(name+'@'+version+'_'))?.[1];
 assert.equal(record?.integrity,pkg.packages['node_modules/'+name].integrity,name);
}
pass('exact_offline_source_output_graph_and_lock_integrity',`${Object.keys(manifest.sources).length} source and ${Object.keys(manifest.outputs).length} bundle hashes verified. Three actual entry graphs packaged; Edge external dependencies exact npm/Deno integrity pins; ingress/scheduler zero external imports.`);
for(const [file,flag]of [['cloudflare/worker.mjs','N44_ENABLED'],['scheduler/worker.mjs','N44_ENABLED']]) {
 const module=await import(pathToFileURL(path.resolve(dir+'bundle/'+file)));
 const reads=[],env=new Proxy({},{get(_t,k){reads.push(k);if(k===flag)return 'false';throw Error('disabled secret access');}});
 const response=await module.default.fetch(new Request('https://synthetic.invalid/api/n44/context/read'),env);
 assert.equal(response.status,503);
 if(file.startsWith('cloudflare'))assert.deepEqual(reads,[flag]);
 else {assert.deepEqual(reads,[]);assert.equal((await module.runScheduled(env,{fetch(){throw Error('disabled fetch');}})).status,'disabled');assert.deepEqual(reads,[flag]);}
}
const config=JSON.parse(await readFile(dir+'deploy.staged.json','utf8'));
for(const v of [config.enabled,config.function.enabled,config.cloudflare.enabled,config.scheduler.enabled,config.deliveryEnabled,config.browserEnabled,config.serviceWorkerEnabled])assert.equal(v,false);
for(const v of [config.cron,config.cloudflare.routes,config.scheduler.cron,config.scheduler.publicRoutes])assert.deepEqual(v,[]);
for(const name of ['wrangler.staged.toml','scheduler.staged.toml']) {
 const text=(await readFile(dir+name,'utf8')).replaceAll('\r\n','\n');for(const pattern of [/workers_dev = false/,/preview_urls = false/,/routes = \[\]/,/crons = \[\]/,/N44_ENABLED = "false"/,/\[observability\]\nenabled = false/])assert.match(text,pattern);
}
const client=JSON.parse(await readFile(dir+'client-readiness.json','utf8'));
assert.equal(client.enabled,false);assert.equal(client.client.publicKey,null);
assert.match(await readFile(client.client.path,'utf8'),/PUSH_CONFIGURATION = Object.freeze\(\{ enabled: false, publicKey: null \}\)/);
assert.match(await readFile(client.serviceWorker.path,'utf8'),/const N44_PUSH_ENABLED = false/);
assert.match(await readFile('drafts/n44-push/session-policy.mjs','utf8'),/profile\.activatedAt - profile\.observedAt <= 86400000/);
assert.equal(client.policy.dailyHumanRenewal,false);
pass('inactive_ingress_private_scheduler_and_public_client_mapping','Actual packaged ingress and private scheduler default-OFF return 503/disabled without fetch or private bindings. All deployment, delivery, browser and SW switches OFF; no routes/cron/preview. Public readiness names exact existing constants/protocol/revision and activation-bound policy contract, no daily renewal.');
const expected=JSON.parse(await readFile(dir+'expected-identities.json','utf8'));
assert.ok(expected.identities.constraints.length&&expected.identities.indexes.length&&expected.identities.triggers.length);
const fabricated={projectId:manifest.projectId,personalRowsRead:0,mode:'metadata-only',capturedAt:new Date().toISOString(),identities:structuredClone(expected.identities),migrationVersion:manifest.migrationVersion,enabled:false};
assert.match(verifyReadback(fabricated,expected),/matches/);
for(const mutate of [a=>{a.identities.helpers[0].definition_md5='wrong';},a=>{a.identities.roles[0].rolbypassrls=true;},a=>{a.identities.constraints.pop();},a=>{a.identities.owner_reference_capability=false;},a=>{a.projectId='wrong';},a=>{a.enabled=true;}]) {const bad=structuredClone(fabricated);mutate(bad);assert.throws(()=>verifyReadback(bad,expected));}
const contract=JSON.parse(await readFile(dir+'metadata-contract.json','utf8')),preflight=await readFile(dir+'preflight.inactive.sql','utf8');
assert.equal(contract.inputSha256,'b0abdcb656880f0660d43d4678ce1191fb8ccd7eed2e957f519d33aa5f55f334');
for(const c of contract.columns)assert.ok(preflight.includes(c.schema+'.'+c.table+'.'+c.column));
for(const c of contract.constraints)assert.ok(preflight.includes("conname='"+c.name+"'"));
for(const t of contract.triggers)assert.ok(preflight.includes(t.definition.replaceAll("'","''")));
assert.match(preflight,/begin read only/);assert.match(preflight,/Auth REFERENCES prerequisite/);
pass('metadata_preflight_and_postapply_identity_tamper_guards','Pinned metadata consumed columns/constraints/trigger identities present in read-only preflight. Local PG exported complete private role/helper/schema/ACL/grant/RLS/constraint/index/trigger identities. Offline comparison rejects helper, role, FK, REFERENCES capability, project and enabled drift; no hosted readback.');
for(const [file,field,count]of [['tests/n44-crypto-sender.result.json','sourceHashes',18],['tests/n44-crypto-sender.boundary-repair-result.json','sourceHashes',16],['tests/n44-existing-host.result.json','sourceSha256',12],['tests/n44-client-binding.checks.json','sourceSha256',null]]) {
 const prior=JSON.parse(await readFile(file,'utf8')),matching=[],changed=[];
 for(const [source,old]of Object.entries(prior[field]??{})) {const raw=await readFile(source),normal=hash(raw.toString('utf8').replaceAll('\r\n','\n'));(old===normal||old===hash(raw)?matching:changed).push({source,priorSha256:old,currentSha256:normal});}
 assert.ok(matching.length);if(file.includes('client-binding')){assert.equal(prior.state,'PASS');assert.equal(changed.length,0);}
 reuse.push({file,reportSha256:hash(await readFile(file)),runId:prior.runId,historicalCases:count,matching,changed,scope:'Matching component evidence only; changed paths are NOT certified by historical totals. No blanket replay.'});
}
pass('historical_crypto_boundary_runtime_and_actual_client_reuse','18 crypto / corrected16 boundary /12 existing-host historical evidence compared component by component; all current client-check source hashes match PASS record. No repeated UI/Preview, no new UI PASS claim.');
for(const file of ['scripts/n44-activation-prepare.mjs','scripts/n44-activation-bundle.mjs','scripts/n44-activation-readback.mjs','tests/n44-activation-postgres.mjs','tests/n44-activation-artifacts.mjs','tests/n44-activation-edge.mjs','tests/fixtures/n44-activation/guards.mjs',...Object.keys(manifest.outputs).filter(x=>x.endsWith('.mjs')).map(x=>dir+'bundle/'+x)])execFileSync(process.execPath,['--check',file],{windowsHide:true});
assert.equal(execFileSync('git',['diff','--name-only','6753b1ede766649c2bb7506b07df63bf421858c5','--','src','sw.js','drafts/n88-student-portal','supabase/functions/n88-student-portal'],{encoding:'utf8'}).trim(),'');
pass('affected_syntax_and_shared_app_n88_unchanged','New scripts and all three bundled JS outputs parse. Shared app/SW/N88 unchanged; no startup dependency or offline-shell change.');
if(process.argv[2]) {
 const deno=process.argv[2],env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',TEMP:process.env.TEMP,TMP:process.env.TMP,PATH:'C:\\Windows\\System32'};
 const r=spawnSync(deno,['run','--cached-only','--frozen-lockfile','--allow-env','--deny-net','--config',dir+'bundle/edge/deno.json','tests/n44-activation-edge.mjs'],{env,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);pass('packaged_edge_actual_disabled_handler',r.stdout.trim()+' Deno 2.2.12; sanitized child environment and network denied.');
}
checks.push({name:'hosted_service_auth_policy_provider_push_private_device',status:'NOT_RUN',evidence:'Source preparation only. No live migration/function/role/secret/route/cron/provider/DNS/push/account/Production operation. Actual postgres REFERENCES and fresh supported Auth policy metadata remain preapply gates; hosted fixture/private device proof requires separate exact authority.'});
await writeFile('tests/n44-activation-artifacts.result.json',JSON.stringify({taskId:'continuous-n44-service-activation-candidate-20261018',runId:'db4e0272-e5b1-44da-83b1-c720bc76cb4d',baseSha:'6753b1ede766649c2bb7506b07df63bf421858c5',checkedAt:new Date().toISOString(),checks,reuse},null,2)+'\n');
console.log('N44 exact inactive bundle/metadata/default-OFF and affected evidence reuse PASS.');
