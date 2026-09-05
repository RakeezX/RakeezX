import { test, expect } from '@playwright/test';

test('generator keeps the inter-period gap core and slot choices disclose occupied periods', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#/schedule/times');
  await page.evaluate(async () => {
    const periods = [1, 2, 3, 4].map((period) => {
      const start = 420 + (period - 1) * 45;
      const stamp = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
      return { period, start: stamp(start), end: stamp(start + 45) };
    });
    await window.store.save({
      years: [{ id: 'res-y', name: '2026' }],
      terms: [{ id: 'res-t', yearId: 'res-y', name: 'الفصل الأول' }],
      subjects: [{ id: 'res-sub-a', name: 'رياضيات' }, { id: 'res-sub-b', name: 'علوم' }],
      timeProfiles: [{ id: 'res-profile', name: 'توقيت اختباري', order: 1, periods, overrides: { config: { recess: { enabled: false } } } }],
    });
    await window.store.patchDevice({ activeYearId: 'res-y', activeTermId: 'res-t', activeTimeProfileId: 'res-profile' });
    const first = await window.store.createSection({ id: 'res-sec-a', grade: 5, label: 'أ' });
    const second = await window.store.createSection({ id: 'res-sec-b', grade: 5, label: 'ب' });
    const teachingA = await window.store.createTeaching({ id: 'res-tch-a', sectionId: first.id, subjectId: 'res-sub-a', termId: 'res-t' });
    await window.store.createTeaching({ id: 'res-tch-b', sectionId: second.id, subjectId: 'res-sub-b', termId: 'res-t' });
    await window.store.addSlot(teachingA.id, 0, 1);
    window.store.repaint();
  });
  await page.reload();

  await page.locator('[data-act="edit-times"][data-id="res-profile"]').click();
  await page.locator('#sheet-btn-gen').click();
  const generator = page.locator('.sheet').last();
  await expect(generator.locator('input[name="gap"]')).toBeVisible();
  await expect(generator.locator('#gen-recess-fields input[name="gap"]')).toHaveCount(0);
  await generator.locator('#gen-toggle-recess').click();
  expect(await generator.locator('select[name="recessAfter"] option').evaluateAll((options) => options.map((option) => option.value))).toEqual(['1', '2', '3']);
  await generator.locator('input[name="count"]').fill('1');
  await expect(generator.locator('#gen-toggle-recess')).toBeDisabled();
  await expect(generator.locator('select[name="recessAfter"] option')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto('/#/schedule');
  await page.locator('[data-act="add"]').first().click();
  await page.selectOption('select[name="teachingId"]', 'res-tch-b');
  await page.selectOption('select[name="weekday"]', '0');
  const occupied = page.locator('select[name="period"] option[value="1"]');
  await expect(occupied).toBeDisabled();
  await expect(occupied).toContainText('مشغولة (خامس/أ)');

  // UI state can be tampered with; the form still rejects an occupied slot before saving.
  await page.evaluate(() => {
    const option = document.querySelector('select[name="period"] option[value="1"]');
    const select = document.querySelector('select[name="period"]');
    option.disabled = false;
    select.value = '1';
  });
  await page.locator('button[form="slot-form"]').click();
  await expect(page.locator('#toast')).toContainText('مسجلة بالفعل');
  await expect(page.locator('#slot-form')).toBeVisible();
  expect(errors).toEqual([]);
});
