/** AI: actual UI -> browser client -> signed gateway -> Web service -> restricted PG.
 * Fabricated ONLY: Auth provider, source rows, ingress TLS metadata/network mapping.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createWebEntry} from '../../../drafts/n88-student-portal/web-entry.mjs';
import {createCloudflareEntry} from '../../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {A,authUrl,providerFixture} from '../n88-existing-host/provider.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {offlineChecks} from '../../n88-client-binding-guards.mjs';
export async function journey({admin,pool,report}) {
  const root=resolve('.'),origin='https://synthetic.invalid',provider=providerFixture(),ingressKey=randomBytes(32);
  const manifest=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
  const edge=createWebEntry({...manifest,origin,authUrl,apiKey:'FABRICATED_API_KEY',secretKey:randomBytes(32),ingressKey,
    acquire:async()=>{const c=await pool.connect();return {query:(...args)=>c.query(...args),release:e=>c.release(e)};},
    fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
  const gateway=createCloudflareEntry({fetch:(url,init)=>edge(new Request(url,init))});
  const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:ingressKey.toString('hex')};
  let failAck=false,hold=false,release,held,holdAction='students'; const statuses=[];
  const server=createServer(async(req,res)=>{
    try {
      const u=new URL(req.url,'http://127.0.0.1');
      res.setHeader('cache-control','no-store, private');res.setHeader('referrer-policy','no-referrer');
      if(u.pathname==='/fixture/context') {
        const m=(await admin.query("select id,revision from rakeezx.enrollments where owner_id=$1 and status='active'",[A])).rows[0];
        res.setHeader('content-type','application/json');res.end(JSON.stringify({ownerId:A,token:provider.token(),enrollmentId:m.id,revision:m.revision}));return;
      }
      if(u.pathname.startsWith('/api/n88/')) {
        let body='';for await(const b of req)body+=b;
        if(failAck && u.pathname.endsWith('/publish')) { failAck=false;res.setHeader('content-type','application/json');res.end('{"updated":false}');return; }
        const headers=new Headers(req.headers);headers.set('origin',origin);headers.set('cf-connecting-ip','192.0.2.1');
        const request=new Request(origin+u.pathname,{method:req.method,headers,...(body?{body}:{})});
        Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
        const result=await gateway(request,env); statuses.push({action:u.pathname.split('/').at(-1),status:result.status});
        if(hold && u.pathname.split('/').at(-1)===holdAction) {hold=false;held?.();await new Promise(ok=>{release=ok;});}
        res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
      }
      let file;
      if(u.pathname==='/teacher'||u.pathname.startsWith('/off')||/^\/s\/[A-Za-z0-9_-]{43}$/.test(u.pathname)) file=resolve(root,'tests/fixtures/n88-client-binding/index.html');
      else {
        assert.match(u.pathname,/^\/(?:src\/|assets\/|tests\/fixtures\/n88-client-binding\/entry.js$)/);
        file=resolve(root,'.'+u.pathname);assert.ok(file.startsWith(root+sep));
      }
      res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
      res.end(await readFile(file));
    }catch { if(!res.headersSent)res.writeHead(503);res.end(); }
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+report.taskId+'.json',runId:report.runId,url,timeoutMs:120000},async({createContext})=>{
      for(const width of [390,1280]) {
        // Fresh source/credential fixture per viewport; never real or hosted rows.
        await admin.query('truncate n88_private.sessions,n88_private.credentials,n88_private.publications,n88_private.memberships,n88_private.guess_budgets cascade');
        await admin.query("delete from rakeezx.enrollments where id='enrollment2'");
        await admin.query("update rakeezx.enrollments set status='active',end_date=null where id='enrollment1' and owner_id=$1",[A]);
        await admin.query("update rakeezx.terms set status=case when id='term1' then 'active' else 'upcoming' end where owner_id=$1",[A]);
        const context=await createContext({viewport:{width,height:900},locale:'ar-SA'}),errors=[],logs=[];let api=0;
        context.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/n88/'))api++;assert.equal(new URL(r.url()).search,'');});
        context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>logs.push(m.text()));});
        const teacher=await context.newPage();
        for(const path of ['/off-teacher','/off-student']) {
          const before=api;await teacher.goto(url+path);await teacher.getByText('مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة الخاصة بعد.').waitFor();
          assert.equal(await teacher.locator('button,input,select').count(),0);assert.equal(api,before);
        }
        env.N88_ENABLED='false';
        await teacher.goto(url+'/teacher');await teacher.getByText('تعذّر التحقق من الحساب أو العضوية. الوصول غير متاح.').waitFor();assert.equal(await teacher.locator('button,input,select').count(),0);env.N88_ENABLED='true';
        await teacher.goto(url+'/teacher');
        const choose=async()=>{await teacher.locator('#n88-member option:not([value=""])').waitFor({state:'attached'});const v=await teacher.locator('#n88-member option:not([value=""])').getAttribute('value');await teacher.locator('#n88-member').selectOption(v);await teacher.locator('[data-select] button').click();};
        await choose();assert.equal(await teacher.locator('input[name=published]').isChecked(),false);
        await teacher.locator('[data-issue]').click();await teacher.locator('[data-code]').waitFor();
        const code=await teacher.locator('[data-code]').inputValue(),bookmark=await teacher.locator('[data-entry]').inputValue();assert.match(code,/^[1-9][0-9]{3}$/);
        await teacher.locator('[data-cancel]').click();
        const student=await context.newPage();await student.goto(bookmark);await student.locator('[data-claim]').waitFor();
        const enter=async(pin=code)=>{await student.locator('input').fill(pin);await student.locator('[data-claim] button').click();try {await student.getByRole('heading',{name:'ما المطلوب مني؟'}).waitFor({timeout:10000});}catch(e){report.studentFailure={text:await student.locator('main').innerText(),statuses:statuses.slice(-12)};throw e;}};
        await enter();assert.equal(await student.locator('.n88-task').count(),0);
        await choose();await teacher.locator('#n88-title').fill('EXPLICIT PUBLISHED');await teacher.locator('[name=published]').check();
        failAck=true;await teacher.locator('[data-publish] button').click();await teacher.getByText('تعذّر حفظ التحديث.').waitFor();assert.doesNotMatch(await teacher.locator('main').innerText(),/حُفظ التحديث/);
        await teacher.locator('[data-publish] button').click();await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
        await student.locator('[data-refresh]').click();await student.getByRole('heading',{name:'EXPLICIT PUBLISHED'}).first().waitFor();
        await teacher.locator('#n88-title').fill('FRESH UPDATE');await teacher.locator('[name=status]').selectOption('done');await teacher.locator('[data-publish] button').click();
        await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
        await student.locator('[data-refresh]').click();await student.getByRole('heading',{name:'FRESH UPDATE'}).first().waitFor();
        assert.doesNotMatch(await student.locator('main').innerText(),/OTHER|CANONICAL TERM TWO/);
        assert.equal(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await student.screenshot({path:`tests/fixtures/n88-client-binding/student-${width}.png`,fullPage:true});
        await teacher.screenshot({path:`tests/fixtures/n88-client-binding/teacher-${width}.png`,fullPage:true});
        // Stale private read cannot repaint after the actual view's clear boundary.
        hold=true;holdAction='read';const privateReached=new Promise(ok=>{held=ok;});
        await student.locator('[data-refresh]').click();await privateReached;
        await student.evaluate(()=>window.portal.clear());
        const privateDone=student.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/read'));
        release();release=null;await privateDone;
        await student.locator('[data-claim]').waitFor();assert.equal(await student.locator('[data-tasks]').count(),0);
        await student.reload();await student.getByRole('heading',{name:'ما المطلوب مني؟'}).waitFor();
        // Real PG canonical lifecycle: same student, valid parent/child dependencies.
        await admin.query('begin');
        await admin.query("update rakeezx.enrollments set status='completed',end_date='2026-10-18' where owner_id=$1",[A]);
        await admin.query("update rakeezx.terms set status=case when id='term1' then 'closed' else 'active' end where owner_id=$1",[A]);
        await admin.query("insert into rakeezx.enrollments values($1,'enrollment2','class2','student',1,'active',null,null)",[A]);await admin.query('commit');
        await student.locator('[data-refresh]').click();await student.locator('[data-claim]').waitFor();
        await teacher.reload();await choose();await teacher.locator('#n88-title').fill('SECOND TERM');await teacher.locator('[name=published]').check();await teacher.locator('[data-publish] button').click();await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
        await enter();await student.getByRole('heading',{name:'SECOND TERM'}).first().waitFor();assert.doesNotMatch(await student.locator('main').innerText(),/FRESH UPDATE/);
        // Session expiry -> deny; same PIN may establish a new current session.
        await admin.query('update n88_private.sessions set expires_at=date_trunc(\'milliseconds\',now())-interval \'1 second\'');
        await student.locator('[data-refresh]').click();await student.locator('[data-claim]').waitFor();await enter();
        await student.locator('[data-logout]').click();await student.locator('[data-claim]').waitFor();await enter();
        await teacher.locator('[data-issue]').click();await teacher.locator('[data-code]').waitFor();
        const nextCode=await teacher.locator('[data-code]').inputValue(),nextBookmark=await teacher.locator('[data-entry]').inputValue();
        await student.locator('[data-refresh]').click();await student.locator('[data-claim]').waitFor();
        await student.locator('input').fill(code);await student.locator('[data-claim] button').click();await student.locator('#n88-error').filter({hasText:'تعذّر'}).waitFor();
        await student.goto(nextBookmark);await student.locator('[data-claim]').waitFor();await enter(nextCode);
        await teacher.locator('[data-cancel]').click();await choose();await teacher.locator('[data-revoke]').click();await teacher.getByText('أُلغي الوصول والرمز وجميع الجلسات.').waitFor();
        await student.locator('[data-refresh]').click();await student.locator('[data-claim]').waitFor();
        // The real account guard rejects writes before transport when lease/owner changes.
        await teacher.reload();await choose();const beforeLease=api;await teacher.evaluate(()=>window.expireLease());await teacher.locator('[data-issue]').click();await teacher.getByText('تعذّر الإنشاء أو الإلغاء. أعد التحقق من العضوية والحساب.').waitFor();assert.equal(api,beforeLease);
        hold=true;holdAction='students';const reached=new Promise(ok=>{held=ok;});
        await teacher.reload({waitUntil:'domcontentloaded'});await reached;
        await teacher.waitForFunction(()=>!!window.switchOwner);await teacher.evaluate(()=>window.switchOwner());release();release=null;
        await teacher.getByText('مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة الخاصة بعد.').waitFor();
        assert.equal(await teacher.locator('button,input,select').count(),0);
        assert.equal(errors.length,0);assert.ok(logs.every(m=>!m.includes(code)&&!m.includes(nextCode)&&!m.includes(new URL(bookmark).pathname.slice(3))));
        await context.close();
      }
    });
    report.checks.push({name:'n88_actual_teacher_student_client_server_contract_journey',status:'PASS',evidence:'390/1280 actual app modules + source CSS over loopback HTTP; bearer client -> actual Cloudflare signer/Web entry/verified Auth/restricted native PG. Deliberate publish/issue; no unpublished view; fresh update; identical PIN/private entry in term2; logout/expiry/rotation/revoke deny. Screenshots retained without credentials.'});
    report.checks.push({name:'n88_client_owner_stale_revocation_default_off_and_offline_guards',status:'PASS',evidence:'Both default-OFF mounts have no controls or API calls; actual owner command guard/lease rejection before transport; held roster after owner switch and held student read after clear cannot render; enabled client against unavailable service exposes no controls; malformed ACK never succeeds. Offline shell check below; backend qualification reused unchanged.'});
    await offlineChecks(report);
  } finally { release?.();server.closeAllConnections();await new Promise(ok=>server.close(ok));report.cleanup.httpClosed=true;report.cleanup.isolatedBrowserClosed=true; }
}
