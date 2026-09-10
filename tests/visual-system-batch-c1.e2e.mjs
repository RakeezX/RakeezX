import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120_000);

const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 412, height: 860 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
];

const hasNoHorizontalOverflow = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
);

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function setTheme(page, theme) {
  await page.evaluate((value) => window.store.patchDevice({ theme: value }), theme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function seedManagement(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  return page.evaluate(async () => {
    const subjectId = window.store.subjects()[0].id;
    const sectionA = await window.store.createSection({ grade: 5, label: 'أ', color: '#18A878' });
    const sectionB = await window.store.createSection({ grade: 5, label: 'ب', color: '#2F7DD3' });
    const teachingA = await window.store.createTeaching({ sectionId: sectionA.id, subjectId });
    await window.store.createTeaching({ sectionId: sectionB.id, subjectId });
    let firstStudentId = null;
    for (let index = 1; index <= 8; index += 1) {
      const student = await window.store.addStudent(sectionA.id, `طالب اختبار ${index}`, { rollNo: index });
      firstStudentId ??= student.id;
    }
    return { teachingId: teachingA.id, studentId: firstStudentId };
  });
}

test('Classes, roster, and Student Profile share the C1 hierarchy at every approved size', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const fixture = await seedManagement(page);
  const routes = [
    { url: '/#/classes', root: '.classes-page' },
    { url: `/#/teaching/${fixture.teachingId}/students`, root: '.students-roster-page' },
    { url: `/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`, root: '.student-profile-page' },
  ];

  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route.url);
        await setTheme(page, theme);
        await expect(page.locator(route.root)).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        expect(await hasNoHorizontalOverflow(page), `${theme}/${viewport.width}/${route.url}`).toBe(true);
      }

      await page.goto('/#/classes');
      await expect(page.locator('.class-card')).toHaveCount(2);
      await expect(page.locator('.class-card').first()).toContainText('8 طالبًا');
      await expect(page.locator('.classes-overview__label')).toHaveText(['عدد الفصول', 'عدد الطلاب']);
      const overviewWidth = await page.locator('.classes-overview').evaluate((node) => node.getBoundingClientRect().width);
      const pageWidth = await page.locator('.classes-page').evaluate((node) => node.getBoundingClientRect().width);
      expect(Math.abs(overviewWidth - pageWidth)).toBeLessThanOrEqual(1);
      const classColumns = await page.locator('.class-cards-grid').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').length
      );
      expect(classColumns).toBe(viewport.width >= 1200 ? 3 : 1);
      if (viewport.width <= 412) {
        const actionSizes = await page.locator('.classes-actions .btn').evaluateAll((nodes) => nodes.map((node) => ({
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
        })));
        expect(new Set(actionSizes.map(({ width }) => width)).size, JSON.stringify(actionSizes)).toBe(1);
        expect(actionSizes.every(({ height }) => height >= 44), JSON.stringify(actionSizes)).toBe(true);
      }

      await page.goto(`/#/teaching/${fixture.teachingId}/students`);
      await expect(page.locator('.roster-row')).toHaveCount(8);
      const search = page.getByRole('searchbox', { name: 'بحث الطلاب' });
      await search.fill('اختبار 2');
      await expect(page.locator('.roster-row')).toHaveCount(1);
      await page.getByRole('button', { name: 'مسح البحث' }).click();
      await expect(page.locator('.roster-row')).toHaveCount(8);

      await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
      await expect(page.locator('.student-profile-current-grades')).toBeVisible();
      const disclosures = page.locator('.student-profile-disclosure');
      await expect(disclosures).toHaveCount(4);
      expect(await disclosures.evaluateAll((nodes) => nodes.every((node) => !node.open))).toBe(true);
      await expect(disclosures.last()).toHaveClass(/student-profile-enrollment/);

      if (viewport.width <= 412) {
        const targets = await page.locator('.classes-actions .btn, .roster-row .iconbtn, .student-profile-page .iconbtn')
          .evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().width > 0).map((node) => ({
            width: node.getBoundingClientRect().width,
            height: node.getBoundingClientRect().height,
          })));
        expect(targets.every(({ width, height }) => width >= 44 && height >= 44), JSON.stringify(targets)).toBe(true);
        const profileActions = await page.locator('.student-profile-actions__row .btn').evaluateAll((nodes) => nodes.map((node) => ({
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
        })));
        expect(new Set(profileActions.map(({ width }) => width)).size, JSON.stringify(profileActions)).toBe(1);
        expect(profileActions.every(({ height }) => height >= 44), JSON.stringify(profileActions)).toBe(true);
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  const attendanceSummary = page.locator('.student-attendance-history > summary');
  await attendanceSummary.focus();
  await expect(attendanceSummary).toBeFocused();
  await attendanceSummary.press('Enter');
  await expect(page.locator('.student-attendance-history')).toHaveAttribute('open', '');

  await page.evaluate(async (teachingId) => {
    const participation = window.store.items(teachingId).find((item) => item.auto === 'participation');
    await window.store.patch('items', participation.id, { max: 13 }, null, { queue: false });
  }, fixture.teachingId);
  await page.goto(`/#/teaching/${fixture.teachingId}/items`);
  const participationRow = page.locator('.grade-item-row', { hasText: 'المشاركة والتفاعل' });
  await expect(participationRow).toContainText('13 درجات · رصد آلي من الرصد السريع (1 لكل نقطة)');

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of routes) {
    await page.goto(route.url);
    const scan = await new AxeBuilder({ page })
      .include(route.root)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(scan.violations.filter(({ impact }) => impact === 'critical'), route.url).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('C1 micro refinements keep summaries calm and accents selective', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const fixture = await seedManagement(page);
  const sizes = viewports.filter(({ width }) => [320, 390, 412, 1280].includes(width));

  for (const theme of ['light', 'dark']) {
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);

      await page.goto('/#/classes');
      await setTheme(page, theme);
      const summary = page.locator('.classes-overview');
      await expect(summary).toBeVisible();
      await expect(summary).not.toHaveClass(/rakeez-accent-surface/);
      const metrics = await summary.locator('.classes-overview__metric').evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { top: Math.round(box.top), height: Math.round(box.height) };
      }));
      expect(new Set(metrics.map(({ top }) => top)).size).toBe(1);
      expect(metrics.every(({ height }) => height <= 64), JSON.stringify(metrics)).toBe(true);
      expect(await hasNoHorizontalOverflow(page), `${theme}/${viewport.width}/classes-summary`).toBe(true);

      await page.goto(`/#/teaching/${fixture.teachingId}/picker`);
      await expect(page.locator('.picker__stage')).toBeVisible();
      await expect(page.locator('.picker-page .rakeez-accent-surface')).toHaveCount(0);
      const pickerSurfaces = await page.evaluate(() => ({
        stageImage: getComputedStyle(document.querySelector('.picker__stage')).backgroundImage,
        summaryImage: getComputedStyle(document.querySelector('.picker__summary')).backgroundImage,
        optionsImage: getComputedStyle(document.querySelector('.picker__options')).backgroundImage,
      }));
      expect(pickerSurfaces.stageImage).not.toBe('none');
      expect(pickerSurfaces.summaryImage).toBe('none');
      expect(pickerSurfaces.optionsImage).toBe('none');
      expect(await hasNoHorizontalOverflow(page), `${theme}/${viewport.width}/picker`).toBe(true);

      await page.goto(`/#/teaching/${fixture.teachingId}/class-rules`);
      const presentation = page.getByRole('button', { name: 'عرض صفي', exact: true });
      const startGoal = page.getByRole('button', { name: 'ابدأ الهدف', exact: true });
      await expect(presentation).toBeVisible();
      await expect(startGoal).toBeVisible();
      const actionStyles = await page.evaluate(() => {
        const presentationButton = document.querySelector('.presentation-controls__action');
        const startButton = document.querySelector('.goal-builder__start');
        return {
          presentationBackground: getComputedStyle(presentationButton).backgroundColor,
          startBackground: getComputedStyle(startButton).backgroundColor,
          height: presentationButton.getBoundingClientRect().height,
        };
      });
      expect(actionStyles.presentationBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(actionStyles.presentationBackground).not.toBe(actionStyles.startBackground);
      if (viewport.width <= 412) expect(actionStyles.height).toBeGreaterThanOrEqual(44);
      await presentation.focus();
      await expect(presentation).toBeFocused();
      expect(await hasNoHorizontalOverflow(page), `${theme}/${viewport.width}/class-rules`).toBe(true);
    }
  }

  expect(errors).toEqual([]);
});

test('Calendar, Timing Profiles, and Settings keep compact semantics in light and dark', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const common = { updatedAt: Date.now(), deleted: false };
    await window.store.save({
      timeProfiles: [
        {
          id: 'c1-base', name: 'التوقيت الأساسي', order: 90,
          periods: [{ period: 1, start: '07:00', end: '07:45' }],
          overrides: { config: { type: 'summer' } }, ...common,
        },
        {
          id: 'c1-effective', name: 'التوقيت الفعّال', order: 91,
          periods: [{ period: 1, start: '09:00', end: '09:40' }],
          overrides: { config: { type: 'ramadan' } },
          activeFrom: '2000-01-01', activeTo: '2100-01-01', ...common,
        },
        {
          id: 'c1-custom', name: 'توقيت مخصص', order: 92,
          periods: [{ period: 1, start: '08:00', end: '08:45' }],
          overrides: { config: { type: 'custom' } }, ...common,
        },
      ],
    }, { queue: false });
    await window.store.patchProfile({ activeTimeProfileId: 'c1-base' }, { queue: false });
  });

  const routes = [
    { url: '/#/calendar', root: '.calendar-management-page' },
    { url: '/#/schedule/times', root: '.timing-profiles-page' },
    { url: '/#/settings', root: '.settings-page' },
  ];

  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route.url);
        await setTheme(page, theme);
        await expect(page.locator(route.root)).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        expect(await hasNoHorizontalOverflow(page), `${theme}/${viewport.width}/${route.url}`).toBe(true);
      }

      await page.goto('/#/calendar');
      const official = page.getByRole('button', { name: /رسمية معتمدة/ });
      await official.click();
      await expect(official).toHaveAttribute('aria-pressed', 'true');

      await page.goto('/#/schedule/times');
      const effective = page.locator('.timing-profile-card', { hasText: 'التوقيت الفعّال' });
      const base = page.locator('.timing-profile-card', { hasText: 'التوقيت الأساسي' });
      await expect(effective).toHaveClass(/is-effective-profile/);
      await expect(effective).toContainText('مطبق الآن');
      await expect(base).toHaveClass(/is-base-profile/);
      await expect(base).toContainText('احتياطي');
      const setBase = page.getByRole('button', { name: 'تعيين توقيت مخصص كتوقيت أساسي' });
      await expect(setBase).toBeVisible();
      await expect(setBase).toContainText('تعيين كأساسي');
      const setBaseBounds = await setBase.evaluate((node) => {
        const button = node.getBoundingClientRect();
        const card = node.closest('.timing-profile-card').getBoundingClientRect();
        return { buttonLeft: button.left, buttonRight: button.right, cardLeft: card.left, cardRight: card.right };
      });
      expect(setBaseBounds.buttonLeft).toBeGreaterThanOrEqual(setBaseBounds.cardLeft - 1);
      expect(setBaseBounds.buttonRight).toBeLessThanOrEqual(setBaseBounds.cardRight + 1);

      await page.goto('/#/settings');
      await expect(page.getByText('المظهر والمؤثرات والتفاعل', { exact: true })).toBeVisible();
      await expect(page.locator('.settings-preference-row')).toHaveCount(3);
      await expect(page.locator('.settings-preference-surface')).toBeVisible();
      await expect(page.getByText('حالة المزامنة', { exact: true })).toHaveCount(0);
      await expect(page.getByText('تسجيل الدخول', { exact: true })).toHaveCount(0);
      const themeControl = page.getByRole('button', { name: theme === 'light' ? 'فاتح' : 'داكن' });
      await themeControl.focus();
      await expect(themeControl).toBeFocused();
      await expect(themeControl).toHaveAttribute('aria-pressed', 'true');
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/settings');
  const settingsColumns = await page.locator('.settings-page').evaluate((node) =>
    getComputedStyle(node).gridTemplateColumns.split(' ').length
  );
  expect(settingsColumns).toBe(2);

  await page.goto('/#/');
  await expect(page.locator('main')).not.toContainText('إسناد');

  for (const route of routes) {
    await page.goto(route.url);
    const scan = await new AxeBuilder({ page })
      .include(route.root)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(scan.violations.filter(({ impact }) => impact === 'critical'), route.url).toEqual([]);
  }
  expect(errors).toEqual([]);
});
