/** AI: one real HTTP -> actual client/service/PG/canonical adapter journey.
 * ONLY Auth, canonical source rows and TLS/network metadata are fabricated.
 */
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { randomBytes } from 'node:crypto';
import { composeRuntime, deploymentPreflight, createTeacherVerifier } from '../../../drafts/n88-student-portal/runtime.mjs';
import { createHttpAdapter } from '../../../drafts/n88-student-portal/http-adapter.mjs';
import { createStudentPortalClient } from '../../../src/lib/student-portal-client.js';
// Node fetch rewrites Host for its loopback URL. This explicit synthetic network
// transport preserves the TLS virtual host while still exercising actual HTTP.
const httpFetch=(target,init={})=>new Promise((resolve,reject)=>{
  const r=request(target,{method:init.method||'GET',headers:init.headers},async response=>{
    try {const parts=[];let n=0;for await(const part of response){n+=part.length;assert.ok(n<1024*1024);parts.push(part);}
      resolve(new Response(Buffer.concat(parts),{status:response.statusCode,headers:response.headers}));
    }catch(e){reject(e);}
  });
  r.on('error',reject);r.setTimeout(15000,()=>r.destroy(Error('synthetic_transport_timeout')));r.end(init.body);
});
export async function journey({pool,admin,report}) {
  const origin='https://synthetic.invalid',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let current=true,foreign=false;
  const manifest=JSON.parse(await (await import('node:fs/promises')).readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
  const opts={...manifest,origin,authUrl:'https://auth.synthetic.invalid',apiKey:'FABRICATED_API_KEY',secretKey:randomBytes(32),
    acquire:async()=>{const c=await pool.connect();return {release:e=>c.release(e),query:async(text,values)=>{
      try{return await c.query(text,values);}catch(e){report.syntheticSqlFailure={code:e.code,statement:text.startsWith('select case')?'canonical-read':text.split(' ')[0]};throw e;}
    }};},sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,
    verifyCurrentSession:async ({userId})=>current?{userId,sessionId:'independently-verified-synthetic-session',current:true}:null,
    fetch:async()=>new Response(JSON.stringify({id:foreign?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':A,user_metadata:{owner_id:A}}),{status:200})};
  for(const change of [{sourceOnly:true},{canonicalReadback:false},{privateIngressReadback:false},{secretKey:Buffer.alloc(0)},{verifyCurrentSession:null},{acquire:null}]) assert.throws(()=>deploymentPreflight({...opts,...change}));
  assert.equal(await createTeacherVerifier(opts)(undefined),null);
  const runtime=composeRuntime(opts);
  // Actual HTTP loopback server; simulate ONLY the direct TLS transport property.
  const server=createServer((req,res)=>{req.socket.encrypted=true;report.syntheticIngress={hostMatches:req.headers.host==='synthetic.invalid',directTls:req.socket.encrypted};void runtime.handle(req,res);});
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  const url='http://127.0.0.1:'+server.address().port;
  let cookie='',lastCookie='';
  const transport=(auth=false,extra={})=>async(path,init={})=>{
    const r=await httpFetch(url+path,{...init,headers:{host:'synthetic.invalid',origin,...init.headers,
      ...(auth?{authorization:'Bearer SYNTHETIC_TOKEN_ONLY_1234567890'}:{}),...(cookie?{cookie}:{}),...extra}});
    lastCookie=r.headers.get('set-cookie')||'';
    report.lastHttpStatus=r.status;
    if(lastCookie)cookie=lastCookie.split(';')[0];
    assert.match(r.headers.get('cache-control'),/no-store, private/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    return r;
  };
  const teacher=createStudentPortalClient({fetch:transport(true)});
  let student,first,oldEntry,firstCookie;
  try {
    let roster=await teacher.students(),m=roster.students[0];assert.equal(roster.students.length,1);assert.equal(m.enrollmentId,'enrollment1');
    assert.equal(m.publications[0].title,'CANONICAL TERM ONE');assert.equal(m.publications[0].published,false);
    first=await teacher.issue(m);assert.match(first.code,/^[1-9][0-9]{3}$/);oldEntry=first.entrySecret;
    student=createStudentPortalClient({fetch:transport(),base:'/api/n88/s/'+oldEntry});
    await student.claim(first.code);assert.match(lastCookie,/HttpOnly; Secure; SameSite=Strict/);assert.match(lastCookie,/Path=\/api\/n88\/s\//);firstCookie=cookie;
    assert.equal((await student.read()).tasks.length,0);
    const publish=async(member,title,status='todo')=>teacher.publish(member,{publicationId:member.publications[0].id,title,status,published:true});
    await publish(m,'TEACHER PUBLISHED');assert.equal((await student.read()).tasks[0].title,'TEACHER PUBLISHED');
    await publish(m,'UPDATED','done');const view=await student.read();assert.deepEqual(view.progress,{completed:1,total:1});
    assert.deepEqual(Object.keys(view).sort(),['progress','tasks']);assert.deepEqual(Object.keys(view.tasks[0]).sort(),['deadline','id','instruction','status','title']);
    current=false;await assert.rejects(()=>teacher.issue(m));current=true;
    foreign=true;await assert.rejects(()=>teacher.issue(m));foreign=false;
    await assert.rejects(()=>createStudentPortalClient({fetch:transport(true,{'x-forwarded-for':'198.51.100.1'})}).students());
    await assert.rejects(()=>createStudentPortalClient({fetch:transport(true,{origin:'https://foreign.invalid'})}).issue(m));
    const stale={...m,revision:m.revision+1};await assert.rejects(()=>teacher.issue(stale));
    cookie='__Secure-n88=bad; __Secure-n88=duplicate';await assert.rejects(()=>student.read());cookie=firstCookie;
    await admin.query("update rakeezx.students set status='withdrawn'");await assert.rejects(()=>student.read());
    await admin.query("update rakeezx.students set status='active';update rakeezx.sections set status='archived' where id='class1'");await assert.rejects(()=>student.read());
    await admin.query("update rakeezx.sections set status='active' where id='class1';update rakeezx.enrollments set revision=2");
    await assert.rejects(()=>student.read());await student.claim(first.code);
    const forgedOwner={...m,ownerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',enrollmentId:'foreign-enrollment'};
    await assert.rejects(()=>teacher.issue(forgedOwner));
    // Canonical writer does NOT cooperate with N88 advisory lock. PostgreSQL table
    // lock must still block it while authoritative read/portal commit is active.
    const c=await pool.connect(),other=await pool.connect();
    try {
      await c.query('begin');await c.query('select n88_private.lock_canonical_sources()');
      await other.query('begin');await other.query("set local lock_timeout='100ms'");
      await assert.rejects(()=>other.query("update rakeezx.enrollments set revision=2"),e=>e.code==='55P03');
      await other.query('rollback');await c.query('rollback');
    } finally {c.release();other.release();}
    await admin.query("begin; update rakeezx.enrollments set status='completed',end_date='2026-10-18',revision=2; update rakeezx.terms set status=case when id='term1' then 'closed' else 'active' end; insert into rakeezx.enrollments values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enrollment2','class2','student',1,'active',null,null); commit");
    await assert.rejects(()=>student.read());
    roster=await teacher.students();m=roster.students[0];assert.equal(m.enrollmentId,'enrollment2');assert.equal(m.publications.length,1);
    await publish(m,'SECOND TERM');await student.claim(first.code);assert.equal((await student.read()).tasks[0].title,'SECOND TERM');
    assert.equal((await admin.query('select count(*)::int as n from n88_private.credentials')).rows[0].n,1);
    // Same-student name is irrelevant; ambiguous CURRENT membership fails closed.
    await admin.query("insert into rakeezx.enrollments values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ambiguous','class1','student',1,'active',null,null)");
    await assert.rejects(()=>student.read());await admin.query("delete from rakeezx.enrollments where id='ambiguous'");
    await student.claim(first.code);
    const replacement=await teacher.issue(m);await assert.rejects(()=>student.read());await assert.rejects(()=>student.claim(first.code));
    const newer=createStudentPortalClient({fetch:transport(),base:'/api/n88/s/'+replacement.entrySecret});await newer.claim(replacement.code);
    await teacher.revoke(m);await assert.rejects(()=>newer.read());await assert.rejects(()=>newer.claim(replacement.code));
    // Canonical source deletion retracts projection without touching source writes.
    await admin.query("update rakeezx.items set deleted_at=now() where id='item2'");
    assert.equal((await teacher.students()).students[0].publications.length,0);
    await admin.query('alter table rakeezx.items rename to unavailable_items');await assert.rejects(()=>teacher.students());
    await admin.query('alter table rakeezx.unavailable_items rename to items');
    assert.equal((await teacher.students()).students[0].publications.length,0);
    // Expected missing-source error proves fail-closed behavior, not a test failure.
    assert.equal(report.syntheticSqlFailure.code,'42P01');report.expectedMissingSourceSqlstate=report.syntheticSqlFailure.code;delete report.syntheticSqlFailure;
    report.checks.push({name:'n88_actual_http_service_repository_and_authoritative_mapping_journey',status:'PASS',evidence:'Actual loopback HTTP + existing client + composed runtime + native PG repository; explicit teacher publication/update; same PIN/private entry second term; rotate/revoke. Only identity/source rows/TLS transport fabricated; no UI claim.'});
    // HTTP parser/stream/deadline errors remain private and bounded.
    for(const [path,init,status] of [
      ['/api/n88/teacher/students?owner=x',{},400],
      ['/api/n88/teacher/issue',{method:'POST',headers:{'content-type':'application/json','x-n88-csrf':'1'},body:'{'},400],
      ['/api/n88/teacher/issue',{method:'POST',headers:{'content-type':'application/json','x-n88-csrf':'1'},body:'x'.repeat(4097)},413]
    ]) {const r=await transport(true)(path,init);assert.equal(r.status,status);assert.deepEqual(await r.json(),{error:'unavailable'});}
    // Separate transport-only deadline fixture, never substituting the real journey.
    let finish;
    const bounded=createHttpAdapter({origin,service:()=>new Promise(r=>{finish=r;}),verifyTeacher:()=>null,
      trustedSocket:()=>({clientKey:'synthetic'}),deadlineMs:30,maxConcurrent:1});
    const slow=createServer(bounded.handle);await new Promise(ok=>slow.listen(0,'127.0.0.1',ok));
    try {
      const target='http://127.0.0.1:'+slow.address().port+'/api/n88/s/'+'a'.repeat(43)+'/read';
      const r=await httpFetch(target,{headers:{host:'synthetic.invalid'}});assert.equal(r.status,503);
      const next=await httpFetch(target,{headers:{host:'synthetic.invalid'}});assert.equal(next.status,503);
      finish({status:200,body:{}});
    }finally{slow.closeAllConnections();await new Promise(ok=>slow.close(ok));}
    report.checks.push({name:'n88_owner_membership_cookie_ingress_rotation_and_activation_preflight',status:'PASS',evidence:'Current Auth user/session vs metadata/foreign owner, stale/ambiguous membership, scoped Secure cookie and duplicate refusal, forwarded/origin refusal, source retraction, JSON/body limits/deadline/concurrency and inactive/missing-port preflight. Native SHARE lock blocks noncooperating source writer (55P03).'});
  } finally {server.closeAllConnections();await new Promise(ok=>server.close(ok));report.httpClosed=true;}
}
