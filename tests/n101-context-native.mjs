// AI: actual application + disposable native PG17. No hosted API/Auth calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { createServer as viteServer } from 'vite';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';
import { SUPABASE_URL, AUTH_STORAGE_KEY } from '../src/lib/cloud.js';
import { SYNC_V2_SCHEMAS } from '../src/lib/sync-v2.js';

const RUN = 'b5cb864d-2289-478a-a29e-c331c45e4f24';
const BASE='ae581ea2b48ec45beb73c7249ab941edbcbf14ab', N58='4fa6fb8b98415a42dd0a835bfdd7038ab65b8979';
const baseline=process.env.N101_CONTEXT_BASELINE==='1';
const source=async file=>(await exec('git',['show',N58+':'+file],{windowsHide:true,maxBuffer:20000000})).stdout;
process.env.N71_RUN_ID = RUN;
// Import only the existing pure checkpoint exports; never invoke its live runner.
const { ownerCheckpoint } = await import('./n71-live/runner.mjs');
const A = 'a5800000-0000-4000-8000-000000000001', B = 'b5800000-0000-4000-8000-000000000002';
const shared = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const { default: pg } = await import(pathToFileURL(shared + '/client/node_modules/pg/lib/index.js'));
const exec = promisify(execFile), root = path.resolve('test-results/n101-context-native-' + RUN);
const cluster = path.join(root, 'cluster-' + randomUUID()), checks = [], calls = [], migrationHashes = {};
const G = 'sa-general-1448-1449', W = 'sa-western-1448-1449', YEAR = 'y:1448-1449';
const hash = value => createHash('sha256').update(value).digest('hex');
let client, started = false, vite, queue = Promise.resolve(), error, currentStage = 'INIT';
let loseNextSession=false;
const contexts = [], record = (name, evidence) => { checks.push({ name, status: 'PASS', evidence }); console.log('PASS ' + name); };
const binary = name => path.join(shared, 'package/native/bin', name + '.exe');
const pgctl = args => new Promise((resolve, reject) => {
  const child = spawn(binary('pg_ctl'), args, { windowsHide: true, stdio: 'ignore' });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error('Owned pg_ctl exit ' + code)));
});
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
  const port = server.address().port; server.close(() => resolve(port));
}); });
const identifier = value => { assert.match(value, /^[a-z_][a-z0-9_]*$/); return '"' + value + '"'; };
const native = (owner, work) => {
  const result = queue.then(async () => {
    await client.query('begin');
    try {
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
      await client.query('set local role authenticated');
      const value = await work(); await client.query('commit'); return value;
    } catch (failure) { await client.query('rollback'); throw failure; }
  });
  queue = result.catch(() => {}); return result;
};
const rpc = (owner, name, body = {}) => native(owner, async () => {
  const entries = Object.entries(body);
  const parameters = entries.map(([key], index) => identifier(key) + '=>$' + (index + 1)).join(',');
  const values = entries.map(([, value]) => value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
  return (await client.query(`select rakeezx.${identifier(name)}(${parameters}) result`, values)).rows[0].result;
});
async function checkpoint(page) {
  await ownerCheckpoint(page, A, { timeout: 20000 });
  return page.evaluate(async owner => {
    const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
    const workspace = s.getActiveWorkspace(), databaseName = db.getActiveDatabaseName();
    const receipt = await db.readInitialRestoreReceipt();
    if (!s.state.ready || c.user?.id !== owner || workspace?.authUserId !== owner ||
        workspace.databaseName !== databaseName || receipt?.ownerId !== owner || receipt.protocol !== 'CORE_V2')
      throw Error('N58 same-document owner/receipt mismatch');
    const data = Object.fromEntries(await Promise.all(['years', 'terms', 'sessions', 'teachings', 'items', 'outbox']
      .map(async name => [name, await db.getAll(name)])));
    if (s.getActiveWorkspace() !== workspace || db.getActiveDatabaseName() !== databaseName)
      throw Error('N58 document/workspace changed during checkpoint');
    return { workspace, databaseName, receipt, data };
  }, A);
}
async function setup(page, origin, { delayManifest = false } = {}) {
  const session = { access_token: 'n58-local-native-session', refresh_token: 'n58-local-no-refresh', expires_at: 4102444800,
    user: { id: A, email: 'n58-native@example.invalid', role: 'authenticated' } };
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: AUTH_STORAGE_KEY, session });
  await page.routeWebSocket('wss://**', socket => socket.close());
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await page.route(SUPABASE_URL + '/auth/v1/user', route => route.fulfill({ json: session.user }));
  let release, held = new Promise(resolve => { release = resolve; }), first = delayManifest;
  await page.route(SUPABASE_URL + '/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').at(-1);
    try {
      if (first && name.includes('restore_manifest')) { first = false; await held; }
      if (url.pathname.includes('/rpc/')) {
        const body = request.postDataJSON() ?? {};
        const result = await rpc(A, name, body);
        calls.push({ name, status: loseNextSession&&name==='apply_sync_v2_mutation'&&body.p_entity==='sessions'?503:200, ...(body.p_mutation_id ? { envelope: body, result } : {}) });
        if(loseNextSession&&name==='apply_sync_v2_mutation'&&body.p_entity==='sessions'){loseNextSession=false;return route.fulfill({status:503,json:{message:'synthetic lost native receipt'}});}
        return route.fulfill({ json: result });
      }
      assert.equal(request.method(), 'GET');
      assert.ok(Object.values(SYNC_V2_SCHEMAS).some(schema => schema.entity === name) || name === 'sync_mutation_receipts');
      assert.equal(url.searchParams.get('owner_id'), 'eq.' + A);
      const rows = await native(A, async () => (await client.query(`select to_jsonb(t) result from rakeezx.${identifier(name)} t where owner_id=$1`, [A])).rows.map(row => row.result));
      const key = name === 'profile' ? 'owner_id' : name === 'sync_mutation_receipts' ? 'mutation_id' : 'id';
      rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 500);
      const selected = rows.slice(offset, offset + limit);
      return route.fulfill({ json: selected, headers: { 'Content-Range': selected.length ? `${offset}-${offset + selected.length - 1}/${rows.length}` : `*/${rows.length}`, 'Access-Control-Expose-Headers': 'Content-Range' } });
    } catch (failure) {
      calls.push({ name, code: failure.code, message: failure.message });
      return route.fulfill({ status: failure.code === '42501' ? 403 : 400, json: { code: failure.code, message: failure.message } });
    }
  });
  await page.goto(origin + '/#/schedule', { waitUntil: 'domcontentloaded' });
  return release;
}

async function dispatch(page, onlyMutationId=null, wrongOwner=false) {
  return page.evaluate(async ({onlyMutationId,wrongOwner,B})=>{
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
    const {createSyncV2Engine}=await import('/src/lib/sync-v2.js');
    const {runtimeSyncOwnershipGuard}=await import('/src/lib/sync-ownership.js');
    return createSyncV2Engine({ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>wrongOwner?B:c.user?.id}).dispatchPending({onlyMutationId});
  },{onlyMutationId,wrongOwner,B});
}
async function addSlotUI(page,teachingId,day,period,{cancel=false}={}) {
  await page.locator('.page--schedule [data-act="add"]').first().click();
  const form=page.locator('#slot-form');await form.waitFor();
  await form.locator('[name="teachingId"]').selectOption(teachingId);
  await form.locator('[name="weekday"]').selectOption(String(day));
  await form.locator('[name="period"]').selectOption(String(period));
  if(cancel) await page.getByRole('dialog').getByRole('button',{name:'إلغاء',exact:true}).click();
  else await page.locator('[form="slot-form"][type="submit"]').click();
  await form.waitFor({state:'hidden'});
  if(!cancel) await page.waitForFunction(async({day,period})=>{
    const s=await import('/src/store.js'),m=await import('/src/models.js'),d=await import('/src/lib/db.js');const slot=s.state.slots.find(x=>x.weekday===day&&x.period===period);if(!slot)return false;if(day!==m.weekday(m.todayISO()))return true;return (await d.getAll('sessions')).some(x=>x.teachingId===slot.teachingId&&x.date===m.todayISO()&&x.period===period);
  },{day,period});
}
async function data(page) {
  return page.evaluate(async()=>{const d=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(['years','terms','sessions','slots','outbox'].map(async x=>[x,await d.getAll(x)])));});
}
async function scenario(a,a2,origin) {
  currentStage='APP_RESTORE';await setup(a,origin);await checkpoint(a);
  await a.locator('.page--schedule').waitFor();
  await a.evaluate(async()=>{const s=await import('/src/store.js');await s.renewOfflineLease();Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});});
  currentStage='TEACHING';
  const teaching=await a.evaluate(async()=>{
    const s=await import('/src/store.js');
    const section=await s.createSection({yearId:'y:1448-1449',grade:4,label:'N101',name:'N101 synthetic'});
    return s.createTeaching({sectionId:section.id,subjectId:'sub:digital-skills',termId:'tm:y:1448-1449:1'});
  });
  await dispatch(a);
  await a.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');await s.refreshSyncedState();});
  const today=await a.evaluate(async()=> (await import('/src/models.js')).todayISO());
  const day=await a.evaluate(async t=>(await import('/src/models.js')).weekday(t),today);
  if(baseline) {
    currentStage='BASELINE_UI';await addSlotUI(a,teaching.id,day,1);
    const queued=(await data(a)).outbox.find(x=>x.store==='sessions');assert.ok(queued);assert.equal(queued.patch.calendar_context,undefined);
    const result=await dispatch(a);assert.ok(result.blocked>0);
    const rejected=(await data(a)).outbox.find(x=>x.id===queued.id);
    assert.equal(rejected.state,'rejected');assert.equal(rejected.lastError.code,'22023');assert.equal(rejected.lastError.message,'N58_SESSION_CONTEXT_REQUIRED');
    assert.deepEqual(await native(A,async()=> (await client.query('select (select count(*)::int from rakeezx.sessions where id=$1) sessions,(select count(*)::int from rakeezx.sync_mutation_receipts where mutation_id=$2) receipts',[queued.recordId,queued.mutationId])).rows[0]),{sessions:0,receipts:0});
    record('n101_context_required_reproduced','Base actual schedule DOM handler → addSlot → ensureSessionsForDate → actual owner-bound serialized envelope → immutable native N58 routine: 22023/N58_SESSION_CONTEXT_REQUIRED, no session receipt.');return;
  }
  currentStage='REJECTED_FIXTURE';
  const rejected=await a.evaluate(async A=>{
    const d=await import('/src/lib/db.js');
    const rows=Array.from({length:11},(_,i)=>({id:'synthetic:rejected:'+i,protocol:'v2',mutationId:'prior:'+i,store:'sessions',entity:'sessions',recordId:'old:'+i,serverRecordId:'old:'+i,logicalRecordKey:'sessions:old:'+i,ownerId:A,op:'create',state:'rejected',sequence:i,patch:{note:'byte-preserve '+i},localPatch:{note:'byte-preserve '+i},dependencies:[],envelopeLocked:true,attemptCount:1,lastError:{code:'22023',message:'N58_SESSION_CONTEXT_REQUIRED',at:1},queuedAt:1}));
    await d.putMany('outbox',rows);return (await d.getAll('outbox')).filter(x=>x.id.startsWith('synthetic:rejected:'));
  },A);
  await a.evaluate(async()=>{const s=await import('/src/store.js');await s.patch('years','y:1448-1449',{calendarPresetId:'sa-general-1448-1449'});});

  await a.evaluate(async today=>{const s=await import('/src/store.js'),m=await import('/src/models.js');
    const inactive=m.makeCalendar({id:'n101:custom:W',yearId:'y:1448-1449',source:'custom',presetId:'sa-western-1448-1449',termDateOverrides:{}});await s.save({calendars:[inactive]});await s.setCalendarDay(inactive.id,today,'holiday','inactive must not govern today');
    const calendar=m.makeCalendar({id:'n101:custom:G',yearId:'y:1448-1449',source:'custom',presetId:'sa-general-1448-1449',termDateOverrides:{}});
    await s.save({calendars:[calendar]});await s.setCalendarDay(calendar.id,today,'remote','يوم اصطناعي محفوظ');
  },today);
  currentStage='FIVE_TODAY_UI';
  for(let period=1;period<=5;period++) await addSlotUI(a,teaching.id,day,period);
  const prepared=await data(a),children=prepared.outbox.filter(x=>x.store==='sessions'&&x.state==='pending');assert.equal(children.length,5);
  for(const child of children) {
    assert.equal(child.patch.calendar_context.presetId,G);assert.equal(child.patch.calendar_context.kind,'remote');assert.equal(child.patch.calendar_context.source,'custom');assert.equal(child.patch.calendar_context.label,'يوم اصطناعي محفوظ');assert.equal(child.patch.calendar_context.selectionRevision,undefined);
    assert.ok(child.dependencies.some(d=>d.store==='years'&&d.calendarPresetId===G));assert.ok(child.dependencies.some(d=>d.store==='terms'));
    assert.equal((await dispatch(a,child.mutationId)).attempted,0);
  }
  assert.equal(calls.filter(x=>x.envelope?.p_entity==='sessions').length,0);
  currentStage='WRONG_OWNER_CLIENT';assert.equal((await dispatch(a,children[0].mutationId,true)).attempted,0);
  currentStage='ACK';await dispatch(a);
  const acknowledged=await data(a);assert.equal(acknowledged.sessions.filter(x=>x.serverRevision>0).length,5);
  assert.deepEqual(acknowledged.outbox.filter(x=>x.id.startsWith('synthetic:rejected:')),rejected);
  const year=acknowledged.years.find(x=>x.id===YEAR),revision=year.fieldRevisions.calendar_selection;assert.ok(revision>1);
  const receipts=calls.filter(x=>x.envelope?.p_entity==='sessions'&&x.result?.outcome==='applied');assert.equal(receipts.length,5);
  for(const call of receipts){assert.equal(call.envelope.p_patch.calendar_context.selectionRevision,revision);assert.equal(call.result.canonical.calendar_context.selectionRevision,revision);}
  // No owner/year/term receipt means no wire request. Also exercise term delay.
  const originalTerm=acknowledged.terms.find(x=>x.id===teaching.termId);
  await a.evaluate(async id=>{const s=await import('/src/store.js');await s.refreshSyncedState();return s.ensureSession(id,(await import('/src/models.js')).todayISO(),7);},teaching.id);
  const delayed=(await data(a)).outbox.find(x=>x.store==='sessions'&&x.state!=='rejected');assert.ok(delayed);
  await a.evaluate(async id=>{const d=await import('/src/lib/db.js');await d.put('terms',{...await d.get('terms',id),serverRevision:0});},teaching.termId);
  assert.equal((await dispatch(a,delayed.mutationId)).attempted,0);
  await a.evaluate(async row=>{await (await import('/src/lib/db.js')).put('terms',row);},originalTerm);
  assert.equal((await dispatch(a,delayed.mutationId)).acknowledged,1);
  record('n101_context_revision_wire_and_ack','Five actual schedule form submissions; child dispatch delayed until year calendar-selection receipt and term receipt; creation-time remote/custom/label and exact acknowledged revision on JSON wire/native receipts; additional term-delay probe succeeds only after restoration of its synthetic receipt.');

  currentStage='UNKNOWN_CALENDAR';
  const invalidBefore=await data(a);
  const unknown=await a.evaluate(async id=>{
    const s=await import('/src/store.js'),m=await import('/src/models.js');const y=s.state.years.find(x=>x.id==='y:1448-1449');const selected=y.calendarPresetId;
    const errors=[];try { for(const value of ['unknown-preset',null]) {y.calendarPresetId=value;try {await s.ensureSession(id,m.todayISO(),8);errors.push(null);}catch(e){errors.push(e.message);}} } finally {y.calendarPresetId=selected;}
    return errors;
  },teaching.id);
  assert.ok(unknown.every(Boolean));assert.deepEqual(await data(a),invalidBefore);
  currentStage='RANGE_CREATE';
  const yesterday=await a.evaluate(async()=> (await import('/src/models.js')).shiftDate((await import('/src/models.js')).todayISO(),-1));
  const yesterdayDay=await a.evaluate(async d=>(await import('/src/models.js')).weekday(d),yesterday);
  await addSlotUI(a,teaching.id,yesterdayDay,2);
  const range=await a.evaluate(async({teachingId,date})=>(await import('/src/store.js')).generateSessionsForRange(teachingId,date,date),{teachingId:teaching.id,date:yesterday});assert.equal(range.created,1);await dispatch(a);
  const rangeSession=(await data(a)).sessions.find(x=>x.date===yesterday);assert.equal(rangeSession.calendarContext.selectionRevision,revision);assert.equal(rangeSession.calendarContext.presetId,G);
  currentStage='SECOND_CONTEXT';const release=await setup(a2,origin,{delayManifest:true});
  let ready=false;const waiting=checkpoint(a2).then(x=>{ready=true;return x;});await new Promise(r=>setTimeout(r,150));assert.equal(ready,false);release();const restored=await waiting;
  const expected=(await data(a)).sessions;assert.deepEqual(restored.data.sessions.map(x=>x.calendarContext),expected.map(x=>x.calendarContext));
  const prior=expected[0],wire=receipts[0].envelope;
  await assert.rejects(rpc(A,'apply_sync_v2_mutation',{...wire,p_mutation_id:'immutable',p_base_revision:prior.serverRevision,p_operation:'patch',p_patch:{calendar_context:{...prior.calendarContext,label:'changed'}}}),e=>e.code==='22023'&&e.message==='N58_IMMUTABLE_SESSION_CONTEXT');
  const foreign=await rpc(B,'apply_sync_v2_mutation',{...wire,p_mutation_id:'foreign',p_base_revision:prior.serverRevision,p_operation:'patch',p_patch:{note:'wrong owner'}});assert.equal(foreign.outcome,'not_found');
  assert.deepEqual(await native(B,async()=> (await client.query('select * from rakeezx.sessions where owner_id=$1',[A])).rows),[]);
  currentStage='TOMBSTONE_CANCEL_FUTURE';
  await a.evaluate(async teachingId=>{const s=await import('/src/store.js'),m=await import('/src/models.js'),d=await import('/src/lib/db.js');const row=m.makeSession({teachingId,date:m.todayISO(),period:6,deleted:true,calendarContext:{kind:'study',label:'retained'}});await d.put('sessions',row);s.state.sessions.push(row);},teaching.id);
  const tombstone=(await data(a)).sessions.find(x=>x.period===6);
  await addSlotUI(a,teaching.id,day,6);const beforeCancel=await data(a);
  await addSlotUI(a,teaching.id,(day+1)%5,1,{cancel:true});assert.deepEqual(await data(a),beforeCancel);
  await addSlotUI(a,teaching.id,(day+1)%5,1);
  const count=(await data(a)).sessions.length;
  const checksLocal=await a.evaluate(async teachingId=>{
    const s=await import('/src/store.js'),m=await import('/src/models.js');
    const again=await s.ensureSessionsForDate();const tomb=await s.ensureSession(teachingId,m.todayISO(),6);
    const future=await s.ensureSessionsForDate(m.shiftDate(m.todayISO(),1));
    const futureDirect=await s.ensureSession(teachingId,m.shiftDate(m.todayISO(),1),1);
    const projections=s.projectedSessionsForDate(m.shiftDate(m.todayISO(),1));
    const range=await s.generateSessionsForRange(teachingId,m.todayISO(),m.shiftDate(m.todayISO(),2));
    return {again,tomb,future,futureDirect,projections,range};
  },teaching.id);
  assert.equal(checksLocal.again.created,0);assert.equal(checksLocal.tomb,null);assert.equal(checksLocal.future.created,0);assert.equal(checksLocal.futureDirect,null);assert.equal(checksLocal.range.created,0);assert.ok(checksLocal.projections.length>0);assert.ok(checksLocal.projections.every(x=>x.projected&&x.date>today));
  assert.equal((await data(a)).sessions.length,count);assert.deepEqual((await data(a)).sessions.find(x=>x.period===6),tombstone);
  assert.deepEqual((await data(a)).outbox.filter(x=>x.id.startsWith('synthetic:rejected:')),rejected);

  currentStage='LOCKED_RECEIPT_RETRY';
  await a.evaluate(async teachingId=>{const s=await import('/src/store.js');await s.ensureSession(teachingId,(await import('/src/models.js')).todayISO(),8);},teaching.id);
  const retryQueued=(await data(a)).outbox.find(x=>x.store==='sessions'&&x.state==='pending');assert.ok(retryQueued);
  loseNextSession=true;assert.equal((await dispatch(a,retryQueued.mutationId)).failed,1);
  const failedEnvelope=(await data(a)).outbox.find(x=>x.id===retryQueued.id);assert.equal(failedEnvelope.envelopeLocked,true);assert.equal(failedEnvelope.patch.calendar_context.selectionRevision,revision);
  // Snapshot is immutable across later selected-calendar changes and A2 reload.
  await a.evaluate(async()=>{const s=await import('/src/store.js');await s.patch('years','y:1448-1449',{calendarPresetId:'sa-western-1448-1449'});});
  const switchCommand=(await data(a)).outbox.find(x=>x.store==='years');assert.ok(switchCommand);await dispatch(a,switchCommand.mutationId);
  assert.equal((await dispatch(a,retryQueued.mutationId)).acknowledged,1);
  const retryCalls=calls.filter(x=>x.envelope?.p_mutation_id===retryQueued.mutationId);assert.equal(retryCalls.length,2);assert.deepEqual(retryCalls[0].envelope,retryCalls[1].envelope);assert.deepEqual(retryCalls[0].result,retryCalls[1].result);

  expected.push((await data(a)).sessions.find(x=>x.period===8));
  await a.evaluate(async id=>{const s=await import('/src/store.js');await s.refreshSyncedState();await s.patch('sessions',id,{note:'permitted historical edit after selection switch'});},prior.id);
  const historicalEdit=(await data(a)).outbox.find(x=>x.store==='sessions'&&x.op==='patch');assert.ok(historicalEdit);assert.equal(historicalEdit.dependencies.some(x=>x.calendarPresetId),false);
  assert.equal((await dispatch(a,historicalEdit.mutationId)).acknowledged,1);assert.deepEqual((await data(a)).sessions.find(x=>x.id===prior.id).calendarContext,prior.calendarContext);

  await a2.reload();const reloaded=await checkpoint(a2);assert.deepEqual(reloaded.data.sessions.map(x=>x.calendarContext),expected.map(x=>x.calendarContext));
  for(const width of [390,1280]){await a.setViewportSize({width,height:900});assert.equal(await a.evaluate(()=>getComputedStyle(document.documentElement).direction==='rtl'&&document.documentElement.scrollWidth<=innerWidth+2),true);}
  record('n101_history_owner_rejected_entries_unchanged','Second isolated context native CORE_V2 restore/delayed checkpoint/reload; native immutable-context and B RLS/not_found denial; actual client owner guard; tombstone preserved; lost native response retries byte-identical locked context after preset switch; normal existing-session edit still acknowledges without changing context; cancelled schedule form, no duplicate/today-only range; 5 current + 6 historic synthetic rejected entries byte-unchanged. Real rejected recovery STILL_PENDING.');
}

await fs.mkdir(root, { recursive: true });
try {
  const port = await freePort();
  await exec(binary('initdb'), ['-D', cluster, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'], { windowsHide: true, timeout: 30000 });
  await pgctl(['-D', cluster, '-l', path.join(root, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
  client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' }); await client.connect();
  await client.query(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
    insert into auth.users values('${A}','a@example.invalid'),('${B}','b@example.invalid');`);
  currentStage = 'SOURCE_SCHEMA';
  for (const file of [...await fs.readdir('supabase/migrations'),'20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'].sort().filter(name => /^\d+.*\.sql$/.test(name))) {
    const sql = (await (file.includes('_n58_') ? source('supabase/migrations/'+file) : fs.readFile('supabase/migrations/' + file, 'utf8'))).replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
    if (file === '20261014090000_n100_automatic_safe_copy.sql') {
      // Reuse N100's exact committed provider baseline, as its existing native
      // fixture does. Preserve its real source/ACL guard; never strip the guard.
      const baselineText = await fs.readFile('tests/n100-automatic-provider-source.json', 'utf8');
      migrationHashes['n100-automatic-provider-source.json'] = hash(baselineText);
      for (const row of JSON.parse(baselineText)) {
        await client.query(row.definition);
        assert.equal((await client.query('select md5(prosrc) hash from pg_proc where oid=$1::regprocedure', [row.signature])).rows[0].hash, row.body_md5);
      }
    }
    migrationHashes[file] = hash(sql); await client.query(sql);
  }
  const guard=(await client.query("select md5(prosrc) body_md5,pg_get_functiondef(oid) definition from pg_proc where oid='rakeezx.n58_guard_calendar_contract()'::regprocedure")).rows[0];
  assert.ok(guard.definition.includes('N58_SESSION_CONTEXT_REQUIRED'));
  migrationHashes.nativeN58GuardBodyMd5=guard.body_md5;
  record('native_current_source_schema', (await client.query('select version()')).rows[0].version + '; all source definitions including N58/N71/N77/N90/N100 loaded locally only');
  currentStage = 'FOUNDATION';
  await rpc(A, 'provision_account_profile');
  await rpc(A, 'complete_account_profile', { p_teacher_name: 'N58 native fixture', p_phone: '0500000001', p_teacher_form: 'masculine', p_school_name: null });
  await rpc(A, 'begin_account_provisioning');
  await rpc(A, 'provision_account_workspace', { p_defaults: buildAccountFoundationDefaults() });
  await rpc(A,'apply_sync_v2_mutation',{p_entity:'years',p_record_id:YEAR,p_mutation_id:'synthetic-select-W',p_device_id:'native',p_base_revision:1,p_operation:'patch',p_patch:{calendar_preset_id:W}});
  vite = await viteServer({ configFile: false, root: process.cwd(), plugins: [{name:'immutable-base-app',enforce:'pre',async load(id){if(baseline&&['/src/store.js','/src/lib/sync-v2.js'].some(file=>id.endsWith(file)))return (await exec('git',['show',BASE+':'+id.slice(id.lastIndexOf('/src/')+1)],{windowsHide:true,maxBuffer:20000000})).stdout;}}], server: { host: '127.0.0.1', port: await freePort(), strictPort: true } });
  await vite.listen(); const origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n101-confirmed-context-prevention-20261014.json',runId:RUN,url:origin,timeoutMs:120000},async({createContext})=>{
    for(let i=0;i<2;i++) contexts.push(await createContext({timezoneId:'Asia/Riyadh',viewport:{width:1280,height:900}}));
    const a=await contexts[0].newPage(), a2=await contexts[1].newPage();
    const pageErrors=[];for(const p of [a,a2])p.on('pageerror',e=>pageErrors.push(e.message));
    await scenario(a,a2,origin);assert.deepEqual(pageErrors,[]);
  });
} catch (failure) { error = { stage: currentStage, message: failure.message, stack: failure.stack }; console.error(JSON.stringify(error)); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close(); await vite?.close(); await queue; await client?.end();
  if (started) await pgctl(['-D', cluster, '-m', 'fast', '-w', 'stop']);
  assert.ok(path.resolve(root).startsWith(path.resolve('test-results') + path.sep) && path.basename(root).startsWith('n101-context-native-'));
  await fs.rm(root, { recursive: true, force: true });
  const files = ['src/models.js', 'src/store.js', 'src/lib/cloud.js', 'src/lib/sync-v2.js', 'src/lib/backup-v2.js', 'src/lib/initial-restore.js', 'src/views/calendar.js', 'sw.js'];
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, hash((await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n'))])));
  await fs.mkdir('test-results',{recursive:true});
  await fs.writeFile('test-results/n101-context-'+(baseline?'baseline':'fixed')+'-'+Date.now()+'.json', JSON.stringify({ runId: RUN, scope: 'local actual-app/native PG only; NOT live Supabase acceptance', checks, error, sourceHashes, migrationHashes, nativeRequests: calls, n58SourceCommit:N58, baselineSourceCommit:BASE, ownedResourcesClosed: true, externalNetworkCalls: 0, contexts: 2, liveAccountsCreated: 0, observedAt: new Date().toISOString() }, null, 2) + '\n');
}
