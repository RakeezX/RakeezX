// AI N138: real application DOM/handlers/CSS on an owned synthetic loopback server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test('N138 focused actual-app sorting regression', {timeout:120000}, async t => {
  const url='http://127.0.0.1:53138';
  const server=await createServer({server:{host:'127.0.0.1',port:53138,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({
      taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n138-grade-total-sort-20261029.json',
      runId:process.env.RAKEEZ_RUN_ID||'45ffb2db-083a-4892-94a7-713782ea4d4b',url,timeoutMs:110000,
    }, async ({createContext}) => {
      const context=await createContext({viewport:{width:1280,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();
      await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
      await openReadyServedDemo(page,url);
      const fixture=await page.evaluate(async()=>{
        const s=await import('/src/store.js'), m=await import('/src/models.js');
        if(s.getActiveWorkspace()?.type!=='demo')throw Error('DEMO_ONLY');
        const section=await s.createSection({grade:5,label:'138'});
        const subjects=[{id:'n138-subject-a',name:'N138 Mathematics'},{id:'n138-subject-b',name:'N138 Science'}];
        const teaching=['n138-main','n138-other'].map((id,index)=>({id,sectionId:section.id,subjectId:subjects[index].id,termId:s.activeTerm().id,order:index}));
        const letters=['A','B','C','Z','U','V'];
        const students=letters.map(letter=>({id:'n138-'+letter,name:'N138 '+letter,status:'active'}));
        const enrollments=students.map((student,index)=>({id:'n138-e'+index,studentId:student.id,sectionId:section.id,status:'active',rollNo:index+1}));
        const items=[10,90,1,1,1,1].map((max,index)=>({id:'n138-i'+index,teachingId:'n138-main',name:'N138 item '+index,max,order:index}));
        items.push({id:'n138-independent',teachingId:'n138-other',name:'Independent subject',max:10,order:0});
        const scores=[['A',0,10],['B',0,0],['B',1,80],['C',0,10],['Z',0,0]].map(([letter,index,value],i)=>({id:'n138-score'+i,studentId:'n138-'+letter,itemId:'n138-i'+index,value}));
        students.forEach((student,index)=>scores.push({id:'n138-other-score'+index,studentId:student.id,itemId:'n138-independent',value:index+1}));
        await s.save({subjects,teachings:teaching,students,enrollments,items,scores});
        const c=s.teachingContext('n138-main');
        return {totals:Object.fromEntries(letters.map(letter=>[letter,m.studentTotal(c.items,c.ctx['n138-'+letter])]))};
      });
      assert.equal(fixture.totals.A.earned,10); assert.equal(fixture.totals.A.pct,100);
      assert.equal(fixture.totals.B.earned,80); assert.equal(fixture.totals.B.pct,80);
      assert.equal(fixture.totals.Z.outOfGraded,10); assert.equal(fixture.totals.U.outOfGraded,0);
      const snapshot=()=>page.evaluate(async()=>{const s=await import('/src/store.js'),db=await import('/src/lib/db.js');return JSON.stringify({scores:s.state.scores,items:s.state.items,persistedScores:await db.getAll('scores'),persistedItems:await db.getAll('items'),outbox:await db.getAll('outbox')});});
      const before=await snapshot();
      const names=letters=>letters.map(letter=>'N138 '+letter);
      const totalHigh=names(['B','A','C','Z','U','V']), totalLow=names(['Z','A','C','B','U','V']);
      const sort=async value=>{await page.locator('select[data-change="sort"]').selectOption(value);};
      const gradeRows=()=>page.locator('.gtable tbody th a');
      const reportRows=(root='.report-document')=>page.locator(root+' .gtable tbody th a');
      const assertChunks=async(root,order)=>{
        const tables=page.locator(root+' .gtable');
        await expect(tables,'Six item columns must produce two paper chunks').toHaveCount(2);
        for(let i=0;i<2;i++)await expect(tables.nth(i).locator('tbody th a')).toHaveText(order);
      };
      const csvNames=async()=>{
        const downloadPromise=page.waitForEvent('download');
        await page.locator('[data-act="csv"]').click();
        const download=await downloadPromise, stream=await download.createReadStream();
        let text='';for await(const chunk of stream)text+=chunk.toString('utf8');
        return [...text.matchAll(/N138 [ABCZUV]/g)].map(match=>match[0]);
      };
      await t.test('n138_all_grades_sorted_by_earned_total_and_ungraded_last',async()=>{
        await page.goto(url+'/#/teaching/n138-main/grades');
        await page.locator('[data-act="mode"][data-mode="table"]').click();
        await sort('score_desc');await expect(gradeRows()).toHaveText(totalHigh);
        await sort('score_asc');await expect(gradeRows()).toHaveText(totalLow);
        await sort('score_desc');await expect(gradeRows()).toHaveText(totalHigh);
        assert.equal(await page.locator('#n94-grades-style').count(),1,'Actual grades CSS loaded');
      });
      await t.test('n138_single_item_sort_and_recorded_zero_semantics',async()=>{
        await page.locator('[data-act="mode"][data-mode="item"]').click();
        await sort('score_desc');await expect(page.locator('.graderow__name strong')).toHaveText(names(['A','C','B','Z','U','V']));
        await sort('score_asc');await expect(page.locator('.graderow__name strong')).toHaveText(names(['B','Z','A','C','U','V']));
        await page.locator('[data-act="pick"][data-id="n138-i1"]').click();
        await expect(page.locator('.graderow__name strong')).toHaveText(names(['B','A','C','U','V','Z']));
        await sort('score_desc');await expect(page.locator('.graderow__name strong')).toHaveText(names(['B','A','C','U','V','Z']));
      });
      await t.test('n138_report_grade_print_and_csv_order_match_visible_sort',async()=>{
        await page.goto(url+'/#/teaching/n138-main/reports');
        await expect(page.locator('.print-report--grades')).toBeVisible();
        for(const [direction,order] of [['score_desc',totalHigh],['score_asc',totalLow]]){
          await sort(direction);
          await expect(reportRows('.report-document .grades-report-screen')).toHaveText(order);
          await assertChunks('.report-document .grades-report-print',order);
          assert.deepEqual(await csvNames(),order);
          await page.locator('[data-act="toggle-a4"]').click();
          await assertChunks('.a4-sheet .grades-report-print',order);
          await page.emulateMedia({media:'print'});
          await expect(page.locator('.report-document .grades-report-print .gtable').first()).toBeVisible();
          await assertChunks('.report-document .grades-report-print',order);
          await page.emulateMedia({media:'screen'});
          await page.locator('[data-act="toggle-a4"]').first().click();
        }
        // Support continues to use percentage, including its original ungraded semantics.
        await page.locator('[data-act="tab"][data-tab="support"]').click();
        await expect(page.locator('.print-report--support')).toBeVisible();
        for(const [direction,letters] of [['score_desc',['A','C','B','Z','U','V']],['score_asc',['Z','B','A','C','U','V']]]){
          await sort(direction);const expected=names(letters);
          await expect(page.locator('.report-document .support-report-screen .row__title')).toHaveText(expected);
          await expect(page.locator('.report-document .support-report-print tbody th')).toHaveText(expected);
          assert.deepEqual(await csvNames(),expected);
        }
        await page.locator('[data-act="tab"][data-tab="roster"]').click();
        await expect(page.locator('.print-report--roster')).toBeVisible();
        const rosterNames=await page.locator('.report-document tbody th').allTextContents();
        assert.deepEqual(await csvNames(),rosterNames);
        // Same students, separate subject and score scope.
        await page.goto(url+'/#/teaching/n138-other/grades');
        await page.locator('[data-act="mode"][data-mode="table"]').click();
        await sort('score_desc');await expect(gradeRows()).toHaveText(names(['V','U','Z','C','B','A']));
        await page.goto(url+'/#/teaching/n138-other/reports');
        await expect(page.locator('.print-report--grades')).toBeVisible();
        await sort('score_desc');await expect(reportRows()).toHaveText(names(['V','U','Z','C','B','A']));
        assert.deepEqual(await csvNames(),names(['V','U','Z','C','B','A']));
      });
      assert.equal(await snapshot(),before,'Sorting, preview and export must not mutate scores/items/outbox');
      console.log('N138 fixture: A=10/10 (100%), B=80/100 (80%); no score/item/outbox mutation. Acceptance status is reported by node:test above.');
    });
  } finally {await server.close();}
});
