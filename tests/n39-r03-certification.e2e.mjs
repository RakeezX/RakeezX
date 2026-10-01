import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh', reducedMotion: 'reduce' });
const base = process.env.RAKEEZX_E2E_BASE_URL ?? 'http://127.0.0.1:5173';

async function setup(page) {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (!request.url().startsWith(base + '/')) external.push(request.url());
  });
  await page.context().route('https://**/*', route => route.abort());
  await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  await page.goto(base + '/#/');
  await expect(page.getByRole('button', { name: /الخروج من التجربة/ })).toBeVisible();
  const ids = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const section = await store.createSection({ grade: 5, label: 'بحث ن39' });
    const arabic = await store.resolveSubjectSelection({ token: 'builtin:arabic' });
    const science = await store.resolveSubjectSelection({ token: 'builtin:science' });
    const first = await store.createTeaching({ sectionId: section.id, subjectId: arabic.id });
    const second = await store.createTeaching({ sectionId: section.id, subjectId: science.id });
    const one = await store.addStudent(section.id, 'محمد أحمد');
    const two = await store.addStudent(section.id, 'محمد أحمد');
    const long = await store.addStudent(section.id, 'عبدالرحمن محمد أحمد عبدالله الحوشاني');
    const singleSection = await store.createSection({ grade: 6, label: 'بحث ن39' });
    await store.createTeaching({ sectionId: singleSection.id, subjectId: arabic.id });
    const single = await store.addStudent(singleSection.id, 'فهد نتيجة منفردة ن39');
    const crowdedSection = await store.createSection({ grade: 3, label: 'بحث ن39' });
    for (const token of ['builtin:arabic', 'builtin:science', 'builtin:life-family-skills', 'builtin:quran-islamic']) {
      const subject = await store.resolveSubjectSelection({ token });
      await store.createTeaching({ sectionId: crowdedSection.id, subjectId: subject.id });
    }
    const crowded = await store.addStudent(crowdedSection.id, 'نورة ركيز للتمرير');
    return { one: one.id, two: two.id, long: long.id, single: single.id, crowded: crowded.id, first: first.id, second: second.id };
  });
  await page.goto(base + '/#/');
  await page.locator('[data-act=student-search]').click();
  return { ids, errors, external };
}

test('N39 approved search cards, responsive geometry, keyboard, and Demo isolation', async ({ page }, info) => {
  const { ids, errors, external } = await setup(page);
  const query = page.locator('[data-student-query]');
  await expect(page.locator('[data-search-status]')).toContainText('اكتب جزءًا');
  await query.fill('لا يوجد طالب');
  await expect(page.locator('[data-student-id]')).toHaveCount(0);
  await expect(page.locator('[data-search-status]')).toContainText('لا توجد نتائج');
  await query.fill('فهد نتيجة منفردة ن39');
  const singleCard = page.locator(`[data-student-id="${ids.single}"]`);
  await expect(page.locator('[data-student-id]')).toHaveCount(1);
  await expect(singleCard.locator('.student-search-chip')).toHaveText(['العربية']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await singleCard.evaluate(card => {
    const profile = card.querySelector('.student-search-result__profile').getBoundingClientRect();
    const rail = card.querySelector('.student-search-result__rail').getBoundingClientRect();
    return Math.abs((profile.top + profile.bottom - rail.top - rail.bottom) / 2) <= 5;
  })).toBe(true);
  await query.fill('محمد أحمد');
  await expect(page.locator(`[data-student-id="${ids.one}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-student-id="${ids.two}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-student-id="${ids.long}"]`)).toHaveCount(1);
  const cards = page.locator('[data-student-id]');
  expect(new Set(await cards.evaluateAll(nodes => nodes.map(node => node.dataset.studentId))).size).toBe(await cards.count());
  const firstCard = page.locator(`[data-student-id="${ids.one}"]`);
  await expect(firstCard.locator('.student-search-result__name')).toHaveText('محمد أحمد');
  await expect(firstCard.locator('.student-search-result__class')).toContainText('خامس');
  await expect(firstCard.locator('.student-search-chip')).toHaveText(['العربية', 'العلوم']);
  await expect(firstCard.locator('a a')).toHaveCount(0);
  await expect.poll(() => firstCard.locator('.student-search-chip').first().evaluate(chip => chip.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  for (const theme of ['light', 'dark']) for (const width of [1440, 1366, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await expect.poll(() => firstCard.locator('.student-search-chip').first().evaluate(chip => chip.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const geometry = await firstCard.evaluate(card => {
      const profile = card.querySelector('.student-search-result__profile').getBoundingClientRect();
      const rail = card.querySelector('.student-search-result__rail').getBoundingClientRect();
      const sheet = document.querySelector('.sheet');
      return {
        chipHeights: [...card.querySelectorAll('.student-search-chip')].map(chip => chip.getBoundingClientRect().height),
        sameRow: Math.abs((profile.top + profile.bottom - rail.top - rail.bottom) / 2) <= 5,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        sheetOverflow: sheet.scrollWidth > sheet.clientWidth + 1,
      };
    });
    expect(geometry.chipHeights.every(height => height >= 44), JSON.stringify({ width, theme, geometry })).toBe(true);
    expect(geometry.pageOverflow).toBe(false);
    expect(geometry.sheetOverflow).toBe(false);
    if (width >= 390) expect(geometry.sameRow).toBe(true);
    await firstCard.screenshot({ path: info.outputPath(`student-card-${width}-${theme}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const axe = await new AxeBuilder({ page }).include('.student-search').analyze();
  expect(axe.violations).toEqual([]);
  await query.focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-student-profile', '');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-student-teaching', '');
  await query.fill('نورة ركيز للتمرير');
  await page.setViewportSize({ width: 320, height: 844 });
  const crowdedCard = page.locator(`[data-student-id="${ids.crowded}"]`);
  await expect(crowdedCard.locator('.student-search-chip')).toHaveCount(4);
  await expect(crowdedCard.locator('.student-search-chip')).toContainText(['العربية', 'العلوم', 'الحياتية والأسرية', 'القرآن والإسلامية']);
  expect(await crowdedCard.locator('.student-search-result__rail-scroll').evaluate(rail => rail.scrollWidth > rail.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await crowdedCard.screenshot({ path: info.outputPath('crowded-320-light.png') });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('N39 profile and each subject chip route to durable, exact destinations', async ({ page }) => {
  const { ids, errors, external } = await setup(page);
  await page.locator('[data-student-query]').fill('محمد أحمد');
  const card = page.locator(`[data-student-id="${ids.one}"]`);
  await expect(card.locator('[data-student-profile]')).toHaveAttribute('href', `#/student/${encodeURIComponent(ids.one)}`);
  await expect(card.locator('[data-student-teaching]').nth(0)).toHaveAttribute('href', `#/teaching/${encodeURIComponent(ids.first)}`);
  await expect(card.locator('[data-student-teaching]').nth(1)).toHaveAttribute('href', `#/teaching/${encodeURIComponent(ids.second)}`);
  await card.locator('[data-student-teaching]').nth(1).click();
  await expect(page).toHaveURL(new RegExp(`teaching/${encodeURIComponent(ids.second)}$`));
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.goto(base + '/#/');
  await page.locator('[data-act=student-search]').click();
  await page.locator('[data-student-query]').fill('محمد أحمد');
  await page.locator(`[data-student-id="${ids.two}"] [data-student-profile]`).click();
  await expect(page).toHaveURL(new RegExp(`student/${encodeURIComponent(ids.two)}$`));
  await expect(page.locator('.student-profile-header__name')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
