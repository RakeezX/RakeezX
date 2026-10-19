// AI: bounded actual-app HTTP DOM/CSS journey; no hosted requests or real data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {fixture,owner,capability} from './n73-account-flow-fixture.mjs';
import * as m from '../src/models.js';
const taskId='continuous-n122-permanent-activity-waiting-slots-20261019',runId='57e985f1-2297-4d68-9855-061744258c65';
const root=resolve('.'),data=fixture();
for(const key of ['subjects','sections','teachings','students','items','scores'])data[key]=[];
const owned=row=>({...row,ownerId:owner,serverRevision:1});
data.terms[0]=owned(m.makeTerm({id:'n73-term',yearId:'n73-year',startDate:'2027-05-01',endDate:'2027-05-10',status:'active'}));
data.timeProfiles=[owned(m.makeTimeProfile({id:'tp:n122',periods:[1,2,3,4].map(period=>({period,start:String(period+6).padStart(2,'0')+':00',end:String(period+6).padStart(2,'0')+':45'}))}))];
data.profile[0].activeTimeProfileId='tp:n122';
data.calendars=[owned(m.makeCalendar({id:'cal:n122',yearId:'n73-year',source:'custom'}))];
const evidence={taskId,runId,checks:[],errors:[]};
const record=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/__n73/')) {
      res.setHeader('Content-Type', 'application/json');
      const name = pathname.slice(7);
      if (name === 'fixture') return res.end(JSON.stringify(data));
      if (name === 'auth') return res.end(JSON.stringify({ id: owner, source: 'supabase-auth-user', verifiedAt: new Date('2027-05-02T04:10:00Z').getTime() }));
      if (name === 'capability') return res.end(JSON.stringify(capability));
      throw Error('Unexpected synthetic service request: ' + name);
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw Error('Outside root');
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end(e.message); }
});
async function checkpoint(page) {
  return page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    if(s.getActiveWorkspace()?.authUserId!=='a7300000-0000-4000-8000-000000000001') throw Error('Unexpected fixture owner');
    if(d.getActiveDatabaseName()!==s.getActiveWorkspace().databaseName)throw Error('Database binding mismatch');
    return {...Object.fromEntries(await Promise.all(['slots','teachings','subjects','sections','students','sessions','attendance','scores','outbox'].map(async n=>[n,await d.getAll(n)]))),workspace:s.getActiveWorkspace()};
  });
}
async function prepare(page,url) {
  await openReadyServedDemo(page,url);
  await page.evaluate(async()=>{
    await (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount();
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    const owner=s.getActiveWorkspace().authUserId;
    const receipt={ownerId:owner,contractVersion:1,foundationHash:'n122-synthetic'};
    s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
    s.activateWorkspace({...s.getActiveWorkspace(),workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([owner,null,null,receipt])});
    await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
    location.hash='#/schedule';
  });
  await page.locator('.week').waitFor();
}
try {
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
  const url='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url,timeoutMs:110000},async({createContext})=>{
    const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
    await context.addInitScript(()=>{
      sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
      localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');
    });
    const page=await context.newPage();page.setDefaultTimeout(8000);
    page.on('pageerror',e=>evidence.errors.push(e.message));
    await page.clock.setFixedTime(new Date('2027-05-02T04:10:00Z'));
    await prepare(page,url);
    const initial=await checkpoint(page);assert.equal(initial.teachings.length,0);
    const add=async(kind,period)=>{
      await page.locator('[data-act="add"][data-day="0"]').click();
      await page.locator('#slot-kind').selectOption(kind);
      await page.locator('#slot-period').selectOption(String(period));
      assert.equal(await page.locator('#slot-teaching-field').isVisible(),false);
      await page.locator('[form="slot-form"][type="submit"]').click();
      await page.locator('.sheet').waitFor({state:'detached'});
      await page.waitForFunction(async({kind,period})=>(await import('/src/store.js')).allSlots().some(s=>s.kind===kind&&s.period===period),{kind,period});
    };
    await add('activity',2);await add('waiting',3);
    let cp=await checkpoint(page);
    const activity=cp.slots.find(s=>s.kind==='activity'),waiting=cp.slots.find(s=>s.kind==='waiting');
    for(const slot of [activity,waiting]) {assert.equal(slot.teachingId,null);assert.equal(slot.termId,'n73-term');}
    assert.equal(cp.outbox.filter(r=>r.store==='slots').length,2);
    assert.ok(cp.outbox.filter(r=>r.store==='slots').every(r=>r.ownerId===owner&&r.state==='pending'&&r.patch.kind&&r.patch.term_id==='n73-term'));
    for(const name of ['teachings','subjects','sections','students','sessions','attendance','scores'])assert.deepEqual(cp[name],initial[name]);
    assert.equal(await page.locator('.slot').filter({hasText:'نشاط'}).count(),1);
    assert.equal(await page.locator('.slot').filter({hasText:'انتظار'}).count(),1);
    assert.notEqual(await page.locator('.slot').first().evaluate(e=>getComputedStyle(e).display),'none');
    record('no_teachings_save_pending_owner_bound','Actual schedule dialogs save both independent kinds with no fake subjects/classes/pupils; real owner-bound outbox remains pending.');
    await page.reload({waitUntil:'domcontentloaded'});await prepare(page,url);
    cp=await checkpoint(page);
    assert.deepEqual(cp.slots.find(s=>s.id===activity.id),activity);assert.deepEqual(cp.slots.find(s=>s.id===waiting.id),waiting);
    assert.equal(cp.teachings.length,0);
    record('same_document_reload_checkpoint','Both kinds/IDs/term survive actual reload in the expected owner/database checkpoint; no slot fixture is reseeded.');
    await page.locator(`[data-act="edit"][data-id="${activity.id}"]`).click();
    await page.locator('#slot-kind').selectOption('waiting');await page.locator('#slot-period').selectOption('4');
    await page.locator('[form="slot-form"][type="submit"]').click();await page.locator('.sheet').waitFor({state:'detached'});
    await page.waitForFunction(async id=>(await import('/src/store.js')).getSlot(id)?.period===4,activity.id);
    assert.equal((await checkpoint(page)).slots.find(s=>s.id===activity.id).kind,'waiting');
    await page.locator(`[data-act="edit"][data-id="${waiting.id}"]`).click();
    await page.locator('#slot-kind').selectOption('activity');await page.locator('#slot-period').selectOption('2');
    await page.locator('[form="slot-form"][type="submit"]').click();await page.locator('.sheet').waitFor({state:'detached'});
    await page.waitForFunction(async id=>(await import('/src/store.js')).getSlot(id)?.period===2,waiting.id);
    // Seed one ordinary synthetic academic parent/history control after the no-teaching journey.
    await page.evaluate(async()=>{
      const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),m=await import('/src/models.js');
      const own=row=>({...row,ownerId:s.getActiveWorkspace().authUserId,serverRevision:1});
      await d.putMany('sections',[own(m.makeSection({id:'n122-sec',yearId:'n73-year',grade:4,label:'أ'}))]);
      await d.putMany('subjects',[own(m.makeSubject({id:'n122-sub',name:'مادة مصطنعة',slug:'n122-sub'}))]);
      await d.putMany('teachings',[own(m.makeTeaching({id:'n122-tch',sectionId:'n122-sec',subjectId:'n122-sub',termId:'n73-term'}))]);
      await d.putMany('sessions',[own(m.makeSession({teachingId:'n122-tch',date:'2027-05-01',period:1,status:'held'}))]);
      await s.refreshSyncedState();
    });
    const history=(await checkpoint(page)).sessions;
    const coexist=await page.evaluate(async()=>{
      const s=await import('/src/store.js');let conflict=false;
      try{await s.addSlot('n122-tch',0,2);}catch{conflict=true;}
      const academic=await s.addSlot('n122-tch',0,1);
      const projections=s.projectedSessionsForDate('2027-05-02');
      const noop=await s.ensureSessionsForDate('2027-05-02');
      const model=(await import('/src/lib/schedule-export.js')).buildScheduleExportModel(s);
      const backup=await (await import('/src/lib/export.js')).buildBackup();
      return {conflict,academic,projections,noop,model,backup,hold:s.CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD};
    });
    assert.equal(coexist.conflict,true);assert.equal(coexist.academic.kind,'teaching');
    assert.ok(coexist.projections.every(s=>s.teachingId==='n122-tch'));assert.equal(coexist.noop.created,0);assert.equal(coexist.hold,true);
    const cells=coexist.model.days.flatMap(d=>d.periods).filter(c=>c.teaching).map(c=>c.teaching.classLabel);
    assert.ok(cells.includes('نشاط')&&cells.includes('انتظار'));
    assert.ok(coexist.backup.data.slots.some(s=>s.kind==='activity'&&s.termId==='n73-term'&&s.teachingId===null));
    await page.locator('[data-act="export"]').click();await page.locator('#schedule-export-preview').getByText('نشاط',{exact:true}).waitFor();
    await page.locator('#schedule-export-preview').getByText('انتظار',{exact:true}).waitFor();await page.keyboard.press('Escape');
    record('coexistence_projection_export_backup','Academic slot coexists; occupied time rejects collision; read-only projections and unscoped N116 entry create no independent lessons; actual export preview and backup retain both labels/fields.');
    // Keep actual existing owner/lease guards, including nonacademic writes.
    const negatives=await page.evaluate(async()=>{
      const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),l=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
      const attempt=()=>s.addSlot(null,1,1,{kind:'activity',termId:'n73-term'}),rejected=[];
      const ws=s.getActiveWorkspace();s.activateWorkspace({...ws,ownershipState:'unresolved'});
      try{await attempt();}catch{rejected.push('unresolved-owner');}finally{s.activateWorkspace(ws);}
      const auth=c.user,session=c.session;c.setMockAuth({id:'foreign'}, {...session,user:{id:'foreign'}});
      try{await attempt();}catch{rejected.push('foreign-auth');}finally{c.setMockAuth(auth,session);}
      s.getOfflineLeaseStatus();l.invalidate('n122-fixture');try{await attempt();}catch{rejected.push('limited-lease');}
      await l.renew(async()=>({id:ws.authUserId,source:'supabase-auth-user',verifiedAt:Date.now()}));
      return rejected;
    });assert.deepEqual(negatives,['unresolved-owner','foreign-auth','limited-lease']);
    await mkdir('tests/fixtures/n122-1019',{recursive:true});
    await page.screenshot({path:'tests/fixtures/n122-1019/schedule.png',fullPage:true});
    for(const id of [activity.id,waiting.id]) {
      await page.locator(`[data-act="remove"][data-id="${id}"]`).click();
      await page.locator('.sheet .btn--danger').click();await page.locator('.sheet').waitFor({state:'detached'});
      await page.waitForFunction(async id=>!(await import('/src/store.js')).getSlot(id),id);
    }
    cp=await checkpoint(page);
    assert.ok(cp.slots.filter(s=>[activity.id,waiting.id].includes(s.id)).every(s=>s.deleted));assert.deepEqual(cp.sessions,history);
    assert.deepEqual(cp.attendance,initial.attendance);assert.deepEqual(cp.scores,initial.scores);
    assert.ok(cp.outbox.filter(r=>r.store==='slots').every(r=>r.state==='pending'));
    record('edit_delete_guards_history','Both kinds edited through real dialogs and soft-deleted with tombstones; history unchanged; owner/Auth/lease negatives rejected; local commands never claim ACK.');
    assert.deepEqual(evidence.errors,[]);
    record('n122_permanent_activity_waiting_slot_save_reload_edit_delete_no_fake_subject','PASS: actual app DOM/handlers/source CSS over owned loopback HTTP, synthetic account guard path.');
  });
}catch(error){evidence.failure=error.stack;throw error;}
finally{server.closeAllConnections();await new Promise(done=>server.close(done));await writeFile('tests/n122-1019-browser.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence,null,2));
