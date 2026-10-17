// AI: focused changed entry/PIN scenario; reuse prior publication/print/delayed-response evidence.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startPilotServer } from './fixtures/n88-real-pilot/server.mjs';
import { POLICY } from '../drafts/n88-student-portal/service.mjs';
const taskId = 'continuous-n88-personal-four-digit-student-code-20261017';
const runId = '47828d23-b2bd-4dea-8b83-a1fbedc80d7a';
const server = await startPilotServer(), checks = [], failures = [];
const record = { taskId, runId, baseSha: '5ce42fd71ed23408bde4b48be40c06b17f1ab273',
  teacherUrl: server.url + '/teacher', ownedPid: server.pid, startedAt: server.startedAt, checks, failures,
  privateLink: 'Intentionally NOT recorded: private bookmark path is a credential.',
  priorEvidence: 'tests/n88-real-pilot-browser.json at bdb1e2bf7cfbd6a04f11bda5c9a3154652550358; unchanged CSS/repository and unaffected publication/print/async generation behavior reused.',
  limits: 'Synthetic single-process memory only. Durable repository/limits, SQL/RLS, real Auth/proxy/TLS/log redaction, real devices and hosted private access NOT_RUN.' };
const files = ['src/lib/student-portal-client.js','src/views/student-portal.js','src/lib/rakeez-datetime-values.js',
  'drafts/n88-student-portal/service.mjs','drafts/n88-student-portal/memory-repository.mjs',
  'drafts/n88-student-portal/teacher-controller.js','drafts/n88-student-portal/portal.css',
  'tests/fixtures/n88-real-pilot/entry.js','tests/fixtures/n88-real-pilot/server.mjs',
  'tests/fixtures/n88-real-pilot/index.html','tests/fixtures/n88-real-pilot/fixture.mjs',
  'tests/n88-real-pilot-four-digit-browser.mjs','src/styles/app.css'];
record.testedSourceSha256 = Object.fromEntries(await Promise.all(files.map(async file => [file,
  createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex')])));
try {
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,
    runId, url: server.url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const [width, theme] of [[320,'light'],[1280,'dark']]) {
      server.reset();
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA', colorScheme: theme });
      await context.addInitScript(theme => document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = theme; }), theme);
      const errors = [], logs = [], requests = [];
      context.on('request', r => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
      const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => logs.push(m.text())); };
      const teacher = await context.newPage(); watch(teacher);
      await teacher.goto(server.url + '/teacher');
      await teacher.locator('#n88-member option[value="enrollment-a"]').waitFor({ state: 'attached' });
      const issue = async (member = 'enrollment-a') => {
        await teacher.locator('#n88-member').selectOption(member); await teacher.locator('[data-select] button').click();
        await teacher.locator('[data-issue]').click(); await teacher.locator('[data-code]').waitFor();
        const code = await teacher.locator('[data-code]').inputValue(), url = await teacher.locator('[data-entry]').inputValue();
        assert.match(code,/^[0-9]{4}$/); assert.match(new URL(url).pathname,/^\/s\/[A-Za-z0-9_-]{43}$/);
        await teacher.locator('[data-copy]').click(); assert.equal(await teacher.evaluate(() => window.fabricatedCopy), code + '\n' + url);
        await teacher.locator('[data-cancel]').click(); return { code, url };
      };
      const a = await issue(), b = await issue('enrollment-b'); assert.notEqual(a.code,b.code); assert.notEqual(a.url,b.url);
      const student = await context.newPage(); watch(student);
      const open = async url => { await student.goto(url); await student.locator('[data-claim]').waitFor(); };
      const enter = async (code, succeeds = true) => {
        await student.locator('input').fill(code); await student.locator('[data-claim] button').click();
        if (succeeds) await student.getByRole('heading',{ name: 'ما المطلوب مني؟' }).waitFor();
        else { await student.getByText('تعذّر فتح المساحة. تحقق من الرابط والرمز أو حاول لاحقًا مع معلمك.').waitFor(); assert.equal(await student.locator('input').inputValue(),''); }
      };
      const privateHeaders = await student.goto(a.url); await student.locator('[data-claim]').waitFor();
      for (const [key,pattern] of [['cache-control',/no-store/],['referrer-policy',/no-referrer/],['x-robots-tag',/noindex/]]) assert.match(privateHeaders.headers()[key],pattern);
      assert.equal(await student.locator('input').count(),1);
      assert.equal(await student.locator('input').getAttribute('maxlength'),'4');
      assert.equal(await student.locator('input').getAttribute('inputmode'),'numeric');
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      assert.equal(await student.locator('main').evaluate(el => getComputedStyle(el).direction),'rtl');
      await student.screenshot({ path: `tests/fixtures/n88-real-pilot/four-digit-form-${width}.png`, fullPage: true });
      await enter(b.code,false); // another valid PIN never switches the student behind a private link
      const arabic = a.code.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
      await enter(arabic); // existing digit adapter normalizes BEFORE native pattern validation
      assert.match(await student.locator('main').innerText(),/الأمان الرقمي/);
      assert.doesNotMatch(await student.locator('main').innerText(),/OTHER|PRIVATE|UNPUBLISHED|result|attendance/);
      assert.match(await student.locator('aside').innerText(),/1 من 2/);
      const aCookie = (await context.cookies()).find(c => c.name === '__Secure-n88');
      assert.ok(aCookie?.secure && aCookie.httpOnly && aCookie.sameSite === 'Strict');
      assert.equal(aCookie.path,'/api/n88' + new URL(a.url).pathname);
      await student.locator('[data-logout]').click(); await student.locator('[data-claim]').waitFor();
      server.fixture.advance(POLICY.sessionMs + 1);
      await open(a.url); await enter(a.code); // same bookmark/PIN beyond old timer, fresh session
      await student.reload(); await student.getByRole('heading',{ name: 'ما المطلوب مني؟' }).waitFor();
      await open(b.url); await enter(a.code,false); await enter(b.code);
      assert.match(await student.locator('main').innerText(),/OTHER_STUDENT/);
      assert.doesNotMatch(await student.locator('main').innerText(),/الأمان الرقمي/);
      const bCookie = (await context.cookies()).find(c => c.name === '__Secure-n88' && c.path.endsWith(new URL(b.url).pathname));
      server.fixture.advance(POLICY.rateWindowMs);
      const rotated = await issue('enrollment-b');
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      await enter(b.code,false); await enter(rotated.code,false); // even NEW PIN fails on retired link
      await open(rotated.url); await enter(b.code,false); await enter(rotated.code);
      await teacher.locator('#n88-member').selectOption('enrollment-b'); await teacher.locator('[data-select] button').click();
      await teacher.locator('[data-revoke]').click(); await teacher.getByText('أُلغي الوصول والرمز وجميع الجلسات.').waitFor();
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('[data-tasks]').count(),0);
      assert.deepEqual(await student.evaluate(async () => ({ local: {...localStorage}, session: {...sessionStorage}, dbs: await indexedDB.databases() })),{ local:{},session:{},dbs:[] });
      assert.equal(await student.evaluate(() => document.cookie),'');
      const pins = [a.code,b.code,rotated.code];
      assert.ok(requests.every(r => !new URL(r.url).search && !new URL(r.url).hash));
      assert.ok(requests.filter(r => r.url.includes('/api/n88/') && r.body?.includes('"code"')).every(r => r.method === 'POST' && !r.url.includes(JSON.parse(r.body).code)));
      const privateValues = [...pins, ...[a,b,rotated].map(v => new URL(v.url).pathname.slice(3)), aCookie.value, bCookie.value];
      assert.ok(logs.every(l => privateValues.every(value => !l.includes(value))));
      assert.ok(requests.filter(r => new URL(r.url).pathname.startsWith('/src/')).every(r => !r.body));
      assert.deepEqual(errors,[]);
      checks.push({ name: `four-digit-private-entry-${width}-${theme}`, status:'PASS', evidence:'Actual source DOM/CSS and teacher handlers; one four-digit field, Arabic digits, distinct private links, both cross-student PIN refusals, exact profile/progress, scoped secure cookie, reusable bookmark after logout/8h expiry, reload, rotated old link/PIN/session refused, revoke, no PIN URL/storage/log leak, no overflow. Empty-form screenshot inspected.' });
      await context.close();
    }
  });
} catch(error) { failures.push({ status:'FAIL',message:error.message }); process.exitCode=1; }
finally { await server.close(); record.cleanup='Owned fresh browser/contexts closed by canonical helper; unique loopback server closed in finally.';
  await writeFile('tests/n88-real-pilot-four-digit-browser.json',JSON.stringify(record,null,2)+'\n'); }
console.log(JSON.stringify({ checks, failures, ownedPid:server.pid,serverClosed:true }));
