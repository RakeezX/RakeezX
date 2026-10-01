import { test, expect } from '@playwright/test';

test('current Timing labels use the effective dated profile while the base remains explicit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#/');
  await page.evaluate(async () => {
    const profiles = [
      {
        id: 'timing-effective-base', name: 'التوقيت الصيفي الاختباري', order: 90,
        periods: [{ period: 1, start: '07:00', end: '07:45' }], overrides: { config: { type: 'summer' } },
      },
      {
        id: 'timing-effective-ramadan', name: 'توقيت رمضان الاختباري', order: 91,
        periods: [{ period: 1, start: '09:00', end: '09:45' }], overrides: { config: { type: 'ramadan' } },
        activeFrom: '2000-01-01', activeTo: '2100-01-01',
      },
    ];
    await window.store.save({ timeProfiles: profiles }, { queue: false });
    await window.store.patchProfile({ activeTimeProfileId: 'timing-effective-base' }, { queue: false });
    const section = await window.store.createSection({ grade: 5, label: 'فعّال' });
    const teaching = await window.store.createTeaching({ sectionId: section.id, subjectId: window.store.subjects()[0].id });
    await window.store.addSlot(teaching.id, 0, 1);
    window.store.repaint();
  });

  await expect(page.locator('.compact-timing-pill')).toContainText('توقيت رمضان الاختباري');
  await page.goto('/#/schedule');
  await expect(page.locator('.compact-timing-pill')).toContainText('توقيت رمضان الاختباري');

  await page.getByRole('link', { name: 'تعديل ملفات أوقات الحصص' }).click();
  await expect(page).toHaveURL(/#\/schedule\/times$/);
  const effective = page.locator('.timing-profile-card', { hasText: 'توقيت رمضان الاختباري' });
  const base = page.locator('.timing-profile-card', { hasText: 'التوقيت الصيفي الاختباري' });
  await expect(effective).toContainText('مطبق الآن');
  await expect(base).toContainText('التوقيت الأساسي');

  const dateSpecific = await page.evaluate(() => {
    const baseProfile = window.store.activeTimeProfile();
    return {
      before: window.store.resolveProfile(baseProfile, '1999-12-31')?.id,
      during: window.store.resolveProfile(baseProfile, '2050-01-01')?.id,
    };
  });
  expect(dateSpecific.before).toBe('timing-effective-base');
  expect(dateSpecific.during).toBe('timing-effective-ramadan');

  await page.evaluate(async () => {
    await window.store.patch('timeProfiles', 'timing-effective-ramadan', { activeTo: '2000-01-01' }, null, { queue: false });
    window.store.repaint();
  });
  await page.goto('/#/');
  await expect(page.locator('.compact-timing-pill')).toContainText('التوقيت الصيفي الاختباري');
  await page.goto('/#/schedule');
  await expect(page.locator('.compact-timing-pill')).toContainText('التوقيت الصيفي الاختباري');
  expect(errors).toEqual([]);
});
