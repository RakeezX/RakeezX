import { test, expect } from '@playwright/test';

test('one-click local demo classes stay isolated, persistent, and deletable', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store);
  const demoButton = page.getByRole('button', { name: 'إضافة فصل تجريبي' });
  await expect(demoButton).toBeVisible();
  await expect(demoButton).toHaveClass(/btn--ghost/);
  await expect(demoButton).not.toHaveClass(/btn--primary/);
  const disabledDuringCreate = await page.evaluate(() => {
    const button = [...document.querySelectorAll('[data-act="add-demo"]')].find((el) => el.textContent.includes('إضافة فصل تجريبي'));
    button.click();
    return button.disabled;
  });
  expect(disabledDuringCreate).toBe(true);
  await expect(page.getByRole('link', { name: /تجريبي 1/ })).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'تجريبي' })).toBeVisible();
  const first = await page.evaluate(async () => ({
    sections: window.store.state.sections.filter((r) => r.id.startsWith('demo:') && !r.deleted).length,
    students: window.store.state.students.filter((r) => r.id.startsWith('demo:') && !r.deleted).length,
    outbox: (await (await import('/src/lib/db.js')).getAll('outbox')).filter((r) => r.recordId?.startsWith('demo:')).length,
  }));
  expect(first).toEqual({ sections: 1, students: 24, outbox: 0 });
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'حذف الفصل التجريبي' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الفصل التجريبي' }).click();
  await expect(page.getByRole('link', { name: /تجريبي 1/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /تجريبي 2/ })).toBeVisible();
});
test('demo packages preserve real records, stay out of backup, and work in reports on mobile RTL', async ({ page }) => {
  await page.goto('/#/classes'); await page.waitForFunction(() => window.store);
  const real = await page.evaluate(async () => {
    const store = window.store; const now = Date.now(); const year = store.activeYear(); const term = store.activeTerm(); const subject = store.subjects()[0];
    const section = { id:'real-quick-section', yearId:year.id, grade:4, label:'حقيقي', name:'الرابع الابتدائي / حقيقي', color:'#1d4ed8', order:99, updatedAt:now, deleted:false };
    const teaching = { id:'real-quick-teaching', sectionId:section.id, subjectId:subject.id, termId:term.id, order:99, updatedAt:now, deleted:false };
    const student = { id:'real-quick-student', name:'طالب اختبار حقيقي', status:'active', note:'', updatedAt:now, deleted:false };
    const enrollment = { id:'real-quick-enrollment', studentId:student.id, sectionId:section.id, rollNo:1, status:'active', startDate:'2026-08-25', endDate:null, transferNote:'', updatedAt:now, deleted:false };
    const slot = { id:'real-quick-slot', teachingId:teaching.id, weekday:1, period:6, updatedAt:now, deleted:false };
    const session = { id:'real-quick-session', teachingId:teaching.id, slotId:slot.id, date:'2026-08-24', period:6, status:'held', startTime:'09:00', endTime:'09:45', updatedAt:now, deleted:false };
    const item = { id:'real-quick-item', teachingId:teaching.id, name:'اختبار حقيقي', max:10, order:0, auto:null, updatedAt:now, deleted:false };
    const attendance = { id:'real-quick-attendance', studentId:student.id, sessionId:session.id, teachingId:teaching.id, date:session.date, status:'present', note:'', updatedAt:now, deleted:false };
    const score = { id:'real-quick-score', studentId:student.id, itemId:item.id, value:8, updatedAt:now, deleted:false };
    await store.save({ sections:[section], teachings:[teaching], students:[student], enrollments:[enrollment], slots:[slot], sessions:[session], items:[item], attendance:[attendance], scores:[score] });
    return { section:section.id, teaching:teaching.id, student:student.id };
  });
  await page.getByRole('button', { name:'إضافة فصل تجريبي' }).click();
  await page.getByRole('button', { name:'إضافة فصل تجريبي' }).click();
  await expect(page.getByRole('link', { name:/تجريبي 2/ })).toBeVisible();
  const result = await page.evaluate(async (real) => {
    const backup = await (await import('/src/lib/export.js')).buildBackup();
    const ids = Object.values(backup.data).flat().map((r) => r.id);
    const demoIds = window.store.state.sections.filter((r) => r.id.startsWith('demo:') && !r.deleted).map((r) => r.id);
    return { real: [real.section, real.teaching, real.student].every((id) => ids.includes(id)), demoInBackup: ids.some((id) => String(id).startsWith('demo:')), demoIds };
  }, real);
  expect(result.real).toBe(true); expect(result.demoInBackup).toBe(false);
  await page.getByRole('button', { name:'حذف الفصل التجريبي' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name:'حذف الفصل التجريبي' }).click();
  await expect(page.getByRole('link', { name:/تجريبي 2/ })).toBeVisible();
  expect(await page.evaluate((real) => [real.section, real.teaching, real.student].every((id) => window.store.state[ id.includes('section') ? 'sections' : id.includes('teaching') ? 'teachings' : 'students' ].some((r) => r.id === id && !r.deleted)), real)).toBe(true);
  await page.goto('/#/teaching/' + real.teaching + '/reports'); await expect(page.locator('body')).not.toBeEmpty();
  await page.setViewportSize({ width:390, height:844 }); await page.goto('/#/classes');
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
test('local demo packages converge across same-profile tabs', async ({ context, page }) => {
  await page.goto('/#/classes'); await page.waitForFunction(() => window.store);
  const other = await context.newPage(); await other.goto('/#/classes'); await other.waitForFunction(() => window.store);
  await page.getByRole('button', { name:'إضافة فصل تجريبي' }).click();
  await expect(other.getByRole('link', { name:/تجريبي 1/ })).toBeVisible();
  await page.getByRole('button', { name:'حذف الفصل التجريبي' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name:'حذف الفصل التجريبي' }).click();
  await expect(other.getByRole('link', { name:/تجريبي 1/ })).toHaveCount(0);
  await other.close();
});