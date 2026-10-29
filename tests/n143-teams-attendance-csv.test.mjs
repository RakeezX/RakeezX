// AI N143: generated identities only; never load a real Teams report.
import test from 'node:test';
import assert from 'node:assert/strict';
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
      runId:process.env.RAKEEZ_RUN_ID || '22eb3123-0d81-419f-a67b-f4bedcbdd68b',url,timeoutMs:110000,
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
    });
  } finally { await server.close(); }
});
