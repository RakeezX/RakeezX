// AI: actual application + disposable native PG17. No hosted API/Auth calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
async function withLeasedBrowser(options, work) {
 const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
 assert.equal(lease.taskId,'continuous-n101-reviewed-rejected-session-repair-20261014');assert.equal(lease.owner.token,RUN);
 const browser=await chromium.launch({headless:true}),timer=setTimeout(()=>browser.close(),120000);timer.unref();
 try{return await work({createContext: options=>browser.newContext({...options,serviceWorkers:'block'})});}finally{clearTimeout(timer);await browser.close();}
}
import { createServer as viteServer } from 'vite';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';
import { SUPABASE_URL, AUTH_STORAGE_KEY } from '../src/lib/cloud.js';
import { SYNC_V2_SCHEMAS } from '../src/lib/sync-v2.js';

const RUN = '445614fc-3975-4a8c-814f-0fc8be85d6a3';
const BASE='ae581ea2b48ec45beb73c7249ab941edbcbf14ab', N58='4fa6fb8b98415a42dd0a835bfdd7038ab65b8979';
let baseline=true;
const source=async file=>(await exec('git',['show',N58+':'+file],{windowsHide:true,maxBuffer:20000000})).stdout;
process.env.N71_RUN_ID = RUN;
// Same-document owner checkpoint below intentionally permits preserved rejected outbox evidence.
const A = 'a5800000-0000-4000-8000-000000000001', B = 'b5800000-0000-4000-8000-000000000002';
const shared = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const { default: pg } = await import(pathToFileURL(shared + '/client/node_modules/pg/lib/index.js'));
const exec = promisify(execFile), root = path.resolve('test-results/n101-repair-native-' + RUN);
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
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    try {
    const snapshot=await page.evaluate(async owner=>{
    const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    const sync=await import('/src/lib/sync.js');
    const workspace=s.getActiveWorkspace(),databaseName=db.getActiveDatabaseName();
    if(document.readyState!=='complete'||document.querySelector('[data-initial-restore-state]')||!s.state.ready||c.user?.id!==owner||
      workspace?.authUserId!==owner||workspace.type!=='account'||workspace.ownershipState!=='claimed'||workspace.databaseName!==databaseName||
      !(Number(sync.state.lastSyncedAt)>0)||
      s.state.device?.lastSyncAt!==sync.state.lastSyncedAt||!s.getOfflineLeaseStatus().editable)return false;
    const receipt=await db.readInitialRestoreReceipt();if(receipt?.ownerId!==owner||receipt.protocol!=='CORE_V2')return false;
    const data=Object.fromEntries(await Promise.all(['years','terms','sessions','teachings','items','outbox'].map(async name=>[name,await db.getAll(name)])));
    if(s.getActiveWorkspace()!==workspace||db.getActiveDatabaseName()!==databaseName)return false;
    return {workspace,databaseName,receipt,data};
  },A);
    if(snapshot?.data&&snapshot.receipt)return snapshot;
    } catch(error){if(!/Execution context was destroyed|Cannot find context/.test(error.message))throw error;}
    await page.waitForTimeout(50);
  }
  throw Error('N101 same-document owner/receipt/data checkpoint timed out');
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
  currentStage='BASELINE';await setup(a,origin);await checkpoint(a);await a.locator('.page--schedule').waitFor();
  await a.evaluate(async()=>{await (await import('/src/store.js')).renewOfflineLease();Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});});
  const teaching=await a.evaluate(async()=>{
    const s=await import('/src/store.js'),section=await s.createSection({yearId:'y:1448-1449',grade:4,label:'N101',name:'N101 synthetic'});
    return s.createTeaching({sectionId:section.id,subjectId:'sub:digital-skills',termId:'tm:y:1448-1449:1'});
  });await dispatch(a);await a.evaluate(async()=>{await (await import('/src/store.js')).refreshSyncedState();});
  const today=await a.evaluate(async()=> (await import('/src/models.js')).todayISO());
  const day=await a.evaluate(async d=>(await import('/src/models.js')).weekday(d),today);
  currentStage='FIVE_FAILURES';for(let period=1;period<=5;period++)await addSlotUI(a,teaching.id,day,period);await dispatch(a);
  const five=(await data(a)).outbox.filter(x=>x.store==='sessions');assert.equal(five.length,5);
  assert.ok(five.every(x=>x.state==='rejected'&&x.lastError.code==='22023'&&x.lastError.message==='N58_SESSION_CONTEXT_REQUIRED'));
  assert.equal((await client.query('select count(*)::int n from rakeezx.sessions')).rows[0].n,0);
  const frozen=await a.evaluate(async({five,today})=>{
    const d=await import('/src/lib/db.js'),m=await import('/src/models.js'),entries=[];
    for(let i=0;i<6;i++){
      const template=five[0],id='synthetic:frozen:'+i,date=m.shiftDate(today,-i-1),original=await d.get('sessions',template.recordId);
      await d.put('sessions',{...original,id,canonicalId:id,date});
      const row={...template,id:'v2:frozen:'+i,mutationId:'frozen:'+i,recordId:id,serverRecordId:id,canonicalId:id,logicalRecordKey:'sessions:'+id,
        patch:{...template.patch,date},localPatch:{...template.localPatch,id,date},queuedAt:Date.parse('2026-10-10T00:00:00Z'),sequence:-10+i};
      await d.put('outbox',row);entries.push(row);
    }return entries;
  },{five,today});
  baseline=false;vite.moduleGraph.invalidateAll();await a.reload();await checkpoint(a);await a.evaluate(async()=>{await (await import('/src/store.js')).renewOfflineLease();Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});});
  currentStage='PLAN';const plan=await a.evaluate(async()=> (await import('/src/store.js')).reviewRejectedSessionRepairs());
  assert.equal(plan.entries.length,11);assert.equal(plan.entries.filter(x=>x.status==='review').length,11,JSON.stringify(plan.entries));
  for(const e of plan.entries){assert.equal(e.originalContextVerified,false);assert.equal(e.correction,true);assert.equal(e.context.yearId,YEAR);assert.equal(e.context.termId,teaching.termId);assert.equal(e.context.presetId,W);assert.ok(e.context.selectionRevision>0);}
  const unchanged=await data(a);
  const unrelatedNative=async()=>Object.fromEntries(await Promise.all(Object.values(SYNC_V2_SCHEMAS).filter(x=>x.entity!=='sessions').map(async x=>[x.entity,(await client.query(`select to_jsonb(t) value from rakeezx.${identifier(x.entity)} t order by to_jsonb(t)::text`)).rows])));
  const untouched=await unrelatedNative();
  await a.locator('[data-act="open-teacher-mini-hub"]').first().click();await a.locator('[data-act="review-session-repair"]').click();
  const review=a.locator('[data-session-repair-review]');await review.waitFor();assert.equal(await review.locator('input:checked').count(),0);
  assert.ok((await review.innerText()).includes('السياق وقت الإنشاء غير قابل للتحقق'));assert.ok((await review.innerText()).includes('تقويم مكة المكرمة'));
  for(const width of [390,1280]){await a.setViewportSize({width,height:900});assert.equal(await a.evaluate(()=>getComputedStyle(document.documentElement).direction==='rtl'&&document.documentElement.scrollWidth<=innerWidth+2),true);await a.screenshot({path:`test-results/n101-repair-review-${width}.png`});}
  await a.getByRole('dialog').last().getByRole('button',{name:'إلغاء',exact:true}).click();assert.deepEqual(await data(a),unchanged);
  await a.locator('[data-act="review-session-repair"]').click();await review.waitFor();const selected=five.map(x=>x.id);
  for(let i=0;i<plan.entries.length;i++)if(selected.includes(plan.entries[i].originalId))await review.locator(`[data-repair-entry="${i}"]`).check();
  assert.equal(await review.locator('input:checked').count(),5);await a.locator('[data-confirm-session-repair]').click();
  await review.locator('[data-repair-message]').filter({hasText:'حُفظ طلب التصحيح'}).waitFor();
  const pending=await data(a),replacements=pending.outbox.filter(x=>x.sessionRepairOf);assert.equal(replacements.length,5);
  assert.deepEqual(pending.outbox.filter(x=>selected.includes(x.id)),five);assert.deepEqual(pending.outbox.filter(x=>x.mutationId?.startsWith('frozen:')),frozen);
  const again=await a.evaluate(async({plan,selected})=>(await import('/src/store.js')).confirmRejectedSessionRepairs(plan,selected,true),{plan,selected});
  assert.deepEqual(new Set(again),new Set(replacements.map(x=>x.mutationId)));assert.equal((await data(a)).outbox.filter(x=>x.sessionRepairOf).length,5);
  record('n101_exact_missing_context_repair_plan','Actual baseline DOM produced five exact native 22023 failures. Eleven individually unchecked entries include six historical synthetic candidates; exact selected current IDs, named dates/classes/year/term and receipt revision are reviewed as corrections.');
  record('n101_review_then_atomic_replacement','Actual DOM confirmation -> store -> engine/IndexedDB atomic full-original audit and one owner-bound replacement. Cancel writes zero data; repeat returns same IDs. All originals remain rejected before exact receipts.');
  currentStage='ACK_LOSS';assert.equal((await dispatch(a,replacements[0].mutationId,true)).attempted,0);
  loseNextSession=true;assert.equal((await dispatch(a,replacements[0].mutationId)).failed,1,JSON.stringify((await data(a)).outbox.filter(x=>x.sessionRepairOf).map(x=>({id:x.id,state:x.state,error:x.lastError,blockedReason:x.blockedReason}))));
  assert.equal((await data(a)).outbox.find(x=>x.id===replacements[0].id).envelopeLocked,true);
  await a.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
  await a.reload();await checkpoint(a);
  assert.equal((await dispatch(a,replacements[0].mutationId)).acknowledged,1,JSON.stringify((await data(a)).outbox.filter(x=>x.sessionRepairOf).map(x=>({id:x.id,state:x.state,error:x.lastError,blockedReason:x.blockedReason}))));
  for(const row of replacements.slice(1)){const r=await dispatch(a,row.mutationId);assert.equal(r.acknowledged,1,JSON.stringify({r,replacements:(await data(a)).outbox.filter(x=>x.sessionRepairOf).map(x=>({state:x.state,error:x.lastError,reason:x.blockedReason}))}));}
  const final=await data(a);assert.equal(final.outbox.filter(x=>x.protocol==='N101_REVIEWED_SESSION_V1'&&x.state==='verified').length,5);
  assert.deepEqual(final.outbox.filter(x=>x.mutationId?.startsWith('frozen:')),frozen);
  for(const prior of five){const audit=final.outbox.find(x=>x.id==='session-repair:'+prior.id);assert.deepEqual(audit.original,prior);assert.equal(final.outbox.find(x=>x.id===prior.id).state,'superseded');assert.ok(audit.receipt.canonical.calendar_context);}
  const retries=calls.filter(x=>x.envelope?.p_mutation_id===replacements[0].mutationId);assert.equal(retries.length,2);assert.deepEqual(retries[0].envelope,retries[1].envelope);assert.deepEqual(retries[0].result,retries[1].result);
  assert.equal((await client.query('select count(*)::int n from rakeezx.sessions')).rows[0].n,5);
  assert.equal((await client.query('select count(*)::int n from rakeezx.sync_mutation_receipts where mutation_id=any($1)',[replacements.map(x=>x.mutationId)])).rows[0].n,5);
  await assert.rejects(()=>rpc(B,'apply_sync_v2_mutation',retries[0].envelope));
  assert.deepEqual(await unrelatedNative(),untouched);
  for(const name of ['years','terms','slots'])assert.deepEqual(final[name],unchanged[name]);
  const release=await setup(a2,origin,{delayManifest:true});release();const second=await checkpoint(a2);assert.equal(second.data.sessions.length,5);
  for(const row of second.data.sessions){assert.deepEqual(row.calendarContext,final.sessions.find(x=>x.id===row.id).calendarContext);assert.equal(row.calendarContext.presetId,W);assert.equal(row.calendarContext.selectionRevision,plan.entries[0].context.selectionRevision);}
  await a2.reload();await checkpoint(a2);
  record('n101_repair_native_ack_loss_retry','Native immutable N58/sync functions: five canonical sessions/five receipts, identical envelope/ID after response-loss + reload, no duplicates, exact contexts converge in second actual-app delayed restore/reload.');
  record('n101_original_evidence_owner_history_preserved','Five original full rejection/error audits preserved; six frozen candidates byte-identical/unreplayed. Client wrong-owner sends zero requests; native B denied A receipt. Year/term/slots unchanged.');
  record('n101_actual_repair_ui','Current HTTP app DOM/CSS -> handlers/store/engine; review/cancel/confirm and RTL at 390/1280px, no overflow.');
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
  await withLeasedBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n101-reviewed-rejected-session-repair-20261014.json',runId:RUN,url:origin,timeoutMs:120000},async({createContext})=>{
    for(let i=0;i<2;i++) contexts.push(await createContext({timezoneId:'Asia/Riyadh',viewport:{width:1280,height:900}}));
    const a=await contexts[0].newPage(), a2=await contexts[1].newPage();
    const pageErrors=[];for(const p of [a,a2])p.on('pageerror',e=>pageErrors.push(e.message));
    await scenario(a,a2,origin);assert.deepEqual(pageErrors,[]);
  });
} catch (failure) { error = { stage: currentStage, message: failure.message, stack: failure.stack }; console.error(JSON.stringify(error)); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close(); await vite?.close(); await queue; await client?.end();
  if (started) await pgctl(['-D', cluster, '-m', 'fast', '-w', 'stop']);
  assert.ok(path.resolve(root).startsWith(path.resolve('test-results') + path.sep) && path.basename(root).startsWith('n101-repair-native-'));
  await fs.rm(root, { recursive: true, force: true, maxRetries:10, retryDelay:200 });
  const files = ['src/app.js', 'src/lib/session-recovery.js', 'src/models.js', 'src/store.js', 'src/lib/cloud.js', 'src/lib/sync-v2.js', 'src/lib/backup-v2.js', 'src/lib/initial-restore.js', 'src/views/calendar.js', 'sw.js'];
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, hash((await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n'))])));
  await fs.mkdir('test-results',{recursive:true});
  await fs.writeFile('test-results/n101-repair-'+(baseline?'baseline':'fixed')+'-'+Date.now()+'.json', JSON.stringify({ runId: RUN, scope: 'local actual-app/native PG only; NOT live Supabase acceptance', checks, error, sourceHashes, migrationHashes, nativeRequests: calls, n58SourceCommit:N58, baselineSourceCommit:BASE, ownedResourcesClosed: true, externalNetworkCalls: 0, contexts: 2, liveAccountsCreated: 0, observedAt: new Date().toISOString() }, null, 2) + '\n');
}
