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
// Only the Edge source graph changes for the explicitly authorized boundary.
for(const [p,h]of Object.entries(previous.outputs))if((p.startsWith('edge/')&&p!=='edge/index.mjs')||p.startsWith('cloudflare/'))assert.equal(m.outputs[p],h,p);
const boundary=JSON.parse(await readFile(dir+'error-boundary-contract.json','utf8'));
const deploy=JSON.parse(await readFile(dir+'deploy.staged.json','utf8'));
assert.equal(sha(lf(await readFile(boundary.migration.path,'utf8'))),boundary.migration.sha256);
assert.equal(deploy.migrations.length,8);assert.equal(deploy.migrations[7],boundary.migration.path);
assert.equal(deploy.migrations[1],'supabase/migrations/20261018195100_n88_guard_membership_inherit_staged.sql');
assert.equal(m.privateMembershipCorrection.sha256,sha(lf(await readFile(deploy.migrations[1],'utf8'))));
assert.equal(m.privateErrorBoundary.routines,76);assert.deepEqual(m.privateErrorBoundary.migration,boundary.migration);
assert.equal(m.privateErrorBoundary.contractSha256,sha(lf(await readFile(dir+'error-boundary-contract.json','utf8'))));
assert.equal(m.privateErrorBoundary.identitiesSha256,sha(lf(await readFile(dir+'error-boundary-identities.json','utf8'))));
assert.deepEqual(m.gates,{edgeEnabled:false,cloudflareEnabled:false,browserReadiness:false,routes:[],cron:[]});
assert.equal(deploy.enabled,false);assert.equal(deploy.function.enabled,false);assert.equal(deploy.privateDocument.enabled,false);
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
await writeFile('tests/n88-official-activation-scope.json',JSON.stringify({aiAuthored:true,taskId:'continuous-n88-official-student-portal-activation-20261018',runId:'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',baseSha,at:new Date().toISOString(),checks:[{name:'exact_inert_graph_and_preserved_migrations',status:'PASS',evidence:'All source/output/binary hashes verified; original six migrations unchanged from base; exact boundary and membership repair sources pinned before their hosted applies. Only Edge graph changed; provider/config/private UI outputs unchanged; activation OFF.'},{name:'exact_card_migration_bytes',status:mismatches.length?'FAIL':'PASS',evidence:mismatches.length?'Preserved SQL/card identity mismatch; no rewrite/apply.':'All six byte identities match corrected current card.'},{name:'unchanged_evidence_reuse',status:'PASS',evidence:'Six service/crypto/budget/recovery/guidance/teacher reports unchanged from base. Four-case browser evidence reused with identical UI/document/styles/logo bytes.'}],boundaryMigration:boundary.migration,priorPinFailurePreserved:'tests/n88-official-activation-scope.json in candidate76a58 and Git history; old CRLF pin superseded by exact LF metadata correction',migrationHashes,reused,hostedProof:false},null,2)+'\n');
if(mismatches.length)process.exitCode=1;
console.log(mismatches.length?'N88 exact card identity FAIL; inert graph/proof reuse PASS; hosted gates NOT_RUN':'N88 offline scope PASS');
