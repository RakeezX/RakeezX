import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });

const forbidden = /[\u0660-\u0669\u06f0-\u06f9]/;
const sizes = [1440, 390, 320];

async function visibleText(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const text = document.body.innerText;
    const controls = [...document.querySelectorAll('input, select, textarea, [aria-label], [title], [placeholder]')]
      .filter(visible).flatMap((element) => [element.value, element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('placeholder')]);
    return [text, ...controls.filter(Boolean)].join(' ');
  });
}

test('combined display contract on real app surfaces at required viewport and theme matrix', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready);
  const fixture = await page.evaluate(async () => {
    const section = await window.store.createSection({ grade: 5, label: 'A', name: 'فصل تجريبي' });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    const student = await window.store.addStudent(section.id, 'طالب تجريبي');
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    await window.store.addSlot(teaching.id, now.getDay(), 1);
    const seeded = await window.store.ensureSession(teaching.id, today, 1);
    await window.store.save({ sessions: [{ ...seeded, startTime: '08:02:00', endTime: '08:32:00' }] }, { queue: false });
    const session = window.store.getSession(seeded.id);
    return { teachingId: teaching.id, studentId: student.id, sessionId: session.id, startTime: session.startTime, endTime: session.endTime };
  });
  expect(fixture.startTime).toBe('08:02:00');
  expect(fixture.endTime).toBe('08:32:00');

  const routes = [
    ['Home', '/'], ['Teaching', `/teaching/${fixture.teachingId}`],
    ['Attendance', `/teaching/${fixture.teachingId}/attendance?session=${fixture.sessionId}`],
    ['Settings', '/settings'], ['Backup', '/settings/backup'],
    ['Student', `/student/${fixture.studentId}`], ['Report', `/teaching/${fixture.teachingId}/reports`],
    ['Schedule', '/schedule'],
  ];
  for (const width of sizes) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.evaluate(async (value) => {
      await window.store.patchDevice({ theme: value });
      window.store.applyTheme();
    }, theme);
    for (const [surface, route] of routes) {
      await page.goto(`/#${route}`);
      await page.waitForFunction(() => window.store?.state?.ready);
      await expect(page.locator('main').first()).toBeVisible();
      const text = await visibleText(page);
      expect(text, `${surface} ${width} ${theme}`).not.toMatch(forbidden);
      if (['Home', 'Teaching', 'Attendance'].includes(surface)) {
        expect(text, `${surface} ${width} ${theme}`).toContain('08:02');
        expect(text, `${surface} ${width} ${theme}`).toContain('08:32');
        expect(text, `${surface} ${width} ${theme}`).not.toMatch(/08:02:00|08:32:00/);
      }
    }
  }
  const stored = await page.evaluate(async (id) => {
    const session = window.store.getSession(id);
    return [session.startTime, session.endTime];
  }, fixture.sessionId);
  expect(stored).toEqual(['08:02:00', '08:32:00']);
  expect(errors).toEqual([]);
});

test('print, CSV, schedule export, input and Demo presentation preserve source values', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready);
  const result = await page.evaluate(async () => {
    const { normalizeTimeDigits } = await import('/src/lib/dom.js');
    const { toCSV } = await import('/src/lib/export.js');
    const { reportHeader } = await import('/src/lib/report-print.js');
    const { schedulePrintDocument } = await import('/src/lib/schedule-export.js');
    const input = '٠٨:۳۰';
    const source = 'فصل ٤ / طالب ۳';
    return {
      input, normalized: normalizeTimeDigits(input), source,
      csv: toCSV([['الفصل', source]]),
      print: String(reportHeader({ title: source, year: '١٤٤٨' })),
      schedule: schedulePrintDocument({ title: source, identity: {}, academic: { year: '١٤٤٨', term: 'فصل ۲' }, periods: [{ period: 1 }], days: [{ label: 'يوم ۳', periods: [{ teaching: { classLabel: source, subjectLabel: 'فن ۵' }, time: null }] }] }),
    };
  });
  expect(result.normalized).toBe('08:30');
  expect(result.input).toBe('٠٨:۳۰');
  expect(result.source).toBe('فصل ٤ / طالب ۳');
  for (const output of [result.csv, result.print, result.schedule]) expect(output).not.toMatch(forbidden);

  await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready);
  expect(await visibleText(page)).not.toMatch(forbidden);
});
