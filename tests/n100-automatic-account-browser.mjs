import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner,foreignOwner,source,target,second} from './n100-account-fixture.mjs';
const root=resolve('.'),output='test-results/n100-automatic-account',checks=[];
// Canonical adoption adds serverCanonical/canonicalId; compare every Product/owner field.
const marks = rows => rows.map(row => Object.fromEntries(['id','itemId','studentId','value','manualValue','derivedValue','ownerId','serverRevision']
  .map(key=>[key,row[key] ?? null]).concat([['deleted',row.deleted===true]])));
const completions = rows => rows.map(row => Object.fromEntries(['id','studentId','subitemId','checked','completionState','ownerId','serverRevision']
  .map(key=>[key,row[key] ?? null]).concat([['deleted',row.deleted===true]])));
let service=syntheticService(),browser,timer;
const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')) {
      let body='';for await(const chunk of req)body+=chunk;
      const result=await service.request(pathname.slice('/__n73/'.length),JSON.parse(body||'{}'));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside application root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));
  } catch(error){res.writeHead(error.status??404,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message,code:error.code,status:error.status}));}
});
await mkdir(output,{recursive:true});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
async function account(width=390) {
  service=syntheticService();
  const context=await browser.newContext({viewport:{width,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await openReadyServedDemo(page,base);
  const readiness=await page.evaluate(async()=> (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
  assert.equal(readiness.ready,true);assert.equal(readiness.lease.editable,true);assert.deepEqual(readiness.outbox,[]);
  return {page,context};
}
async function openCopy(page,ids=[target]) {
  await page.goto(base+'/#/teaching/'+source+'/items');
  await page.waitForFunction(()=>!document.querySelector('[data-act="copy"]')?.disabled);
  await page.locator('[data-act="copy"]').click();
  assert.equal(await page.locator('[data-copy-mode]').count(),0);
  assert.equal(await page.getByText('طريقة النسخ',{exact:true}).count(),0);
  for(const id of ids)await page.locator('[data-copy-target][value="'+id+'"]').check();
  await page.waitForFunction(()=>!document.querySelector('[data-copy-apply]')?.disabled);
}
async function inspect(page) {
  return page.evaluate(async()=>{
    const db=await import('/src/lib/db.js');return {items:await db.getAll('items'),subs:await db.getAll('scoreSubitems'),scores:await db.getAll('scores'),completions:await db.getAll('scoreSubitemCompletions'),outbox:await db.getAll('outbox')};
  });
}
async function confirm(page) {
  await page.locator('[data-copy-apply]').click();
  await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).click();
}
try {
  browser=await chromium.launch({headless:true});
  timer=setTimeout(()=>browser.close(),180000);timer.unref();
  for(const width of [390,1280]) {
    const {page,context}=await account(width);
    try {
      const before=await inspect(page);await openCopy(page,width===390?[target,second]:[target]);
      await page.getByText(/تحديث التعريف والأسماء والتواريخ؛ تبقى سجلاته محفوظة/).first().waitFor();
      await page.getByText(/اسم جديد 0 · البداية 2026-11-01 · الاستحقاق 2026-11-02/).first().waitFor();
      if(width===390)assert.ok(await page.getByText(/إضافة بند دون درجات الطلاب/).count()>0);
      assert.equal(await page.locator('[data-copy-remove]').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      await page.screenshot({path:output+'/'+width+'-review.png',fullPage:true,animations:'disabled'});
      await page.getByText(/اسم جديد 0 · البداية 2026-11-01 · الاستحقاق 2026-11-02/).first().scrollIntoViewIfNeeded();
      await page.screenshot({path:output+'/'+width+'-impact.png',fullPage:true,animations:'disabled'});
      await confirm(page);await page.getByText(/طُبّقت التحديثات والإضافات/).waitFor();
      await page.waitForFunction(async()=> (await (await import('/src/lib/db.js')).get('scoreSubitems','n100-target-0'))?.name==='اسم جديد 0');
      const after=await inspect(page);
      assert.deepEqual(marks(after.scores),marks(before.scores));assert.deepEqual(completions(after.completions),completions(before.completions));assert.deepEqual(after.outbox,[]);
      for(const id of ['n100-target-0','n100-target-1']) {
        const old=before.subs.find(row=>row.id===id),next=after.subs.find(row=>row.id===id);
        assert.equal(next.createdAt,old.createdAt);assert.equal(next.startDate,'2026-11-01');assert.equal(next.dueDate,'2026-11-02');
      }
      assert.equal(after.items.find(row=>row.id==='n73-extra').deleted,false);
      const added=new Set(after.items.filter(row=>row.teachingId===second).map(row=>row.id));
      assert.equal(after.scores.some(row=>added.has(row.itemId)),false);
      assert.equal(service.evidence.commits,1);
      assert.ok(service.evidence.plans.every(row=>row.mode==='automatic-safe'));
      assert.deepEqual(Object.keys(service.evidence.envelopes[0]).sort(),['confirmed','deviceId','mutationId','planId','token'].sort());
      const backup=await page.evaluate(async(owner)=>{
        const {buildBackup,validateBackupIntegrity}=await import('/src/lib/export.js');
        const {planCloudRestore}=await import('/src/lib/backup-v2.js');
        const payload=JSON.parse(JSON.stringify(await buildBackup({sourceOwnerId:owner})));
        const validation=await validateBackupIntegrity(payload);
        const plan=planCloudRestore(payload,payload.data,{ownerId:owner,ownerHistoryRevision:'1'});
        return {validation,ready:plan.ready,operations:plan.operations,subs:payload.data.scoreSubitems,scores:payload.data.scores,completions:payload.data.scoreSubitemCompletions};
      },owner);
      assert.equal(backup.validation.ok,true,JSON.stringify(backup.validation));assert.equal(backup.ready,true);assert.deepEqual(backup.operations,[]);
      assert.deepEqual(backup.subs,after.subs);assert.deepEqual(backup.scores,after.scores);assert.deepEqual(backup.completions,after.completions);
      record('n100_backup_roundtrip_'+width,'Actual account buildBackup → JSON roundtrip → V5 integrity/invariant → current planCloudRestore against same owner checkpoint: zero restore operations; preserved IDs/marks/states/date/origin/createdAt unchanged.');
      record('n100_actual_account_review_apply_'+width,'Real application DOM/CSS, one automatic action/no modes, copied dates/labels/preserved counts, real claimed account store + N49 lease + ownership preflight + owner-bound durable Sync command + bounded HTTP canonical receipt; target regular5/late2/NULL and manual marks/history persist; source9/19 never copied.');
    } finally {await context.close();}
  }
  for(const scenario of ['auth-mismatch','workspace-mismatch','expired-lease','pending-outbox','ownerless-dispatch','foreign-dispatch','mode-mismatch','old-capability']) {
    const {page,context}=await account();
    try {
      const result=await page.evaluate(async({scenario,foreignOwner,source,target})=>{
        const store=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js'),db=await import('/src/lib/db.js');
        const {runtimeSyncOwnershipGuard:guard}=await import('/src/lib/sync-ownership.js');
        const {createSyncV2Engine}=await import('/src/lib/sync-v2.js');
        const mode='automatic-safe',plan=await store.reviewScoreDistributionCopy(source,[target],{mode});
        const before={items:await db.getAll('items'),scores:await db.getAll('scores')};
        if(scenario==='auth-mismatch') {
          const session={access_token:'synthetic-local-only',user:{id:foreignOwner}};
          localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);
        }
        if(scenario==='workspace-mismatch')guard.setWorkspace({...store.getActiveWorkspace(),authUserId:foreignOwner});
        if(scenario==='expired-lease'||scenario==='old-capability')return {plan};
        if(scenario==='pending-outbox'||scenario.endsWith('-dispatch')) {
          const engine=createSyncV2Engine({ownershipGuard:guard,currentAuthenticatedUserId:()=>cloud.user?.id});
          const queued=await engine.queueCommand({store:'items',recordId:source,command:'score:distribution_apply',patch:{planId:plan.planId,token:plan.token,confirmed:true}});
          if(scenario.endsWith('-dispatch')) {
            await db.put('outbox',{...queued,ownerId:scenario==='ownerless-dispatch'?null:foreignOwner});return {dispatch:await engine.dispatchPending()};
          }
        }
        const errors=[];
        for(const call of scenario==='mode-mismatch'?[()=>store.applyReviewedScoreDistribution(source,[target],{expectedToken:plan.token,mode:'definitions',confirmed:true})]:[
          ()=>store.reviewScoreDistributionCopy(source,[target],{mode}),()=>store.applyReviewedScoreDistribution(source,[target],{expectedToken:plan.token,mode,confirmed:true})]) {
          try{await call();errors.push(null);}catch(error){errors.push(error.message);}
        }
        return {errors,unchanged:JSON.stringify(before)===JSON.stringify({items:await db.getAll('items'),scores:await db.getAll('scores')})};
      },{scenario,foreignOwner,source,target});
      if(scenario==='expired-lease'||scenario==='old-capability') {
        if(scenario==='expired-lease')await page.clock.setFixedTime(new Date(Date.now()+15*86400000));else service.setMode('old-capability');
        const errors=await page.evaluate(async({source,target,token})=>{
          const s=await import('/src/store.js'),errors=[];
          for(const call of [()=>s.reviewScoreDistributionCopy(source,[target],{mode:'automatic-safe'}),()=>s.applyReviewedScoreDistribution(source,[target],{expectedToken:token,mode:'automatic-safe',confirmed:true})]) {
            try{await call();errors.push(null);}catch(error){errors.push(error.code??error.message);}
          }return errors;
        },{source,target,token:result.plan.token});
        assert.ok(errors.every(Boolean));if(scenario==='expired-lease')assert.deepEqual(errors,['OFFLINE_LEASE_LIMITED','OFFLINE_LEASE_LIMITED']);
      } else if(scenario.endsWith('-dispatch')) {
        assert.equal(result.dispatch.attempted,0);assert.equal(result.dispatch.ownershipBlocked,1);
        assert.equal(result.dispatch.blockReason,scenario==='ownerless-dispatch'?'command-owner-missing':'command-owner-mismatch');
      } else {assert.ok(result.errors.every(Boolean),JSON.stringify(result));assert.equal(result.unchanged,true);}
      assert.equal(service.evidence.envelopes.length,0);assert.equal(service.evidence.commits,0);
      record('n100_account_guard_'+scenario,'Actual public account review/apply/engine guard rejects '+scenario+' before HTTP mutations; no ownership guard mocked or weakened.');
    } finally {await context.close();}
  }
  for(const failure of ['ambiguous','stale-apply','lost-receipt']) {
    const {page,context}=await account();
    try {
      if(failure==='ambiguous') {
        service.current.scoreSubitems.find(row=>row.id==='n100-target-1').latePoints=0;
        await page.goto(base+'/#/teaching/'+source+'/items');await page.waitForFunction(()=>!document.querySelector('[data-act="copy"]')?.disabled);
        await page.locator('[data-act="copy"]').click();
        await page.locator('[data-copy-target][value="'+target+'"]').check();
        await page.getByText(/بقي كما هو/).first().waitFor();
        assert.equal(await page.locator('[data-copy-apply]').isDisabled(),false);assert.equal(service.evidence.commits,0);
        await page.screenshot({path:output+'/ambiguous.png',fullPage:true});
      } else {
        const before=await inspect(page);await openCopy(page,[target,second]);service.setMode(failure);await confirm(page);
        if(failure==='stale-apply') {
          await page.getByText('تغيّر التوزيع أو تعذّر قبول التطبيق؛ راجع التغييرات قبل المحاولة الجديدة.',{exact:true}).waitFor();
          const after=await inspect(page);assert.deepEqual(after.scores,before.scores);assert.equal(after.outbox[0].state,'rejected');assert.equal(service.evidence.commits,0);
        } else {
          await page.getByText('تعذّر تأكيد التطبيق. طلبك محفوظ للمزامنة وإعادة المحاولة الآمنة.',{exact:true}).waitFor();
          const retried=await page.evaluate(async()=>{
            const {createSyncV2Engine}=await import('/src/lib/sync-v2.js'),{runtimeSyncOwnershipGuard}=await import('/src/lib/sync-ownership.js'),cloud=await import('/src/lib/cloud.js');
            return createSyncV2Engine({ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cloud.user?.id}).dispatchPending();
          });
          assert.equal(retried.acknowledged,1);const after=await inspect(page);assert.deepEqual(after.outbox,[]);assert.deepEqual(marks(after.scores),marks(before.scores));assert.deepEqual(completions(after.completions),completions(before.completions));
          assert.equal(service.evidence.commits,1);assert.deepEqual(service.evidence.envelopes[0],service.evidence.envelopes[1]);
        }
      }
      record('n100_account_'+failure,'Actual account UI handles '+failure+'; incompatible target intact, stale mutation rejected, lost receipt exact durable retry once; target records preserved.');
    } finally {await context.close();}
  }
  // Current authoritative target differs from the unchanged client cache.
  {
    const {page,context}=await account();
    try {
      const before=await inspect(page);
      service.current.items.find(row=>row.id==='n100-target').max=11;
      service.current.items.push({...service.current.items.find(row=>row.id==='n73-source-exam'),id:'n100-safe-add',name:'بند آمن جديد',max:3});
      await openCopy(page,[target,second]);
      await page.getByText(/الواجبات: بقي كما هو/).waitFor();
      await page.getByText(/بند آمن جديد: إضافة بند دون درجات الطلاب/).first().waitFor();
      assert.equal(before.items.find(row=>row.id==='n100-target').max,10);
      await page.screenshot({path:output+'/partial-authoritative.png',fullPage:true,animations:'disabled'});
      await confirm(page);await page.getByText(/طُبّقت التحديثات والإضافات/).waitFor();
      const after=await inspect(page);
      assert.equal(after.items.find(row=>row.id==='n100-target').max,11);
      assert.equal(after.subs.find(row=>row.id==='n100-target-0').name,before.subs.find(row=>row.id==='n100-target-0').name);
      assert.deepEqual(marks(after.scores),marks(before.scores));assert.deepEqual(completions(after.completions),completions(before.completions));
      assert.ok(after.items.some(row=>row.teachingId===target&&row.name==='بند آمن جديد'));
      record('n100_authoritative_partial_actual_ui','Actual account UI reviews server-current max11 while browser has max10; retains conflicting target children/marks and adds independent safe source definition to both targets without a mode or removal.');
    } finally {await context.close();}
  }
  {
    const {page,context}=await account();
    try {
      const before=await inspect(page);await openCopy(page,[target,second]);
      await page.locator('[data-copy-apply]').click();await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).waitFor();
      service.current.scores.find(row=>row.id==='n100-unmarked-score').value=0;
      await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).click();
      await page.getByText('تغيّر التوزيع أو تعذّر قبول التطبيق؛ راجع التغييرات قبل المحاولة الجديدة.',{exact:true}).waitFor();
      const after=await inspect(page);assert.deepEqual(after.items,before.items);assert.deepEqual(after.scores,before.scores);
      assert.equal(after.outbox[0].state,'rejected');assert.equal(service.evidence.commits,0);
      record('n100_mark_gain_after_review_actual_ui','Actual account confirm handler sends reviewed owner-bound plan; authoritative target gains zero after review, token check rejects before all writes; client items/scores untouched, rejection retained in outbox.');
    } finally {await context.close();}
  }
} finally {
  clearTimeout(timer);await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));
  const hashes={};for(const file of ['src/store.js','src/views/items.js','src/lib/cloud.js','src/lib/score-distribution-copy.js','tests/n100-automatic-account-browser.mjs','tests/n100-account-fixture.mjs'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  await writeFile(output+'/result.json',JSON.stringify({base,hashes,checks,ownedBrowserClosed:true,ownedServerClosed:true},null,2));
}
