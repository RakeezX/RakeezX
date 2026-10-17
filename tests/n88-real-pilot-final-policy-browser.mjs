// AI: final approved PIN + verified second-term journey, actual inert DOM/handlers/CSS.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startPilotServer } from './fixtures/n88-real-pilot/server.mjs';
import { POLICY } from '../drafts/n88-student-portal/service.mjs';
const taskId = 'continuous-n88-approved-pin-stable-term-identity-20261017';
const runId = 'c9477105-48a2-4092-ac12-237eaacc6d8e';
const codes = ['1000', '9999'];
const server = await startPilotServer({ newCode: () => codes.shift() }), checks = [], failures = [];
const record = { taskId, runId, baseSha: 'e1950472da7abd53bd520dad2beac791146b298f',
  teacherUrl: server.url + '/teacher', ownedPid: server.pid, startedAt: server.startedAt, checks, failures,
  privateLink: 'Credential URLs/cookies/bodies intentionally omitted.',
  reusedEvidence: 'Prior JSON/screenshots are historical (leading-zero policy SUPERSEDED). Unchanged teacher publication/print/async cleanup and CSS evidence retained; final entry/term behavior freshly tested here.',
  limits: 'Synthetic single-process memory, desktop/mobile viewport emulation only. Durable SQL/RLS, real Auth/lifecycle, HTTPS/ingress/log redaction, real devices and hosted private access NOT_RUN; no activation.' };
const files = ['src/lib/student-portal-client.js','src/views/student-portal.js','src/lib/rakeez-datetime-values.js',
  'drafts/n88-student-portal/service.mjs','drafts/n88-student-portal/memory-repository.mjs',
  'drafts/n88-student-portal/teacher-controller.js','drafts/n88-student-portal/portal.css',
  'tests/fixtures/n88-real-pilot/entry.js','tests/fixtures/n88-real-pilot/server.mjs',
  'tests/fixtures/n88-real-pilot/index.html','tests/fixtures/n88-real-pilot/fixture.mjs',
  'tests/n88-real-pilot-final-policy-browser.mjs','src/styles/app.css'];
record.testedSourceSha256 = Object.fromEntries(await Promise.all(files.map(async file => [file,
  createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex')])));
try {
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,
    runId, url: server.url, timeoutMs: 120000 }, async ({ createContext }) => {
    for (const [width, theme] of [[320,'light'],[1280,'dark']]) {
      server.reset();
      const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA', colorScheme: theme });
      await context.addInitScript(theme => document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = theme; }), theme);
      const errors = [], logs = []; let claims = 0;
      context.on('request', r => { if (r.url().endsWith('/claim')) claims++;
        assert.equal(new URL(r.url()).search, ''); assert.equal(new URL(r.url()).hash, ''); });
      const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => logs.push(m.text())); };
      const teacher = await context.newPage(); watch(teacher);
      await teacher.goto(server.url + '/teacher');
      await teacher.locator('#n88-member option[value="enrollment-a"]').waitFor({ state: 'attached' });
      await teacher.locator('#n88-member').selectOption('enrollment-a');
      await teacher.locator('[data-select] button').click(); await teacher.locator('[data-issue]').click();
      await teacher.locator('[data-code]').waitFor();
      const code = await teacher.locator('[data-code]').inputValue(), bookmark = await teacher.locator('[data-entry]').inputValue();
      assert.equal(code, width === 320 ? '1000' : '9999');
      await teacher.locator('[data-copy]').click(); assert.equal(await teacher.evaluate(() => window.fabricatedCopy), code + '\n' + bookmark);
      await teacher.locator('[data-cancel]').click();
      const student = await context.newPage(); watch(student);
      const response = await student.goto(bookmark); await student.locator('[data-claim]').waitFor();
      for (const [key,pattern] of [['cache-control',/no-store/],['referrer-policy',/no-referrer/],['x-robots-tag',/noindex/]]) assert.match(response.headers()[key],pattern);
      assert.equal(await student.locator('input').count(), 1);
      assert.equal(await student.locator('input').getAttribute('type'), 'password');
      assert.equal(await student.locator('input').getAttribute('inputmode'), 'numeric');
      assert.equal(await student.locator('input').getAttribute('pattern'), '[1-9][0-9]{3}');
      assert.match(await student.locator('main').innerText(), /أولها من 1 إلى 9/);
      assert.equal(await student.locator('main').evaluate(el => getComputedStyle(el).direction), 'rtl');
      const initialClaims = claims;
      for (const invalid of ['0007','0074','0000','999','10000','٠٠٠٧']) {
        await student.locator('input').fill(invalid);
        assert.equal(await student.locator('input').evaluate(el => el.checkValidity()), false);
        await student.locator('[data-claim] button').click();
        assert.equal(claims, initialClaims); // No silent truncation/padding into a valid code.
      }
      await student.locator('input').fill('');
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await student.screenshot({ path: `tests/fixtures/n88-real-pilot/final-form-${width}.png`, fullPage: true });
      const enter = async value => {
        await student.locator('input').fill(value); await student.locator('[data-claim] button').click();
        await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      };
      await enter(code.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]));
      assert.match(await student.locator('main').innerText(), /الأمان الرقمي/);
      const credential = server.fixture.repo.snapshot().credentials[0];
      const cookie = (await context.cookies()).find(c => c.name === '__Secure-n88');
      assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
      assert.equal(cookie.path, '/api/n88' + new URL(bookmark).pathname);
      // Independently verified fabricated lifecycle, NOT a student request/enrollment write.
      await server.fixture.advanceToSecondTerm();
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      assert.equal(await student.locator('[data-tasks]').count(), 0); // unexpired old session denies
      server.fixture.advance(POLICY.sessionMs + 1);
      await student.goto(bookmark); await student.locator('[data-claim]').waitFor();
      await enter(code); // identical bookmark/code, now CURRENT new enrollment/class/revision
      await student.reload(); await student.getByRole('heading', { name: 'ما المطلوب مني؟' }).waitFor();
      const text = await student.locator('main').innerText();
      assert.match(text, /نشاط الفصل الدراسي الثاني/); assert.match(text, /0 من 1/);
      assert.doesNotMatch(text, /الأمان الرقمي|تنسيق مستند|OTHER|PRIVATE|UNPUBLISHED|attendance|result/);
      assert.deepEqual(server.fixture.repo.snapshot().credentials[0], credential);
      assert.equal(student.url(), bookmark);
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await student.screenshot({ path: `tests/fixtures/n88-real-pilot/final-term2-${width}.png`, fullPage: true });
      await teacher.reload(); await teacher.locator('#n88-member option[value="enrollment-a-term2"]').waitFor({ state: 'attached' });
      await teacher.locator('#n88-member').selectOption('enrollment-a-term2'); await teacher.locator('[data-select] button').click();
      await teacher.locator('[data-revoke]').click(); await teacher.getByText('أُلغي الوصول والرمز وجميع الجلسات.').waitFor();
      await student.locator('[data-refresh]').click(); await student.locator('[data-claim]').waitFor();
      await student.locator('input').fill(code); await student.locator('[data-claim] button').click();
      await student.getByText('تعذّر فتح المساحة. تحقق من الرابط والرمز أو حاول لاحقًا مع معلمك.').waitFor();
      assert.equal(await student.locator('input').inputValue(), '');
      assert.deepEqual(await student.evaluate(async () => ({ local: {...localStorage}, session: {...sessionStorage}, dbs: await indexedDB.databases() })), { local:{},session:{},dbs:[] });
      assert.equal(await student.evaluate(() => document.cookie), '');
      const privateValues = [code, new URL(bookmark).pathname.slice(3), cookie.value];
      assert.ok(logs.every(l => privateValues.every(value => !l.includes(value)))); assert.deepEqual(errors, []);
      checks.push({ name: `final-policy-same-bookmark-second-term-${width}-${theme}`, status:'PASS',
        evidence:'Actual source DOM/CSS/teacher+student handlers over HTTP. Forced 1000/9999; one numeric password field; 0-first/3/5 digits rejected without request or truncation; Arabic accepted. Unexpired old scope refused, same bookmark/PIN after expiry and reload shows ONLY new-term tasks; unchanged stable credential; new-term teacher revoke refuses read/login; scoped cookie, generic errors, no storage/log leak or overflow. Screenshots visually inspected.' });
      await context.close();
    }
  });
} catch(error) { failures.push({ status:'FAIL',message:error.message }); process.exitCode=1; }
finally { await server.close(); record.cleanup='Canonical helper closed owned fresh browser/contexts; unique loopback server closed in finally.';
  try { await fetch(server.url + '/teacher'); record.cleanupCheck='FAIL: server still reachable'; process.exitCode=1; }
  catch { record.cleanupCheck='PASS: retired loopback server refuses connection'; }
  await writeFile('tests/n88-real-pilot-final-policy-browser.json', JSON.stringify(record,null,2)+'\n'); }
console.log(JSON.stringify({ checks, failures, ownedPid:server.pid, serverClosed:true }));
