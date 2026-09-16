import { test, expect } from '@playwright/test';

test.use({...(process.env.RAKEEZX_TIMING_TEST_URL ? {baseURL:process.env.RAKEEZX_TIMING_TEST_URL} : {})});
for (const width of [1280, 390]) {
  test(`generic gaps and explicit recess remain distinct through real controls/save/reload (${width}px)`, async ({page, context}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if(message.type() === 'error') errors.push(message.text()); });
    await context.route('**/*.supabase.co/**', (route) => route.abort());
    await page.setViewportSize({width, height:900});
    await page.goto('/#/schedule/times');
    await page.waitForFunction(() => window.store?.state.ready);
    await page.evaluate(async () => {
      const {generateAdvancedPeriods} = await import('/src/models.js');
      const cfg = {count:4, firstPeriodStart:'08:00', periodDuration:45, gap:0, recess:{enabled:false}};
      await window.store.save({timeProfiles:[{id:'gap-browser',name:'توقيت الفاصل الاختباري',order:99,
        periods:generateAdvancedPeriods(cfg),overrides:{config:cfg}}]}, {queue:false});
      await window.store.patchProfile({activeTimeProfileId:'gap-browser'}, {queue:false});
      const section = await window.store.createSection({grade:5,label:'اختبار الفاصل'});
      const teaching = await window.store.createTeaching({sectionId:section.id,subjectId:window.store.subjects()[0].id});
      await window.store.addSlot(teaching.id,0,2);
      window.store.repaint();
    });
    const edit = () => page.locator('[data-act="edit-times"][data-id="gap-browser"]').click();
    const start = (period) => page.getByRole('textbox', {name:`بداية الحصة ${period}`,exact:true});
    const save = async () => {
      await page.locator('#sheet-btn-save-all').click();
      await expect(page.locator('.sheet')).toHaveCount(0);
    };
    for (const gap of [0,1,5]) {
      await edit();
      await page.locator('#sheet-btn-gen').click();
      await page.locator('#gen-form [name="gap"]').fill(String(gap));
      await page.getByRole('button',{name:'توليد وتطبيق الأوقات',exact:true}).click();
      await expect(page.locator('.row-recess')).toHaveCount(0);
      await expect(page.locator('[data-row-period]')).toHaveCount(4);
      await expect(start(2)).toHaveValue(gap === 0 ? '08:45' : gap === 1 ? '08:46' : '08:50');
      await expect(page.locator('#sheet-btn-add-recess')).toBeVisible();
      await page.locator('#sheet-btn-edit-model').click();
      await expect(page.locator('.sheet').last()).toContainText('بدون فسحة');
      await expect(page.locator('.sheet').last().locator('[name="recessAfter"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await save();
      await page.reload();
      await edit();
      await expect(page.locator('.row-recess')).toHaveCount(0);
      await expect(start(2)).toHaveValue(gap === 0 ? '08:45' : gap === 1 ? '08:46' : '08:50');
      await page.keyboard.press('Escape');
      await page.goto('/#/schedule');
      await expect(page.locator('main')).not.toContainText('فسحة');
      const exported = await page.evaluate(async () => {
        const engine = await import('/src/lib/schedule-export.js');
        const model = engine.buildScheduleExportModel(window.store);
        return {time:model.days.find((day)=>day.weekday===0).periods.find((p)=>p.period===2).time,
          print:engine.schedulePrintDocument(model),periods:model.periods};
      });
      expect(exported.time.start).toBe(gap === 0 ? '08:45' : gap === 1 ? '08:46' : '08:50');
      expect(exported.print).toContain(exported.time.start);
      expect(exported.print).not.toContain('فسحة');
      expect(exported.periods.map((p)=>p.period)).toEqual([1,2,3,4]);
      await page.goto('/#/schedule/times');
    }

    await edit();
    await page.locator('#sheet-btn-add-recess').click();
    await page.locator('#recess-config-form [name="afterPeriod"]').selectOption('2');
    await page.getByRole('button',{name:'إضافة الفسحة',exact:true}).click();
    await expect(page.locator('.row-recess')).toHaveCount(1);
    await expect(page.locator('.row-recess')).toContainText('20 دقيقة');
    await expect(start(2)).toHaveValue('08:50');
    await expect(start(3)).toHaveValue('09:55');
    await save();
    await page.reload(); await edit();
    await expect(page.locator('.row-recess')).toHaveCount(1);
    await expect(start(2)).toHaveValue('08:50');
    await page.getByRole('button',{name:'إزالة الفسحة',exact:true}).click();
    await expect(page.locator('.row-recess')).toHaveCount(0);
    await expect(start(3)).toHaveValue('09:40');
    await save();
    await page.reload(); await edit();
    await expect(page.locator('.row-recess')).toHaveCount(0);

    // Day overrides retain independent explicit intent without changing base.
    await page.locator('[data-day="1"]').click();
    await page.locator('#sheet-btn-add-recess').click();
    await page.locator('#recess-config-form [name="afterPeriod"]').selectOption('1');
    await page.getByRole('button',{name:'إضافة الفسحة',exact:true}).click();
    await expect(page.locator('.row-recess')).toHaveCount(1);
    await save();
    await page.reload(); await edit();
    await expect(page.locator('.row-recess')).toHaveCount(0);
    await page.locator('[data-day="1"]').click();
    await expect(page.locator('.row-recess')).toHaveCount(1);
    await page.locator('#sheet-btn-gen').click();
    await page.getByRole('button',{name:'توليد وتطبيق الأوقات',exact:true}).click();
    await expect(page.locator('.row-recess')).toHaveCount(0);
    await save();
    await page.reload(); await edit();
    await page.locator('[data-day="1"]').click();
    await expect(page.locator('.row-recess')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
