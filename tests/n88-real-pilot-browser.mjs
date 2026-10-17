import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { startPilotServer } from './fixtures/n88-real-pilot/server.mjs';
const taskId = 'continuous-n88-real-use-readonly-pilot-preparation-20261017';
const runId = '3c617c1e-b814-4bb3-beeb-df52b8f77490';
const checks = [], server = await startPilotServer();
const appOnly = process.argv.includes('--app-only');
if (appOnly) checks.push(...JSON.parse(await readFile('tests/n88-real-pilot-browser.json', 'utf8')).checks.filter(c => c.name.startsWith('actual-source-ui-')));
const save = async () => writeFile('tests/n88-real-pilot-browser.json', JSON.stringify({ taskId, runId, target: 'task-owned loopback HTTP with fabricated auth/repository/clock; actual source UI/CSS; no hosted service', checks,
  limits: ['No hosted SQL/RLS or real teacher authentication', 'No physical mobile, deployed HTTPS/proxy, Service Worker/offline certification', 'Print/clipboard adapter calls injected; no OS printer/clipboard proof'], cleanup: 'All owned contexts/browser closed by canonical helper; server closed in finally.' }, null, 2) + '\n');
const snapshot = page => page.evaluate(async () => {
  const db = await import('/src/lib/db.js');
  return { local: { ...localStorage }, session: { ...sessionStorage },
    rows: Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)]))) };
});
try {
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: server.url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const [width, theme] of appOnly ? [] : [[320, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
      server.reset();
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA', colorScheme: theme });
      await context.addInitScript(theme => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = theme; }); }, theme);
      const teacher = await context.newPage(), errors = [], requests = [];
      context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
      teacher.on('pageerror', e => errors.push(e.message));
      context.on('request', r => requests.push({ url: r.url(), method: r.method() }));
      await teacher.goto(server.url + '/teacher');
      await teacher.locator('select option[value="enrollment-a"]').waitFor({ state: 'attached' });
      assert.equal(await teacher.locator('select option').count(), 3, 'only current owner students');
      const review = async () => { await teacher.locator('select').selectOption('enrollment-a'); await teacher.locator('button[type=submit]').click(); };
      await review(); await teacher.locator('[data-cancel]').click();
      assert.equal(server.fixture.repo.snapshot().invites.length, 0, 'cancel causes no service mutation');
      await review(); await teacher.locator('[data-issue]').click();
      await teacher.locator('textarea').waitFor();
      const link = await teacher.locator('textarea').inputValue(), token = link.split('#invite=')[1];
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      await teacher.locator('[data-copy]').click();
      assert.equal(await teacher.evaluate(() => window.fabricatedCopy), link);
      await teacher.locator('[data-print]').click();
      assert.equal(await teacher.evaluate(() => window.fabricatedPrint), true);
      await teacher.locator('[data-cancel]').click();
      assert.equal(await teacher.locator('textarea').count(), 0);

      const student = await context.newPage();
      const logMessages = []; student.on('console', m => logMessages.push(m.text()));
      await student.goto(link);
      await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      assert.ok(new URL(student.url()).hash === '', 'fragment cleared');
      assert.equal(await student.locator('h1').evaluate(el => document.activeElement === el), true);
      assert.ok((await student.locator('main').innerText()).includes('تصميم عرض عن الأمان الرقمي'));
      assert.ok((await student.locator('aside').innerText()).includes('1 من 2'));
      assert.doesNotMatch(await student.locator('main').innerText(), /OTHER|PRIVATE|UNPUBLISHED|نتيجة نشرها المعلم/);
      assert.equal(await student.locator('[data-tasks] a, [data-tasks] input, [data-tasks] button').count(), 0);
      assert.equal(await student.evaluate(() => document.cookie.includes('__Host-n88')), false, 'HttpOnly cookie unreadable to JS');
      const cookies = await context.cookies();
      const c = cookies.find(c => c.name === '__Host-n88');
      assert.ok(c?.httpOnly && c.secure && c.sameSite === 'Strict');
      const storage = await student.evaluate(async () => ({ local: { ...localStorage }, session: { ...sessionStorage }, dbs: await indexedDB.databases() }));
      assert.deepEqual(storage, { local: {}, session: {}, dbs: [] });
      assert.ok(requests.every(r => !r.url.includes(token) && !new URL(r.url).search));
      assert.ok(logMessages.every(m => !m.includes(token)));
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await student.locator('main').evaluate(el => getComputedStyle(el).direction), 'rtl');
      for (const box of await student.locator('button').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return { width: b.width, height: b.height }; }))) assert.ok(box.width >= 44 && box.height >= 44);
      if ((width === 320 && theme === 'light') || (width === 1280 && theme === 'dark')) await student.screenshot({ path: `tests/fixtures/n88-real-pilot/student-${width}-${theme}.png`, fullPage: true });
      await student.reload(); await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      await server.fixture.repo.transaction(db => { db.publications[0].resultPublished = true; });
      await student.locator('[data-refresh]').click(); await student.getByText('نتيجة نشرها المعلم: 8 من 10').first().waitFor();
      await server.fixture.repo.transaction(db => { db.publications[0].published = false; });
      await student.locator('[data-refresh]').click();
      await student.getByText('لا توجد مهام معلّقة منشورة الآن.').waitFor();
      assert.ok(!(await student.locator('main').innerText()).includes('تصميم عرض عن الأمان الرقمي'));
      await review(); await teacher.locator('[data-revoke]').click();
      await teacher.getByText('أُلغي الوصول.').waitFor();
      await student.locator('[data-refresh]').click();
      await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('[data-tasks]').count(), 0);
      await student.goto(link); await student.waitForFunction(() => location.hash === '');
      await student.locator('[data-claim]').waitFor();
      assert.ok(new URL(student.url()).hash === '', 'same-document replay fragment cleared');
      // Manual entry preserves the entire secret and exercises same claim handlers.
      await review(); await teacher.locator('[data-issue]').click(); await teacher.locator('textarea').waitFor();
      const manual = (await teacher.locator('textarea').inputValue()).split('#invite=')[1];
      await student.locator('input').fill('123456'); await student.locator('input').press('Enter');
      await student.getByText('تعذّر فتح المساحة. اطلب دعوة جديدة من معلمك.').waitFor();
      await student.locator('input').fill(manual); await student.locator('input').press('Enter');
      await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      await student.goto(server.url + '/student#invite=' + 'z'.repeat(43));
      await student.waitForFunction(() => location.hash === ''); await student.locator('[data-claim]').waitFor();
      await student.reload(); await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('[data-tasks]').count(), 0, 'failed new invite cannot restore prior student');
      // Reissue after failed context switch, then test actual successful logout.
      await teacher.locator('[data-cancel]').click(); await review(); await teacher.locator('[data-issue]').click();
      await teacher.locator('textarea').waitFor();
      const finalToken = (await teacher.locator('textarea').inputValue()).split('#invite=')[1];
      await student.locator('input').fill(finalToken); await student.locator('input').press('Enter');
      await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      await student.locator('[data-logout]').click(); await student.locator('[data-claim]').waitFor();
      assert.equal((await context.cookies()).filter(c => c.name === '__Host-n88').length, 0);
      assert.deepEqual(errors, []);
      checks.push({ name: `actual-source-ui-${width}-${theme}`, status: 'PASS', evidence: 'Teacher selection/cancel/issue/manual copy+print injection; fragment claim; actual Secure HttpOnly Strict cookie on loopback; reload/read; default-off and explicitly published result; unpublish; revoke/replay; full-secret fallback; logout; RTL/overflow/44px/storage/URL checks. Synthetic transport only.' });
      await context.close();
    }
    await save();
    // Targeted actual application entry: no DB/store writes when mounting/cancelling
    // the new controller in the existing synthetic Demo document. No real toolbar change.
    server.reset();
    const context = await createContext({ viewport: { width: 390, height: 900 }, locale: 'ar-SA' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    const bootProblems = [];
    page.on('pageerror', e => bootProblems.push(e.message));
    page.on('response', r => { if (r.status() >= 400) bootProblems.push(r.status() + ' ' + new URL(r.url()).pathname); });
    try { await openReadyServedDemo(page, server.url); }
    catch { throw Error('Actual app readiness failed: ' + bootProblems.join('; ')); }
    const before = await snapshot(page);
    await page.evaluate(async () => {
      const { mountTeacherInvitations } = await import('/drafts/n88-student-portal/teacher-controller.js');
      const { createStudentPortalClient } = await import('/src/lib/student-portal-client.js');
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/drafts/n88-student-portal/portal.css'; document.head.append(css);
      const root = document.createElement('section'); root.id = 'injected-pilot'; document.body.prepend(root);
      window.injectedPilot = await mountTeacherInvitations(root, { studentUrl: location.origin + '/student',
        client: createStudentPortalClient({ fetch: (url, options) => fetch(url, { ...options, headers: { ...options.headers, 'X-Fixture-Teacher': 'fabricated-teacher-a' } }) }) });
    });
    await page.locator('#injected-pilot select').selectOption('enrollment-a');
    await page.locator('#injected-pilot button[type=submit]').click(); await page.locator('[data-cancel]').click();
    assert.deepEqual(await snapshot(page), before);
    assert.equal(server.fixture.repo.snapshot().invites.length, 0);
    server.fixture.auth.clear();
    await page.evaluate(() => window.injectedPilot.contextChanged());
    assert.equal(await page.locator('#injected-pilot select option').count(), 1);
    await page.evaluate(() => window.injectedPilot.dispose());
    assert.deepEqual(await snapshot(page), before);
    checks.push({ name: 'actual-app-injected-entry-cancel-owner-context-no-writes', status: 'PASS', evidence: 'Existing openReadyServedDemo helper; actual store readiness and every IndexedDB store + local/session storage identical before/after review/cancel/current-auth-refusal/dispose. No production registration.' });
    await context.close();
  });
  await save();
  console.log(JSON.stringify({ checks: checks.length, status: 'PASS' }));
} finally { await server.close(); }
