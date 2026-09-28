import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
let host, server;
test.beforeAll(async () => {
  host = process.env.RAKEEZX_GRADES0366_URL;
  if (host) return;
  const root = process.cwd();
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  server = createServer(async (req, res) => {
    const file = path.resolve(root, new URL(req.url, 'http://local').pathname.slice(1) || 'index.html');
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw Error();
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function boot(page) {
  const evidence = { errors: [], cloud: [] };
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') evidence.errors.push(message.text()); });
  await page.context().route('https://xlrubcwjqktzzunrvuns.supabase.co/**', route => {
    evidence.cloud.push(route.request().url());
    return route.abort();
  });
  // Bounded Demo fixture; real Product view, handlers and IndexedDB remain in use.
  await page.context().route('**/src/lib/demo-workspace.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/const CLASS_PLAN = Object.freeze\(\[[\s\S]*?\]\);/, 'const CLASS_PLAN = Object.freeze([]);') });
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('rakeezx-demo-session-v1')) sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing');
  });
  await page.goto(host + '/#/classes');
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  await page.waitForFunction(async () => (await import('/src/store.js')).state.ready);
  await page.evaluate(async () => {
    const s = await import('/src/store.js');
    await s.save({
      years: [{ id: 'g-year', name: 'سنة اختبار' }],
      terms: [{ id: 'g-term', yearId: 'g-year', name: 'فصل اختبار', index: 1 }],
      subjects: [{ id: 'g-subject', name: 'العلوم' }],
      sections: [{ id: 'g-section', yearId: 'g-year', grade: 7, label: 'أ', status: 'active' }],
      teachings: [{ id: 'g-teaching', sectionId: 'g-section', subjectId: 'g-subject', termId: 'g-term' }],
      students: ['عمر علي', 'محمد بن عبدالله بن عبدالرحمن القحطاني', 'عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل عبدالرحمن الشهراني', 'فهد عبدالله الزهراني'].map((name, i) => ({ id: `g-s${i + 1}`, name, status: 'active' })),
      enrollments: [1, 2, 3, 4].map(i => ({ id: `g-e${i}`, studentId: `g-s${i}`, sectionId: 'g-section', status: 'active', rollNo: i })),
      items: [
        { id: 'g-m20', name: 'الاختبار القصير', max: 20, order: 0 },
        { id: 'g-m10', name: 'الأداء الصفي', max: 10, order: 1 },
        { id: 'g-p', name: 'المشاركة', max: 20, auto: 'participation', perPoint: 1, order: 2 },
        { id: 'g-a', name: 'الحضور', max: 10, auto: 'attendance', penalty: 1, order: 3 },
        { id: 'g-sub', name: 'المهمة العملية', max: 10, scoreMode: 'subitems', distributionMode: 'manual', order: 4 },
      ].map(item => ({ ...item, teachingId: 'g-teaching' })),
      logs: [{ id: 'g-log', studentId: 'g-s1', teachingId: 'g-teaching', kind: 'participation', delta: 5, date: '2026-09-28' }],
      scoreSubitems: [{ id: 'g-q', itemId: 'g-sub', name: 'الفهم', value: 3, order: 0 }],
    });
    await s.patchDevice({ activeYearId: 'g-year', activeTermId: 'g-term' });
    await s.setScore('g-s1', 'g-m20', 5);
    await s.setScore('g-s3', 'g-m20', 20);
    await s.setScore('g-s1', 'g-m10', 9);
  });
  await page.goto(host + '/#/teaching/g-teaching/grades');
  await expect(page.locator('.grades-01c__direct-row')).toHaveCount(4);
  return evidence;
}
async function safe(page, evidence) {
  expect(evidence.errors).toEqual([]);
  expect(evidence.cloud).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

for (const theme of ['light', 'dark']) test(`manual and automatic RTL geometry across widths (${theme})`, async ({ page }, info) => {
  const evidence = await boot(page);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    for (const id of ['g-m20', 'g-m10', 'g-p', 'g-a']) {
      await page.locator(`[data-act=pick][data-id="${id}"]`).click();
      const auto = id === 'g-p' || id === 'g-a';
      if (!auto) await page.locator('[data-act=toggle-student-bulk][data-id="g-s1"]').check();
      const rows = page.locator('.grades-01c__direct-row');
      await expect(rows).toHaveCount(4);
      for (const row of await rows.all()) {
        const geometry = await row.evaluate(el => {
          const box = selector => { const r = el.querySelector(selector)?.getBoundingClientRect(); return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
          return { checkbox: box('input[type=checkbox]'), roll: box('.rollno'), name: box('.graderow__name'), input: box('.gradein'), slash: box('.graderow__slash'), max: box('.graderow__max'), score: box('.graderow__auto'), columns: getComputedStyle(el).gridTemplateColumns };
        });
        expect(geometry.roll.width).toBe(34);
        expect(geometry.roll.bottom - geometry.roll.top).toBe(34);
        const centering = await row.locator('.rollno').evaluate(el => {
          const badge = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const number = range.getBoundingClientRect();
          return { x: Math.abs((number.left + number.right - badge.left - badge.right) / 2), y: Math.abs((number.top + number.bottom - badge.top - badge.bottom) / 2) };
        });
        expect(centering.x).toBeLessThanOrEqual(1);
        // Font glyph bounds may differ from the centered line box by subpixels.
        expect(centering.y).toBeLessThanOrEqual(2);
        const unchanged = await row.evaluate(el => {
          const rects = () => [el, ...el.children].map(node => {
            const r = node.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          });
          const centered = rects();
          const rule = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).find(rule =>
            rule.selectorText === '.grades-01c__direct-row > .rollno' && rule.style.justifyContent === 'center');
          const style = rule.style.cssText;
          // Compare every row/child box with the unchanged 0366 alignment.
          try { rule.style.cssText = ''; return JSON.stringify(centered) === JSON.stringify(rects()); }
          finally { rule.style.cssText = style; }
        });
        expect(unchanged).toBe(true);
        expect(geometry.roll.left).toBeGreaterThanOrEqual(geometry.name.right - 1);
        if (auto) {
          expect(geometry.checkbox).toBeUndefined();
          expect(geometry.columns.split(' ')).toHaveLength(3);
          expect(geometry.score.right).toBeLessThanOrEqual(geometry.name.left + 1);
          await expect(row.locator('.badge')).toHaveAttribute('dir', 'ltr');
        } else {
          expect(geometry.checkbox.left).toBeGreaterThan(geometry.roll.left);
          expect(geometry.input.left).toBeGreaterThanOrEqual(geometry.slash.right - 1);
          expect(geometry.slash.left).toBeGreaterThanOrEqual(geometry.max.right - 1);
          await expect(row.locator('.graderow__max')).toHaveText(id === 'g-m20' ? '20' : '10');
        }
      }
      if (id === 'g-p') await expect(rows.first().locator('.badge')).toHaveText('5 / 20');
      await safe(page, evidence);
      if ((width === 1440 || width === 320) && (id === 'g-m20' || id === 'g-p')) await page.screenshot({ path: info.outputPath(`${id}-${width}-${theme}.png`), fullPage: true });
    }
  }
});

test('real score entry, Enter, sort, filter, bulk, table, subitems and reload', async ({ page }) => {
  const evidence = await boot(page);
  const first = page.locator('[data-fk="g-g-s1-g-m20"]');
  await first.fill('7');
  await first.press('Enter');
  await expect(page.locator('[data-fk="g-g-s2-g-m20"]')).toBeFocused();
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('scores')).find(s => s.studentId === 'g-s1' && s.itemId === 'g-m20')?.value)).toBe(7);
  await page.locator('[data-change=sort]').selectOption('score_desc');
  await expect(page.locator('.graderow__name').first()).toContainText('عبدالرحمن');
  await page.locator('[data-change=toggle-missing]').check();
  await expect(page.locator('.grades-01c__direct-row')).toHaveCount(2);
  await page.locator('[data-change=toggle-missing]').uncheck();
  await page.locator('[data-change=sort]').selectOption('default');
  await page.locator('[data-act=toggle-student-bulk][data-id="g-s2"]').check();
  await expect(page.locator('.graderow.is-selected')).toHaveCount(1);
  await page.locator('[data-input=bulk-score-input]').fill('8');
  await page.locator('[data-act=apply-bulk]').click();
  await expect(page.locator('[data-fk="g-g-s2-g-m20"]')).toHaveValue('8');
  await expect(page.locator('.graderow.is-selected')).toHaveCount(0);
  await page.locator('[data-act=mode][data-mode=table]').click();
  const tableInput = page.locator('[data-fk="t-g-s1-g-m10"]');
  await tableInput.fill('6');
  await tableInput.press('Tab');
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('scores')).find(s => s.studentId === 'g-s1' && s.itemId === 'g-m10')?.value)).toBe(6);
  await page.locator('[data-act=mode][data-mode=item]').click();
  await page.locator('[data-act=pick][data-id="g-sub"]').click();
  await page.locator('label').filter({ has: page.locator('[data-change=subitem-completion][data-student="g-s1"]') }).click();
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('scoreSubitemCompletions')).some(s => s.studentId === 'g-s1' && s.checked))).toBe(true);
  await page.reload();
  await expect(page.locator('[data-fk="g-g-s1-g-m20"]')).toHaveValue('7');
  await expect(page.locator('[data-fk="g-g-s2-g-m20"]')).toHaveValue('8');
  await page.locator('[data-act=pick][data-id="g-m10"]').click();
  await expect(page.locator('[data-fk="g-g-s1-g-m10"]')).toHaveValue('6');
  await page.locator('[data-act=pick][data-id="g-sub"]').click();
  await expect(page.locator('[data-change=subitem-completion][data-student="g-s1"]')).toBeChecked();
  await safe(page, evidence);
});
