/** AI: affected real PG -> original numeric Auth -> V2 signer/web entry/client/UI journey. */
import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {createServer} from 'node:http';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {providerFixture,A,B,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import {createCanonicalAdapter} from '../../drafts/n88-student-portal/canonical-adapter.mjs';
import {createNumericCredentialOperations} from '../../drafts/n88-student-portal/numeric-credentials.mjs';
import {createWebEntry} from '../../drafts/n88-student-portal/web-entry.mjs';
import {createRuntimeWriterGateway} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/gateway.inactive.mjs';
import {createPublicationClient,parseStudentScopeData} from '../../src/lib/student-portal-publication-client.js';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import deployment from '../../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
const origin='https://scope.synthetic.invalid',off={required:false,scheduled:false,completed:false,grade:false},dir='tests/n88-student-scope-1031';
export async function qualifyJourney({q,installer,connectAs,report,check,root}){
 const provider=providerFixture(),numeric={keys:new Map([['v1',Buffer.alloc(32,1)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,2)};
 const rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
 const db={contexts:(await q('select namespace,owner_id,active from n88_private.contexts')).rows.map(r=>({namespace:r.namespace,ownerId:r.owner_id,active:r.active})),memberships:[],sessions:[],publications:[],numericCredentials:[],numericSessions:[]};
 await createCanonicalAdapter({rollout})(db,{query:q},A);
 db.numericCredentials=(await q('select payload from n88_private.numeric_credentials')).rows.map(r=>r.payload);db.numericSessions=(await q('select payload from n88_private.numeric_sessions')).rows.map(r=>r.payload);
 const numbers=createNumericCredentialOperations({...numeric,rollout}),issued=numbers.rotateMember(db,db.memberships.find(m=>m.ownerId===A),{expectedVersion:1});
 for(const cred of db.numericCredentials)await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2) on conflict(row_key) do update set payload=excluded.payload',[cred.id,cred]);
 for(const session of db.numericSessions)await q('update n88_private.numeric_sessions set payload=$2 where row_key=$1',[session.id,session]);
 await createCanonicalAdapter({rollout})(db,{query:q},B);const issuedB=numbers.issueMember(db,db.memberships.find(m=>m.ownerId===B),{expectedVersion:0});
 const credentialB=db.numericCredentials.find(c=>c.ownerId===B);await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2)',[credentialB.id,credentialB]);
 for(const m of db.memberships)await q('insert into n88_private.memberships(owner_id,class_id,student_id,enrollment_id,revision,status,end_date,student_active,class_active,label,canonical_stamp,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)',[m.ownerId,m.classId,m.studentId,m.enrollmentId,m.revision,m.status,m.endDate,m.studentActive,m.classActive,m.label,m.canonicalStamp]);
 await q('insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval \'1 hour\')',[SESSION,A]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q(`insert into rakeezx.items(id,teaching_id,name,max,score_mode,"order") values('item-a','teaching','الدرجة الأولى',10,'direct',0);insert into rakeezx.scores(id,student_id,item_id,value) values('score-a','pupil','item-a',8);`);
 const sys=(await q('select (pg_control_system()).system_identifier::text as id')).rows[0].id;
 const acquire=async()=>{const c=await connectAs('n88_backend');c.release=()=>c.end().catch(()=>{});return c;};
 const options={...deployment,origin,authUrl,apiKey:'FABRICATED_PUBLIC_KEY',secretKey:Buffer.alloc(32,3),ingressKey:Buffer.alloc(32,4),numericKey:numeric.keys.get('v1'),reservationKey:numeric.reservationKey,
  recoveryKeys:new Map([['v1',Buffer.alloc(32,5)]]),recoveryActiveKeyVersion:'v1',acquire,fetch:provider.fetch,rollout,canonicalBounds:{rollout},sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,
  publicationRuntime:{enabled:true,expectedSystemIdentifier:sys,assertTransport:async c=>assert.equal((await c.query('select session_user as login')).rows[0].login,'n88_backend')}};
 const web=createWebEntry(options),wires=[];let tamper=false;
 const carrier=createRuntimeWriterGateway({fetch:async(url,init)=>{
  const envelope=JSON.parse(init.body);wires.push({path:envelope.path,headers:envelope.headers.length,body:envelope.body});
  if(tamper){envelope.path=envelope.path.replace('teaching=teaching','teaching=other-teaching');init={...init,body:JSON.stringify(envelope)};}
  return web(new Request(url,init));
 }});
 const env={N88_ENABLED:'true',N88_PUBLICATION_V2_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:options.ingressKey.toString('hex')};
 const request=async(pathname,init={},gateway=carrier)=>{
  const r=new Request(origin+pathname,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),origin,'cf-connecting-ip':'192.0.2.42','sec-fetch-site':'same-origin'}});
  Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return gateway(r,env);
 };
 const binding={sessionId:SESSION,leaseId:'scope-owned-synthetic',contextRevision:'scope-source-1'};
 const scope=teachingId=>({ownerId:A,teachingId,sectionId:'class',termId:teachingId==='teaching'?'term':'term2',subjectId:'custom'});
 const makeTeacher=teachingId=>{const stored=new Map();return createPublicationClient({getIdentity:()=>({scope:scope(teachingId),binding,key:'synthetic-'+teachingId}),storage:()=>({getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)}),dispatch:(p,i,mark)=>{mark();return request(p,{...i,headers:{...i.headers,authorization:'Bearer '+provider.token()}});}});};
 const a=makeTeacher('teaching');const list=await a.list();await a.save(list.rows[0].id,{...off,grade:true});
 let cookie;const student=createUnifiedStudentPortalClient({publicationReadiness:{enabled:true,serviceRevision:'n88-item-publication-v2'},fetch:async(p,i)=>{const r=await request(p,{...i,headers:{...i.headers,...(cookie?{cookie}:{})}});report.studentResponses??=[];report.studentResponses.push({path:p,status:r.status,diagnostic:r.headers.get('x-n88-failure')});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;}});
 await check('actual_signed_single_scope_auto_numeric_auth',async()=>{
  let single;try{single=await student.claim(issued.code);}catch(e){report.studentFailure={kind:e.kind,claimState:e.claimState,diagnostic:student.getDiagnostic()};throw e;}assert.equal(single.state,'selected');assert.equal(single.teachingId,'teaching');assert.equal(single.choices[0].label,'مادة مخصصة <b>نص</b>');assert.equal(single.projection.grades[0].value,8);return {singleAutomatic:true,originalNumericAuth:true,actualCarrierAndWebEntry:true};
 });
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q(`insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term2','year','الفصل الموازي',2,'active','2026-08-01','2027-06-01');insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('teaching2','class','custom','term2');
 insert into rakeezx.items(id,teaching_id,name,max,score_mode,"order") values('item-b','teaching2','الدرجة الثانية',10,'direct',0);insert into rakeezx.scores(id,student_id,item_id,value) values('score-b','pupil','item-b',3);
 insert into rakeezx.sections(id,year_id,grade,label,name) values('other-class','year',4,'ب','فصل آخر');insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('other-teaching','other-class','custom','term');`);
 const b=makeTeacher('teaching2'),bl=await b.list();await b.save(bl.rows[0].id,{...off,grade:true});
 await a.list();const manual=await a.preview({id:'manual-a',title:'عمل النطاق الأول',description:'مهمة المعلم',startDate:null,dueDate:null,link:'https://example.test/explanation'});await a.save(manual.id,{...off,required:true});
 await check('overlap_terms_choice_only_explicit_single_projection_and_signed_tamper',async()=>{
  const choice=await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}});const data=await choice.json();assert.equal(data.state,'choice');assert.equal(data.choices.length,2);assert(!('projection'in data));assert(data.choices.every(c=>c.label.includes(' — ')));parseStudentScopeData(data);
  const read=async id=>request('/api/n88/student/publication-v2/read?teaching='+encodeURIComponent(id),{headers:{cookie,'X-N88-CSRF':'1'}});
  const one=await (await read('teaching')).json(),two=await (await read('teaching2')).json();assert.deepEqual(one.projection.grades.map(g=>g.value),[8]);assert.deepEqual(two.projection.grades.map(g=>g.value),[3]);assert.equal(one.projection.work.length,1);assert.equal(two.projection.work.length,0);assert(!JSON.stringify(two).includes('عمل النطاق الأول'));
  assert.notEqual((await read('other-teaching')).status,200);tamper=true;assert.equal((await read('teaching')).status,401);tamper=false;
  for(const suffix of ['?teaching=teaching&owner=x','?teaching=teaching&teaching=teaching2','?teaching=%74eaching','?unknown=x'])assert.equal((await request('/api/n88/student/publication-v2/read'+suffix,{headers:{cookie,'X-N88-CSRF':'1'}})).status,401);
  assert(wires.some(w=>w.path.endsWith('?teaching=teaching2')&&w.headers===6&&w.body===''));return {explicitChoice:true,sameSubjectRealTermLabels:true,noCombinedProjection:true,manualScopeIsolation:true,signedSelectorTamperDenied:true,bodylessGET:true};
 });
 await check('old_legacy_path_and_pilot_exact_teaching_fence',async()=>{
  const legacy=await request('/api/n88/student/read',{headers:{cookie}});assert.equal(legacy.status,503);const legacyData=await legacy.json();assert.notEqual(legacyData.version,'n88-student-scope-v2');
  assert.equal((await request('/api/n88/student/read?teaching=teaching2',{headers:{cookie}})).status,401);
  const pilot=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify({ownerId:A,classId:'class',teachingId:'teaching',studentIds:['pupil','second-pilot']})})[k]);
  const pw=createWebEntry({...options,rollout:pilot,canonicalBounds:{rollout:pilot}}),pc=createRuntimeWriterGateway({fetch:(u,i)=>pw(new Request(u,i))});
  const pr=await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}},pc);const pd=await pr.json();assert.equal(pd.state,'selected');assert.equal(pd.teachingId,'teaching');assert.equal(pd.choices.length,1);
  assert.notEqual((await request('/api/n88/student/publication-v2/read?teaching=teaching2',{headers:{cookie,'X-N88-CSRF':'1'}},pc)).status,200);
  assert(!pilot.admitsStudent({ownerId:A,classId:'class',studentId:'third',status:'active',endDate:null,studentActive:true,classActive:true}));return {legacyResponseNotReinterpreted:true,legacySearchStillDenied:true,pilotExactTeachingAndTwoPupilsPreserved:true,legacyStatus:legacy.status};
 });
 // Actual mounted current student source, HTTP native fetch, signed carrier and owned native DB.
 let delayNext=false;const http=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/api/n88/')){const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks);const result=await request(u.pathname+u.search,{method:req.method,headers:req.headers,...(raw.length?{body:raw}:{})});const body=await result.text();if(delayNext&&u.search==='?teaching=teaching'){delayNext=false;await new Promise(r=>setTimeout(r,350));}res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(body);}
  if(u.pathname==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><main id="student"></main><script type="module" src="/tests/n88-student-scope-1031/student.mjs"></script></html>');}
  if(!/^\/(src\/|assets\/|font\/|tests\/n88-student-scope-1031\/student\.mjs$)/.test(u.pathname))throw Error();
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep))throw Error();res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(f)]??'application/octet-stream');res.end(await readFile(f));
 }catch{res.writeHead(503);res.end();}});
 await new Promise((ok,fail)=>{http.once('error',fail);http.listen(0,'127.0.0.1',ok);});
 try{await check('mounted_actual_student_scope_selection_retired_reply_rtl',async()=>{
  const errors=[];await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-student-scope-source-20261031.json',runId:'9f046986-1f78-4ad5-a247-397a19fc7e66',url:`http://127.0.0.1:${http.address().port}/`,timeoutMs:60000},async({createContext})=>{
   const c=await createContext({viewport:{width:390,height:844},locale:'ar-SA'}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${http.address().port}/`);
   await p.locator('[data-claim] input:not(:disabled)').waitFor();await p.locator('[data-claim] input').fill(issued.code);await p.locator('[data-claim] [type=submit]').click();await p.locator('[data-student-teaching]').waitFor();
   assert.equal(await p.locator('.n88-v2-grades,[data-work-id]').count(),0);assert.equal(await p.locator('option b').count(),0);assert((await p.locator('[data-student-teaching]').textContent()).includes('<b>نص</b>'));
   await p.screenshot({path:dir+'/student-choice-390.png',fullPage:true});report.placeholderDOM=await p.locator('[data-student-teaching] option[value=""]').evaluate(e=>({disabled:e.disabled,html:e.outerHTML}));assert.equal(report.placeholderDOM.disabled,true);
   await p.locator('[data-student-teaching]').focus();await p.locator('[data-student-teaching]').press('ArrowDown');await p.locator('.n88-v2-grades').waitFor();assert.equal(await p.locator('.n88-v2-grades dd').textContent(),'8');
   delayNext=true;await p.locator('[data-read]').click();await p.selectOption('[data-student-teaching]','teaching2');await p.waitForFunction(()=>document.querySelector('.n88-v2-grades dd')?.textContent==='3');await p.waitForTimeout(450);assert.equal(await p.locator('.n88-v2-grades dd').textContent(),'3');assert.equal(await p.locator('[data-work-id]').count(),0);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:dir+'/student-scopes-390.png',fullPage:true});
   await p.evaluate(()=>document.documentElement.dataset.theme='dark');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:dir+'/student-scopes-dark-390.png',fullPage:true});
   await p.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'rakeez.n88.student-retirement.v1',newValue:'untrusted'})));assert.equal(await p.locator('.n88-v2-grades').count(),0);
   await p.reload();await p.locator('[data-student-teaching]').waitFor();assert.equal(await p.locator('.n88-v2-grades').count(),0);
  });assert.deepEqual(errors,[]);return {actualNumericEntry:true,nativeSignedHTTP:true,choiceBeforeProjection:true,maliciousLabelEscaped:true,retiredSelectionReplyIgnored:true,crossTabAndReloadClear:true,mobile390NoOverflow:true};
 });}finally{http.closeAllConnections();await new Promise(ok=>http.close(ok));report.scopeHttpClosed=true;}
 await check('second_owner_exact_scope_rotation_and_transfer_retire_session',async()=>{
  let bc;const claim=async code=>{const r=await request('/api/n88/student/claim',{method:'POST',headers:{'content-type':'application/json','X-N88-CSRF':'1'},body:JSON.stringify({code})});assert.equal(r.status,200);bc=r.headers.get('set-cookie').split(';')[0];};
  const read=()=>request('/api/n88/student/publication-v2/read',{headers:{cookie:bc,'X-N88-CSRF':'1'}});
  await claim(issuedB.code);const own=await (await read()).json();assert.equal(own.teachingId,'teaching');assert.deepEqual(own.projection,{work:[],grades:[]});
  db.numericSessions=(await q('select payload from n88_private.numeric_sessions')).rows.map(r=>r.payload);
  db.numericCredentials=(await q('select payload from n88_private.numeric_credentials')).rows.map(r=>r.payload);
  await createCanonicalAdapter({rollout})(db,{query:q},B);const rotated=numbers.rotateMember(db,db.memberships.find(m=>m.ownerId===B),{expectedVersion:1});
  for(const c of db.numericCredentials.filter(c=>c.ownerId===B))await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2) on conflict(row_key) do update set payload=excluded.payload',[c.id,c]);
  for(const s of db.numericSessions.filter(s=>s.ownerId===B))await q('update n88_private.numeric_sessions set payload=$2 where row_key=$1',[s.id,s]);
  assert.notEqual((await read()).status,200);await claim(rotated.code);assert.equal((await read()).status,200);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await q(`insert into rakeezx.sections(id,year_id,grade,label,name) values('transferred','year',4,'ب','الفصل المنقول');update rakeezx.enrollments set section_id='transferred' where owner_id=current_setting('request.jwt.claim.sub')::uuid and id='enrollment'`);
  assert.notEqual((await read()).status,200);return {sameIdsDifferentOwnersIsolated:true,noForeignGradesOrManualWork:true,rotationRetiresOldSession:true,currentClassTransferRetiresSession:true};
 });
 await check('scope_removal_transfer_archive_and_numeric_revocation',async()=>{
  await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  await q("update rakeezx.teachings set deleted_at=clock_timestamp() where owner_id=$1 and id='teaching2'",[A]);assert.notEqual((await request('/api/n88/student/publication-v2/read?teaching=teaching2',{headers:{cookie,'X-N88-CSRF':'1'}})).status,200);
  await q("update rakeezx.teachings set deleted_at=clock_timestamp() where owner_id=$1 and id='teaching'",[A]);const empty=await (await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}})).json();assert.equal(empty.state,'empty');assert(!('projection'in empty));
  await q("select rakeezx.apply_sync_v2_section_lifecycle_command('scope-archive','scope-device','archive_class','class','2026-10-31',1234)");assert.notEqual((await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}})).status,200);
  await q("select rakeezx.apply_sync_v2_section_lifecycle_command('scope-reopen','scope-device','reopen_class','class',null,1235)");assert.notEqual((await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}})).status,200);
  const again=await request('/api/n88/student/claim',{method:'POST',headers:{'content-type':'application/json','X-N88-CSRF':'1'},body:JSON.stringify({code:issued.code})});assert.equal(again.status,200);cookie=again.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}})).status,200);
  await q("update n88_private.numeric_credentials set payload=jsonb_set(payload,'{revokedAt}',to_jsonb(1::bigint)) where owner_id=$1 and revoked_at is null",[A]);assert.notEqual((await request('/api/n88/student/publication-v2/read',{headers:{cookie,'X-N88-CSRF':'1'}})).status,200);
  return {removedSelectionDenied:true,zeroEligibleEmpty:true,archivedClassDenied:true,restoreCannotReviveOldSession:true,numericRevocationStillDenies:true};
 });
 a.dispose();b.dispose();student.dispose();
 await writeFile(path.join(root,dir,'journey-evidence.json'),JSON.stringify({checks:report.checks.filter(c=>/scope|signed|pilot/.test(c.name)),wires,actualHostedOperations:0},null,2)+'\n');
}
