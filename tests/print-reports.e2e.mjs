import { test, expect } from '@playwright/test';

const maleNames = ['أحمد محمد','محمد خالد','عبدالله سعد','عمر فهد','يوسف علي','خالد عبدالرحمن','سلمان ناصر','عبدالعزيز ماجد','تركي وليد','فهد عادل','ناصر إبراهيم','سعد راشد','ماجد حسن','راكان بدر','زياد طارق','أنس سامي','بدر منصور','وليد صالح','ياسر عوض','فيصل حمد','ريان عبدالمجيد','حسن جابر','علي ناصر','معتز فؤاد','سامي يوسف','طارق مازن','إبراهيم سالم','خليل سلطان','جابر عمر','منصور فهد'];

function errorsFor(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    // Local Vite HMR transport is not part of the Production print runtime.
    if (m.type() === 'error' && !/^WebSocket connection to 'ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/.*failed:/.test(m.text())) errors.push(m.text());
  });
  return errors;
}
async function downloadText(download) { const stream = await download.createReadStream(); let text = ''; for await (const chunk of stream) text += chunk; return text; }

async function seed(page) {
  await page.evaluate(async (names) => {
    const students = names.map((name, index) => ({ id: `print-student-${index}`, name, status: 'active' }));
    const enrollments = students.map((student, index) => ({ id: `print-enrollment-${index}`, studentId: student.id, sectionId: 'print-section', status: 'active', rollNo: index + 1 }));
    const attendance = students.map((student, index) => ({ id: `print-attendance-${index}`, studentId: student.id, sessionId: 'print-session', teachingId: 'print-teaching', date: '2026-08-20', status: index % 5 === 0 ? 'absent' : index % 3 === 0 ? 'late' : 'present' }));
    await window.store.save({
      profile: [{ id: 'profile', teacherName: 'معلمة تجريبية', teacherForm: 'feminine', schoolName: 'مدرسة تجريبية' }],
      years: [{ id: 'print-year', label: '1448-1449' }], terms: [{ id: 'print-term', yearId: 'print-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'print-subject', name: 'الرياضيات' }], sections: [{ id: 'print-section', yearId: 'print-year', grade: 5, label: '1', name: 'الخامس / 1' }],
      teachings: [{ id: 'print-teaching', sectionId: 'print-section', subjectId: 'print-subject', termId: 'print-term' }],
      students, enrollments,
      items: [{ id: 'print-item', teachingId: 'print-teaching', name: 'اختبار قصير', max: 10 }, { id: 'print-participation', teachingId: 'print-teaching', name: 'المشاركة', max: 5, auto: 'participation', perPoint: 1 }],
      scores: [{ id: 'print-score', studentId: 'print-student-0', itemId: 'print-item', value: 8 }],
      logs: [{ id: 'print-log', studentId: 'print-student-0', teachingId: 'print-teaching', kind: 'participation', delta: 2, date: '2026-08-20' }],
      slots: [{ id: 'print-slot', teachingId: 'print-teaching', weekday: 0, period: 1 }],
      sessions: [{ id: 'print-session', teachingId: 'print-teaching', slotId: 'print-slot', date: '2026-08-20', weekday: 0, period: 1, startTime: '07:00', endTime: '07:45' }], attendance,
    });
    await window.store.patchDevice({ activeYearId: 'print-year', activeTermId: 'print-term', reportPrincipalName: '' });
    window.store.repaint();
  }, maleNames);
}

// Inspect real descendants, not just the white body (which masked this bug).
async function printPalette(page) {
  return page.evaluate(() => {
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const root = getComputedStyle(document.documentElement);
    const faintText = [...document.querySelectorAll('main *')].filter(el => visible(el)
      && [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      .filter(el => {
        // Assess text on white paper, without relying on printed backgrounds.
        const channels = getComputedStyle(el).color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const s = value / 255;
          return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
        });
        const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        return 1.05 / (luminance + .05) < 4.5;
      }).map(el => [el.tagName, el.className, getComputedStyle(el).color]);
    const samples = [...document.querySelectorAll('main, main *')].filter(visible).map(el => {
      const style = getComputedStyle(el);
      return [el.tagName, el.className.baseVal ?? el.className, style.color, style.backgroundColor,
        style.backgroundImage, style.borderTopColor, style.borderTopStyle, style.borderTopWidth];
    });
    return {
      scheme: root.colorScheme,
      canvas: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      tokens: ['--bg', '--bg-elev', '--text', '--text-2', '--text-3', '--brand', '--ok', '--danger', '--warn', '--info']
        .map(name => root.getPropertyValue(name).trim()),
      samples,
      faintText,
      controls: [...document.querySelectorAll('button:not(.group__member),input,select,textarea,nav,[role="navigation"],[role="tablist"]')].filter(visible).length,
    };
  });
}

for (const width of [1280, 390]) {
  test(`A4 paper preview isolates computed descendant colors before printing (${width}px)`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors = errorsFor(page);
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/*.supabase.co/**', route => route.abort());
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store);
    await seed(page);
    for (const tab of ['roster', 'grades', 'attendance']) {
      let lightPaper;
      for (const theme of ['light', 'dark', 'auto']) {
        await page.emulateMedia({ media: 'screen', colorScheme: 'dark' });
        await page.goto('/#/settings');
        await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
        await expect.poll(() => page.evaluate(() => window.store.state.device.theme)).toBe(theme);
        await page.goto('/#/teaching/print-teaching/reports');
        // Reload the persisted route: hash-only goto can leave the previous
        // view visible while a lazy onMount resets preview state.
        await page.reload();
        await page.locator(`[data-act="tab"][data-tab="${tab}"]`).click();
        if (tab === 'attendance') await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
        if (!await page.locator('.a4-sheet').count()) await page.locator('[data-act="toggle-a4"]').click();
        const sheet = page.locator('.a4-sheet');
        await expect(sheet).toBeVisible();
        const paper = await sheet.evaluate(root => {
          const inspect = el => {
            const s = getComputedStyle(el);
            return [s.color, s.backgroundColor, s.borderTopColor, s.colorScheme];
          };
          return {
            root: inspect(root),
            aliases: ['--bg-elev', '--surface-raised', '--text', '--text-1', '--t-1', '--text-2', '--text-3', '--t-3']
              .map(name => getComputedStyle(root).getPropertyValue(name).trim()),
            cells: [...root.querySelectorAll('th,td,.printhead__sub,.printhead__meta dt')].map(inspect),
          };
        });
        expect(paper.root[1]).toBe('rgb(255, 255, 255)');
        expect(paper.root[3]).toBe('light only');
        expect(paper.aliases).toEqual(['#fff', '#fff', '#000', '#000', '#000', '#333', '#666', '#666']);
        expect(paper.cells.length).toBeGreaterThan(30);
        expect(paper.cells.every(cell => cell[3] === 'light only')).toBe(true);
        expect(paper.cells.every(cell => !cell[1].includes('23, 27, 33'))).toBe(true);
        if (theme === 'light') lightPaper = paper;
        else expect(paper).toEqual(lightPaper);
        const screenBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
        if (theme !== 'light') expect(screenBg).not.toBe('rgb(255, 255, 255)');
        await sheet.screenshot({ path: testInfo.outputPath(`${theme}-${tab}-paper.png`) });
        // Use the actual preview Print control, preserving native window.print.
        await page.evaluate(() => {
          window.__paperPrintCalls = 0;
          const nativePrint = window.print.bind(window);
          window.print = () => { window.__paperPrintCalls++; nativePrint(); };
        });
        await page.locator('[data-act="print"]').first().click();
        await page.locator('button[form="pre-print-form"]').click();
        await expect.poll(() => page.evaluate(() => window.__paperPrintCalls)).toBe(1);
        await page.emulateMedia({ media: 'print' });
        const printed = await printPalette(page);
        expect(printed.scheme).toBe('light only');
        expect(printed.canvas).toBe('rgb(255, 255, 255)');
        expect(printed.controls).toBe(0);
        expect(printed.faintText).toEqual([]);
        await page.pdf({ path: testInfo.outputPath(`${theme}-${tab}.pdf`), preferCSSPageSize: true, printBackground: false });
        await page.emulateMedia({ media: 'screen' });
        expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(screenBg);
      }
    }
    expect(errors).toEqual([]);
  });

  test(`print output is theme-independent on desktop/mobile (${width}px) without changing screen preference`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = errorsFor(page);
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/*.supabase.co/**', route => route.abort());
    await page.goto('/#/classes');
    await page.waitForFunction(() => window.store);
    await seed(page);
    await page.evaluate(async () => {
      await window.store.save({ groupArrangements: [{ id: 'print-groups', teachingId: 'print-teaching',
        groups: Array.from({ length: 8 }, (_, group) => window.store.students('print-teaching').slice(group * 4, group * 4 + 4).map(student => student.id)) }] }, { queue: false });
    });
    const modes = ['light', 'dark', 'auto']; // auto + OS dark is the real system-dark path.
    const surfaces = [
      { tab: 'roster' }, { tab: 'grades' }, { tab: 'attendance' },
      { tab: 'attendance', detailed: true }, { tab: 'support' },
      { route: '/#/reports/execution' },
      { route: '/#/student/print-student-0' },
      { route: '/#/teaching/print-teaching/groups', groups: true },
    ];
    for (const surface of surfaces) {
      let lightPalette;
      for (const theme of modes) {
        await page.emulateMedia({ media: 'screen', colorScheme: 'dark' });
        await page.evaluate(async theme => { await window.store.patchDevice({ theme }); window.store.applyTheme(); window.store.repaint(); }, theme);
        await page.goto(surface.route ?? '/#/teaching/print-teaching/reports');
        await page.reload();
        await page.waitForFunction(() => window.store?.state?.ready);
        // Hash navigation does not await the lazy Student view; do not click
        // the previous report's Print control while that view is still loading.
        if (surface.route === '/#/student/print-student-0') await expect(page.locator('.student-profile-header')).toBeVisible();
        if (surface.tab) await page.locator(`[data-act="tab"][data-tab="${surface.tab}"]`).click();
        if (surface.detailed) await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
        else if (surface.tab === 'attendance') await page.locator('[data-act="att-mode"][data-mode="brief"]').click();
        if (surface.groups) await expect(page.locator('#groups-container')).toBeVisible();
        const preference = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), theme: window.store.state.device.theme }));
        expect(preference).toEqual({ attr: theme === 'auto' ? null : theme, theme });
        const screenBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
        if (theme !== 'light') expect(screenBg).not.toBe('rgb(255, 255, 255)');
        // Exercise the supported control and confirmation without opening an OS dialog.
        await page.evaluate(() => { window.__printCalls = 0; window.print = () => window.__printCalls++; });
        await page.locator('[data-act="print"]').first().click();
        const confirmation = page.locator('button[form="pre-print-form"]');
        if (surface.tab || surface.route === '/#/reports/execution') await confirmation.click();
        await expect.poll(() => page.evaluate(() => window.__printCalls)).toBe(1);
        const dataBefore = await page.evaluate(() => JSON.stringify({ attendance: window.store.state.attendance, scores: window.store.state.scores, sessions: window.store.state.sessions }));
        await page.emulateMedia({ media: 'print' });
        const palette = await printPalette(page);
        expect(palette.scheme).toBe('light only');
        expect(palette.canvas).toBe('rgb(255, 255, 255)');
        expect(palette.text).toBe('rgb(0, 0, 0)');
        expect(palette.controls).toBe(0);
        expect(palette.faintText).toEqual([]);
        expect(palette.samples.length).toBeGreaterThan(20);
        expect(palette.samples.every(sample => sample[4] === 'none')).toBe(true);
        if (surface.groups) await expect(page.locator('.group__member-name')).toHaveCount(30);
        if (theme === 'light') lightPalette = palette;
        else expect(palette).toEqual(lightPalette);
        if (surface.tab) {
          const table = surface.tab === 'support' ? page.locator('.print-only table') : page.locator('.gtable--report');
          await expect(table).toContainText(surface.tab === 'support' ? 'محمد خالد' : 'أحمد محمد');
          expect(await table.locator('thead').evaluate(el => getComputedStyle(el).display)).toBe('table-header-group');
          // Page setup remains a genuine table report, never a screen screenshot.
          expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);
          expect(await page.locator('[data-report-page-size]').textContent()).toContain(`A4 ${surface.tab === 'grades' || surface.detailed ? 'landscape' : 'portrait'}`);
        }
        await page.emulateMedia({ media: 'screen' });
        expect(await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), theme: window.store.state.device.theme }))).toEqual(preference);
        expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(screenBg);
        expect(await page.evaluate(() => JSON.stringify({ attendance: window.store.state.attendance, scores: window.store.state.scores, sessions: window.store.state.sessions }))).toBe(dataBefore);
      }
      await page.reload();
      await page.waitForFunction(() => window.store?.state?.ready && window.store.state.device);
      expect(await page.evaluate(() => window.store.state.device.theme)).toBe('auto');
    }
    expect(errors).toEqual([]);
  });
}

test('administration print reports preserve data, local metadata, privacy, RTL, and print media', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = errorsFor(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store, { timeout: 15_000 });
  await seed(page);

  await page.goto('/#/teaching/print-teaching/reports');
  // Match the established readiness path above: a hash-only transition can
  // briefly leave the classes view mounted while the lazy report view loads.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'كشف الدرجات', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'الطلاب', exact: true }).click();
  await expect(page.locator('[data-act="tab"][data-tab="roster"]')).toBeVisible();
  await expect(page.locator('.gtable--report tbody tr')).toHaveCount(30);
  await expect(page.locator('.gtable--report')).toContainText('أحمد محمد');
  await expect(page.locator('main')).not.toContainText('الهوية الوطنية');
  await expect(page.locator('.print-signatures')).not.toContainText('مديرة المدرسة');
  await expect(page.getByRole('button', { name: 'طباعة' })).toBeVisible();

  await page.getByRole('button', { name: 'طباعة' }).click();
  await expect(page.locator('#pre-print-form')).toBeVisible();
  await expect(page.getByText('اسم المعلمة', { exact: true })).toBeVisible();
  await expect(page.getByText(/اسم المديرة/, { exact: false })).toBeVisible();
  await page.locator('input[name="principalName"]').fill('مديرة تجريبية');
  await page.locator('button[form="pre-print-form"]').click();
  await expect(page.locator('.print-signatures')).toContainText('معلمة المادة');
  await expect(page.locator('.print-signatures')).toContainText('مديرة المدرسة');
  await expect(page.locator('.print-signatures')).toContainText('مديرة تجريبية');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'كشف الدرجات', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'الطلاب', exact: true }).click();
  await expect(page.locator('.print-signatures')).toContainText('مديرة تجريبية');

  const rosterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const rosterFile = await rosterDownload;
  await expect(rosterFile.suggestedFilename()).toMatch(/^طلاب-/);
  expect(await downloadText(rosterFile)).toContain('أحمد محمد');

  await page.locator('[data-act="tab"][data-tab="attendance"]').click();
  await expect(page.locator('.gtable--report')).toContainText('غياب');
  const attendanceDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const attendanceFile = await attendanceDownload;
  await expect(attendanceFile.suggestedFilename()).toMatch(/^حضور-/);
  const attendanceText = await downloadText(attendanceFile);
  expect(attendanceText).toContain('20 أغسطس 2026');
  expect(attendanceText).toContain('أحمد محمد');
  expect(attendanceText).not.toMatch(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/);

  await page.locator('[data-act="tab"][data-tab="support"]').click();
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصدير CSV' })).toBeVisible();
  await expect(page.locator('.list')).toContainText('محمد خالد');
  const supportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const supportFile = await supportDownload;
  await expect(supportFile.suggestedFilename()).toMatch(/^دعم-/);
  const supportText = await downloadText(supportFile);
  expect(supportText).toContain('محمد خالد');
  expect(supportText).toContain('مؤشرات الدعم');
  expect(supportText).not.toContain('print-student-');
  expect(supportText).not.toContain('updatedAt');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-only .gtable--report')).toContainText('مؤشرات الدعم');
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.report-actions')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.locator('[data-act="tab"][data-tab="grades"]').click();
  await expect(page.locator('.gtable--report')).toContainText('اختبار قصير');
  await expect(page.locator('.gtable--report tbody tr').nth(1)).toContainText('0');
  const gradesDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  await expect((await gradesDownload).suggestedFilename()).toMatch(/^درجات-/);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.report-actions')).toBeHidden();
  await expect(page.locator('.printhead')).toBeVisible();
  expect(await page.locator('.gtable thead').evaluate(el => getComputedStyle(el).display)).toBe('table-header-group');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'screen' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/#/reports/execution');
  await expect(page.locator('.gtable--report')).toBeVisible();
  await expect(page.locator('.gtable--report')).toContainText('تم رصد الحضور');
  const executionDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const executionFile = await executionDownload;
  await expect(executionFile.suggestedFilename()).toBe('تنفيذ-الحصص.csv');
  const executionText = await downloadText(executionFile);
  expect(executionText).toContain('07:00 – 07:45');
  expect(executionText).not.toContain('print-session');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.print-signatures')).toContainText('مديرة تجريبية');
  await page.emulateMedia({ media: 'screen' });
  expect(errors).toEqual([]);
});
