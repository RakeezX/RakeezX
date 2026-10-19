/** AI: validate newly observed affected hosted catalogs, not Product live readiness. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='3297f7ab-daae-4b90-be12-e7dcfb676c0f',saved='93e76b3f68e8c56f8c7257825417105907305539',dir='drafts/n88-student-portal/activation/';
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const snapshot=await read(dir+'official-source-catalog.json'),c=snapshot.catalog,m=await read(dir+'integrated-metadata-contract.json');
assert.equal(snapshot.personalRowsRead,0);assert.equal(snapshot.runId,runId);assert.equal(c.projectId,'xlrubcwjqktzzunrvuns');
for(const r of m.required)assert.ok(c.columns.some(x=>x.table===r.table&&x.column===r.column&&x.udt===r.udt),`${r.table}.${r.column}`);
const baseline=await readFile(dir+'preflight.inactive.sql','utf8');
const stampLine=baseline.split('\n').find(l=>l.includes("to_regprocedure('rakeezx.sync_v2_stamp_revision()')"));
const expectedStamp=stampLine.match(/='([0-9a-f]{32})'/)[1];
for(const table of new Set(m.required.map(r=>r.table))){
 assert.ok(c.tables.some(t=>t.table===table&&t.rls&&t.forceRls),table);
 assert.ok(c.constraints.some(k=>k.table===table&&k.definition==='PRIMARY KEY (owner_id, id)'&&k.validated&&!k.deferrable),table+' PK');
 assert.ok(c.constraints.some(k=>k.table===table&&k.definition==='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE'&&k.validated&&!k.deferrable),table+' owner FK');
 assert.ok(c.triggers.some(t=>t.table===table&&t.function==='rakeezx.sync_v2_stamp_revision()'&&t.functionMd5===expectedStamp&&t.functionOwner==='postgres'&&t.enabled==='O'),table+' monotonic revision');
}
for(const a of c.authTables){assert.equal(a.owner,'supabase_auth_admin');assert.equal(a.rls,true);assert.equal(a.forceRls,false);assert.equal(a.policyCount,0);}
assert.equal(c.authStatusColumns.length,5);assert.ok(c.statusLockPrivileges.every(p=>p.select&&p.update));
assert.deepEqual(c.management,{bypassRls:true,superuser:false,currentUser:'postgres',sessionUser:'postgres',authReferences:true,authOwnerMember:false,authSchemaUsage:true,authSchemaCreate:false});
assert.deepEqual(c.n88,{guardExists:false,schemaExists:false,backendExists:false});
const card=await read('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json');assert.equal(card.attempt.runId,runId);
for(const p of card.preparationAuthority.migrationIdentities)assert.equal(sha(await readFile(p.path)),p.sha256,p.path);
for(const p of [dir+'manifest.json',dir+'deploy.staged.json','tests/n88-official-activation-custody-probe.json','tests/n88-official-activation-custody-initial-failure.json','tests/n88-official-activation-private-assets.json'])assert.equal(lf(await readFile(p,'utf8')),lf(execFileSync('git',['show',saved+':'+p],{encoding:'utf8'})),p);
const report={aiAuthored:true,taskId,runId,at:new Date().toISOString(),checks:[{name:'affected_hosted_catalog_and_privileges',status:'PASS',evidence:`${m.required.length} consumed column/type contracts across13 tables; owner PK/immediate FK/RLS and existing exact revision-function identity; managed Auth RLS/zero policies/status locks and existing management privileges. Source snapshot: ${c.columns.length} catalog columns,${c.constraints.length} constraints,${c.triggers.length} triggers; no personal rows.`},{name:'exact_six_pins_and_saved_proof_reuse',status:'PASS',evidence:'Current six byte pins match; saved manifest/package, actual browser evidence and successful encrypted custody proof plus original failure unchanged from93e76b3. No rerun.'}],hostedServiceReadiness:false,providerOrDatabaseWrites:0};
execFileSync('git',['diff','--check'],{stdio:'pipe'});await writeFile('tests/n88-official-activation-catalog.json',JSON.stringify(report,null,2)+'\n');console.log('N88 affected catalog and preserved proof checks PASS; service gates remain blocked');
