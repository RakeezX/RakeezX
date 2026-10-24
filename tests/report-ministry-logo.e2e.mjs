import { test, expect } from '@playwright/test';

test('official reports and student summary retain the supplied Ministry logo through prepared printing', async ({ page, context, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => socket.close());
  let releaseLogo;
  const logoGate = new Promise(resolve => { releaseLogo = resolve; });
  await context.route(url => url.origin === origin && /\/ministry-of-education(?:-[^.]+)?\.png$/.test(url.pathname), async route => {
    await logoGate;
    await route.continue();
  });
  await context.addInitScript(() => {
    sessionStorage.setItem('rakeezx-demo-session-v1', 'active');
    window.__reportPrintProofs = [];
    window.print = () => window.__reportPrintProofs.push({
      title: document.title,
      logos: [...document.querySelectorAll('img[data-report-ministry]')].map(image => ({
        complete: image.complete, width: image.naturalWidth, height: image.naturalHeight,
      })),
    });
  });
  await page.goto('/#/classes');
  await page.waitForFunction(async () => {
    const store = await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type === 'demo' && store.state.students.length > 0;
  });
  await page.locator('.boot').waitFor({ state: 'detached' });
  const fixture = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    if (store.getActiveWorkspace()?.type !== 'demo') throw new Error('Synthetic Demo required');
    const teaching = store.teachings().find(item => store.students(item.id).length);
    if (!teaching) throw new Error('Populated synthetic teaching required');
    const student = store.students(teaching.id)[0];
    const keys = ['students', 'enrollments', 'items', 'scores', 'attendance', 'logs', 'sessions', 'profile'];
    return { teachingId: teaching.id, studentId: student.id, keys,
      state: JSON.stringify(Object.fromEntries(keys.map(key => [key, store.state[key]]))) };
  });

  // An early print must wait for the logo; navigation during that wait cancels it.
  const classRoute = `/#/teaching/${fixture.teachingId}/reports`;
  await page.goto(classRoute, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.print-report img[data-report-ministry]')).toHaveCount(1);
  await page.evaluate(() => {
    window.__staleReportPrint = import('/src/lib/report-print.js').then(({ printReport }) => {
      window.__reportPreparationStarted = true;
      return printReport('تقرير تجريبي');
    });
  });
  await expect.poll(() => page.evaluate(() => window.__reportPreparationStarted)).toBe(true);
  expect(await page.evaluate(() => window.__reportPrintProofs.length)).toBe(0);
  await page.evaluate(() => { location.hash = '#/reports'; });
  await expect(page.locator('.reports-index-page')).toBeVisible();
  releaseLogo();
  expect(await page.evaluate(() => window.__staleReportPrint)).toBe(false);
  expect(await page.evaluate(() => window.__reportPrintProofs.length)).toBe(0);

  const routes = [
    { name: 'class', url: classRoute, selector: '.print-report--grades' },
    { name: 'all-classes', url: '/#/reports/grades', selector: '.n70-report-page[data-report-kind="grades"]' },
    { name: 'student', url: `/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`, selector: '.student-profile-page' },
  ];
  for (const route of routes) {
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route.url);
    const report = page.locator(route.selector);
    await expect(report).toBeVisible();
    const logo = report.locator('img[data-report-ministry]');
    await expect(logo).toHaveCount(1);
    await logo.evaluate(image => image.decode());
    expect(await logo.evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([866, 659]);
    await expect(logo).toHaveAttribute('alt', 'وزارة التعليم');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ media: 'print' });
    await expect(logo).toBeVisible();
    const bounds = await report.locator('.printhead').evaluate(header => {
      const image = header.querySelector('img[data-report-ministry]').getBoundingClientRect();
      const title = header.querySelector('.printhead__title').getBoundingClientRect();
      return { width: image.width, height: image.height,
        overlap: Math.min(image.right, title.right) > Math.max(image.left, title.left)
          && Math.min(image.bottom, title.bottom) > Math.max(image.top, title.top) };
    });
    expect(bounds.width).toBeGreaterThan(40);
    expect(bounds.height).toBeGreaterThan(30);
    expect(bounds.width / bounds.height).toBeCloseTo(866 / 659, 2);
    expect(bounds.overlap).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`report-ministry-${route.name}.png`), fullPage: false });
    if (route.name === 'class') {
      const printed = await page.evaluate(async () => (await import('/src/lib/report-print.js')).printReport('كشف الدرجات'));
      expect(printed).toBe(true);
      const proof = await page.evaluate(() => window.__reportPrintProofs.at(-1));
      expect(proof.logos).toEqual([{ complete: true, width: 866, height: 659 }]);
      expect(proof.title).toContain('كشف الدرجات');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      const pdf = await page.pdf({ path: testInfo.outputPath('report-ministry-class.pdf'), preferCSSPageSize: true, printBackground: true });
      expect(pdf.toString('latin1')).toMatch(/\/Subtype \/Image\b/);
    }
  }
  expect(await page.evaluate(async keys => {
    const store = await import('/src/store.js');
    return JSON.stringify(Object.fromEntries(keys.map(key => [key, store.state[key]])));
  }, fixture.keys)).toBe(fixture.state);
  expect(errors).toEqual([]);
});
