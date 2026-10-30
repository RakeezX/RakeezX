// AI N143: generated identities only; never load a real Teams report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { parseTeamsAttendance, matchTeamsAttendance, durationSeconds } from '../src/lib/teams-attendance-csv.js';
import {withIsolatedLocalBrowser} from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {createN143AttendanceServer} from './n143-selected-attendance-command.test.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const participant = (name, id, first = '8:00 AM', last = '8:40 AM', duration = '40m', role = 'مشارك') =>
  [name, `10/29/26, ${first}`, `10/29/26, ${last}`, duration, `${id}@example.invalid`, `${id}@example.invalid`, role].join('\t');
const roster = [
  {id:'a',name:'احمد تجريبي'}, {id:'b',name:'سالم افتراضي'}, {id:'p',name:'بدر تجريبي'},
  {id:'l',name:'ناصر تجريبي'}, {id:'e',name:'خالد تجريبي'}, {id:'r',name:'رائد مشترك'},
  {id:'c',name:'اسم مشترك'}, {id:'d',name:'اسم مشترك'}, {id:'bad',name:'توقيت ناقص'},
];
const session = {date:'2026-10-29',startTime:'08:00',endTime:'08:40'};
function reportText(day = '10/29/26') {
  return ['1. الملخص', `وقت بدء الاجتماع\t${day}, 7:00 AM`, '', '2. المشاركون',
    'الاسم\tوقت الانضمام الأول\tوقت المغادرة الأخير\tمدة الاجتماع\tالبريد الإلكتروني\tمعرّف المشارك (UPN)\tالدور',
    participant('معلم افتراضي','teacher','7:00 AM','8:40 AM','100m','منظم'),
    participant('أحمد تجريبي','fake-a'), participant('سالم افتراضي','fake-b','8:00 AM','8:10 AM','10m'),
    participant('بدر تجريبي','fake-p','8:05 AM','8:25 AM','20m'),
    participant('ناصر تجريبي','fake-l','8:05:01 AM','8:40 AM','34m 59s'),
    participant('خالد تجريبي','fake-e','7:00 AM','8:40 AM','100m'),
    participant('رائد مشترك','fake-r1'), participant('رائد مشترك','fake-r2'),
    participant('اسم مشترك','fake-c'), participant('زائر تجريبي','fake-z'),
    participant('توقيت ناقص','fake-bad','','','0s'), participant('أحمد تجريبي','fake-a'),
    '3. الأنشطة داخل الاجتماع', 'الاسم\tوقت الانضمام\tوقت المغادرة',
    'أحمد تجريبي\t7:55\t8:15', 'أحمد تجريبي\t8:10\t8:25', 'أحمد تجريبي\t8:30\t8:40',
  ].join('\r\n');
}
const encoded = (text, encoding = 'utf16le') => encoding === 'utf16le'
  ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, encoding)]) : Buffer.from(text, 'utf8');
const classify = text => matchTeamsAttendance(parseTeamsAttendance(encoded(text)), roster, session);

test('n143_interval_union_and_class_window_boundaries', () => {
  const text = reportText(), parsed = parseTeamsAttendance(encoded(text));
  assert.equal(parsed.reportDate,'2026-10-29');
  assert.equal(parsed.organizerIgnored,1); assert.equal(parsed.duplicates,1);
  assert.equal(JSON.stringify(parsed).includes('@'),false);
  assert.deepEqual(parseTeamsAttendance(encoded(text,'utf8')),parsed);
  const rows = classify(text);
  assert.deepEqual(rows.slice(0,5).map(r=>[r.studentId,r.status]),[
    ['a','present'],['b','absent'],['p','present'],['l','late'],['e','present'],
  ]);
  assert.deepEqual(rows.slice(5).map(r=>r.state),['ambiguous','ambiguous','ambiguous','unmatched','invalid']);
  // Union is 15 minutes (not 25) after clipping, strictly below half => absent.
  const overlaps = text.replace('7:55\t8:15','8:00\t8:10').replace('8:10\t8:25','8:05\t8:15').replace('8:30\t8:40','8:05\t8:15');
  assert.equal(classify(overlaps)[0].status,'absent');
  // Early meeting opening must not turn an 8:05 entry into late.
  assert.equal(rows[2].status,'present');
  assert.equal(classify(text.replace('8:25 AM\t20m','8:24:59 AM\t19m 59s'))[2].status,'absent');
  assert.equal(classify(text.replace('7:55\t8:15','invalid\t8:15'))[0].state,'invalid');
  assert.equal(classify(text.replace('7:55\t8:15','8:00Z\t8:15'))[0].state,'invalid');
  assert.equal(classify(text.replace('7:55\t8:15','10/28/26, 8:00 AM\t8:15'))[0].state,'invalid');
  assert.equal(classify(text.replace('8:05 AM\t10/29/26, 8:25 AM\t20m','8:05 AM\t10/29/26, 8:25 AM\t10m'))[2].state,'invalid');
  assert.throws(()=>classify(reportText('10/28/26')),/CLASS_WINDOW/);
  for (const change of [{startTime:''},{endTime:'08:00'},{endTime:'25:00'},{date:'2026-02-30'}])
    assert.throws(()=>matchTeamsAttendance(parsed,roster,{...session,...change}),/CLASS_WINDOW/);
  const earlyEntryThenRejoin = text.replace('7:55\t8:15','7:00\t7:10').replace('8:10\t8:25','8:06\t8:30');
  assert.equal(classify(earlyEntryThenRejoin)[0].status,'present');
  assert.deepEqual(classify(text.replaceAll('10/29/26, ', '2026-10-29T')),rows);
  const ambiguousActivity = text + '\r\nرائد مشترك\t8:00\t8:40';
  assert.equal(classify(ambiguousActivity).filter(r=>r.studentId==='r').length,0);
  // Distinct UPNs sharing a mailbox are still distinct people, hence ambiguous.
  const sharedEmail = text.replace('fake-r2@example.invalid\tfake-r2@example.invalid','fake-r1@example.invalid\tfake-r2@example.invalid');
  assert.equal(classify(sharedEmail).filter(r=>r.studentId==='r').length,0);
  // Unknown activity identities with a known display name cannot justify its fallback.
  const identifiedActivity = text.replace('الاسم\tوقت الانضمام\tوقت المغادرة', 'الاسم\tوقت الانضمام\tوقت المغادرة\tالبريد الإلكتروني')
    .replace('7:55\t8:15','7:55\t8:15\tfake-a@example.invalid')
    .replace('8:10\t8:25','8:10\t8:25\tfake-a@example.invalid')
    .replace('8:30\t8:40','8:30\t8:40\tfake-a@example.invalid');
  assert.equal(classify(identifiedActivity)[0].status,'present');
  assert.equal(classify(identifiedActivity + '\r\nبدر تجريبي\t8:00\t8:40\tunknown@example.invalid')[2].state,'invalid');
  const quoted=text.replace('زائر تجريبي','"زائر\tتجريبي ""صناعي"""');
  assert.equal(parseTeamsAttendance(encoded(quoted)).participants.at(-2).name.includes('صناعي'),true);
  const english=text.replace('1. الملخص','1. Summary').replace('2. المشاركون','2. Participants').replace('وقت بدء الاجتماع','Meeting start time')
    .replace('الاسم\tوقت الانضمام الأول\tوقت المغادرة الأخير\tمدة الاجتماع\tالبريد الإلكتروني\tمعرّف المشارك (UPN)\tالدور',
      'Name\tFirst Join\tLast Leave\tIn-Meeting Duration\tEmail\tParticipant ID (UPN)\tRole')
    .replace('الاسم\tوقت الانضمام\tوقت المغادرة','Name\tJoin Time\tLeave Time');
  assert.deepEqual(classify(english),rows);
  for (const [value,seconds] of [['1h 2m 3s',3723],['1 ساعة 2 دقيقة 3 ثانية',3723],['00:00:10',10],['unknown',null],['00:99',null]]) assert.equal(durationSeconds(value),seconds);
  assert.throws(()=>parseTeamsAttendance(new Uint8Array(1024*1024+1)));
  assert.throws(()=>parseTeamsAttendance(encoded(text.replace('أحمد تجريبي','"bad'))));
  assert.throws(()=>parseTeamsAttendance(encoded(text + ('\nأحمد تجريبي\t8:00\t8:40').repeat(301))));
});

test('n143_direct_import_statuses_and_untouched_students', {timeout:120000}, async () => {
  const url='http://127.0.0.1:53143';
  const server=await createServer({server:{host:'127.0.0.1',port:53143,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({
      taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n143-direct-attendance-rules-20261030.json',
      runId:'b5f58499-738c-49e8-8706-e5a7a0cdd818',url,timeoutMs:110000,
    },async({createContext})=>{
      const context=await createContext({viewport:{width:360,height:800},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-10-29T09:00:00+03:00'));
      await openReadyServedDemo(page,url);
      await page.evaluate(async students=>{
        const s=await import('/src/store.js');
        if(s.getActiveWorkspace()?.type!=='demo') throw Error('SYNTHETIC_ONLY');
        const section=await s.createSection({grade:5,label:'143'});
        const all=[...students,{id:'missing',name:'طالب خارج التقرير',status:'active'}];
        await s.save({subjects:[{id:'n143-sub',name:'استيراد اصطناعي'}],
          teachings:[{id:'n143-t',sectionId:section.id,subjectId:'n143-sub',termId:s.activeTerm().id}],
          students:all,enrollments:all.map((r,i)=>({id:`n143-e${i}`,studentId:r.id,sectionId:section.id,status:'active',rollNo:i+1})),
          sessions:[1,2,3,4,5,6,7,8].map(period=>({id:`n143-s${period}`,teachingId:'n143-t',date:'2026-10-29',period,startTime:period===7?'':'08:00',endTime:'08:40',status:'scheduled'})),
        });
        await s.setAttendance('n143-s1','a','late');
      },roster.map(r=>({...r,status:'active'})));
      const records=id=>page.evaluate(async id=>{
        const s=await import('/src/store.js'), db=await import('/src/lib/db.js');
        return {memory:s.attendanceIn(id),disk:(await db.getAll('attendance')).filter(r=>r.sessionId===id)};
      },id);
      const open=async id=>{
        await page.goto(`${url}/#/teaching/n143-t/attendance?session=${id}`);
        await expect(page.locator('.att-row')).toHaveCount(10);
        await page.locator('[data-act="import-teams"]').click();
        await expect(page.locator('[data-teams-apply], [data-teams-row], [data-teams-preview]')).toHaveCount(0);
      };
      const choose=(text=reportText())=>page.locator('[data-teams-file]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:encoded(text)});
      const summary=()=>page.locator('[data-teams-result]');
      const close=()=>page.locator('[data-sheet-close]').last().click();
      await open('n143-s1');
      const before=await records('n143-s1');
      // Cancel file selection is a no-op.
      await page.locator('[data-teams-file]').setInputFiles([]);
      assert.deepEqual(await records('n143-s1'),before);
      await choose(); await expect(summary()).toContainText('حاضر 2 · متأخر 1 · غائب 1');
      const after=await records('n143-s1');
      assert.deepEqual(after.disk.find(r=>r.studentId==='a'),before.disk[0]);
      assert.deepEqual(after.memory.find(r=>r.studentId==='a'),before.memory[0]);
      assert.deepEqual(after.memory.map(r=>[r.studentId,r.status]).sort(),[['a','late'],['b','absent'],['e','present'],['l','late'],['p','present']]);
      await expect(page.locator('[data-teams-file]')).toBeDisabled();
      const geometry=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {fits:r.left>=-1&&r.right<=innerWidth+1,overflow:document.documentElement.scrollWidth>innerWidth,position:getComputedStyle(el).position};});
      assert.equal(geometry.fits,true);assert.equal(geometry.overflow,false);
      console.log('N143 actual direct-import mobile DOM:',JSON.stringify(geometry));
      await close();
      await page.locator('[data-act="fill-remaining"]').click();
      await expect(page.locator('#attendance-fill-choices')).toBeVisible(); await page.keyboard.press('Escape');
      for(const [id,text] of [['n143-s2',reportText('10/28/26')],['n143-s7',reportText()]]) {
        await open(id);await choose(text);await expect(summary()).toContainText('تحقق من توقيت الحصة');
        assert.equal((await records(id)).disk.length,0);await close();
      }
      // A concurrent native mark is retained atomically during direct file selection.
      await open('n143-s3');
      await page.evaluate(()=>{ const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){
        const buffer=await original.call(this),s=await import('/src/store.js');
        window.n143Race=s.setAttendance('n143-s3','a','excused');File.prototype.arrayBuffer=original;return buffer;
      };});
      await choose();await expect(summary()).toContainText('اكتمل الرصد');
      await page.evaluate(async()=>{await window.n143Race;delete window.n143Race;});
      assert.equal((await records('n143-s3')).disk.find(r=>r.studentId==='a').status,'excused');await close();
      // Real store access failure after first successful write: no automatic replay.
      await open('n143-s4');
      await page.evaluate(async()=>{const s=await import('/src/store.js');window.n143Off=s.subscribe(()=>{if(s.attendanceIn('n143-s4').length)s.setCloudRestoreInProgress(true);});});
      await choose();await expect(summary()).toContainText('توقف الرصد');
      assert.equal((await records('n143-s4')).memory.length,1);
      await expect(summary()).toContainText('غير محفوظ 4');
      await page.evaluate(async()=>{window.n143Off();delete window.n143Off;(await import('/src/store.js')).setCloudRestoreInProgress(false);});await close();
      // Session changes after one commit halt the remaining writes.
      await open('n143-s5');
      await page.evaluate(async()=>{const s=await import('/src/store.js');window.n143Off=s.subscribe(()=>{
        if(s.attendanceIn('n143-s5').length){window.n143Off();import('/src/views/attendance.js').then(v=>v.default.actions['pick-session']({dataset:{id:'n143-s6'}},null,{id:'n143-t'}));}
      });});
      await choose();await expect(summary()).toContainText('توقف الرصد');
      assert.equal((await records('n143-s5')).disk.length,1);assert.equal((await records('n143-s6')).disk.length,0);await close();
      // Actual UI entry calls the ownership guard when a synthetic owner changes before file read finishes.
      await open('n143-s6');
      await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){
        const buffer=await original.call(this),s=await import('/src/store.js');
        window.n143Workspace=s.getActiveWorkspace();s.activateWorkspace({...s.getActiveWorkspace(),type:'account',authUserId:'synthetic-other'});
        let denied=false;try{s.assertClassOperationsAccess('n143-t');}catch{denied=true;}
        if(!denied)throw Error('OWNER_GUARD_NOT_EXERCISED');File.prototype.arrayBuffer=original;return buffer;
      };});
      await choose();await expect(summary()).toContainText('لم يُرصد شيء');assert.equal((await records('n143-s6')).disk.length,0);
      await page.evaluate(async()=>{(await import('/src/store.js')).activateWorkspace(window.n143Workspace);delete window.n143Workspace;});await close();
      // Repeated selected writes preserve tombstones and reject inactive membership.
      const guarded=await page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
        await s.setAttendance('n143-s8','a','excused');
        const mark=s.attendanceIn('n143-s8')[0];await db.put('attendance',{...mark,deleted:true});
        const outcome=await s.fillSelectedAttendance('n143-s8',['a'],{status:'absent'});
        const en=(await db.getAll('enrollments')).find(r=>r.studentId==='b');await db.put('enrollments',{...en,status:'withdrawn'});
        let denied=false;try{await s.fillSelectedAttendance('n143-s8',['b'],{status:'late'});}catch{denied=true;}
        return {outcome,deleted:(await db.get('attendance',mark.id)).deleted,denied};
      });
      assert.deepEqual(guarded,{outcome:{saved:0,skipped:1},deleted:true,denied:true});
      // Existing unresolved history must never use a legacy full-roster write.
      const legacy=await page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
        await s.setAttendance('n143-s8','p','present');
        await db.remove('sessionRosterSnapshots',s.sessionRosterSnapshotId('n143-s8'));
        s.state.sessionRosterSnapshots=s.state.sessionRosterSnapshots.filter(r=>r.sessionId!=='n143-s8');
        const before=await db.getAll('attendance');let denied=false;
        try{await s.fillSelectedAttendance('n143-s8',['l'],{status:'late'});}catch{denied=true;}
        return {denied,same:JSON.stringify(before)===JSON.stringify(await db.getAll('attendance')),snapshot:s.sessionRosterSnapshot('n143-s8')};
      });
      assert.deepEqual(legacy,{denied:true,same:true,snapshot:null});
      const leaked=await page.evaluate(async()=>{const db=await import('/src/lib/db.js'),database=await db.openDB(),all=[];
        for(const name of database.objectStoreNames)all.push(await db.getAll(name));
        return JSON.stringify([all,{...localStorage},{...sessionStorage}]).includes('@example.invalid');});
      assert.equal(leaked,false);assert.deepEqual(errors,[]);
    });
  }finally{await server.close();}
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
      transport:{fetchRecords:entity=>server.fetchRecords(entity),applySelectedAttendanceCommand:async envelope=>{
        const receipt = await server.applySelectedAttendanceCommand(envelope);
        if (lose) { lose = false; throw Error('synthetic lost receipt'); }
        return receipt;
      }},
    });
    await engine.pullAll({stores:['students','sessions']});
    await server.applyAttendanceCommand({mutationId:'n143-competing',deviceId:'n143-device',
      attendanceId:'att:override-a:override-session',sessionId:'override-session',studentId:'override-a',
      baseRevision:0,patch:{status:'excused'},clientUpdatedAt:++clock});
    await engine.queueSelectedAttendanceCommand({sessionId:'override-session',status:'present',studentIds:['override-b']});
    const queued = (await db.getAll('outbox'))[0];
    assert.deepEqual(queued.patch.studentIds,['override-b']);
    const first = await engine.dispatchPending();
    assert.equal(first.failed,1);
    assert.equal((await db.getAll('outbox'))[0].mutationId,queued.mutationId);
    clock += 120000;
    db.closeDB(); // Restart the actual durable client before retrying its locked envelope.
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
    await engine.queueSelectedAttendanceCommand({sessionId:'override-session',status:'present',studentIds:['override-c']});
    let fallbackCalls=0;
    const unavailable=createSyncV2Engine({database:db,transport:{applyFillAttendanceCommand:async()=>{fallbackCalls++;}}});
    const blocked=await unavailable.dispatchPending();
    assert.equal(blocked.blocked,1);
    assert.equal(fallbackCalls,0);
    assert.equal((await db.getAll('outbox')).length,1);
    assert.equal((await server.fetchRecords('attendance')).some(r=>r.student_id==='override-c'),false);
  } finally {
    await server.close();
    db.closeDB();
  }
});

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
  assert.ok(cacheNames.has('rakeezx-v99'));
  assert.equal(requested.filter(url=>url===origin+'/src/lib/teams-attendance-csv.js').length,1);
  assert.ok(requested.includes(origin+'/src/models.js'));
  assert.ok(requested.includes(origin+'/src/lib/rakeez-datetime-values.js'));
  let served;
  handlers.get('fetch')({request:new RelativeRequest('/src/lib/teams-attendance-csv.js'),respondWith:work=>{served=work;}});
  const response = await served;
  assert.equal(response.status,200);
  assert.equal(await response.text(),parser);
});
