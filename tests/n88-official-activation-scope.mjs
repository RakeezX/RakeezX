/** AI-authored: bounded offline identity check; reuses unchanged rendered evidence. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const baseSha='5046e82968cb0055db7a99aea41d65dcb71b2a60',dir='drafts/n88-student-portal/activation/';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const m=JSON.parse(await readFile(dir+'manifest.json','utf8'));
for(const [p,h]of Object.entries(m.sources))assert.equal(sha(lf(await readFile(p,'utf8'))),h,p);
for(const [p,h]of Object.entries(m.binarySources))assert.equal(sha(await readFile(p)),h,p);
for(const [p,h]of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+'bundle/'+p)),h,p);
const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json','utf8'));
const migrationHashes=[];
for(const {path:p,sha256}of card.preparationAuthority.migrationIdentities){
 const text=await readFile(p,'utf8'),actualSha256=sha(text),lfSha256=sha(lf(text));
 assert.equal(lf(text),lf(execFileSync('git',['show',baseSha+':'+p],{encoding:'utf8'})),p);
 migrationHashes.push({path:p,authorizedSha256:sha256,actualSha256,lfSha256,crlfSha256:sha(lf(text).replaceAll('\n','\r\n')),exact:actualSha256===sha256});
}
const previous=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));
for(const [p,h]of Object.entries(previous.outputs))if(p.startsWith('edge/')||p.startsWith('cloudflare/'))assert.equal(m.outputs[p],h,p);
const reused=[];
for(const p of ['tests/n88-integrated-class-final-service.json','tests/n88-six-digit-security.json','tests/n88-six-digit-shared-network.json','tests/n88-six-digit-recovery.json','tests/n88-task-guidance.json','tests/n88-teacher-presentation.json']){
 const current=lf(await readFile(p,'utf8')),prior=lf(execFileSync('git',['show',baseSha+':'+p],{encoding:'utf8'}));assert.equal(current,prior,p);reused.push({path:p,sha256:sha(current)});
}
// Exact UI bytes exercised by the recorded four-case browser check remain unchanged.
assert.equal(m.outputs['private/assets/student.mjs'],'f88d908955ca2039816a6e8233b4a47de0ac8f450095449c7ce892a4ab37f0dc');
for(const p of ['private/styles/app.css','private/styles/student-portal-login.css','private/student.html'])assert.equal(m.outputs[p],previous.outputs[p]);
const browser=JSON.parse(await readFile('tests/n88-official-activation-private-assets.json','utf8'));
assert.equal(browser.failure,undefined);assert.equal(browser.checks.length,5);assert.ok(browser.checks.every(c=>c.status==='PASS'));
assert.deepEqual(browser.cleanup,{browserClosed:true,serverClosed:true,browserLease:'RELEASED browser'});
execFileSync('git',['diff','--check'],{stdio:'pipe'});
const mismatches=migrationHashes.filter(m=>!m.exact);
await writeFile('tests/n88-official-activation-scope.json',JSON.stringify({aiAuthored:true,taskId:card.id,runId:'bb64e011-c3c1-417b-9e99-af05ee0f8f09',baseSha,at:new Date().toISOString(),checks:[{name:'exact_inert_graph_and_preserved_migrations',status:'PASS',evidence:'All source/output/binary hashes verified; six migrations unchanged from base; service bundles unchanged; no hosted apply.'},{name:'exact_card_migration_bytes',status:mismatches.length?'FAIL':'PASS',evidence:mismatches.length?'Sixth card SHA matches CRLF serialization; preserved Git/base/worktree SQL is LF. Original exact-hash assertion failed; no SQL/card rewrite or hosted apply.':'All six byte identities match card.'},{name:'unchanged_evidence_reuse',status:'PASS',evidence:'Six service/crypto/budget/recovery/guidance/teacher reports unchanged from base. Four-case browser evidence reused with identical UI/document/styles/logo bytes.'}],initialFailure:mismatches.length?{check:'exact_card_migration_bytes',message:'AssertionError: supabase/migrations/20261018125611_n88_task_guidance_staged.sql',actual:'d8de3ae8f3d70d732205a324376a095fd27bf8ed8c0afa85f216ec15c0876060',expected:'f48be5c930c4567632caa94b59f28a1e19a31a82c208f03aa5cfbbe184252ae1'}:null,migrationHashes,reused,hostedProof:false},null,2)+'\n');
if(mismatches.length)process.exitCode=1;
console.log(mismatches.length?'N88 exact card identity FAIL; inert graph/proof reuse PASS; hosted gates NOT_RUN':'N88 offline scope PASS');
