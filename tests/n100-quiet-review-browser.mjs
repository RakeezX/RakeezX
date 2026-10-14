import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService, owner, source, target } from './n100-account-fixture.mjs';
import * as models from '../src/models.js';

const root = resolve('.');
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n100-quiet-copy-review-20261014.json';
const runId = '00f010f9-6cba-4053-86bd-0e645624b44a';
const checks = [];
let service = syntheticService(), latestPlanToken = null, appliedTokenMatches = [];

function addManyTargets() {
  const rows = service.current;
  const protectedExam = rows.items.find(row => row.id === 'n73-target-exam');
  protectedExam.max = 25;
  protectedExam.serverCanonical = { ...protectedExam.serverCanonical, max:25 };
  const clearingSourceChild = rows.scoreSubitems.find(row => row.id === 'n100-source-0');
  clearingSourceChild.startDate = null; clearingSourceChild.dueDate = null;
  clearingSourceChild.serverCanonical = { ...clearingSourceChild.serverCanonical, startDate:null, dueDate:null };
  const baseSection = rows.sections.find(row => row.id === target + '-section');
  const baseTeaching = rows.teachings.find(row => row.id === target);
  for (let index = 0; index < 18; index++) {
    const section = models.makeSection({ id: `n100-quiet-section-${index}`, yearId: 'n73-year', grade: 5, label: String(index + 3) });
    const teaching = models.makeTeaching({ id: `n100-quiet-target-${index}`, sectionId: section.id,
      termId: 'n73-term', subjectId: 'n73-subject', name: 'N100 synthetic' });
    rows.sections.push({ ...section, ownerId: owner, serverRevision: 1, sourceSection: baseSection.id });
    rows.teachings.push({ ...teaching, ownerId: owner, serverRevision: 1, sourceTeaching: baseTeaching.id });
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/__n73/')) {
      let body = ''; for await (const chunk of req) body += chunk;
      const name = pathname.slice('/__n73/'.length), input = JSON.parse(body || '{}');
      const result = await service.request(name, input);
      if (name === 'plan') latestPlanToken = result.token;
      if (name === 'apply') appliedTokenMatches.push(input.token === latestPlanToken && input.confirmed === true);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw new Error('Outside application root');
    res.setHeader('Content-Type', { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(error.status ?? 404, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ message:error.message, code:error.code, status:error.status })); }
});

await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results/n100-quiet-review', { recursive:true });
async function accountPage(createContext, width) {
  service = syntheticService(); addManyTargets(); latestPlanToken = null;
  const context = await createContext({ viewport:{ width, height:844 }, locale:'ar-SA', timezoneId:'Asia/Riyadh' });
  await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  const page = await context.newPage(); await openReadyServedDemo(page, base);
  const readiness = await page.evaluate(async () => (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
  assert.equal(readiness.ready, true); assert.equal(readiness.lease.editable, true); assert.deepEqual(readiness.outbox, []);
  await page.goto(base + '/#/teaching/' + source + '/items');
  await page.waitForFunction(() => !document.querySelector('[data-act="copy"]')?.disabled);
  await page.locator('[data-act="copy"]').click();
  return { page, context };
}
async function select(page, ids) {
  for (const id of ids) await page.locator('[data-copy-target][value="' + id + '"]').check();
  await page.waitForFunction(() => !document.querySelector('[data-copy-apply]')?.disabled);
}
function record(name, evidence) { checks.push({ name, status:'PASS', evidence }); console.log('PASS ' + name + ': ' + evidence); }

try {
  await withIsolatedLocalBrowser({ taskFile, runId, url:base, timeoutMs:120000 }, async ({ createContext }) => {
    const twenty = [target, 'n73-second', ...Array.from({ length:18 }, (_, index) => `n100-quiet-target-${index}`)];
    for (const width of [390, 1280]) {
      for (const ids of [[target], twenty]) {
        const { page, context } = await accountPage(createContext, width);
        try {
          await select(page, ids);
          const details = page.locator('[data-copy-review] details.target-review');
          assert.equal(await details.count(), ids.length);
          assert.equal(await page.locator('[data-copy-review] details[open]').count(), 0);
          assert.ok((await page.locator('[data-copy-review]').innerText()).includes(`${ids.length} فصول مستهدفة`));
          assert.equal(await page.locator('[data-copy-review]').getByText(/البداية غير محددة|الاستحقاق غير محدد/).count(), 0);
          if (ids.length === 1) {
            assert.ok(await page.locator('[data-copy-review] [role="status"]').count() > 0, 'protected conflict count stays visible');
            const summary = details.first().locator('summary'); await summary.focus(); await summary.press('Enter');
            assert.equal(await details.first().evaluate(node => node.open), true, 'native details expands by keyboard');
            assert.ok(await details.first().innerText().then(text => /بقي كما هو|محمي|مطابق|امتحان|Exam/i.test(text)), 'conflict is individually inspectable');
            assert.ok((await details.first().innerText()).includes('سيُمسح تاريخ البداية والاستحقاق'), 'real date clearing is disclosed');
            await page.screenshot({ path:'test-results/n100-quiet-review/390-protected-details.png', fullPage:true, animations:'disabled' });
            await summary.press('Enter');
          }
          await page.screenshot({ path:`test-results/n100-quiet-review/${width}-${ids.length}-targets.png`, fullPage:true, animations:'disabled' });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
          if (width === 390 && ids.length === 1) {
            await page.locator('[data-copy-apply]').click();
            await page.getByRole('button', { name:'تأكيد التطبيق', exact:true }).waitFor();
            await page.locator('[data-sheet-close]').last().click();
            assert.equal(service.evidence.commits, 0, 'cancel leaves synthetic data unchanged');
          }
          if (width === 1280 && ids.length === 20) {
            await page.locator('[data-copy-apply]').click();
            await page.getByRole('button', { name:'تأكيد التطبيق', exact:true }).click();
            await page.getByText(/طُبّقت التحديثات والإضافات/).waitFor();
            assert.equal(service.evidence.commits, 1);
            assert.ok(appliedTokenMatches.at(-1), 'confirmation sends the reviewed plan token');
          }
        } finally { await context.close(); }
      }
    }
  });
  record('n100_compact_actual_many_class_review', 'Actual app DOM, handlers and CSS at 390px/1280px with synthetic 1 and 20 target plans: one closed accessible details row per class, compact counts, no unchanged roster/date boilerplate, no horizontal overflow.');
  record('n100_protected_conflicts_remain_visible', 'Synthetic protected target conflict remains counted in the collapsed default review and is individually inspectable after keyboard expansion.');
  record('n100_confirm_semantics_unchanged', 'Cancel causes no synthetic commit; confirm commits once and sends the reviewed plan token with confirmed=true.');
} finally { await new Promise(resolveClose => server.close(resolveClose)); }
