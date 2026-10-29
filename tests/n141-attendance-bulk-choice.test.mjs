// AI N141: actual application DOM, handlers, CSS and native store; synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test('N141 affected attendance choice checks', {timeout:120000}, async t => {
  const url = 'http://127.0.0.1:53141';
  const server = await createServer({server:{host:'127.0.0.1',port:53141,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({
      taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n141-bulk-attendance-present-absent-20261029.json',
      runId:process.env.RAKEEZ_RUN_ID || '20556b38-3159-4b84-a46c-d7e872370e6f', url, timeoutMs:110000,
    }, async ({createContext}) => {
      const context = await createContext({viewport:{width:320,height:800},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-29T09:00:00+03:00'));
      await openReadyServedDemo(page,url);
      await page.evaluate(async () => {
        const s = await import('/src/store.js');
        if (s.getActiveWorkspace()?.type !== 'demo') throw Error('SYNTHETIC_DEMO_ONLY');
        const section = await s.createSection({grade:5,label:'141'});
        const students = Array.from({length:7},(_,i) => ({id:`n141-st${i}`,name:`طالب اختبار ${i}`,status:'active'}));
        await s.save({
          subjects:[{id:'n141-subject',name:'اختبار رصد الباقين'}],
          teachings:[{id:'n141-t',sectionId:section.id,subjectId:'n141-subject',termId:s.activeTerm().id}],
          students,
          enrollments:students.map((student,i) => ({id:`n141-en${i}`,studentId:student.id,sectionId:section.id,status:'active',rollNo:i+1})),
          sessions:[1,2,3,4].map(period => ({id:`n141-s${period}`,teachingId:'n141-t',date:period < 3 ? '2026-10-28' : '2026-10-29',period,startTime:'15:00',endTime:'15:45',status:'scheduled'})),
        });
        for (const session of [1,2,3,4]) {
          for (const [i,status] of ['present','absent','late','excused'].entries()) {
            await s.setAttendance(`n141-s${session}`,`n141-st${i}`,status);
          }
        }
      });
      const open = async session => {
        await page.goto(`${url}/#/teaching/n141-t/attendance?session=n141-s${session}`);
        await expect(page.locator('.att-row')).toHaveCount(7);
      };
      const records = session => page.evaluate(async session => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        return {memory:s.attendanceIn(`n141-s${session}`),disk:(await db.getAll('attendance')).filter(r => r.sessionId === `n141-s${session}` && !r.deleted)};
      },session);
      const bulk = () => page.locator('[data-act="fill-remaining"]');
      const choose = status => page.locator(`[data-attendance-choice="${status}"]`).click();
      const switchSession = session => page.evaluate(async session => {
        const view = (await import('/src/views/attendance.js')).default;
        await view.actions['pick-session']({dataset:{id:`n141-s${session}`}},null,{id:'n141-t'});
      },session);
      const geometry = async selector => {
        assert.deepEqual(await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect();
          return {fits:r.left >= -1 && r.right <= innerWidth+1,visible:r.height >= 40};
        })), selector.includes('choice') ? [{fits:true,visible:true},{fits:true,visible:true}] : [{fits:true,visible:true}]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      };

      await t.test('both statuses preserve existing records, concurrent marking and full-roster scope', async () => {
        for (const [session,status] of [[1,'present'],[2,'absent']]) {
          await open(session);
          const before = await records(session);
          assert.equal(before.memory.length,4);
          await page.locator('[data-input="search"]').fill('اختبار 5');
          await expect(page.locator('.att-row')).toHaveCount(1);
          await expect(bulk()).toHaveText('رصد الباقين (3) ▾');
          await geometry('[data-act="fill-remaining"]');
          await bulk().click();
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await expect(page.getByRole('dialog')).toContainText('هؤلاء الطلاب غير المرصودين فقط.');
          await expect(page.getByRole('dialog')).toContainText('حتى خارج نتائج البحث');
          await expect(page.locator('[data-attendance-choice]')).toHaveText(['✓ حاضرين (3)','× غائبين (3)']);
          await geometry('[data-attendance-choice]');
          // Race an asynchronous native write with the deliberate bulk click.
          await page.evaluate(async ({session,status}) => {
            const s = await import('/src/store.js');
            const marking = s.setAttendance(`n141-s${session}`,'n141-st4','late');
            document.querySelector(`[data-attendance-choice="${status}"]`).click();
            await marking;
          },{session,status});
          await expect(bulk()).toHaveCount(0);
          const after = await records(session);
          assert.equal(after.memory.length,7);
          for (const old of before.memory) assert.deepEqual(after.memory.find(r => r.id === old.id),old);
          for (const old of before.disk) assert.deepEqual(after.disk.find(r => r.id === old.id),old);
          assert.equal(after.memory.find(r => r.studentId === 'n141-st4').status,'late');
          for (const id of ['n141-st5','n141-st6']) {
            assert.equal(after.memory.find(r => r.studentId === id).status,status);
            assert.equal(after.disk.find(r => r.studentId === id).status,status);
          }
        }
      });

      await t.test('choice cancel, status-aware prestart cancel/confirm and session-switch guards', async () => {
        for (const [session,status,label] of [[3,'present','حاضرين'],[4,'absent','غائبين']]) {
          await open(session);
          const before = await records(session);
          await bulk().click();
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
          assert.deepEqual(await records(session),before);
          await expect(bulk()).toBeFocused();

          await bulk().click();
          await choose(status);
          await expect(page.getByRole('dialog')).toContainText(`في الحصة ${label} الآن؟`);
          await page.getByRole('button',{name:'إلغاء',exact:true}).click();
          assert.deepEqual(await records(session),before);

          // A context change while the choice sheet is suspended must cancel the write.
          await bulk().click();
          await switchSession(session === 3 ? 4 : 3);
          await choose(status);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          assert.deepEqual(await records(session),before);
          await switchSession(session);

          // The same guard must hold after waiting for the prestart confirmation.
          await bulk().click();
          await choose(status);
          await switchSession(session === 3 ? 4 : 3);
          await page.locator('[data-confirm-attendance]').click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          assert.deepEqual(await records(session),before);
          await switchSession(session);
          await bulk().click();
          await choose(status);
          await page.getByRole('button',{name:`نعم، رصدهم ${label}`,exact:true}).click();
          await expect(bulk()).toHaveCount(0);
          const after = await records(session);
          assert.equal(after.memory.length,7);
          for (const old of before.memory) assert.deepEqual(after.memory.find(r => r.id === old.id),old);
          for (const id of ['n141-st4','n141-st5','n141-st6']) assert.equal(after.memory.find(r => r.studentId === id).status,status);
        }
      });
      assert.deepEqual(errors,[]);
    });
  } finally {
    await server.close();
  }
});
