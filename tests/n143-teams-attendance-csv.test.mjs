// AI N143: generated identities only; never load a real Teams report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { parseTeamsAttendance, matchTeamsAttendance, durationSeconds } from '../src/lib/teams-attendance-csv.js';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const participant = (name, id, duration = '12m 3s', role = 'مشارك') =>
  [name, '10/29/26, 8:00 AM', '10/29/26, 8:12 AM', duration, `${id}@example.invalid`, `${id}@example.invalid`, role].join('\t');
function reportText(day = '10/29/26') {
  return [
    '1. الملخص', 'عنوان الاجتماع\tحصة اصطناعية', `وقت بدء الاجتماع\t${day}, 8:00 AM`,
    `وقت انتهاء الاجتماع\t${day}, 8:45 AM`, '', '2. المشاركون',
    'الاسم\tوقت الانضمام الأول\tوقت المغادرة الأخير\tمدة الاجتماع\tالبريد الإلكتروني\tمعرّف المشارك (UPN)\tالدور',
    participant('معلم افتراضي', 'teacher', '45m', 'منظم'),
    participant('أحمد تجريبي', 'fake-a'), participant('سالم افتراضي', 'fake-b', '10s'),
    participant('اسم مشترك', 'fake-c'), participant('زائر تجريبي', 'fake-d'),
    participant('أحمد تجريبي', 'fake-a'),
    '3. الأنشطة داخل الاجتماع', 'الاسم\tوقت الانضمام\tوقت المغادرة',
    'أحمد تجريبي\t8:00\t8:05', 'أحمد تجريبي\t8:06\t8:12',
  ].join('\r\n');
}
const encoded = (text, encoding = 'utf16le') => encoding === 'utf16le'
  ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, encoding)]) : Buffer.from(text, 'utf8');
const roster = [
  { id:'a', name:'احمد تجريبي' }, { id:'b', name:'سالم افتراضي' },
  { id:'c', name:'اسم مشترك' }, { id:'d', name:'اسم مشترك' },
];

test('n143_utf16le_tab_sections_dedup_organizer_and_duration', () => {
  const parsed = parseTeamsAttendance(encoded(reportText()));
  assert.equal(parsed.reportDate, '2026-10-29');
  assert.equal(parsed.participants.length, 4);
  assert.equal(parsed.organizerIgnored, 1);
  assert.equal(parsed.duplicates, 1);
  assert.deepEqual(parsed.participants.map(p => p.seconds), [723, 10, 723, 723]);
  assert.deepEqual(parseTeamsAttendance(encoded(reportText(), 'utf8')), parsed);
  assert.equal(JSON.stringify(parsed).includes('@'), false);
  const quoted = reportText().replaceAll('زائر تجريبي', '"زائر\tتجريبي ""صناعي"""');
  assert.equal(parseTeamsAttendance(encoded(quoted)).participants.at(-1).name, 'زائر\tتجريبي "صناعي"');
  for (const [value, seconds] of [['1h 2m 3s',3723],['1 ساعة 2 دقيقة 3 ثانية',3723],['00:00:10',10],['unknown',null]]) assert.equal(durationSeconds(value),seconds);
  assert.throws(() => parseTeamsAttendance(new Uint8Array(1024 * 1024 + 1)));
  assert.throws(() => parseTeamsAttendance(encoded(reportText() + '\n'.repeat(301))));
  assert.throws(() => parseTeamsAttendance(encoded(reportText().replace('أحمد تجريبي', '"bad'))));
  assert.equal(parseTeamsAttendance(encoded(reportText('02/30/26'))).reportDate, null);
});

test('n143_unique_owner_roster_matching_preview_unmatched_and_short_duration', () => {
  const parsed = parseTeamsAttendance(encoded(reportText()));
  const rows = matchTeamsAttendance(parsed, [...roster, roster[0]]);
  assert.deepEqual(rows.map(r => r.state), ['matched','matched','ambiguous','unmatched']);
  assert.deepEqual(rows.map(r => r.short), [false,true,false,false]);
  assert.equal(matchTeamsAttendance(parsed, roster, 0)[1].short, false);
  const aliases = matchTeamsAttendance({...parsed,participants:[...parsed.participants,{name:'احمد تجريبي',seconds:10}]},roster);
  assert.equal(aliases.at(-1).state,'duplicate');
  assert.equal(aliases.at(-1).studentId,null);
  assert.equal(matchTeamsAttendance(parsed,[{id:'x',name:'احمد تجريبي آخر'}])[0].state,'unmatched');
});

test('n143_user_confirmed_existing_session_only_unmarked_present_no_absence', {timeout:120000}, async () => {
  const url = 'http://127.0.0.1:53143';
  const server = await createServer({server:{host:'127.0.0.1',port:53143,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({
      taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n143-teams-attendance-csv-20261029.json',
      runId:process.env.RAKEEZ_RUN_ID || '7328bc2d-1454-486c-a479-e0b6d57bb139',url,timeoutMs:110000,
    }, async ({createContext}) => {
      const context = await createContext({viewport:{width:360,height:800},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page = await context.newPage(), errors = [], uploads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.method()); });
      await page.clock.setFixedTime(new Date('2026-10-29T09:00:00+03:00'));
      await openReadyServedDemo(page,url);
      await page.evaluate(async students => {
        const s = await import('/src/store.js');
        if (s.getActiveWorkspace()?.type !== 'demo') throw Error('SYNTHETIC_ONLY');
        const section = await s.createSection({grade:5,label:'143'});
        await s.save({
          subjects:[{id:'n143-sub',name:'استيراد اصطناعي'}],
          teachings:[{id:'n143-t',sectionId:section.id,subjectId:'n143-sub',termId:s.activeTerm().id}],
          students:[...students,{id:'missing',name:'طالب خارج التقرير',status:'active'}],
          enrollments:[...students,{id:'missing'}].map((student,i) => ({id:`n143-e${i}`,studentId:student.id,sectionId:section.id,status:'active',rollNo:i+1})),
          sessions:[1,2,3,4,5].map(period => ({id:`n143-s${period}`,teachingId:'n143-t',date:'2026-10-29',period,startTime:'08:00',endTime:'08:45',status:'scheduled'})),
        });
        await s.setAttendance('n143-s1','a','late');
      },roster.map(s => ({...s,status:'active'})));
      const records = session => page.evaluate(async session => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        return {memory:s.attendanceIn(session),disk:(await db.getAll('attendance')).filter(r => r.sessionId === session && !r.deleted)};
      },session);
      const open = async (session, text = reportText()) => {
        await page.goto(`${url}/#/teaching/n143-t/attendance?session=${session}`);
        await expect(page.locator('.att-row')).toHaveCount(5);
        await page.locator('[data-act="import-teams"]').click();
        await page.locator('[data-teams-file]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:encoded(text)});
        await expect(page.locator('[data-teams-preview]')).toContainText('وُجد 4');
      };
      const close = () => page.locator('[data-sheet-close]').last().click();
      const apply = () => page.locator('[data-teams-apply]');
      const preview = () => page.locator('[data-teams-preview]');
      const switchSession = session => page.evaluate(async session => {
        const view = (await import('/src/views/attendance.js')).default;
        await view.actions['pick-session']({dataset:{id:session}},null,{id:'n143-t'});
      },session);
      // Render real preview, retain marked rows, offer short participation, no writes before confirmation.
      await open('n143-s1');
      const before = await records('n143-s1');
      await expect(preview()).toContainText('غير مطابق 1 · ملتبس 1 · مشاركة قصيرة 1 · منظم مستبعد 1');
      await expect(page.locator('[data-teams-row="0"]')).toBeDisabled();
      await expect(page.locator('[data-teams-row="1"]')).toBeChecked();
      assert.deepEqual(await records('n143-s1'),before);
      await page.locator('[data-teams-short]').fill('0');
      await page.locator('[data-teams-short]').dispatchEvent('change');
      await expect(preview()).toContainText('مشاركة قصيرة 0');
      await page.locator('[data-teams-short]').fill('5');
      await page.locator('[data-teams-short]').dispatchEvent('change');
      await page.locator('[data-teams-row="1"]').uncheck();
      await apply().click();
      assert.deepEqual(await records('n143-s1'),before);
      await page.locator('[data-teams-row="1"]').check();
      const geometry = await page.getByRole('dialog').evaluate(el => {
        const r = el.getBoundingClientRect();
        return {fits:r.left >= -1 && r.right <= innerWidth + 1,styled:getComputedStyle(el).position,overflow:document.documentElement.scrollWidth > innerWidth};
      });
      assert.equal(geometry.fits,true); assert.equal(geometry.overflow,false);
      console.log('N143 actual 360px preview geometry:', JSON.stringify(geometry));
      await apply().click();
      await expect(preview()).toContainText('تأكد رصد 1 حاضرًا');
      const after = await records('n143-s1');
      assert.deepEqual(after.memory.find(r => r.studentId === 'a'),before.memory[0]);
      assert.deepEqual(after.disk.find(r => r.studentId === 'a'),before.disk[0]);
      assert.equal(after.memory.find(r => r.studentId === 'b').status,'present');
      assert.equal(after.memory.length,2); assert.equal(after.disk.length,2);
      await close();
      // Original anchored choices survive the adjacent import control.
      await page.locator('[data-act="fill-remaining"]').click();
      await expect(page.locator('#attendance-fill-choices')).toBeVisible();
      await page.keyboard.press('Escape');
      // Wrong date cannot apply; cancellation and session switch never write.
      await open('n143-s2', reportText('10/28/26'));
      await expect(preview()).toContainText('اختلاف التاريخ');
      await expect(apply()).toBeDisabled();
      assert.equal((await records('n143-s2')).memory.length,0);
      await close();
      await open('n143-s2'); await close();
      assert.equal((await records('n143-s2')).memory.length,0);
      await open('n143-s2');
      await switchSession('n143-s3'); await apply().click();
      await expect(preview()).toContainText('تأكد رصد 0 حاضرًا');
      assert.equal((await records('n143-s2')).memory.length,0);
      assert.equal((await records('n143-s3')).memory.length,0);
      await close();
      // Concurrent marking is preserved when teacher confirms an older preview.
      await open('n143-s3');
      await page.evaluate(async () => (await import('/src/store.js')).setAttendance('n143-s3','a','excused'));
      await apply().click();
      await expect(preview()).toContainText('تأكد رصد 1 حاضرًا · مرصود سابقًا 1');
      assert.equal((await records('n143-s3')).memory.find(r => r.studentId === 'a').status,'excused');
      await close();
      // Genuine store access failure after one successful record: stop, report partial, no replay.
      await open('n143-s4');
      await page.evaluate(async () => {
        const s = await import('/src/store.js');
        window.n143Unsubscribe = s.subscribe(() => {
          if (s.attendanceIn('n143-s4').length) s.setCloudRestoreInProgress(true);
        });
      });
      await apply().click();
      await expect(preview()).toContainText('توقف الرصد');
      assert.equal((await records('n143-s4')).memory.length,1);
      await expect(apply()).toBeDisabled();
      await page.evaluate(async () => { window.n143Unsubscribe(); delete window.n143Unsubscribe; (await import('/src/store.js')).setCloudRestoreInProgress(false); });
      await close();
      // Synthetic owner change in same DB; real UI and existing access guard reject it.
      await open('n143-s5');
      await page.evaluate(async () => {
        const s = await import('/src/store.js');
        window.n143DemoWorkspace = s.getActiveWorkspace();
        s.activateWorkspace({...s.getActiveWorkspace(),type:'account',authUserId:'n143-synthetic-other-owner'});
        let denied = false;
        try { s.assertClassOperationsAccess('n143-t'); } catch { denied = true; }
        if (!denied) throw Error('OWNER_GUARD_NOT_EXERCISED');
      });
      await apply().click();
      await expect(preview()).toContainText('تأكد رصد 0 حاضرًا');
      assert.equal((await records('n143-s5')).memory.length,0);
      assert.equal((await records('n143-s5')).disk.length,0);
      await close();
      await page.evaluate(async () => {
        (await import('/src/store.js')).activateWorkspace(window.n143DemoWorkspace);
        delete window.n143DemoWorkspace;
      });
      // No raw report identities in any durable application table or Web Storage.
      const leaked = await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        const database = await db.openDB(), all = [];
        for (const name of database.objectStoreNames) all.push(await db.getAll(name));
        return JSON.stringify([all,{...localStorage},{...sessionStorage}]).includes('@example.invalid');
      });
      assert.equal(leaked,false);
      assert.deepEqual(uploads,[]); assert.deepEqual(errors,[]);
      // Same event-loop race, with a native write still in flight at confirmation.
      // This must preserve the competing mark inside the store transaction too.
      await open('n143-s5');
      await page.evaluate(async () => {
        const s = await import('/src/store.js');
        const marking = s.setAttendance('n143-s5','a','excused');
        document.querySelector('[data-teams-apply]').click();
        await marking;
      });
      await expect(preview()).toContainText('اكتمل رصد');
      const raced = await records('n143-s5');
      assert.equal(raced.memory.find(r => r.studentId === 'a').status,'excused', 'in-flight existing attendance must never be overwritten');
      assert.equal(raced.disk.find(r => r.studentId === 'a').status,'excused');
      const repeated = await page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        const before = await db.getAll('attendance');
        const outcome = await s.fillSelectedAttendance('n143-s5',['a','b','b']);
        return {outcome,before,after:await db.getAll('attendance'),outbox:await db.getAll('outbox')};
      });
      assert.deepEqual(repeated.outcome,{saved:0,skipped:2});
      assert.deepEqual(repeated.after,repeated.before);
      assert.equal(repeated.outbox.length,0);
      await close();
      // Unresolved pre-snapshot history is rejected; never use legacy save().
      const legacy = await page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        await s.setAttendance('n143-s2','a','absent');
        const old = s.attendanceIn('n143-s2')[0];
        await db.remove('sessionRosterSnapshots',s.sessionRosterSnapshotId('n143-s2'));
        s.state.sessionRosterSnapshots = s.state.sessionRosterSnapshots.filter(r => r.sessionId !== 'n143-s2');
        let rejected = false;
        try { await s.fillSelectedAttendance('n143-s2',['a','b']); } catch { rejected = true; }
        return {rejected,old,records:s.attendanceIn('n143-s2'),snapshot:s.sessionRosterSnapshot('n143-s2')};
      });
      assert.equal(legacy.snapshot,null);
      assert.deepEqual(legacy.records.find(r => r.studentId === 'a'),legacy.old);
      assert.equal(legacy.records.some(r => r.studentId === 'b'),false);
      assert.equal(legacy.rejected,true);
      const unsupported = await page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        const workspace = s.getActiveWorkspace(), before = await db.getAll('attendance');
        try {
          s.activateWorkspace({...workspace,type:'legacy'});
          let code;
          try { await s.fillSelectedAttendance('n143-s2',['b']); } catch (error) { code = error.message; }
          return {code,before,after:await db.getAll('attendance'),outbox:await db.getAll('outbox')};
        } finally { s.activateWorkspace(workspace); }
      });
      assert.equal(unsupported.code,'TEAMS_SELECTED_SYNC_UNAVAILABLE');
      assert.deepEqual(unsupported.before,unsupported.after);
      assert.equal(unsupported.outbox.length,0);
    });
  } finally { await server.close(); }
});

test('n143_atomic_selected_fill_and_repeated_sync_no_overwrite', {timeout:120000}, async () => {
  // Real existing engine and PostgreSQL fixture, never a service connection.
  await import('fake-indexeddb/auto');
  const db = await import('../src/lib/db.js');
  const {createSyncV2Engine} = await import('../src/lib/sync-v2.js');
  db.selectDatabase('rakeezx-demo');
  const server = await createN143AttendanceServer();
  let lose = true, clock = 1800000000000;
  try {
    const engine = createSyncV2Engine({ database:db,now:()=>++clock,
      transport:{fetchRecords:entity=>server.fetchRecords(entity),applyFillAttendanceCommand:async envelope=>{
        const receipt = await server.applyFillAttendanceCommand(envelope);
        if (lose) { lose = false; throw Error('synthetic lost receipt'); }
        return receipt;
      }},
    });
    await engine.pullAll({stores:['students','sessions']});
    await server.applyAttendanceCommand({mutationId:'n143-competing',deviceId:'n143-device',
      attendanceId:'att:override-a:override-session',sessionId:'override-session',studentId:'override-a',
      baseRevision:0,patch:{status:'excused'},clientUpdatedAt:++clock});
    await engine.queueFillAttendanceCommand({sessionId:'override-session',status:'present',studentIds:['override-b']});
    const queued = (await db.getAll('outbox'))[0];
    assert.deepEqual(queued.patch.studentIds,['override-b']);
    const first = await engine.dispatchPending();
    assert.equal(first.failed,1);
    assert.equal((await db.getAll('outbox'))[0].mutationId,queued.mutationId);
    clock += 120000;
    const retried = await engine.dispatchPending();
    assert.equal(retried.acknowledged,1);
    assert.equal((await db.getAll('outbox')).length,0);
    const calls = server.calls.filter(c=>c.mutationId===queued.mutationId);
    assert.equal(calls.length,2);
    assert.deepEqual(calls[0],calls[1]);
    const remote = await server.fetchRecords('attendance');
    assert.equal(remote.find(r=>r.student_id==='override-a').status,'excused');
    console.log('N143 selected Sync diagnostic:',JSON.stringify({requested:queued.patch.studentIds,
      transported:calls[0].studentIds ?? null,remote:remote.map(r=>r.student_id).sort(),repeatedIdentity:true}));
    assert.equal(remote.some(r=>r.student_id==='override-c'),false,
      'selected receipt must not mark an unselected student; current transport/RPC fills the whole roster');
  } finally {
    await server.close();
    (await db.openDB()).close();
  }
});

// Narrow SQL fixture: the unchanged attendance RPC and its declared migrations.
// The generic all-migrations helper fails before this gate on an unrelated N58
// prerequisite (n58_guard_calendar_contract). Keep that original setup failure;
// reproduce THIS protocol against its real SQL, without changing any SQL guard.
async function createN143AttendanceServer() {
  const {PGlite} = await import('@electric-sql/pglite');
  const {installRealtimeFixture} = await import('./helpers/realtime-server-fixture.mjs');
  const pg = new PGlite(), calls = [];
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('11111111-1111-4111-8111-111111111111');
      create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;`);
    await installRealtimeFixture(pg);
    const directory = new URL('../supabase/migrations/',import.meta.url);
    for (const name of (await readdir(directory)).sort().filter(n=>/^\d.*\.sql$/.test(n) && Number(n.slice(0,4)) <= 17)) {
      await pg.exec((await readFile(new URL(name,directory),'utf8')).replace(/^\uFEFF/,''));
    }
    await pg.exec(`insert into rakeezx.profile(owner_id) values (auth.uid());
      insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values ('override-year','اختبار',1450,1451,'active');
      insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values ('override-term','override-year','اختبار',1,'active','2026-08-01','2026-10-01');
      insert into rakeezx.subjects(id,name,slug) values ('override-subject','اختبار','override-subject');
      insert into rakeezx.sections(id,year_id,grade,label,name) values ('override-section','override-year',4,'اختبار','اختبار');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id) values ('override-teaching','override-section','override-subject','override-term');
      insert into rakeezx.students(id,name,status) values ('override-a','طالب اصطناعي أ','active'),('override-b','طالب اصطناعي ب','active'),('override-c','طالب اصطناعي ج','active');
      insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,start_date) values
        ('en-a','override-a','override-section',1,'active','2026-08-01'),('en-b','override-b','override-section',2,'active','2026-08-01'),('en-c','override-c','override-section',3,'active','2026-08-01');
      insert into rakeezx.sessions(id,teaching_id,date,period,status) values ('override-session','override-teaching','2026-09-06',1,'scheduled');`);
    return {calls,close:()=>pg.close(),fetchRecords:async entity=>{
      if (!['students','sessions','attendance'].includes(entity)) return [];
      return (await pg.query(`select to_jsonb(t) as record from rakeezx.${entity} t where owner_id=auth.uid()`)).rows.map(r=>r.record);
    },applyFillAttendanceCommand:async e=>{
      calls.push(structuredClone(e));
      return (await pg.query('select rakeezx.apply_sync_v2_fill_attendance_command($1,$2,$3,$4,$5) as result',
        [e.mutationId,e.deviceId,e.sessionId,e.status,e.clientUpdatedAt])).rows[0].result;
    },applyAttendanceCommand:async e=>{
      return (await pg.query('select rakeezx.apply_sync_v2_attendance_command($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as result',
        [e.mutationId,e.deviceId,e.attendanceId,e.sessionId,e.studentId,e.baseRevision,JSON.stringify(e.patch),e.clientUpdatedAt])).rows[0].result;
    }};
  } catch (error) { await pg.close(); throw error; }
}

test('n143_offline_parser_dependency_in_shell', async () => {
  // Execute the actual SW install and offline-fetch handlers in a cache harness.
  // This checks the changed shell only, not browser SW lifecycle certification.
  const source = await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const parser = await readFile(new URL('../src/lib/teams-attendance-csv.js',import.meta.url),'utf8');
  const origin = 'https://synthetic.invalid', handlers = new Map(), entries = new Map();
  const cacheNames = new Map(), requested = [];
  const key = r => new URL(typeof r === 'string' ? r : r.url,origin+'/').href;
  const caches = {keys:async()=>[...cacheNames.keys()],delete:async n=>cacheNames.delete(n),open:async name=>{
    if (!cacheNames.has(name)) cacheNames.set(name,{
      add:async request=>{ requested.push(key(request)); entries.set(key(request),new Response(key(request).endsWith('/src/lib/teams-attendance-csv.js') ? parser : 'synthetic shell resource')); },
      put:async(request,response)=>entries.set(key(request),response),match:async request=>entries.get(key(request))?.clone(),
    });
    return cacheNames.get(name);
  }};
  class RelativeRequest extends Request { constructor(url,options){super(key(url),options);} }
  runInNewContext(source,{self:{location:{origin},skipWaiting(){},addEventListener:(name,fn)=>handlers.set(name,fn)},
    caches,URL,Request:RelativeRequest,Response,console,fetch:async()=>{throw Error('synthetic offline');},setTimeout,clearTimeout});
  let installed;
  handlers.get('install')({waitUntil:work=>{installed=work;}});
  await installed;
  assert.ok(cacheNames.has('rakeezx-v98'));
  assert.equal(requested.filter(url=>url===origin+'/src/lib/teams-attendance-csv.js').length,1);
  assert.ok(requested.includes(origin+'/src/models.js'));
  let served;
  handlers.get('fetch')({request:new RelativeRequest('/src/lib/teams-attendance-csv.js'),respondWith:work=>{served=work;}});
  const response = await served;
  assert.equal(response.status,200);
  assert.equal(await response.text(),parser);
});
