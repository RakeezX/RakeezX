// AI-authored affected service contracts; never prints generated credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures/n88-class-credentials/fixture.mjs';
import { generateNumericCredential, normalizeNumericCredential, createNumericCredentialOperations } from '../drafts/n88-student-portal/numeric-credentials.mjs';
import { withCredentialRepository,createPgClassResolver } from '../drafts/n88-student-portal/class-credentials.mjs';
const denial=r=>{assert.equal(r.status,401);assert.deepEqual(r.body,{error:'unavailable'});};
const session=r=>r.headers['Set-Cookie'].split(';')[0];
const noPlain=(f,codes)=>{const stored=JSON.stringify(f.snapshot());for(const code of codes)assert.equal(stored.includes(code),false);};

test('n88_class_batch_current_roster_idempotent_missing_only_and_durable_ack',async()=>{
  const f=fixture(),input=await f.input();
  const r=await f.ops.issueMissingClassCodes('teaching-a',input);
  assert.equal(r.status,200);assert.deepEqual(r.body.counts,{created:3,skipped:0,failed:0,uncertain:0});
  assert.ok(r.body.secrets.every(s=>/^1[0-9]{11}$/.test(s.code)));
  noPlain(f,r.body.secrets.map(s=>s.code));
  const retry=await f.ops.issueMissingClassCodes('teaching-a',input);
  assert.equal(retry.body.secrets,undefined);assert.equal(retry.body.counts.uncertain,3);assert.equal(retry.body.counts.created,0);
  const repeat=await f.ops.issueMissingClassCodes('teaching-a',await f.input('synthetic-request-0002'));
  assert.equal(repeat.body.counts.skipped,3);assert.equal(repeat.body.secrets.length,0);
  assert.equal(f.snapshot().numericCredentials.length,3);
  const conflict=await f.ops.issueMissingClassCodes('teaching-a',{...input,expectedRosterRevision:'different'});
  assert.equal(conflict.status,409);
  const listing=await f.ops.listClass('teaching-a');assert.equal(listing.body.students.length,3);
  for(const s of r.body.secrets) assert.equal(JSON.stringify(listing).includes(s.code),false);
});

test('n88_batch_concurrency_lost_ack_selective_revoke_and_owner_lifecycle_guards',async()=>{
  const f=fixture(),input=await f.input();
  const [a,b]=await Promise.all([f.ops.issueMissingClassCodes('teaching-a',input),f.ops.issueMissingClassCodes('teaching-a',{...input,requestId:'synthetic-concurrent-02'})]);
  assert.equal(a.body.counts.created+b.body.counts.created,3);assert.equal(f.snapshot().numericCredentials.length,3);
  const first=a.body.secrets[0],login=await f.request('claim',{code:first.code});assert.equal(login.status,200);
  const cookie=session(login);assert.equal((await f.request('read',{cookie})).body.studentId,first.studentId);
  const member=f.member(),rotated=await f.ops.rotate({...member,requestId:'synthetic-rotate-0001'});
  assert.equal(rotated.body.counts.created,1);denial(await f.request('read',{cookie}));denial(await f.request('claim',{code:first.code}));
  const stale=await f.ops.revoke({...member,requestId:'synthetic-revoke-stale'});assert.equal(stale.status,409);
  assert.equal((await f.ops.revoke({...f.member(),requestId:'synthetic-revoke-0001'})).status,200);
  const after=await f.ops.issueMissingClassCodes('teaching-a',await f.input('synthetic-after-revoke'));
  assert.equal(after.body.counts.created,0);assert.equal(after.body.results[0].reason,'revoked_rotate_required');
  denial(await f.ops.listClass('teaching-b'));
  f.authCurrent=false;denial(await f.ops.listClass('teaching-a'));f.authCurrent=true;
  const changed=await f.input('synthetic-roster-change');f.mutate(db=>{db.memberships[1].revision++;});
  assert.equal((await f.ops.issueMissingClassCodes('teaching-a',changed)).status,409);
  f.scopeCurrent=false;denial(await f.ops.listClass('teaching-a'));

  const lost=fixture(),lostInput=await lost.input();lost.loseAck();
  const uncertain=await lost.ops.issueMissingClassCodes('teaching-a',lostInput);
  assert.equal(uncertain.status,503);assert.equal(uncertain.body.outcome,'uncertain');assert.equal(uncertain.body.secrets,undefined);
  assert.equal(lost.snapshot().numericCredentials.length,3);
  const recover=await lost.ops.issueMissingClassCodes('teaching-a',lostInput);
  assert.equal(recover.body.counts.uncertain,3);assert.equal(recover.body.secrets,undefined);
  const fixed=await lost.ops.rotate({...lost.member(),requestId:'synthetic-recover-rotate'});assert.equal(fixed.body.counts.created,1);
  assert.equal(lost.snapshot().numericCredentials.length,4);
  lost.mutate(db=>{db.memberships[0].status='ended';});
  const noResurrection=await lost.ops.issueMissingClassCodes('teaching-a',lostInput);
  assert.equal(noResurrection.body.secrets,undefined);assert.equal(lost.snapshot().numericCredentials.length,4);
  const concurrent=fixture(),same=await concurrent.input();
  const pair=await Promise.all([concurrent.ops.issueMissingClassCodes('teaching-a',same),concurrent.ops.issueMissingClassCodes('teaching-a',same)]);
  assert.equal(pair[0].body.counts.created+pair[1].body.counts.created,3);
  assert.equal(pair[0].body.counts.uncertain+pair[1].body.counts.uncertain,3);
  assert.equal(concurrent.snapshot().classReceipts.length,1);
});

test('partial failure is atomic per member; rollback and lost rotate ACK never disclose secrets',async()=>{
  const f=fixture({issueMember:(issue,db,m,args)=>{const out=issue(db,m,args);if(m.studentId.endsWith('-2'))throw Error('synthetic partial');return out;}});
  const r=await f.ops.issueMissingClassCodes('teaching-a',await f.input());
  assert.deepEqual(r.body.counts,{created:2,skipped:0,failed:1,uncertain:0});assert.equal(f.snapshot().numericCredentials.length,2);
  noPlain(f,r.body.secrets.map(s=>s.code));
  const g=fixture(),input=await g.input();g.failCommit();
  assert.equal((await g.ops.issueMissingClassCodes('teaching-a',input)).status,503);assert.equal(g.snapshot().classReceipts.length,0);
  assert.equal((await g.ops.issueMissingClassCodes('teaching-a',input)).body.counts.created,3);
  const rotate={...g.member(),requestId:'synthetic-lost-rotate'};g.loseAck();
  assert.equal((await g.ops.rotate(rotate)).status,503);assert.equal(g.snapshot().numericCredentials.length,4);
  const retry=await g.ops.rotate(rotate);assert.equal(retry.body.counts.uncertain,1);assert.equal(retry.body.secrets,undefined);
  assert.equal(g.snapshot().numericCredentials.length,4);
});

test('current identity across terms; stale sessions, removed/inactive/duplicate enrollments and disabled owner denied',async()=>{
  const f=fixture(),r=await f.ops.issueMissingClassCodes('teaching-a',await f.input()),code=r.body.secrets[0].code;
  const old=session(await f.request('claim',{code}));
  f.mutate(db=>{db.memberships[0].enrollmentId='synthetic-second-term';db.memberships[0].revision++;db.memberships[0].canonicalStamp='term-2';});
  denial(await f.request('read',{cookie:old}));
  const fresh=await f.request('claim',{code});assert.equal(fresh.status,200);
  const batch=await f.ops.issueMissingClassCodes('teaching-a',await f.input('synthetic-second-term'));
  assert.equal(batch.body.counts.created,0);assert.equal(f.snapshot().numericCredentials.length,3);
  f.mutate(db=>{db.memberships[0].status='ended';});denial(await f.request('read',{cookie:session(fresh)}));denial(await f.request('claim',{code}));
  f.mutate(db=>{db.memberships[0].status='active';db.memberships.push({...db.memberships[0],enrollmentId:'ambiguous'});});
  denial(await f.ops.listClass('teaching-a'));denial(await f.request('claim',{code}));
  f.mutate(db=>{db.memberships.pop();db.contexts[0].active=false;});denial(await f.request('claim',{code}));
  const g=fixture();g.mutate(db=>{db.memberships[1].studentActive=false;db.memberships[2].classActive=false;});
  assert.equal((await g.ops.issueMissingClassCodes('teaching-a',await g.input())).body.counts.created,1);
});

test('numeric format, global reservations including tombstones, bounded collisions and verifier keys',async()=>{
  for(let i=0;i<100;i++) assert.match(generateNumericCredential(),/^1[0-9]{11}$/);
  assert.equal(normalizeNumericCredential('  123456789012  '),'123456789012');
  for(const x of [123456789012,'123 456789012','\t123456789012','١٢٣٤٥٦٧٨٩٠١٢','１２３４５６７８９０１２','012345678901','1e11','123456789012\n','12345678901'])assert.equal(normalizeNumericCredential(x),null);
  let calls=0;const f=fixture({generate:()=>{calls++;return '123456789012';}});
  const a=await f.ops.issueMissingClassCodes('teaching-a',await f.input());assert.equal(a.body.counts.created,1);assert.equal(a.body.counts.failed,2);
  assert.equal(calls,257); // 1 success + 2 bounded collision budgets
  await f.ops.revoke({...f.member(),requestId:'synthetic-reservation-revoke'});
  const rot=await f.ops.rotate({...f.member(),requestId:'synthetic-reservation-rotate'});assert.equal(rot.body.counts.failed,1);
  f.authOwner='owner-b';const listing=await f.ops.listClass('teaching-b');
  const b=await f.ops.issueMissingClassCodes('teaching-b',{requestId:'synthetic-global-owner-b',expectedRosterRevision:listing.body.rosterRevision});
  assert.equal(b.body.counts.created,0);assert.equal(b.body.counts.failed,3);assert.equal(f.snapshot().numericCredentials.length,1);
  assert.throws(()=>createNumericCredentialOperations({keys:new Map(),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32)}));
});

test('trusted-ingress client/global budgets debit before lookup; uniform errors, session binding/end and private responses',async()=>{
  const f=fixture(),r=await f.ops.issueMissingClassCodes('teaching-a',await f.input());
  denial(await f.request('claim',{code:r.body.secrets[0].code,trusted:false}));assert.equal(f.snapshot().numericRates.length,0);
  for(let i=0;i<6;i++)denial(await f.request('claim',{code:4}));
  f.syncCalls.length=0;denial(await f.request('claim',{code:r.body.secrets[0].code}));assert.equal(f.syncCalls.length,0);
  const okay=await f.request('claim',{code:r.body.secrets[0].code,clientKey:'fresh-client'});assert.equal(okay.status,200);
  assert.match(okay.headers['Set-Cookie'],/Path=\/api\/n88\/student; HttpOnly; Secure; SameSite=Strict/);
  assert.equal(okay.headers['Cache-Control'],'no-store, private');assert.deepEqual(f.syncCalls,['owner-a']);
  const cookie=session(okay);assert.equal((await f.request('read',{cookie})).body.ownerId,'owner-a');
  assert.equal((await f.request('end',{cookie})).status,200);denial(await f.request('read',{cookie}));
  denial(await f.request('claim',{code:r.body.secrets[0].code,clientKey:'cross-origin',headers:{origin:'https://evil.invalid'}}));
  for(let i=0;i<100;i++)denial(await f.request('claim',{code:'199999999999',clientKey:'global-'+i}));
  f.syncCalls.length=0;denial(await f.request('claim',{code:r.body.secrets[1].code,clientKey:'after-global'}));assert.equal(f.syncCalls.length,0);
  f.advance(15*60_000+1);assert.equal((await f.request('claim',{code:r.body.secrets[1].code,clientKey:'after-window'})).status,200);
  noPlain(f,r.body.secrets.map(s=>s.code));
});

test('universal login resolves only original issuer, key versions retain reservations and lost claim ACK is private',async()=>{
  const f=fixture(),a=await f.ops.issueMissingClassCodes('teaching-a',await f.input());
  f.authOwner='owner-b';const listing=await f.ops.listClass('teaching-b');
  const b=await f.ops.issueMissingClassCodes('teaching-b',{requestId:'synthetic-owner-b-batch',expectedRosterRevision:listing.body.rosterRevision});
  const one=await f.request('claim',{body:{code:a.body.secrets[0].code,ownerId:'owner-b',studentId:b.body.secrets[0].studentId}});
  assert.equal(one.status,200);const cookie=session(one);
  assert.equal((await f.request('read',{cookie})).body.ownerId,'owner-a');
  const two=await f.request('claim',{code:b.body.secrets[0].code,cookie});
  assert.equal((await f.request('read',{cookie:session(two)})).body.ownerId,'owner-b');denial(await f.request('read',{cookie}));
  f.loseAck();const lost=await f.request('claim',{code:b.body.secrets[1].code});denial(lost);
  assert.equal(lost.headers['Set-Cookie'].includes('Max-Age=0'),true);
  noPlain(f,[...a.body.secrets,...b.body.secrets].map(s=>s.code));

  const oldKey=Buffer.alloc(32,7),newKey=Buffer.alloc(32,9),reservationKey=Buffer.alloc(32,8);
  const rotatedKeys=createNumericCredentialOperations({keys:new Map([['v1',oldKey],['v2',newKey]]),activeKeyVersion:'v2',reservationKey});
  await f.repository.transaction(db=>{
    const m=db.memberships[0];rotatedKeys.rotateMember(db,m,{expectedVersion:1});
    assert.equal(db.numericCredentials.filter(c=>c.ownerId==='owner-a' && c.studentId===m.studentId).at(-1).keyVersion,'v2');
  });
  const collision=createNumericCredentialOperations({keys:new Map([['v2',newKey]]),activeKeyVersion:'v2',reservationKey,generate:()=>a.body.secrets[0].code});
  await assert.rejects(f.repository.transaction(db=>collision.rotateMember(db,db.memberships[0],{expectedVersion:2})));
});

test('auth expiration at commit rolls back; selective expected enrollment/version gates',async()=>{
  let f;f=fixture({issueMember:(issue,...args)=>{const value=issue(...args);f.authCurrent=false;return value;}});
  const r=await f.ops.issueMissingClassCodes('teaching-a',await f.input());assert.equal(r.status,503);assert.equal(f.snapshot().numericCredentials.length,0);
  const g=fixture();await g.ops.issueMissingClassCodes('teaching-a',await g.input());
  assert.equal((await g.ops.rotate({...g.member(),enrollmentId:'other',requestId:'synthetic-bad-enrollment'})).status,409);
  assert.equal((await g.ops.rotate({...g.member(),revision:999,requestId:'synthetic-bad-revision'})).status,409);
  assert.equal(g.snapshot().numericCredentials.length,3);
  denial(await g.forRequest({method:'GET',trusted:false}).listClass('teaching-a'));
  denial(await g.forRequest({method:'POST',headers:{origin:'https://evil.invalid'}}).issueMissingClassCodes('teaching-a',await g.input()));
  denial(await g.forRequest({method:'GET'}).rotate({...g.member(),requestId:'synthetic-wrong-method'}));
});

test('concrete PG extension uses same query/commit and never flushes plaintext or adds keys to old codec',async()=>{
  const tables=new Map(['numeric_credentials','numeric_sessions','numeric_rates','class_credential_receipts'].map(t=>[t,[]])),calls=[];
  const base={async transaction(fn){const db={contexts:[]};const out=await fn(db,{query:async(sql,args)=>{
    calls.push({sql,args});const table=/n88_private\.([a-z_]+)/.exec(sql)?.[1];
    if(sql.startsWith('select'))return {rows:tables.get(table).map(payload=>({payload}))};
    return {rowCount:1};
  }});assert.deepEqual(Object.keys(db),['contexts']);return out;}};
  const repo=withCredentialRepository(base);
  await repo.transaction(db=>{db.numericRates.push({key:'global',count:1,until:999});return 'committed';});
  assert.equal(calls.filter(c=>c.sql.startsWith('insert')).length,1);
  assert.match(calls.at(-1).sql,/numeric_rates/);assert.equal(calls.at(-1).args[1],JSON.stringify({key:'global',count:1,until:999}));
  assert.equal(calls.some(c=>/begin|commit|advisory/.test(c.sql)),false);
  const resolver=createPgClassResolver({teachingId:'teaching-a'});let parameters;
  const scope=await resolver({memberships:[]},{query:async(sql,args)=>{parameters=args;assert.match(sql,/term.status='active'/);return {rows:[{id:'teaching-a',section_id:'class-a',teaching_revision:'1',term_revision:'1'}]};}},
    {ownerId:'owner-a'},'teaching-a',{});
  assert.deepEqual(parameters,['owner-a','teaching-a']);assert.equal(scope.current,true);
});
