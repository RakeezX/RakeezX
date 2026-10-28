import { test, expect } from '@playwright/test';

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 1024, height: 768 },
];

async function seedQuickLog(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready, { timeout: 15_000 });
  const classesHeading = page.getByRole('heading', { level: 1, name: /^الفصول(?:\s|$)/ });
  await expect(classesHeading).toHaveCount(1);
  await expect(classesHeading).toBeVisible();
  await page.evaluate(async () => {
    const students = Array.from({ length: 8 }, (_, index) => ({ id: `ql-mobile-student-${index}`, name: `طالب تجريبي ${index + 1}`, status: 'active' }));
    await window.store.save({
      years: [{ id: 'ql-mobile-year', label: '1448-1449' }],
      terms: [{ id: 'ql-mobile-term', yearId: 'ql-mobile-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'ql-mobile-subject', name: 'المهارات الرقمية' }],
      sections: [{ id: 'ql-mobile-section', yearId: 'ql-mobile-year', grade: 5, label: '1' }],
      teachings: [{ id: 'ql-mobile-teaching', sectionId: 'ql-mobile-section', subjectId: 'ql-mobile-subject', termId: 'ql-mobile-term' }],
      students,
      enrollments: students.map((student, index) => ({ id: `ql-mobile-enrollment-${index}`, studentId: student.id, sectionId: 'ql-mobile-section', status: 'active', rollNo: index + 1 })),
    });
    window.store.repaint();
  });
}

test('Quick Log remains fully usable and RTL-safe across narrow mobile viewports', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await seedQuickLog(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/#/teaching/ql-mobile-teaching/quicklog');
    const behavior = page.getByRole('button', { name: 'سجل السلوك فقط' });
    const participation = page.getByRole('button', { name: 'المشاركة' });
    await expect(behavior).toBeVisible();
    await expect(participation).toBeVisible();
    await behavior.click();
    await expect(behavior).toHaveClass(/is-on/);
    await participation.click();
    await expect(participation).toHaveClass(/is-on/);
    await expect(page.locator('[data-change="reason"]')).toBeVisible();
    await expect(page.locator('.qlcard').first()).toBeVisible();
    if (viewport.width < 900) await expect(page.locator('.tabbar')).toBeVisible();
    else await expect(page.locator('.tabbar')).toBeHidden();

    expect(await page.evaluate(() => ({
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
      rtl: document.documentElement.dir === 'rtl',
      cardsFit: [...document.querySelectorAll('.qlcard')].every((card) => {
        const box = card.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      }),
      tabbarFits: (() => {
        const bar = document.querySelector('.tabbar');
        if (getComputedStyle(bar).display === 'none') return true;
        const box = bar.getBoundingClientRect();
        return box.left === 0 && box.right === window.innerWidth && box.width === window.innerWidth;
      })(),
    }))).toEqual({ documentFits: true, rtl: true, cardsFit: true, tabbarFits: true });
  }

  expect(errors).toEqual([]);
});

test('long Arabic Quick Log names and both card actions remain reachable in RTL light and dark', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await seedQuickLog(page);
  await page.evaluate(async () => {
    const student = window.store.getStudent('ql-mobile-student-0');
    await window.store.save({ students: [{ ...student,
      name: 'عبد الرحمن بن محمد بن عبد العزيز الطويل الاسم المركب' }] });
  });
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/settings');
    await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/teaching/ql-mobile-teaching/quicklog');
      const card = page.locator('#ql-ql-mobile-student-0');
      const name = card.locator('.qlcard__name');
      await expect(name).toContainText('عبد الرحمن بن محمد');
      await expect(card.locator('[data-act="plus"]')).toBeVisible();
      await expect(card.locator('[data-act="minus"]')).toBeVisible();
      const geometry = await card.evaluate((element) => {
        const name = element.querySelector('.qlcard__name').getBoundingClientRect();
        const card = element.getBoundingClientRect();
        const actions = [...element.querySelectorAll('[data-act="plus"], [data-act="minus"]')]
          .map(node => node.getBoundingClientRect());
        return { documentFits: document.documentElement.scrollWidth <= innerWidth,
          rtl: document.documentElement.dir === 'rtl',
          nameFits: name.left >= card.left && name.right <= card.right,
          actionsFit: actions.every(box => box.width >= 24 && box.height >= 24 &&
            box.left >= card.left && box.right <= card.right && box.top >= card.top && box.bottom <= card.bottom) };
      });
      expect(geometry).toEqual({ documentFits: true, rtl: true, nameFits: true, actionsFit: true });
      await page.screenshot({ path: testInfo.outputPath(`n83-${theme}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
test('Quick Log renders available students before absent and excused students without changing actions', async ({ page }) => {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready);
  const classesHeading = page.getByRole('heading', { level: 1, name: /^الفصول(?:\s|$)/ });
  await expect(classesHeading).toHaveCount(1);
  await expect(classesHeading).toBeVisible();
  await page.evaluate(async () => {
    const { todayISO } = await import('/src/models.js');
    const today = todayISO();
    const year = window.store.activeYear();
    const term = window.store.activeTerm();
    if (!year || !term || term.yearId !== year.id) throw new Error('Test requires a complete academic calendar context');
    await window.store.save({
      sections: [{ id: 'ql-order-section', yearId: year.id, grade: 5, label: 'أ' }],
      teachings: [{ id: 'ql-order-teaching', sectionId: 'ql-order-section', termId: term.id }],
      students: [{ id: 'ql-a', name: 'أحمد', status: 'active' }, { id: 'ql-b', name: 'بدر', status: 'active' }, { id: 'ql-c', name: 'تركي', status: 'active' }, { id: 'ql-d', name: 'سالم', status: 'active' }],
      enrollments: [{ id: 'ql-ea', studentId: 'ql-a', sectionId: 'ql-order-section', status: 'active', rollNo: 1 }, { id: 'ql-eb', studentId: 'ql-b', sectionId: 'ql-order-section', status: 'active', rollNo: 2 }, { id: 'ql-ec', studentId: 'ql-c', sectionId: 'ql-order-section', status: 'active', rollNo: 3 }, { id: 'ql-ed', studentId: 'ql-d', sectionId: 'ql-order-section', status: 'active', rollNo: 4 }],
      sessions: [{ id: 'ql-early', teachingId: 'ql-order-teaching', date: today, period: 1 }, { id: 'ql-late', teachingId: 'ql-order-teaching', date: today, period: 2 }],
      attendance: [{ id: 'ql-aa', sessionId: 'ql-early', studentId: 'ql-a', status: 'absent' }, { id: 'ql-ab', sessionId: 'ql-early', studentId: 'ql-b', status: 'absent' }, { id: 'ql-ac', sessionId: 'ql-early', studentId: 'ql-c', status: 'excused' }, { id: 'ql-ad', sessionId: 'ql-early', studentId: 'ql-d', status: 'excused' }, { id: 'ql-al', sessionId: 'ql-late', studentId: 'ql-a', status: 'present' }, { id: 'ql-cl', sessionId: 'ql-late', studentId: 'ql-c', status: 'present' }],
    });
  });
  await page.goto('/#/teaching/ql-order-teaching/quicklog');
  const cards = page.locator('.qlcard');
  await expect(cards).toHaveCount(4);
  await expect(cards.evaluateAll((nodes) => nodes.map((node) => node.id))).resolves.toEqual(['ql-ql-a', 'ql-ql-c', 'ql-ql-b', 'ql-ql-d']);
  await expect(page.locator('#ql-ql-b')).toHaveClass(/is-unavail/);
  await expect(page.locator('#ql-ql-b')).toContainText('غائب');
  await expect(page.locator('#ql-ql-c')).not.toHaveClass(/is-unavail/);
  await expect(page.locator('#ql-ql-d')).toHaveClass(/is-unavail/);
  await expect(page.locator('#ql-ql-d')).toContainText('مستأذن');
  await page.locator('#ql-ql-a [data-act="plus"]').click();
  await expect(page.locator('#ql-ql-a')).toContainText('+1');
  await page.reload();
  await expect(page.locator('#ql-ql-a')).toContainText('+1'); // Local Quick Log survives a fresh page load.
});
