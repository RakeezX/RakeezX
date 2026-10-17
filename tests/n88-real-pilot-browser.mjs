// AI: actual inert application modules/CSS on HTTP, canonical fresh synthetic contexts.
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startPilotServer } from './fixtures/n88-real-pilot/server.mjs';
import { POLICY } from '../drafts/n88-student-portal/service.mjs';
const taskId = 'continuous-n88-persistent-six-digit-student-code-20261017';
const runId = 'fdce40ca-318e-4da2-a925-9a87c6f091b5';
const server = await startPilotServer(), checks = [], failures = [];
const record = { taskId, runId, source: 'Exact committed content of scoped files; final candidate bound by worker JSON and review document.',
  teacherUrl: server.url + '/teacher', ownedPid: server.pid, startedAt: server.startedAt, serverExpiresAt: server.expiresAt,
  codeLifetime: 'No expiry/consumption. Server expiry is ONLY local process lifetime.', checks, failures,
  limits: ['Fabricated auth/socket/repository only; not real Auth or hosted proxy.', 'Memory transactions/rate limits are not durable multi-instance SQL/RLS proof.',
    'No physical-device, real printer/clipboard, hosted TLS or Production claim.'], cleanup: 'pending' };
record.testedSourceSha256 = Object.fromEntries(await Promise.all([
  'src/lib/student-portal-client.js', 'src/views/student-portal.js', 'drafts/n88-student-portal/service.mjs',
  'drafts/n88-student-portal/memory-repository.mjs', 'drafts/n88-student-portal/teacher-controller.js',
  'drafts/n88-student-portal/portal.css', 'tests/fixtures/n88-real-pilot/server.mjs',
  'tests/fixtures/n88-real-pilot/fixture.mjs', 'tests/fixtures/n88-real-pilot/entry.js', 'tests/n88-real-pilot-browser.mjs'
].map(async file => [file, createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex')])));
record.correctedHarnessFailure = 'Initial delayed-response probe failed: route.fulfill: Route is already handled! Removing its own route while holding it was corrected to a single held response with an explicit completion gate. Original failure retained here; corrected actual delayed-app scenario exercised below.';
const save = () => writeFile('tests/n88-real-pilot-browser.json', JSON.stringify(record, null, 2) + '\n');
try {
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId,
    url: server.url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const [width, theme] of [[320, 'light'], [1280, 'dark']]) {
      server.reset(); const namespace = server.fixture.namespace;
      record.studentUrl = server.url + '/s/' + namespace;
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA', colorScheme: theme });
      await context.addInitScript(theme => document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = theme; }), theme);
      const teacher = await context.newPage(), errors = [], requests = [], logs = [];
      const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => logs.push(m.text())); };
      watch(teacher); context.on('request', r => requests.push({ url: r.url(), method: r.method() }));
      const review = async (member = 'enrollment-a') => { await teacher.locator('#n88-member').selectOption(member); await teacher.locator('[data-select] button').click(); };
      const issue = async member => { await review(member); await teacher.locator('[data-issue]').click(); await teacher.locator('[data-code]').waitFor();
        const code = await teacher.locator('[data-code]').inputValue(), url = await teacher.locator('[data-entry]').inputValue();
        assert.match(code, /^[0-9]{6}$/); assert.equal(new URL(url).pathname, '/s/' + namespace);
        return { code, url }; };
      await teacher.goto(server.url + '/teacher');
      await teacher.locator('#n88-member option[value="enrollment-a"]').waitFor({ state: 'attached' });
      assert.equal(await teacher.locator('#n88-member option').count(), 3);
      await review(); await teacher.locator('[data-cancel]').click();
      assert.equal(server.fixture.repo.snapshot().credentials.length, 0);
      const a = await issue('enrollment-a');
      await teacher.locator('[data-copy]').click(); assert.equal(await teacher.evaluate(() => window.fabricatedCopy), a.code + '\n' + a.url);
      await teacher.locator('[data-print]').click(); assert.equal(await teacher.evaluate(() => window.fabricatedPrint), true);
      await teacher.locator('[data-cancel]').click(); assert.equal(await teacher.locator('[data-code]').count(), 0);
      assert.equal(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const student = await context.newPage(); watch(student);
      await student.goto(a.url); await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('input').getAttribute('inputmode'), 'numeric');
      assert.equal(await student.locator('input').getAttribute('maxlength'), '6');
      assert.equal(await student.locator('input').count(), 1);
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await student.screenshot({ path: `tests/fixtures/n88-real-pilot/code-form-${width}.png`, fullPage: true });
      const enter = async (page, code) => { await page.locator('[data-claim] input').fill(code); await page.locator('[data-claim] button').click();
        await page.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor(); };
      await enter(student, a.code);
      assert.match(await student.locator('main').innerText(), /تصميم عرض عن الأمان الرقمي/);
      assert.doesNotMatch(await student.locator('main').innerText(), /PRIVATE|OTHER|UNPUBLISHED|نتيجة نشرها/);
      assert.equal(await student.locator('aside').innerText().then(t => t.includes('1 من 2')), true);
      assert.equal(await student.evaluate(() => document.cookie), '');
      const c = (await context.cookies()).find(c => c.name === '__Secure-n88');
      assert.ok(c?.httpOnly && c.secure && c.sameSite === 'Strict' && c.path === '/api/n88/s/' + namespace);
      const second = await createContext({ viewport: { width, height: 900 } }), secondPage = await second.newPage(); watch(secondPage);
      await secondPage.goto(a.url); await secondPage.locator('[data-claim]').waitFor(); await enter(secondPage, a.code);
      assert.notEqual((await second.cookies()).find(c => c.name === '__Secure-n88').value, c.value);
      await student.reload(); await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      await review();
      await teacher.locator('#n88-publication').selectOption('published-a');
      await teacher.locator('#n88-title').fill('نشر المعلم تحديثًا جديدًا'); await teacher.locator('#n88-status').selectOption('done');
      await teacher.locator('[data-publish] button').click(); await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
      await student.locator('[data-refresh]').click(); await student.getByText('نشر المعلم تحديثًا جديدًا').waitFor();
      assert.match(await student.locator('aside').innerText(), /2 من 2/);
      await teacher.locator('[name=published]').uncheck(); await teacher.locator('[data-publish] button').click();
      await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
      await student.locator('[data-refresh]').click(); await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      assert.doesNotMatch(await student.locator('main').innerText(), /نشر المعلم تحديثًا جديدًا/);
      await student.locator('[data-logout]').click(); await student.locator('[data-claim]').waitFor();
      assert.equal((await context.cookies()).filter(c => c.name === '__Secure-n88').length, 0);
      await enter(student, a.code);
      server.fixture.advance(POLICY.sessionMs + 1);
      await student.reload(); await student.locator('[data-claim]').waitFor(); assert.equal(await student.locator('[data-tasks]').count(), 0);
      await enter(student, a.code); // same persistent code after session expiry and old 15-minute deadline
      // Actual delayed-response/URL context change fixture: old student read cannot flash after new login.
      const b = await issue('enrollment-b'); await teacher.locator('[data-cancel]').click();
      let release, captured, finished, held = false, routeError;
      const pending = new Promise(ok => { captured = ok; });
      const fulfilled = new Promise(ok => { finished = ok; });
      await student.route('**/api/n88/s/*/read', async route => {
        if (held) return route.continue(); held = true;
        try { const response = await route.fetch();
          const gate = new Promise(ok => { release = ok; }); captured();
          await gate; await route.fulfill({ response });
        } catch (error) { routeError = error.message; } finally { finished(); }
      });
      await student.locator('[data-refresh]').click(); await pending;
      await student.evaluate(() => { location.hash = 'context-change'; });
      await student.locator('[data-claim]').waitFor();
      await enter(student, b.code);
      assert.match(await student.locator('main').innerText(), /OTHER_STUDENT/);
      await student.evaluate(() => { window.oldStudentFlashes = [];
        window.flashObserver = new MutationObserver(() => { if (document.querySelector('main')?.textContent.includes('تنسيق مستند نصي')) window.oldStudentFlashes.push(true); });
        window.flashObserver.observe(document.getElementById('pilot'), { subtree: true, childList: true, characterData: true }); });
      release(); await fulfilled; assert.equal(routeError, undefined); await student.waitForTimeout(100);
      assert.deepEqual(await student.evaluate(() => { window.flashObserver.disconnect(); return window.oldStudentFlashes; }), []);
      assert.doesNotMatch(await student.locator('main').innerText(), /تنسيق مستند نصي/);
      assert.equal(new URL(student.url()).hash, '');
      const rotated = await issue('enrollment-b'); await teacher.locator('[data-cancel]').click();
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      await student.locator('input').fill(b.code); await student.locator('[data-claim] button').click();
      await student.getByText('تعذّر فتح المساحة. تحقق من الرابط والرمز أو حاول لاحقًا مع معلمك.').waitFor();
      assert.equal(await student.locator('input').inputValue(), '');
      await enter(student, rotated.code);
      await review('enrollment-b'); await teacher.locator('[data-revoke]').click();
      await teacher.getByText('أُلغي الوصول والرمز وجميع الجلسات.').waitFor();
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('[data-tasks]').count(), 0);
      server.fixture.auth.clear(); await teacher.evaluate(() => window.pilot.contextChanged());
      assert.equal(await teacher.locator('#n88-member option').count(), 1);
      assert.deepEqual(await student.evaluate(async () => ({ local: { ...localStorage }, session: { ...sessionStorage }, dbs: await indexedDB.databases() })), { local: {}, session: {}, dbs: [] });
      const secrets = [a.code,b.code,rotated.code,c.value];
      assert.ok(requests.every(r => !new URL(r.url).search && secrets.every(code => !r.url.includes(code))));
      assert.ok(logs.every(l => secrets.every(code => !l.includes(code))));
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await student.locator('main').evaluate(el => getComputedStyle(el).direction), 'rtl');
      assert.deepEqual(errors, []);
      checks.push({ name: `actual-persistent-code-ui-${width}-${theme}`, status: 'PASS', evidence: 'Actual teacher selection/cancel/issue/copy+print adapters; single six-digit form; independent sessions; reload/logout/relogin/expiry; teacher publish/status/unpublish reread; delayed old-student response ignored; rotate/revoke; scoped Secure HttpOnly cookie; no secret URL/storage/console; RTL/no overflow. Screenshots code-form-' + width + '.png.' });
      await second.close(); await context.close();
    }
  });
} catch (error) { failures.push({ message: error.message, status: 'FAIL' }); process.exitCode = 1; }
finally { await server.close(); record.cleanup = 'Owned browser/contexts closed by canonical helper; owned HTTP server closed in finally before return.'; await save(); }
console.log(JSON.stringify({ checks, failures, ownedPid: server.pid, serverClosed: true }));
