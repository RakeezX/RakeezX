import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('Demo witness derives saved attendance, renders A4, prints and preserves store without writes', async ({ page, context, baseURL }, info) => {
  const origin = new URL(baseURL).origin;
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await context.route('**/*',route=> new URL(route.request().url()).origin===origin ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.addInitScript(() => {
    sessionStorage.setItem('rakeezx-demo-session-v1','active');
    window.__witnessPrinted=0;
    window.print=()=>{window.__witnessPrinted++;};
  });
  await page.goto('/#/reports/attendance-evidence');
  await page.waitForFunction(async()=>{
    const store=await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type==='demo' && store.teachings().length>0;
  });
  await page.locator('.boot').waitFor({state:'detached'});
  const fixture=await page.evaluate(async()=>{
    const store=await import('/src/store.js');
    const lib=await import('/src/lib/attendance-evidence.js');
    const report=store.executionReport({yearId:store.activeYear()?.id,termId:store.activeTerm()?.id});
    const findings=store.teachings().map(t=>({id:t.id,p:lib.attendanceEvidenceProjection(report,{teachingId:t.id})}));
    const pick=findings.sort((a,b)=>b.p.recordedSessions-a.p.recordedSessions)[0];
    return {pickId:pick.id,expected:pick.p.recordedSessions,full:pick.p.fullSessions,partial:pick.p.partialSessions,sourceHasRecords:findings.some(x=>x.p.recordedSessions>0)};
  });
  expect(fixture.sourceHasRecords,'Demo requires saved attendance from original test fixture').toBe(true);
  const view=page.locator('[data-attendance-evidence]');
  await expect(view).toBeVisible();
  await expect(page.locator('link[data-attendance-evidence-style]')).toHaveAttribute('rel', 'stylesheet');
  await expect(view.locator('.attendance-evidence-document__metrics')).toHaveCSS('display', 'grid');
  const select=page.getByRole('combobox',{name:'الفصل والمادة'});
  await select.selectOption(fixture.pickId);
  const snapshot=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  await expect(view).toContainText('شاهد متابعة رصد الحضور');
  await expect(view).toContainText('مصدر الشاهد');
  await expect(view).toContainText('ليس شهادة بحضور جميع الطلاب');
  await expect(view.locator('tbody tr')).toHaveCount(fixture.expected);
  await expect(view.locator('.attendance-evidence-document__metrics strong').first()).toHaveText(String(fixture.expected));
  await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeEnabled();
  await page.screenshot({path:info.outputPath('attendance-evidence-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:/طباعة \/ PDF/}).click();
  await expect.poll(()=>page.evaluate(()=>window.__witnessPrinted)).toBe(1);
  const pdf=await page.pdf({path:info.outputPath('attendance-evidence.pdf'),preferCSSPageSize:true,printBackground:true});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1); // Two saved sessions must fit one A4 page.
  await page.setViewportSize({width:390,height:844});
  await view.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('attendance-evidence-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(view.locator('[data-report-ministry]')).toBeVisible();
  const original=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  expect(original).toBe(snapshot);
  expect(pageErrors).toEqual([]);
});
test('empty and invalid date ranges cannot produce a fake attendance witness', async ({page,context,baseURL})=>{
  const origin=new URL(baseURL).origin;
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','active'));
  await page.goto('/#/reports/attendance-evidence');
  await page.waitForFunction(async()=> (await import('/src/store.js')).state.ready);
  await page.locator('.boot').waitFor({state:'detached'});
  const input=page.getByRole('textbox',{name:'من تاريخ'});
  await input.fill('2026-10-20');
  await input.dispatchEvent('change');
  await expect(page.locator('[data-attendance-evidence]')).toContainText('لا توجد حصص تحتوي على رصد حضور');
  await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeDisabled();
});