/** AI: focused recovery qualification, fresh fabricated PG/HTTP/app only; no private output. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {createCodeRecovery} from '../drafts/n88-student-portal/code-recovery.mjs';
import {createNumericCredentialOperations} from '../drafts/n88-student-portal/numeric-credentials.mjs';
import {createCanonicalAdapter} from '../drafts/n88-student-portal/canonical-adapter.mjs';
import {createPostgresRepository} from '../drafts/n88-student-portal/postgres-repository.mjs';
import {withCredentialRepository} from '../drafts/n88-student-portal/class-credentials.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A,B,SESSION} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-teacher-code-recovery-share-20261018',runId='72d3c8a3-8a69-4e86-8cee-e6c37034035e';
const canonical='C:/Users/Abody/Projects/RakeezX',taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}},pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
let review,owned=false,failed;
try {
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 review=await startIntegratedReview({ttl:600});const t=review.testing,q=t.query,origin=new URL(review.url).origin;
 const binding={ownerId:A,sessionId:SESSION,leaseId:'recovery-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=async(action,body={},token=t.provider.token(),bind=binding)=>{const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+token},body:JSON.stringify({teachingId:'teaching',binding:bind,...body})});return {status:r.status,body:await r.json(),headers:r.headers};};
 const list=async()=>{const r=await teacher('list');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);return r.body.data;};
 const repo=()=>withCredentialRepository(createPostgresRepository({acquire:t.acquire,synchronize:createCanonicalAdapter(),...t.repositoryOptions}));
 const mutate=(action,s)=>teacher(action,{studentId:s.studentId,enrollmentId:s.enrollmentId,revision:s.revision,credentialVersion:s.credentialVersion,requestId:randomUUID()});
 const batch=async()=>teacher('issue-missing',{expectedRosterRevision:(await list()).rosterRevision,requestId:randomUUID()});
 const claim=async code=>{const r=await fetch(origin+'/api/n88/student/claim',{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1'},body:JSON.stringify({code})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 report.stage='durable-envelope';
 const initial=await batch();assert.equal(initial.status,200);assert.equal(initial.body.data.created.length,2);
 let roster=await list(),codes=roster.students.map(s=>s.credential),versions=roster.students.map(s=>s.credentialVersion);
 assert.ok(codes.every(c=>/^1[0-9]{5}$/.test(c)));assert.equal(new Set(codes).size,2);
 assert.deepEqual((await list()).students.map(s=>s.credential),codes);assert.deepEqual((await list()).students.map(s=>s.credentialVersion),versions);
 const storage=(await q('select payload from n88_private.code_recovery')).rows.map(r=>r.payload);
 assert.equal(storage.length,2);assert.ok(storage.every(e=>e.algorithm==='AES-256-GCM'&&e.nonce.length===24&&e.tag.length===32&&e.ciphertext.length===12));
 assert.ok(codes.every(c=>!JSON.stringify(storage).includes(c)));
 const verifiers=(await q('select payload from n88_private.numeric_credentials order by row_key')).rows;
 await t.restart();assert.deepEqual((await list()).students.map(s=>s.credential),codes);assert.equal(t.serviceInstances,2);
 assert.deepEqual((await batch()).body.data.created,[]);assert.deepEqual((await list()).students.map(s=>s.credentialVersion),versions);
 report.stage='crypto-fail-closed';
 const config=t.recoveryOptions(),recovery=createCodeRecovery(config),c=verifiers[0].payload,e=storage.find(e=>e.credentialId===c.id);
 assert.ok(codes.includes(recovery.open(c,e)));
 for(const [field,value] of [['ownerId',B],['studentId','foreign'],['version',c.version+1],['id',randomUUID()],['format','unknown'],['revokedAt',1]])assert.throws(()=>recovery.open({...c,[field]:value},e));
 for(const [field,value] of [['id',randomUUID()],['credentialId',randomUUID()],['tag','0'.repeat(32)],['nonce','0'.repeat(24)],['ciphertext','0'.repeat(12)],['ciphertext','0'],['envelopeVersion',2],['algorithm','unknown'],['keyVersion','unknown'],['generation',2]])assert.throws(()=>recovery.open(c,{...e,[field]:value}));
 assert.throws(()=>recovery.open(c,{...e,extra:true}));assert.throws(()=>recovery.open(c,{}));
 assert.throws(()=>createCodeRecovery({keys:new Map([['r1',Buffer.alloc(31)]]),activeKeyVersion:'r1'}));
 assert.throws(()=>createCodeRecovery({keys:new Map([['r1',randomBytes(32)]]),activeKeyVersion:'missing'}));
 assert.throws(()=>createCodeRecovery({...config,otherKeys:[config.keys.get('r1')]}));
 const before=JSON.stringify(verifiers);t.setRecovery(new Map([['r1',randomBytes(32)]]),'r1');
 const badKey=await teacher('list');assert.equal(badKey.status,503);assert.deepEqual(badKey.body,{error:'unavailable'});
 assert.equal(JSON.stringify((await q('select payload from n88_private.numeric_credentials order by row_key')).rows),before);t.setRecovery(config.keys,'r1');
 let draws=0;await assert.rejects(()=>recovery.append({query:async()=>{draws++;return {rowCount:0};}},c,codes[0]));assert.equal(draws,8);
 report.stage='authorization-before-read';
 for(const [token,bind] of [[t.provider.token({exp:1}),binding],[t.provider.token({sub:B}),{...binding,ownerId:B}],[t.provider.token(),{...binding,classId:'wrong'}],[t.provider.token(),{...binding,termId:'wrong'}]]) {
  const n=t.metrics.recoveryReads,r=await teacher('list',{},token,bind);assert.equal(r.status,401);assert.equal(t.metrics.recoveryReads,n);assert.deepEqual(r.body,{error:'unavailable'});
 }
 t.provider.banned=true;let n=t.metrics.recoveryReads;assert.equal((await teacher('list')).status,401);assert.equal(t.metrics.recoveryReads,n);t.provider.banned=false;
 assert.equal((await teacher('list',{},'',binding)).status,401);
 report.stage='rewrap-rotation-cas';
 const rotatedConfig={keys:new Map([...config.keys,['r2',randomBytes(32)]]),activeKeyVersion:'r2'},rewrap=createCodeRecovery(rotatedConfig);
 await repo().transaction(async(db,ports)=>{for(const row of db.numericCredentials.filter(c=>c.revokedAt===null))await rewrap.rewrap(ports,row,1);});
 await assert.rejects(()=>repo().transaction(async(db,ports)=>rewrap.rewrap(ports,db.numericCredentials[0],1)));
 t.setRecovery(rotatedConfig.keys,'r2');await t.restart();assert.deepEqual((await list()).students.map(s=>s.credential),codes);
 assert.deepEqual((await q('select payload from n88_private.numeric_credentials order by row_key')).rows,verifiers);
 assert.equal((await q('select count(*)::int n from n88_private.code_recovery')).rows[0].n,4);
 t.setRecovery(new Map([['r2',rotatedConfig.keys.get('r2')]]),'r2');assert.deepEqual((await list()).students.map(s=>s.credential),codes);
 // Old records are intentionally retained as nonce tombstones but not chosen by the current reader.
 const conn=await t.acquire();try {
  await assert.rejects(()=>conn.query('delete from n88_private.code_recovery'));
  await assert.rejects(()=>conn.query('update n88_private.code_recovery set payload=payload'));
  await assert.rejects(()=>conn.query('select * from auth.sessions'));
 }finally{conn.release();}
 for(const role of ['anon','authenticated']){await q('set role '+role);try{await assert.rejects(()=>q('select payload from n88_private.code_recovery'));}finally{await q('reset role');}}
 const collision={...storage[0],id:randomUUID(),generation:99};await assert.rejects(()=>q('insert into n88_private.code_recovery(row_key,payload) values($1,$2::jsonb)',[collision.id,JSON.stringify(collision)]));
 pass('n88_teacher_active_code_aead_durability_rotation_tamper_and_restricted_role_guards','Actual restricted nativePG + two alternating gateway/service instances: same active code/version across list, restart; encrypted-only append-only storage, AEAD wrong key/AAD/nonce/tag/truncation/version rejection; supported old-version decrypt and CAS ciphertext rewrap with fresh nonce, no credential/reservation change; duplicate nonce and backend update/delete/browser/Auth scan denied. Fresh expired/foreign/banned/current-class/term denials happen before envelope query.');
 report.stage='commit-unknown';
 await q(`insert into rakeezx.students(id,owner_id,revision,name,status) values('ack',$1,1,'سالم علي','active')`,[A]);
 await q(`insert into rakeezx.enrollments(id,owner_id,revision,student_id,section_id,status,start_date) values('ack-e',$1,1,'ack','class','active','2026-08-01')`,[A]);
 t.failTeacherCommit('before');assert.equal((await batch()).status,503);assert.equal((await list()).students.find(s=>s.studentId==='ack').hasActiveCode,false);
 t.failMemberAck();const failedMember=await batch();assert.equal(failedMember.body.data.created.length,0);assert.equal(failedMember.body.data.failed.length,1);assert.equal((await list()).students.find(s=>s.studentId==='ack').hasActiveCode,false);
 t.failEnvelope();let failedBatch=await batch();assert.equal(failedBatch.body.data.failed.length,1);assert.equal((await list()).students.find(s=>s.studentId==='ack').hasActiveCode,false);
 t.failTeacherCommit('after');assert.equal((await batch()).status,503);const recovered=(await list()).students.find(s=>s.studentId==='ack');assert.equal(recovered.recoveryStatus,'recoverable');assert.equal(recovered.credentialVersion,1);
 assert.deepEqual((await batch()).body.data.created,[]);assert.equal((await list()).students.find(s=>s.studentId==='ack').credential,recovered.credential);
 report.stage='legacy';
 await q(`insert into rakeezx.students(id,owner_id,revision,name,status) values('legacy',$1,1,'مازن حسن','active')`,[A]);
 await q(`insert into rakeezx.enrollments(id,owner_id,revision,student_id,section_id,status,start_date) values('legacy-e',$1,1,'legacy','class','active','2026-08-01')`,[A]);
 const legacy=await repo().transaction(async(db,ports)=>{await ports.synchronizeOwner(A);return createNumericCredentialOperations(t.numericOptions()).issueMember(db,db.memberships.find(m=>m.studentId==='legacy'),{expectedVersion:0});});
 let legacyRow=(await list()).students.find(s=>s.studentId==='legacy');assert.equal(legacyRow.recoveryStatus,'legacy');assert.equal(legacyRow.credential,null);
 assert.deepEqual((await batch()).body.data.created,[]);assert.equal((await list()).students.find(s=>s.studentId==='legacy').credentialVersion,1);
 const oldSession=await claim(legacy.code);assert.equal(oldSession.status,200);
 const rotate=await mutate('rotate',legacyRow);assert.equal(rotate.status,200);assert.notEqual(rotate.body.data.credential,legacy.code);
 assert.equal((await claim(legacy.code)).status,401);
 const oldRead=await fetch(origin+'/api/n88/student/read',{headers:{cookie:oldSession.cookie}});assert.equal(oldRead.status,401);
 legacyRow=(await list()).students.find(s=>s.studentId==='legacy');assert.equal(legacyRow.recoveryStatus,'recoverable');assert.equal(legacyRow.credentialVersion,2);
 assert.equal((await mutate('revoke',legacyRow)).status,200);assert.equal((await claim(legacyRow.credential)).status,401);assert.equal((await list()).students.find(s=>s.studentId==='legacy').credential,null);
 // Small changed-path budget regression; G's 35-student/flood/restart proof is reused.
 await q('delete from n88_private.numeric_attempts');await q('delete from n88_private.numeric_rates');
 for(let i=0;i<5;i++)assert.equal((await claim('bad')).status,401);
 assert.equal((await claim(codes[0])).status,200);assert.equal((await claim('bad')).status,401);const reads=t.metrics.credentialReads;assert.equal((await claim(codes[0])).status,401);assert.equal(t.metrics.credentialReads,reads);
 await q('delete from n88_private.numeric_attempts');await q('delete from n88_private.numeric_rates');
 // Concurrent list/batch/rotate serialized by original repository lock; stale CAS cannot rotate twice.
 roster=await list();const target=roster.students.find(s=>s.studentId==='ack');const races=await Promise.all([mutate('rotate',target),mutate('rotate',target),teacher('list'),batch()]);assert.equal(races.filter(r=>r.status===409).length,1);assert.equal((await list()).students.find(s=>s.studentId==='ack').credentialVersion,2);
 pass('n88_recovery_commit_ack_budget_compatibility','Envelope insert rollback and before-COMMIT failure disclose no code; after-COMMIT lost ACK recovers server-proven version1 on freshly authorized list, repeated missing-only creation skips unchanged. Legacy hash-only preserved until explicit per-row rotate; old copy/session deny, revoke suppresses reveal. Concurrent list/batch/rotate honors CAS. Focused five-wrong + success + sixth-wrong boundary remains; unchanged G35-IP/flood proof reused.');
 report.stage='actual-app';
 for(const [id,name] of [['legacy-ui','راشد صالح'],['missing-ui','فهد سالم']]) {
  await q(`insert into rakeezx.students(id,owner_id,revision,name,status) values($1,$2,1,$3,'active')`,[id,A,name]);
  await q(`insert into rakeezx.enrollments(id,owner_id,revision,student_id,section_id,status,start_date) values($1,$2,1,$3,'class','active','2026-08-01')`,[id+'-e',A,id]);
 }
 const uiLegacy=await repo().transaction(async(db,ports)=>{await ports.synchronizeOwner(A);return createNumericCredentialOperations(t.numericOptions()).issueMember(db,db.memberships.find(m=>m.studentId==='legacy-ui'),{expectedVersion:0});});

 await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'}),page=await context.newPage();
  // Owned in-memory injected ports validate text without clipboard mutation or real sharing.
  await page.addInitScript(()=>{window.portResults={copy:0,share:0,valid:true,cancel:false,failCopy:false};const validate=text=>{const code=document.querySelector('[data-code] input')?.value,name=document.querySelector('.n88-class-roster strong')?.textContent;return text===`مرحبًا ${name}،\nرمز دخولك: ${code}\n${location.origin}/student\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`&&!(new URL(text.split('\n')[2])).search;};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.portResults.failCopy)throw Error('Synthetic unavailable');window.portResults.copy++;window.portResults.valid&&=validate(text);}}});Object.defineProperty(navigator,'share',{configurable:true,value:async({text})=>{window.portResults.share++;window.portResults.valid&&=validate(text);if(window.portResults.cancel)throw Error('Synthetic canceled');}});});
  await page.goto(review.url);await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await page.locator('[data-code] input').first().waitFor();
  assert.equal(await page.locator('.n88-class-roster>li').count(),6);
  const legacyUi=page.locator('.n88-class-roster>li').filter({hasText:'راشد صالح'});
  assert.equal(await legacyUi.locator('[data-code]').count(),0);assert.match(await legacyUi.innerText(),/رمز قديم غير قابل للاسترجاع/);
  const originalVersion=(await list()).students.find(s=>s.studentId==='legacy-ui').credentialVersion;
  await legacyUi.locator('[data-action=review-rotate]').click();assert.match(await page.locator('[data-confirm]').innerText(),/يُبطل الرمز السابق وجميع جلساته/);
  await page.locator('[data-action=cancel]').click();assert.equal((await list()).students.find(s=>s.studentId==='legacy-ui').credentialVersion,originalVersion);
  await page.locator('[data-action=refresh]').click();await page.locator('[data-code] input').first().waitFor();
  await page.locator('[data-action=batch]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-code] input').length===4);
  assert.equal((await list()).students.find(s=>s.studentId==='legacy-ui').recoveryStatus,'legacy');
  await legacyUi.locator('[data-action=review-rotate]').click();await page.locator('[data-action=confirm]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-code] input').length===5);
  assert.equal((await claim(uiLegacy.code)).status,401);
  const shown=await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value));assert.equal(shown.length,5);
  assert.ok(!(await page.locator('.n88-class-roster').innerText()).includes('OTHER_NAME'));assert.equal(await page.evaluate(()=>window.portResults.share),0);
  await page.locator('[data-action=copy-student]').first().click();await page.waitForFunction(()=>window.portResults.copy===1);
  await page.locator('[data-action=share-student]').first().click();await page.waitForFunction(()=>window.portResults.share===1);assert.equal(await page.evaluate(()=>window.portResults.valid),true);
  await page.evaluate(()=>{window.portResults.cancel=true;});await page.locator('[data-action=share-student]').first().click();await page.getByRole('status').filter({hasText:'أُلغيت المشاركة'}).waitFor();
  await page.evaluate(()=>{window.portResults.failCopy=true;});await page.locator('[data-action=copy-student]').first().click();await page.locator('[data-manual]').waitFor();
  await page.locator('[data-action=refresh]').click();await page.locator('[data-code] input').first().waitFor();assert.equal(await page.locator('[data-manual]').count(),0);
  assert.deepEqual(await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value)),shown);
  await page.reload();await page.locator('[data-code] input').first().waitFor();assert.deepEqual(await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value)),shown);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.notEqual(await page.locator('.n88-class-roster').evaluate(el=>getComputedStyle(el).display),'none');
  // Persisted teacher account state may contain its normal synthetic account/store,
  // but none of the displayed codes or envelope fields may be stored there.
  assert.equal(await page.evaluate(async codes=>{const values=[JSON.stringify({...localStorage}),JSON.stringify({...sessionStorage})];for(const info of await indexedDB.databases()){const db=await new Promise(ok=>{const r=indexedDB.open(info.name);r.onsuccess=()=>ok(r.result);});for(const name of db.objectStoreNames){values.push(JSON.stringify(await new Promise(ok=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>ok(r.result);})));}db.close();}return values.every(v=>!codes.some(c=>v.includes(c))&&!/ciphertext|N88_RECOVERY_KEY/.test(v));},shown),true);
  // Canonical entry-point lease/owner guards immediately erase plaintext and reject late response.
  const held=t.hold();await page.locator('[data-action=refresh]').click();await held;
  await page.evaluate(()=>window.n88Fixture.expire());assert.equal(await page.locator('[data-code] input').count(),0);t.release();await page.waitForTimeout(150);assert.equal(await page.locator('[data-code] input').count(),0);
  await page.reload();await page.locator('[data-code] input').first().waitFor();await page.evaluate(()=>window.n88Fixture.switchOwner());assert.equal(await page.locator('[data-code] input').count(),0);
  // Student route is the same actual universal document; code is entered, never in URL.
  const sc=await createContext({viewport:{width:390,height:900}}),sp=await sc.newPage();await sp.goto(review.studentUrl);await sp.locator('[data-claim] input').fill(codes[0]);await sp.locator('[data-claim] button').click();await sp.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();assert.equal(sp.url(),review.studentUrl);assert.ok(!/credential|ciphertext|keyVersion/.test(await sp.locator('main').innerText()));
 });
 pass('n88_actual_class_reopen_same_code_copy_share_legacy_and_current_owner_guards','Actual whole application class route/owner-bound store + source CSS on fresh 390px synthetic HTTP contexts: actual one-click missing-only creation and explicit legacy per-row warning/cancel/rotate; refetch/reload exact same codes, Arabic names, precise per-student Arabic name/code/absolute universalURL/instructions through injected copy/share ports, no automatic share; cancellation/manual copy fallback honest; persistence scan excludes codes/envelopes. Expired lease and owner switch synchronously wipe DOM, delayed list cannot restore; same actual universal student login succeeds with no code URL. No screenshots or clipboard/send operations.');
 const identities=(await q(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;
 assert.ok(identities.tables.some(x=>x.relname==='code_recovery'&&x.relrowsecurity));
 await writeFile('drafts/n88-student-portal/activation/integrated-expected-identities.json',JSON.stringify({sourceOnly:true,migrationVersions:['20261018034356','20261018102843','20261018110713','20261018114113','20261018115648'],identities},null,2)+'\n');
} catch(e) {failed=true;report.failure={stage:report.stage,message:e?.code==='ERR_ASSERTION'?'Assertion failed; values omitted':String(e.message).replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]').split('\n')[0]};}
finally {await review?.close();report.cleanup.httpAndPgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-recovery.json',JSON.stringify(report,null,2)+'\n');}
console.log(failed?'N88 recovery check FAIL (sanitized report)':'N88 recovery focused checks PASS');if(failed)process.exitCode=1;
