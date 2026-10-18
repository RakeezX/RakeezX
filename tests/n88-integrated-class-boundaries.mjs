import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
/** AI: changed composed service boundaries on owned native PG; no hosted calls. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A,SESSION} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',base+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}};let review,owned=false,failed;
const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try{
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;review=await startIntegratedReview({ttl:240});
  const origin=new URL(review.url).origin,q=review.testing.query;
  const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic-boundary',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
  const teacher=async(action,body={},overrides={})=>{
    const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+review.testing.provider.token()},body:JSON.stringify({teachingId:binding.teachingId,binding,...body,...overrides})});
    return {status:r.status,body:await r.json().catch(()=>null)};
  };
  const student=async(action,{code,cookie,extraHeaders={}}={})=>{
    const r=await fetch(origin+'/api/n88/student/'+action,{method:action==='read'?'GET':'POST',headers:{...extraHeaders,...(action==='read'?{}:{'Content-Type':'application/json','X-N88-CSRF':'1'}),...(cookie?{Cookie:cookie}:{})},...(action==='read'?{}:{body:JSON.stringify(code?{code}:{})})});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie'),cache:r.headers.get('cache-control')};
  };
  const list=await teacher('list');assert.equal(list.status,200);
  const request={requestId:'integrated-lost-ack-0001',expectedRosterRevision:list.body.data.rosterRevision};
  review.testing.loseAck();assert.equal((await teacher('issue-missing',request)).status,503);
  const replay=await teacher('issue-missing',request);assert.equal(replay.status,200);assert.equal(replay.body.data.uncertain,true);assert.equal(replay.body.data.created.length,0);
  assert.equal((await q('select count(*)::int as n from n88_private.numeric_credentials')).rows[0].n,2);
  const after=await teacher('list');const skip=await teacher('issue-missing',{...request,requestId:'integrated-skip-ack-0002',expectedRosterRevision:after.body.data.rosterRevision});assert.equal(skip.body.data.skipped.length,2);
  const member=after.body.data.students.find(s=>s.studentId==='student');
  const rotated=await teacher('rotate',{studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion,requestId:'integrated-rotate-0003'});
  assert.equal(rotated.status,200);let code=rotated.body.data.credential;
  const login=await student('claim',{code});assert.equal(login.status,200);assert.match(login.cookie,/HttpOnly; Secure; SameSite=Strict/);assert.match(login.cache,/no-store/);
  const cookie=login.cookie.split(';')[0];assert.equal((await student('read',{cookie})).status,200);assert.equal((await student('read')).status,401);
  check('durable_lost_ack_replay_missing_only_and_cookie','Real signed gateway/Auth/native PG: lost batch ACK commits once; same request returns uncertain without plaintext; fresh missing-only request skips both; selective rotate recovers exactly one code; Secure/HttpOnly/private cookie and anonymous denial.');
  // Current source drift rejects stale teacher roster and student sessions; restore cannot revive them.
  const before=await teacher('list');await q("update rakeezx.enrollments set revision=revision+1 where owner_id=$1 and id='enrollment'",[A]);
  assert.equal((await teacher('issue-missing',{requestId:'integrated-stale-roster-04',expectedRosterRevision:before.body.data.rosterRevision})).status,409);
  assert.equal((await student('read',{cookie})).status,401);
  // Code identity stays stable across current term; a new session sees no old-term publication.
  await q("update rakeezx.terms set status='closed',revision=revision+1 where owner_id=$1 and id='term'",[A]);
  await q("insert into rakeezx.terms(owner_id,id,year_id,status,revision) values($1,'term2','year','active',1)",[A]);
  await q("insert into rakeezx.teachings(owner_id,id,section_id,term_id,revision,subject_id) values($1,'teaching2','class','term2',1,'subject')",[A]);
  assert.equal((await teacher('list')).status,401);
  const next=await student('claim',{code});assert.equal(next.status,200);assert.deepEqual((await student('read',{cookie:next.cookie.split(';')[0]})).body,{version:'n88-student-v3'});
  assert.equal((await q("select count(*)::int as n from n88_private.numeric_credentials where payload->>'studentId'='student'")).rows[0].n,2);
  check('current_roster_term_identity_and_stable_credential','Enrollment revision rejects stale teacher roster and old student session; current term change denies old teaching and preserves original owner/student credential, while stripping previous term publication.');
  // All failures debit durable budgets BEFORE format/reservation lookup; a valid code is denied when exhausted.
  for(let i=0;i<6;i++)await student('claim',{code:'invalid'});
  assert.equal((await student('claim',{code})).status,401);
  const budgets=(await q('select payload from n88_private.numeric_rates')).rows.map(r=>r.payload);assert.ok(budgets.some(r=>r.count===6));assert.ok(budgets.find(r=>r.key==='global').count>=6);
  const stored=JSON.stringify((await q('select payload from n88_private.numeric_credentials')).rows);assert.equal(stored.includes(code),false);code='';
  // Existing Auth/session/user-ban guards remain effective in composed class entry.
  await q("update auth.sessions set not_after=now()-interval '1 second' where id=$1::uuid",[SESSION]);assert.equal((await teacher('list',{}, {binding:{...binding,teachingId:'teaching2',termId:'term2'},teachingId:'teaching2'})).status,401);
  await q('update auth.sessions set not_after=null where id=$1::uuid',[SESSION]);await q("update auth.users set banned_until=now()+interval '1 hour' where id=$1::uuid",[A]);
  assert.equal((await teacher('list',{}, {binding:{...binding,teachingId:'teaching2',termId:'term2'},teachingId:'teaching2'})).status,401);await q('update auth.users set banned_until=null where id=$1::uuid',[A]);
  check('global_durable_rate_no_plaintext_and_auth_gates','Malformed attempts exhaust persistent source/global budgets before lookup; valid code then denied. Stored reservations/verifiers contain no code. Actual expired Auth session and banned user deny composed class operations.');
  const identity=(await q(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;
  assert.equal(identity.negative_access.anon_private,false);assert.equal(identity.negative_access.backend_auth,false);assert.equal(identity.negative_access.backend_guard_member,false);
  assert.ok(identity.helpers.some(h=>h.name==='lock_projection_sources'&&h.owner==='n88_guard'));
  await writeFile('drafts/n88-student-portal/activation/integrated-expected-identities.json',JSON.stringify({sourceOnly:true,migrationVersions:['20261018034356','20261018102843','20261018110713'],identities:identity},null,2)+'\n');
  check('extended_sql_identity_readback','Extended roles/helpers/ACL/policies read back from actual native PG; backend has no Auth/schema access or guard membership and browser roles have no private access. Exact current expected identity artifact exported; no hosted claim.');
  // Actual account guard clears a held roster after owner deactivation. No credentials are issued here.
  await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:60000},async({createContext})=>{
    // Return source to the first term for this separate UI boundary, preserving all prior receipts/reservations.
    await q("update rakeezx.terms set status=case id when 'term' then 'active' else 'closed' end,revision=revision+1 where owner_id=$1",[A]);
    const c=await createContext({viewport:{width:1280,height:900}}),p=await c.newPage();await p.goto(review.url);await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('.n88-class-roster>li').last().waitFor();
    const held=review.testing.hold();await p.locator('[data-action=refresh]').click();await held;
    await p.evaluate(()=>window.n88Fixture.switchOwner());review.testing.release();await p.waitForFunction(()=>!document.querySelector('.n88-class-roster'));
    assert.equal(await p.locator('[data-delivery]').count(),0);
    check('actual_ui_delayed_owner_change','Actual account/store route with held native-service roster response; deactivating owner clears UI, and late response cannot restore roster or secret delivery sheet.');
  });
}catch(e){failed=e;report.failure=diagnosticError(e);}
finally{review?.testing.release();await review?.close();report.cleanup.ownedHttpAndNativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-boundaries.json',JSON.stringify(redactN88(report),null,2)+'\n');}
if(failed){console.error(redactN88(report.failure));process.exitCode=1;}else console.log('N88 composed service boundary checks PASS');
