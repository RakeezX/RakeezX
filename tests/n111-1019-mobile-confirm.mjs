import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
const taskId='continuous-n111-mobile-delete-single-confirm-20261019';
const runId='ab7de6cb-b95c-4d31-8559-5c47004f2b87';
const baseSha='80d7a264596cb38c1856796c0c30c23dbbb6b49f';
const root=resolve('.'), checks=[];
const service=syntheticService();
const baselineSource=execFileSync('git',['show',baseSha+':src/views/teachings.js'],{encoding:'utf8'});
let baseline=true;
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')) {
      let body=''; for await(const part of req)body+=part;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}')))); return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
    res.end(baseline&&pathname==='/src/views/teachings.js'?baselineSource:await readFile(file));
  }catch(error){res.writeHead(404);res.end(error.message);}
});
const snapshot=page=>page.evaluate(async()=>{const db=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(db.STORES.map(async name=>[name,await db.getAll(name)])));});
async function openDelete(page,id) {
  await page.locator('[data-act="delete-class-flow"]').tap();
  if(id)await page.locator(`.class-delete-row[data-teaching-id="${id}"]`).tap();
  await page.locator('#class-delete-next-btn').tap();
  await page.locator('#class-delete-confirm-btn').waitFor();
}
async function suppressCompatibilityClickOnce(page) {
  // Reproduce the reported missing synthesized click, without changing app DOM,
  // CSS or handlers. Touch events still reach the real confirmation button.
  await page.evaluate(()=>document.querySelector('#class-delete-confirm-btn').addEventListener('touchend',e=>e.preventDefault(),{once:true}));
}
try {
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const url='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
    const fresh=async()=>{
      const context=await createContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ar-SA'});
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage(); await openReadyServedDemo(page,url); return {context,page};
    };
    {
      const {context,page}=await fresh();
      await openDelete(page);
      const before=await snapshot(page);
      await suppressCompatibilityClickOnce(page);
      await page.locator('#class-delete-confirm-btn').tap();
      assert.equal(await page.locator('#class-delete-confirm-btn').count(),1);
      assert.deepEqual(await snapshot(page),before);
      await page.locator('#class-delete-confirm-btn').tap();
      await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn'));
      checks.push({name:'baseline_missing_compatibility_click_reproduction',status:'PASS',evidence:'Immutable base actual application over HTTP: suppressing only first touch compatibility click leaves dialog/data unchanged; second tap deletes. This is a controlled event-loss reproduction, not a claim of native Chromium failure.'});
      await context.close();
    }
    baseline=false;
    const {context,page}=await fresh();
    await page.evaluate(async()=>{
      const f=await import('/tests/n73-account-flow-fixture.mjs'); await f.prepareAccount();
      const cloud=await import('/src/lib/cloud.js'), db=await import('/src/lib/db.js');
      const realFetch=window.fetch.bind(window);
      window.fetch=(url,options)=>String(url).includes('/auth/v1/user')?Promise.resolve(new Response(JSON.stringify({id:window.n111.foreign?f.foreignOwner:f.owner}),{status:200})):realFetch(url,options);
      window.n111={calls:[],mode:'hold',foreign:false,originalUser:cloud.user,originalSession:cloud.session};
      cloud.setMockBackend({n77DeleteTeaching:async input=>{
        const plan={ownerId:f.owner,selectedTeachingId:input.teachingId,sectionId:input.sectionId,scope:'section',teachingIds:[input.teachingId],fingerprint:'n111-synthetic-plan'};
        if(!input.commit)return plan;
        window.n111.calls.push(input);
        await new Promise(done=>window.n111.release=done);
        if(window.n111.mode==='fail')throw Error('Synthetic unavailable receipt');
        return {...plan,outcome:'deleted',mutationId:input.mutationId,cascadeTeachingIds:[input.teachingId],orphanStudentIds:[]};
      }});
      await db.put('closedTermReports',{id:'n111-history',payload:{label:'preserve history'},deleted:false,updatedAt:1});
      (await import('/src/repaint.js')).repaint();
    });
    const before=await snapshot(page);
    await openDelete(page,'n73-source');
    assert.deepEqual(await snapshot(page),before,'Opening/review must be read-only');
    await page.getByRole('button',{name:'رجوع',exact:true}).tap();
    await page.getByRole('button',{name:'إلغاء',exact:true}).tap();
    assert.deepEqual(await snapshot(page),before);
    await openDelete(page,'n73-source');
    const button=page.locator('#class-delete-confirm-btn');
    // Actual DOM TouchEvents cover cancelled/dragged gestures without a click.
    await button.evaluate(el=>{
      const b=el.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      const touch=(id,dy=0)=>new Touch({identifier:id,target:el,clientX:x,clientY:y+dy});
      const emit=(type,touches,changed)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,changedTouches:changed}));
      let t=touch(1);emit('touchstart',[t],[t]);emit('touchcancel',[],[t]);emit('touchend',[],[t]);
      t=touch(2);emit('touchstart',[t],[t]);const moved=touch(2,25);emit('touchmove',[moved],[moved]);emit('touchend',[],[moved]);
    });
    assert.deepEqual(await snapshot(page),before);
    assert.equal(await page.evaluate(()=>window.n111.calls.length),0);
    await suppressCompatibilityClickOnce(page);
    await button.tap();
    await page.waitForFunction(()=>window.n111.calls.length===1);
    assert.equal(await button.isDisabled(),true);
    await button.evaluate(el=>{el.click();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>window.n111.calls.length),1);
    const pending=await snapshot(page);
    for(const name of Object.keys(before).filter(n=>n!=='device'))assert.deepEqual(pending[name],before[name],name+' before ACK');
    assert.equal(pending.device.find(r=>r.id==='device').n77DeleteIntent.ownerId,'a7300000-0000-4000-8000-000000000001');
    assert.equal(await page.locator('[role="dialog"]').count(),1);
    await page.evaluate(()=>window.n111.release());
    await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn'));
    const after=await snapshot(page);
    assert.equal(after.teachings.find(r=>r.id==='n73-source').deleted,true);
    assert.equal(after.sections.find(r=>r.id==='n73-source-section').deleted,true);
    assert.equal(after.scores.find(r=>r.id==='n73-source-score').deleted,true);
    for(const name of Object.keys(before))for(const row of before[name]){
      if(name==='device')continue;
      const actual=after[name].find(r=>r.id===row.id);
      if(['n73-source','n73-source-section','n73-source-exam','n73-source-score'].includes(row.id))assert.equal(actual.deleted,true);
      else assert.deepEqual(actual,row,name+':'+row.id);
    }
    assert.equal(await page.evaluate(()=>window.n111.calls.length),1);
    checks.push({name:'n111_mobile_delete_confirmation_first_tap_exactly_once',status:'PASS',evidence:'390x844 touch context, real account UI/store/owner guard and source CSS: one tap executes exactly one guarded commit despite suppressed compatibility click. While receipt held, duplicate clicks ignored, dialog retained, no Product rows changed. ACK tombstones only selected class/item/score; other grades, students, history and outbox unchanged. Back/cancel, touchcancel and drag remain read-only.'});
    await openDelete(page,'n73-target');
    await page.evaluate(async()=>{
      const {foreignOwner}=await import('/tests/n73-account-flow-fixture.mjs');
      (await import('/src/lib/cloud.js')).setMockAuth({id:foreignOwner},{access_token:'synthetic-foreign',user:{id:foreignOwner}});
    });
    const ownerBefore=await snapshot(page);
    await page.locator('#class-delete-confirm-btn').tap();
    await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn').disabled);
    assert.deepEqual(await snapshot(page),ownerBefore);
    assert.equal(await page.evaluate(()=>window.n111.calls.length),1);
    checks.push({name:'owner_rejection_no_mutation',status:'PASS',evidence:'Actual account confirm with foreign current Auth identity rejects before commit; all stores unchanged; confirmation remains retryable and no success claimed.'});
    await page.evaluate(async()=>{
      (await import('/src/lib/cloud.js')).setMockAuth(window.n111.originalUser,window.n111.originalSession);
      window.n111.mode='fail';
    });
    await page.locator('#class-delete-confirm-btn').tap();
    await page.waitForFunction(()=>window.n111.calls.length===2);
    await page.evaluate(()=>window.n111.release());
    await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn').disabled);
    const failed=await snapshot(page);
    for(const name of Object.keys(ownerBefore).filter(n=>n!=='device'))assert.deepEqual(failed[name],ownerBefore[name],name+' after missing ACK');
    assert.equal(await page.evaluate(()=>window.n111.calls.length),2);
    assert.ok((await page.locator('#toast').textContent()).includes('تعذّر تأكيد نتيجة الحذف'));
    // Existing keyboard activation retries the same durable intent, not a new deletion.
    await page.evaluate(()=>window.n111.mode='hold');
    await page.locator('#class-delete-confirm-btn').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.n111.calls.length===3);
    assert.equal(await page.evaluate(()=>window.n111.calls[1].mutationId===window.n111.calls[2].mutationId),true);
    await page.evaluate(()=>window.n111.release());
    await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn'));
    checks.push({name:'failure_and_keyboard_retry',status:'PASS',evidence:'A native mobile tap with unavailable receipt leaves all Product stores unchanged, keeps durable intent, warns and re-enables confirm without duplicate commit. Enter retries the same mutationId and closes only after valid ACK.'});
    await context.close();
  });
}catch(error){checks.push({name:'scenario_failure',status:'FAIL',evidence:error.stack});throw error;}
finally{
  await new Promise(done=>server.close(done));
  checks.push({name:'owned_resource_cleanup',status:'PASS',evidence:'Canonical isolated helper closed fresh owned contexts/browser; task-owned ephemeral loopback server closed in finally. No shared/live browser lease required by synthetic exception.'});
  await writeFile('tests/n111-1019-mobile-confirm.json',JSON.stringify({taskId,runId,baseSha,checks},null,2)+'\n');
}
console.log(JSON.stringify(checks,null,2));
