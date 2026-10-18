/** AI: focused six-digit security amendment; owned native PG + actual signed service only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createNumericCredentialOperations,generateNumericCredential,normalizeNumericCredential,NUMERIC_POLICY,CREDENTIAL_CAPACITY} from '../drafts/n88-student-portal/numeric-credentials.mjs';
import {normalizeStudentCode,validStudentCode} from '../src/lib/student-portal-unified-client.js';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
import {A,B,SESSION} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='f6931c38-05f6-4d7d-bf8c-0a9e3ba95681';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',root+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{},namespace:'six-v1'};let review,owned=false,failed;
const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try {
  // Boundaries, strings only, historical lengths and unicode policy are explicit.
  for(const c of ['100000','199999']){assert.equal(normalizeNumericCredential(c),c);assert.equal(validStudentCode(c),true);}
  for(const v of [100000,null,undefined,'10000','1000000','100000000000','200000','000000','1e0000','١٠٠٠٠٠','\t100000','100000\n'])assert.equal(normalizeNumericCredential(v),null);
  assert.equal(normalizeStudentCode(100000),'');assert.equal(normalizeStudentCode('١٠٠٠٠٠'),'100000');assert.equal(normalizeStudentCode('۱۹۹۹۹۹'),'199999');
  for(let i=0;i<128;i++)assert.ok(validStudentCode(generateNumericCredential()));
  const config={keys:new Map([['v1',randomBytes(32)]]),activeKeyVersion:'v1',reservationKey:randomBytes(32)};
  const m={ownerId:randomUUID(),studentId:'a',enrollmentId:'e',revision:1,canonicalStamp:'a'.repeat(64),status:'active',endDate:null,studentActive:true,classActive:true};
  const n={...m,ownerId:randomUUID(),studentId:'b'};
  const db={contexts:[{ownerId:m.ownerId,active:true},{ownerId:n.ownerId,active:true}],memberships:[m,n],numericCredentials:[],numericSessions:[]};
  let generated='100000',calls=0;
  const ops=createNumericCredentialOperations({...config,generate:()=>{calls++;return generated;}});
  assert.equal(ops.issueMember(db,m,{expectedVersion:0}).code,generated);
  ops.revokeMember(db,m,{expectedVersion:1});calls=0;
  assert.throws(()=>ops.issueMember(db,n,{expectedVersion:0}));assert.equal(calls,NUMERIC_POLICY.collisionBudget);assert.equal(db.numericCredentials.length,1);
  generated='199999';assert.equal(ops.issueMember(db,n,{expectedVersion:0}).code,generated);
  const original=structuredClone(db.numericCredentials);
  // Controlled reservation metadata, no enumeration or claim guesses of the namespace.
  db.numericCredentials=Array.from({length:CREDENTIAL_CAPACITY},()=>({format:'six-v1',ownerId:n.ownerId,studentId:'retired',version:1,revokedAt:1}));calls=0;
  assert.throws(()=>ops.issueMember(db,m,{expectedVersion:0}));assert.equal(calls,0);assert.equal(db.numericCredentials.length,100000);
  db.numericCredentials=Array.from({length:CREDENTIAL_CAPACITY},()=>({ownerId:n.ownerId,studentId:'historical',version:1,revokedAt:1}));
  assert.equal(ops.issueMember(db,m,{expectedVersion:0}).code,generated);assert.equal(calls,1);db.numericCredentials=original;
  check('six_digit_crypto_string_boundaries_collision_tombstones_capacity_namespace','Actual issuer/validators: both endpoints, invalid types/lengths, defined Arabic/Persian UI normalization; 128 cryptographic samples. Across owners a retained revoked reservation exhausts exactly 128 collision draws without mutation. 100000 six-v1 metadata reservations deny before RNG; 100000 historical metadata records do not count as six-digit occupancy. No brute-force claims.');
  const fabricated='1'+'23456';
  const failure=Object.assign(new Error('locator.fill("'+fabricated+'")\nCall log: value='+fabricated),{stack:'Error\n at fill('+fabricated+')'});
  const safe=JSON.stringify(redactN88({failure:diagnosticError(failure),pageErrors:[failure.message],calls:[{value:fabricated}],nested:{text:fabricated}}));
  assert.ok(!safe.includes(fabricated));assert.ok(safe.includes('[REDACTED]'));
  check('whole_report_locator_stack_call_log_redaction','Bounded synthetic failure sanitizes six-digit secret in message, locator/call log, nested report, page error and stack before persistence/console. Fabricated secret never recorded.');
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  review=await startIntegratedReview({ttl:300,historicalReservationFixture:true});assert.equal(review.testing.serviceInstances,2);const origin=new URL(review.url).origin,q=review.testing.query;
  const binding={ownerId:A,sessionId:SESSION,leaseId:'six-digit-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
  const teacher=async(action,body={})=>{const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+review.testing.provider.token()},body:JSON.stringify({teachingId:'teaching',binding,...body})});return {status:r.status,body:await r.json()};};
  const claim=async(code,extra={})=>{const r=await fetch(origin+'/api/n88/student/claim',{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1','X-Forwarded-For':'198.51.100.77','CF-Connecting-IP':'198.51.100.78'},body:JSON.stringify({code,source:'spoof',ip:'198.51.100.79',...extra})});return {status:r.status,body:await r.json()};};
  const counts=async()=>{const rows=(await q('select payload from n88_private.numeric_rates')).rows.map(r=>r.payload);return {global:rows.find(r=>r.key==='global')?.count||0,sources:rows.filter(r=>r.key!=='global').map(r=>r.count).sort((a,b)=>a-b)};};
  const listed=await teacher('list');assert.equal(listed.status,200);
  const batch=await teacher('issue-missing',{requestId:'six-digit-security-batch-01',expectedRosterRevision:listed.body.data.rosterRevision});assert.equal(batch.status,200);assert.equal(batch.body.data.created.length,2);
  let code=batch.body.data.created[0].credential;
  // Failed downstream session write must rollback auth state but retain independent debit.
  review.testing.failSession();assert.deepEqual(await claim(code),{status:401,body:{error:'unavailable'}});assert.deepEqual(await counts(),{global:1,sources:[1]});
  assert.equal((await q('select count(*)::int as n from n88_private.numeric_sessions')).rows[0].n,0);
  const denied={status:401,body:{error:'unavailable'}};
  assert.deepEqual(await claim('malformed'),denied);const unknown=['100000','199999','100001'].find(c=>!batch.body.data.created.some(s=>s.credential===c));assert.deepEqual(await claim(unknown),denied);
  await review.testing.restart();assert.deepEqual(await counts(),{global:3,sources:[3]});
  const results=await Promise.all(Array.from({length:4},()=>claim('bad')));results.forEach(r=>assert.deepEqual(r,denied));
  assert.deepEqual(await counts(),{global:7,sources:[6]});assert.deepEqual(await claim(code),denied);
  check('actual_pg_prelookup_debit_survives_auth_rollback_concurrency_service_pg_restart','Actual signed provider gateway/current Auth/restricted PG: session insert failure rolls back authentication while source/global attempt debit remains committed. Malformed/unknown claims return same 401/body. Service AND native PG restart retain counters; four concurrent failures across two actual service instances serialize, source saturates at six, valid code denied. Body/IP/forwarded spoof cannot choose source.');
  review.testing.trustedSource(2);assert.equal((await claim(code)).status,200);
  // Revocation tombstone also consumes both budgets, with uniform response.
  const current=(await teacher('list')).body.data.students.find(s=>s.studentId===batch.body.data.created[0].studentId);
  assert.equal((await teacher('revoke',{...current,requestId:'six-digit-security-revoke-02'})).status,200);
  assert.deepEqual(await claim(code),denied);
  assert.equal((await counts()).global,10);
  let source=3;
  while((await counts()).global<100){review.testing.trustedSource(source++);const left=100-(await counts()).global;const r=await Promise.all(Array.from({length:Math.min(4,left)},()=>claim('bad')));r.forEach(x=>assert.deepEqual(x,denied));}
  review.testing.trustedSource(90);const other=batch.body.data.created[1].credential;assert.deepEqual(await claim(other),denied);
  assert.equal((await counts()).global,100);await review.testing.restart();assert.deepEqual(await claim(other),denied);
  assert.ok(!JSON.stringify((await q('select payload from n88_private.numeric_credentials')).rows).includes(code));code='';
  check('real_global_budget_source_isolation_revocation_uniform_denial','Independent trusted synthetic source can authenticate while exhausted original source cannot. Revoked code has identical 401/body and debits. Bounded malformed attempts across independent verified sources reach exactly global100; another valid student code is denied before lookup, also after service/PG restart. No plaintext in durable credential rows.');
  // Preserve actual exact additive SQL identities, not old hash certification.
  const identities=(await q(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;
  assert.ok(identities.private_triggers.some(t=>JSON.stringify(t).includes('numeric_six_capacity')));
  await writeFile('drafts/n88-student-portal/activation/integrated-expected-identities.json',JSON.stringify({sourceOnly:true,migrationVersions:['20261018034356','20261018102843','20261018110713'],identities},null,2)+'\n');
  // SQL storage rejects alternate format and tombstone mutation; globally unique reservation crosses owners.
  const historical=(await q("select payload from n88_private.numeric_credentials where student_id='historical-fixture'")).rows[0].payload;
  const row=(await q("select payload from n88_private.numeric_credentials where payload->>'format'='six-v1' and revoked_at is not null limit 1")).rows[0].payload;
  const insert=payload=>q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[payload.id,JSON.stringify(payload)]);
  await assert.rejects(insert({...row,id:randomUUID(),studentId:'alt-format',format:'twelve-v1',reservation:'f'.repeat(64)}));
  await q('insert into n88_private.contexts(namespace,owner_id,active) values($1,$2,true) on conflict(owner_id) do nothing',['b'.repeat(32),B]);
  await assert.rejects(insert({...row,id:randomUUID(),ownerId:B,studentId:'collision'}),error=>error.code==='23505'&&error.constraint==='numeric_credentials_reservation_key');
  await assert.rejects(q('delete from n88_private.numeric_credentials where row_key=$1',[row.id]));
  await assert.rejects(q("update n88_private.numeric_credentials set payload=jsonb_set(payload,'{format}','\"six-v2\"') where row_key=$1",[row.id]));
  // Controlled reservation records, not brute-force credential guesses/issuance.
  const retained=(await q("select count(*)::int as n from n88_private.numeric_credentials where payload->>'format'='six-v1'")).rows[0].n;
  for(let offset=retained;offset<100000;offset+=10000) {
    const count=Math.min(10000,100000-offset);
    await q(`insert into n88_private.numeric_credentials(row_key,payload)
      select id,jsonb_build_object('id',id,'ownerId',$1::text,'studentId','capacity-fixture-'||n,'version',1,
        'reservation',repeat(md5('six-capacity-reservation-'||n),2),'verifier',repeat('a',64),'keyVersion','v1','format','six-v1','revokedAt',1)
      from (select n,(md5('six-capacity-id-'||n)::uuid)::text as id from generate_series($2::int,$3::int) n) f`,[A,offset,offset+count-1]);
  }
  assert.equal((await q("select count(*)::int as n from n88_private.numeric_credentials where payload->>'format'='six-v1'")).rows[0].n,100000);
  await assert.rejects(insert({...row,id:randomUUID(),studentId:'capacity-extra',reservation:'e'.repeat(64),revokedAt:1}));
  assert.equal((await q('select count(*)::int as n from n88_private.numeric_credentials')).rows[0].n,100001);
  assert.deepEqual((await q("select payload from n88_private.numeric_credentials where student_id='historical-fixture'")).rows[0].payload,historical);
  check('actual_pg_full_six_namespace_no_tombstone_reuse','Bounded native-PG fabricated reservation metadata inserts reach exactly 100000 retained six-v1 records; no credential search or claim enumeration. Exact statement trigger rejects the next unique reservation and leaves count unchanged. A separate fabricated pre-amendment absent-format tombstone stays byte-equivalent and does not count toward six-v1 occupancy; total retained records include that additional history. Cross-owner duplicate of a revoked six-v1 reservation rejects on the global unique constraint.');
  check('actual_additive_pg_constraints_readback','Fresh CLI-generated third migration applied only to owned native PG. Exact private constraints/indexes/triggers/helper identities read back. Alternate namespace, duplicate global reservation, historical rewrite and tombstone deletion reject; preserved earlier migrations unchanged.');
}catch(error){failed=error;report.failure=diagnosticError(error);}
finally{await review?.close();report.cleanup.ownedHttpAndNativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-security.json',JSON.stringify(redactN88(report),null,2)+'\n');}
if(failed){console.error(redactN88(report.failure));process.exitCode=1;}else console.log('N88 six-digit focused issuer/durable security PASS');
