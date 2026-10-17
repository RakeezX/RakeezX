/** AI: actual client -> signed gateway -> Web Request entry -> service -> native PG.
 * Fabricated ONLY: provider keys/responses, canonical data, cloud metadata/network.
 * No browser UI / hosted TLS / live activation claim.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createWebEntry} from '../../../drafts/n88-student-portal/web-entry.mjs';
import {createCloudflareEntry} from '../../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {createExistingHost} from '../../../drafts/n88-student-portal/existing-host.mjs';
import {createStudentPortalClient} from '../../../src/lib/student-portal-client.js';
import {authChecks} from './auth-checks.mjs';
import {lockChecks} from './lock-checks.mjs';
import {A,authUrl,providerFixture} from './provider.mjs';
export async function journey({admin,pool,report}) {
  const provider=await authChecks({admin,report});
  const manifest=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
  let touched=[];const disabled=createExistingHost(n=>{touched.push(n);return undefined;});
  assert.equal((await disabled.handle(new Request('https://synthetic.invalid/api/n88/teacher/students'))).status,503);
  assert.deepEqual(touched,['N88_ENABLED']);await disabled.close();
  const origin='https://synthetic.invalid',ingressKey=randomBytes(32);
  let gate;
  const holdNext=()=>{
    let reached,release;const g={reached:new Promise(r=>{reached=r;}),pause:new Promise(r=>{release=r;}),release:()=>release(),notify:()=>reached()};
    gate=g;return g;
  };
  const acquire=async()=>{report.lastStage='pool-acquire';const c=await pool.connect();return {release:e=>c.release(e),query:async(text,values)=>{
    report.lastQuery=text.startsWith('select n88_private.')?text.split('(')[0]:text.split(' ')[0];
    (report.queryTrace??=[]).push(report.lastQuery);
    let result;try{result=await c.query(text,values);}catch(e){report.sqlFailure={code:e.code,operation:text.split(' ')[0]};throw e;}
    if(gate && text.startsWith('select n88_private.lock_canonical_sources')){const g=gate;gate=null;g.notify();await g.pause;}
    return result;
  }};};
  const options={...manifest,origin,authUrl,apiKey:'FABRICATED_API_KEY',secretKey:randomBytes(32),ingressKey,acquire,fetch:provider.fetch,
    sourceOnly:false,canonicalReadback:true,privateIngressReadback:true};
  assert.throws(()=>createWebEntry({...options,sourceOnly:true}));
  const edge=createWebEntry(options),edgeUrl=authUrl+'/functions/v1/n88-student-portal';
  let lastSigned,requests=0;
  const gateway=createCloudflareEntry({fetch:async(url,init)=>{
    requests++;assert.equal(new URL(url).origin,authUrl);assert.equal(new URL(url).pathname,'/functions/v1/n88-student-portal/dispatch');assert.equal(init.redirect,'error');
    assert.equal(init.headers.has('authorization'),false);assert.equal(init.headers.has('cookie'),false);
    const req=new Request(url,init);lastSigned=req.clone();report.lastStage='signed-edge-request';const res=await edge(req);report.edgeStatus=res.status;assert.equal(res.headers.has('set-cookie'),false);return res;
  }});
  const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:edgeUrl,N88_INGRESS_KEY:ingressKey.toString('hex')};
  let cookie='',lastCookie='',bearer=provider.token();
  const transport=(auth=false,extra={})=>async(path,init={})=>{
    const request=new Request(origin+path,{...init,headers:{origin,...init.headers,'cf-connecting-ip':'192.0.2.1',
      ...(auth?{authorization:'Bearer '+bearer}:{}),...(cookie?{cookie}:{}),...extra}});
    Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}}); // explicit fabricated provider metadata
    const response=await gateway(request,env);lastCookie=response.headers.get('set-cookie')||'';
    report.gatewayStatus=response.status;
    if(!response.ok)report.providerPaths=provider.calls.slice();
    if(lastCookie)cookie=lastCookie.split(';')[0];
    assert.match(response.headers.get('cache-control'),/no-store, private/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    return response;
  };
  const teacher=createStudentPortalClient({fetch:transport(true)});
  const roster=()=>teacher.students();
  let r=await roster(),m=r.students[0];assert.equal(r.students.length,1);assert.equal(m.publications[0].title,'CANONICAL TERM ONE');
  const first=await teacher.issue(m);assert.match(first.code,/^[1-9][0-9]{3}$/);
  const student=createStudentPortalClient({fetch:transport(),base:'/api/n88/s/'+first.entrySecret});
  await student.claim(first.code);assert.match(lastCookie,/HttpOnly; Secure; SameSite=Strict/);const firstCookie=cookie;
  assert.equal((await student.read()).tasks.length,0);
  const publish=async(member,title)=>teacher.publish(member,{publicationId:member.publications[0].id,title,status:'done',published:true});
  await publish(m,'PUBLISHED');assert.deepEqual((await student.read()).progress,{completed:1,total:1});
  // Strong ingress: body/header/path/source signatures, exact once nonce, external
  // provider metadata, no direct public Edge access or arbitrary proxy trust.
  assert.equal((await (await edge(lastSigned.clone())).json()).status,401);
  const forged=new Request(lastSigned.clone());forged.headers.set('x-n88-source','f'.repeat(64));assert.equal((await edge(forged)).status,401);
  const wrongTime=new Request(lastSigned.clone());wrongTime.headers.set('x-n88-time','1000000000');assert.equal((await edge(wrongTime)).status,401);
  assert.equal((await edge(new Request(edgeUrl+'/dispatch',{method:'POST',headers:{'content-type':'application/json'}}))).status,401);
  assert.equal((await gateway(new Request(origin+'/api/n88/teacher/students'),env)).status,401);
  const before=requests;assert.equal((await gateway(new Request(origin+'/api/n88/teacher/students'),{...env,N88_ENABLED:'false'})).status,503);assert.equal(requests,before);
  await assert.rejects(()=>createStudentPortalClient({fetch:transport(true,{'cf-worker':'synthetic.invalid'})}).students());
  // Arbitrary forwarding headers do not enter the allowlist/signature/source key.
  assert.equal((await createStudentPortalClient({fetch:transport(true,{'x-forwarded-for':'203.0.113.222','x-n88-source':'f'.repeat(64)})}).students()).students.length,1);
  provider.foreign=true;await assert.rejects(()=>teacher.issue(m));provider.foreign=false;
  await assert.rejects(()=>teacher.issue({...m,revision:m.revision+1}));
  cookie='__Secure-n88=x; __Secure-n88=y';await assert.rejects(()=>student.read());cookie=firstCookie;
  // An ended/tombstoned membership remains locked too (restore phantom).
  await admin.query("insert into rakeezx.enrollments values($1,'ended-tombstone','class2','student',1,'completed','2026-10-18',now())",[A]);
  await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status) values($1,'class3','year','active')",[A]);
  await lockChecks({admin,pool,holdNext,roster,report});
  // Parent lifecycle changed and restored BETWEEN reads: old sessions still deny
  // via persisted revision lineage; restored source is never silently published.
  await admin.query("update rakeezx.sections set status='archived' where owner_id=$1 and id='class1'",[A]);
  await admin.query("update rakeezx.sections set status='active' where owner_id=$1 and id='class1'",[A]);
  await assert.rejects(()=>student.read());await student.claim(first.code);
  assert.equal((await student.read()).tasks.length,0);r=await roster();m=r.students[0];await publish(m,'REPUBLISHED');
  await admin.query("update rakeezx.items set deleted_at=now() where owner_id=$1 and id='item1'",[A]);
  await admin.query("update rakeezx.items set deleted_at=null where owner_id=$1 and id='item1'",[A]);
  assert.equal((await student.read()).tasks.length,0);
  const restored=(await roster()).students[0].publications[0];assert.equal(restored.title,'REPUBLISHED');assert.equal(restored.published,false);
  // Actual FK-safe transfer into second term; stable code/entry, new membership.
  await admin.query("begin");
  await admin.query("delete from rakeezx.enrollments where owner_id=$1 and id='ended-tombstone'",[A]);
  await admin.query("update rakeezx.enrollments set status='completed',end_date='2026-10-18' where owner_id=$1",[A]);
  await admin.query("update rakeezx.terms set status=case when id='term1' then 'closed' else 'active' end where owner_id=$1",[A]);
  await admin.query("insert into rakeezx.enrollments values($1,'enrollment2','class2','student',1,'active',null,null)",[A]);await admin.query('commit');
  await assert.rejects(()=>student.read());r=await roster();m=r.students[0];assert.equal(m.enrollmentId,'enrollment2');assert.equal(m.publications.length,1);
  await publish(m,'SECOND TERM');await student.claim(first.code);assert.equal((await student.read()).tasks[0].title,'SECOND TERM');
  assert.equal((await admin.query('select count(*)::int as n from n88_private.credentials')).rows[0].n,1);
  const newer=await teacher.issue(m);await assert.rejects(()=>student.read());await assert.rejects(()=>student.claim(first.code));
  const next=createStudentPortalClient({fetch:transport(),base:'/api/n88/s/'+newer.entrySecret});await next.claim(newer.code);
  await teacher.revoke(m);await assert.rejects(()=>next.read());
  // A wrong/unknown private entry debits budgets before ANY canonical lookup.
  const beforeBudget=Number((await admin.query("select count from n88_private.guess_budgets where key='global'")).rows[0].count);
  report.queryTrace=[];
  await assert.rejects(()=>next.claim(newer.code));
  assert.equal(report.queryTrace.some(q=>q==='select n88_private.lock_canonical_sources'),false);
  assert.equal(Number((await admin.query("select count from n88_private.guess_budgets where key='global'")).rows[0].count),beforeBudget+1);
  // Missing canonical source fails closed, no stale fallback. No retry of a live phase.
  await admin.query('alter table rakeezx.items rename to unavailable_items');await assert.rejects(()=>roster());
  await admin.query('alter table rakeezx.unavailable_items rename to items');
  assert.equal(report.sqlFailure.code,'42P01');report.expectedMissingSourceSqlstate=report.sqlFailure.code;
  report.checks.push({name:'n88_concrete_current_session_verifier_and_existing_host_entry',status:'PASS',evidence:report.authEvidence+' Actual existing client -> Cloudflare Web gateway -> signed Web Request -> actual service/restricted PG. Same PIN second-term, publish/update, rotation/revocation; disabled entry; tamper/replay/direct ingress rejection. Deno entry typechecks separately; hosted TLS NOT_RUN.'});
  report.checks.push({name:'n88_targeted_canonical_lifecycle_guards_without_unrelated_owner_write_blocking',status:'PASS',evidence:report.lockEvidence+' Revision lineage prevents unobserved archive/restore session resurrection; item delete/restore retracts publication; source absence denies; per-owner/row caps enforced.'});
  delete report.authEvidence;delete report.lockEvidence;
  for(const k of ['lastStage','lastQuery','queryTrace','edgeStatus','gatewayStatus','providerPaths','blockedScenario','sqlFailure'])delete report[k];
}
