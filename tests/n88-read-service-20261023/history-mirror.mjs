/** AI: fabricated SQL digests only; no old migration SQL, custody or provider. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {hash} from '../../drafts/n88-student-portal/activation/read-service-20261023/prepare.mjs';
import {fixedMigration,qualifyAuthenticMirror,qualifyCliPlan,classifyCliFailure} from '../../drafts/n88-student-portal/activation/read-service-20261023/history-mirror.mjs';
const remote=[{version:'20261018194329',name:'synthetic_first',source_digest:hash('first'),statement_count:1},{version:'20261018203939',name:'synthetic_second',source_digest:hash('second'),statement_count:2}];
const local=[...remote.map(r=>({version:r.version,name:r.name,digest:r.source_digest})),fixedMigration];
assert.equal(qualifyAuthenticMirror(remote,local).onlyPending.length,1);
assert.throws(()=>qualifyAuthenticMirror(remote,local.slice(1)),/missing_or_extra/);
assert.throws(()=>qualifyAuthenticMirror(remote,[...local,fixedMigration]),/missing_or_extra/);
assert.throws(()=>qualifyAuthenticMirror([...remote].reverse(),local),/remote_order/);
assert.throws(()=>qualifyAuthenticMirror(remote,[local[1],local[0],local[2]]),/mirror_drift_or_order/);
assert.throws(()=>qualifyAuthenticMirror(remote,[{...local[0],digest:hash('drift')},...local.slice(1)]),/mirror_drift_or_order/);
assert.throws(()=>qualifyAuthenticMirror(remote,[...local.slice(0,2),{...fixedMigration,digest:hash('wrong-sql')}]),/target_identity/);
assert.throws(()=>qualifyAuthenticMirror([...remote,{version:fixedMigration.version,name:fixedMigration.name,source_digest:fixedMigration.digest,statement_count:1}],local),/already_applied/);
assert.throws(()=>qualifyAuthenticMirror([{...remote[0],statement_count:0},remote[1]],local),/authentic_source_unavailable/);
assert.throws(()=>qualifyAuthenticMirror([{...remote[0],name:'../escape'},remote[1]],local),/authentic_source_unavailable/);
assert.throws(()=>qualifyAuthenticMirror([{...remote[0],version:'20261024000000'}],local),/target_out_of_order/);
const filename=fixedMigration.version+'_'+fixedMigration.name+'.sql',plan={dryRun:true,upToDate:false,migrations:[filename],roles:[],seeds:[]};
qualifyCliPlan(plan,filename);
for(const p of [{...plan,dryRun:false},{...plan,migrations:[filename,'old.sql']},{...plan,roles:['role.sql']},{...plan,seeds:['seed.sql']}])assert.throws(()=>qualifyCliPlan(p,filename),/cli_plan/);
const cases=[['Remote migration versions not found in local migrations directory.','MISSING_LOCAL_HISTORY'],['permission denied for database','PERMISSION_DENIED'],['blocked by policy','POLICY_DENIAL'],['password authentication failed','AUTHENTICATION'],['failed to connect: ETIMEDOUT','NETWORK'],['Cannot find project ref','CONFIGURATION'],['SQLSTATE 23505','SQL_FAILURE'],['opaque error','UNKNOWN_PRIVATE_FAILURE']];
for(const [message,category]of cases){const r=classifyCliFailure({status:1,stderr:message+' sensitive-sentinel password=never-export',stdout:'secret SQL sentinel'});assert.equal(r.category,category);assert(!JSON.stringify(r).includes('sentinel'));}
assert.equal(classifyCliFailure({status:null,error:{code:'ETIMEDOUT'}}).category,'TIMEOUT');
await writeFile(new URL('./history-mirror-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,checks:['complete exact authentic mirror','missing/extra/out-of-order/drifted source deny','wrong SQL and applied target deny','empty source and traversal deny','only-one CLI dry-run plan','allowlisted private-safe failure classification'],providerOperations:0},null,2)+'\n');
console.log('PASS: authentic history/plan and privacy-safe error boundaries.');
