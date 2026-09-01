import { test, expect } from '@playwright/test';

const viewports = [
  { width: 320, height: 680, columns: 1 },
  { width: 350, height: 740, columns: 1 },
  { width: 390, height: 844, columns: 2 },
  { width: 430, height: 860, columns: 2 },
  { width: 1024, height: 768, columns: 2 },
  { width: 1440, height: 900, columns: 2 },
];

for (const viewport of viewports) {
  test(`IA cleanup keeps class workspace usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
    const grid = page.locator('.class-cards-grid');
    await expect(grid).toBeVisible();
    const cards = page.locator('.class-card');
    await expect(cards).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const columnCount = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columnCount).toBe(viewport.columns);
    if (viewport.columns === 2) {
      const [first, second] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first.x - second.x) - first.width).toBeGreaterThanOrEqual(8);
    }
    await cards.nth(0).locator('.class-card__main').click();
    const tabs = page.locator('.class-context-nav__item');
    await expect(tabs).toHaveCount(5);
    expect((await tabs.allTextContents()).map((text) => text.trim())).toEqual(['الفصل', 'الحضور', 'الحصص', 'كشف الدرجات', 'الطلاب']);
    const trigger = page.getByRole('button', { name: 'تبديل الفصل' });
    const hub = page.locator('.class-hub');
    const identity = hub.locator('.class-hub-header__identity-block');
    await expect(identity).toBeVisible();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.topbar:visible, .class-hub-header__identity-block:visible')).toHaveCount(1);
    await expect(trigger).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.height).toBeGreaterThanOrEqual(34);
    expect(await trigger.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(identity.locator('.class-hub-header__sub')).toBeVisible();
    const headerChevron = trigger.locator('.class-name-switcher-btn__chevron');
    const headerChevronBox = await headerChevron.boundingBox();
    expect(headerChevronBox?.width).toBeLessThanOrEqual(18);
    expect(headerChevronBox?.height).toBeLessThanOrEqual(18);
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.class-switcher-option.is-current')).toHaveCount(1);
    await expect(dialog.locator('.class-switcher-option')).toHaveCount(2);
    const chevron = dialog.locator('.class-switcher-option__chevron');
    await expect(chevron).toHaveCount(1);
    const chevronBox = await chevron.boundingBox();
    expect(chevronBox?.width).toBeLessThanOrEqual(20);
    expect(chevronBox?.height).toBeLessThanOrEqual(20);
    expect((await dialog.locator('.sheet').boundingBox())?.height).toBeLessThan(viewport.height * .8);
    for (const box of await dialog.locator('svg').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeLessThanOrEqual(22);
      expect(box.height).toBeLessThanOrEqual(22);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test('Home timing indicator stays compact without a giant SVG', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await expect(page.locator('.welcome__title')).toHaveCount(0);
  const pill = page.locator('.hub-head__timing-pill');
  const timingIcon = page.locator('.hub-head__timing-icon svg');
  await expect(pill).toBeVisible();
  const [pillBox, iconBox] = await Promise.all([pill.boundingBox(), timingIcon.boundingBox()]);
  expect(pillBox?.height).toBeLessThanOrEqual(32);
  expect(iconBox?.width).toBeLessThanOrEqual(16);
  expect(iconBox?.height).toBeLessThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollHeight < 1200)).toBe(true);
});

test('Class workspace pages share a wide shell and Grades exposes distribution as secondary action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('button', { name: 'إضافة فصل تجريبي' }).click();
  await page.locator('.class-card__main').click();
  const widths = [];
  for (const label of ['الفصل', 'الحضور', 'الحصص', 'كشف الدرجات', 'الطلاب']) {
    const contextLink = page.locator('.class-context-nav').getByRole('link', { name: label });
    await contextLink.click();
    const width = await page.waitForFunction(() => {
      const node = document.querySelector('.page--class-workspace');
      const value = node?.getBoundingClientRect().width ?? 0;
      return value > 0 ? value : false;
    }).then((handle) => handle.jsonValue());
    widths.push(width);
  }
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  await page.locator('.class-context-nav').getByRole('link', { name: 'كشف الدرجات' }).click();
  await expect(page.getByRole('link', { name: 'توزيع الدرجات' })).toBeVisible();
  await page.getByRole('link', { name: 'توزيع الدرجات' }).click();
  await expect(page.locator('.topbar__title')).toHaveText('توزيع الدرجات');
});
test('Grades keeps the distribution action visible before a roster exists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.getByRole('button', { name: 'فصل جديد' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'إنشاء' }).click();
  const href = await page.locator('.class-card__main').first().getAttribute('href');
  await page.goto('/#' + href.slice(1) + '/grades');
  const action = page.getByRole('link', { name: 'توزيع الدرجات' });
  await expect(action).toBeVisible();
  await expect(action).toHaveClass(/grades-distribution-action/);
  await action.click();
  await expect(page.locator('.topbar__title')).toHaveText('توزيع الدرجات');
});
for (const viewport of [
  { width: 390, height: 844, label: '390px' },
  { width: 1024, height: 768, label: 'desktop' },
]) {
  test(`Empty class keeps its workspace shell and settings at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    const fixture = await page.evaluate(async () => {
      const subject = window.store.state.subjects.find((item) => !item.deleted);
      const sectionA = await window.store.createSection({ grade: 5, label: `فارغ-${Date.now()}`, name: 'الخامس / فارغ' });
      const sectionB = await window.store.createSection({ grade: 5, label: `بديل-${Date.now()}`, name: 'الخامس / بديل' });
      const teachingA = await window.store.createTeaching({ sectionId: sectionA.id, subjectId: subject?.id });
      const teachingB = await window.store.createTeaching({ sectionId: sectionB.id, subjectId: subject?.id });
      return { teachingA: teachingA.id, teachingB: teachingB.id, subjectName: subject?.name || '' };
    });
    const classLink = page.locator(`a.class-card__main[href="#/teaching/${fixture.teachingA}"]`);
    await expect(classLink).toBeVisible();
    await classLink.click();
    const hub = page.locator('.class-hub');
    await expect(hub).toBeVisible();
    await expect(hub.locator('.class-hub__empty')).toBeVisible();
    await expect(hub.locator('.class-name-switcher-btn')).toBeVisible();
    if (fixture.subjectName) await expect(hub.locator('.class-hub-header__sub')).toHaveText(fixture.subjectName);
    const edit = hub.locator('[data-act="edit-sec"]');
    await expect(edit).toHaveCount(1);
    await edit.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click();
    await hub.getByRole('button', { name: 'تبديل الفصل' }).click();
    await expect(page.getByRole('dialog').locator('.class-switcher-option')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}