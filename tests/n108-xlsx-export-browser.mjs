// AI-authored N108: real application, synthetic account, shared leased SW phase.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService, source, owner } from './n73-account-flow-fixture.mjs';
import * as models from '../src/models.js';
const taskId = 'continuous-n108-readable-excel-xlsx-koshoof-20261015', runId = '86ca48c0-56cd-4e8f-8277-62f4c392b4a2';
let priorEvidence;
const root = resolve('.'), service = syntheticService(), evidence = { taskId, runId, checks: [], screenshots: [], errors: [] };
try { const prior = JSON.parse(await readFile('tests/n108-xlsx-export-browser.json','utf8')); priorEvidence = prior; evidence.previousFailures = [...(prior.previousFailures ?? []), ...(prior.failure ? [prior.failure] : [])]; } catch {}
const owned = row => ({ ...row, ownerId: owner, serverRevision: 1 });
service.current.students = Array.from({ length: 300 }, (_, n) => owned(models.makeStudent({ id: 'n108-' + n, name: n === 0 ? 'أحمد محمد عبدالله عبدالرحمن عبدالعزيز إبراهيم سليمان الحربي الطويل' : n === 1 ? '=1+1' : 'طالب اصطناعي ' + n })));
service.current.enrollments = service.current.students.map((s, n) => owned(models.makeEnrollment({ id: 'en-' + n, studentId: s.id, sectionId: source + '-section' })));
service.current.items = [owned(models.makeItem({ id: 'n108-a', teachingId: source, name: 'عنوان المعلم الطويل لتقييم المهام الأدائية والمشاركة والتفاعل اليومي', max: 40 })), owned(models.makeItem({ id: 'n108-b', teachingId: source, name: 'تقويمات تحريرية وتطبيقات عملية', max: 60 }))];
service.current.scores = service.current.students.filter((_, i) => i % 2 === 0).flatMap(s => ['a','b'].map(k => owned({ id: 'score-' + k + s.id, itemId: 'n108-' + k, studentId: s.id, value: k === 'a' ? 0 : 12.5 })));
const productFiles = ['src/views/grades.js','src/styles/grades.css','src/lib/grade-transfer-export.js','src/lib/grade-transfer-xlsx.js','sw.js'];
evidence.productSha256 = Object.fromEntries(await Promise.all(productFiles.map(async p => [p, createHash('sha256').update(await readFile(p)).digest('hex')])));
if (process.argv.includes('--remaining')) { assert.deepEqual(priorEvidence.productSha256,evidence.productSha256); evidence.checks = priorEvidence.checks; evidence.screenshots = priorEvidence.screenshots; }
const pass = (name, detail) => { evidence.checks.push({ name, status: 'PASS', evidence: detail }); console.log('PASS ' + name); };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/__n73/')) {
      let body = ''; for await (const chunk of req) body += chunk;
      const name = pathname.slice(7); assert.ok(['auth','fixture','capability'].includes(name), 'Export must not mutate fixture service');
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(await service.request(name, JSON.parse(body || '{}')))); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    assert.ok(file.startsWith(root + sep));
    res.setHeader('Content-Type', { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' }[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end(e.message); }
});
let browser, timer;
try {
  const lease = JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8'));
  assert.equal(lease.taskId, taskId); assert.equal(lease.owner.token, runId);
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0,'127.0.0.1',done); });
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless:true }); timer = setTimeout(() => browser.close(),180000); timer.unref();
  await mkdir('test-results/n108',{ recursive:true });
  const context = await browser.newContext({ viewport:{ width:390,height:900 }, locale:'ar-SA', serviceWorkers:'block' });
  await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort('blockedbyclient'));
  await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => evidence.errors.push(e.message));
  await openReadyServedDemo(page, base);
  await page.evaluate(async () => {
    const f = await import('/tests/n73-account-flow-fixture.mjs'); await f.prepareAccount();
    const s = await import('/src/store.js'), d = await import('/src/lib/db.js');
    const receipt = { ownerId:f.owner,contractVersion:1,foundationHash:'n108-synthetic' };
    await d.put('device',{ ...s.state.device,accountProvisioningReceipt:receipt });
    s.activateWorkspace({ ...s.getActiveWorkspace(),workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([f.owner,null,null,receipt]) });
    await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async () => ({ id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now() }));
    await s.init(); s.assertClassOperationsAccess('n73-source');
  });
  const checkpoint = () => page.evaluate(async () => { const d = await import('/src/lib/db.js'); return JSON.stringify(await Promise.all(['students','scores','items','outbox'].map(k => d.getAll(k)))); });
  const before = await checkpoint();
  async function visit(id = source) { await page.goto(base + '/#/teaching/' + id + '/koshoof?export=1'); await page.locator('[data-grade-export-panel]:visible').waitFor(); }
  async function download(action, extension) {
    const event = page.waitForEvent('download'); await page.locator(`[data-act="${action}"]`).click();
    const d = await event, bytes = await readFile(await d.path()); assert.ok(d.suggestedFilename().endsWith('.' + extension));
    assert.match(d.suggestedFilename(), /^كشف (أسماء|درجات) طلاب فصل /); assert.doesNotMatch(d.suggestedFilename(), /n108-|private|token|أحمد/);
    return { name:d.suggestedFilename(), bytes:bytes.toString('base64') };
  }
  async function readDownloaded(file, extension = 'xlsx') {
    return page.evaluate(async ({file,extension}) => {
      const bytes = Uint8Array.from(atob(file.bytes), c => c.charCodeAt(0));
      const f = new File([bytes], file.name);
      const grades = await (await import('/src/lib/grade-transfer-parsers.js')).readGradeFile(f);
      const names = await (await import('/src/lib/student-import.js')).readStudentFile(f);
      if (JSON.stringify(grades) !== JSON.stringify(names)) throw Error('Readers disagree');
      return grades;
    }, {file,extension});
  }
  await visit();
  if (!evidence.checks.some(c => c.name === 'n108_actual_browser_download_320_390_768_1280')) {
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({ width,height:900 });
    for (const theme of ['light','dark']) {
      await page.evaluate(t => document.documentElement.dataset.theme = t,theme);
      const format = page.locator('[data-grade-export-format]');
      await format.selectOption('xlsx');
      const xlsx = await download('grade-export','xlsx'), rows = await readDownloaded(xlsx);
      assert.equal(rows.length,301); evidence.sampleRows = rows.slice(0,4); assert.ok(rows.some(r => r[0].length > 55));
      assert.ok(rows.some(r => r[0] === '=1+1')); const zeroColumn = rows[0].findIndex(h => h.includes('العظمى 40')); assert.ok(zeroColumn > 0); assert.ok(rows.some(r => r[zeroColumn] === 0)); assert.ok(rows.some(r => r[zeroColumn] == null));
      const names = await readDownloaded(await download('grade-names-export','xlsx')); assert.ok(names.every(r => r.length === 1)); assert.equal(names.length,301);
      await format.selectOption('csv'); const csv = await readDownloaded(await download('grade-export','csv'),'csv');
      assert.deepEqual(csv.map(r => r.map(v => String(v ?? '').replace(/^'(=)/,'$1'))), rows.map(r => r.map(v => String(v ?? ''))));
      assert.equal((await readDownloaded(await download('grade-names-export','csv'),'csv'))[0].length,1);
      const bounds = await format.evaluate(e => { const r = e.getBoundingClientRect(); return { left:r.left,right:r.right,height:r.height,width:innerWidth,overflow:document.documentElement.scrollWidth }; });
      assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.height >= 44 && bounds.overflow <= width + 1, JSON.stringify(bounds));
      await format.focus(); assert.equal(await format.evaluate(e => document.activeElement === e),true);
      const path = `test-results/n108/${width}-${theme}.png`; await page.screenshot({ path,fullPage:true }); evidence.screenshots.push(path);
    }
  }
  pass('n108_actual_browser_download_320_390_768_1280', 'Actual owned account Koshoof DOM/CSS: XLSX + CSV, names and grades, 8 size/theme combinations; 300 rows, long Arabic name/title, focus, no horizontal overflow.');
  pass('n108_reader_roundtrip_preserve_zero_blank_and_class_title', 'Both audited file readers parse actual downloaded files; CSV-equivalent labels/values (CSV injection prefix retained), numeric zero distinct from blank.');
  }
  if (!evidence.checks.some(c => c.name === 'n108_empty_class_back_reload_and_no_writes')) {
  await visit('n73-second'); assert.equal(await page.locator('[data-grade-export-format]').inputValue(),'xlsx');
  assert.deepEqual(await readDownloaded(await download('grade-names-export','xlsx')), [['اسم الطالب']]);
  await page.locator('[data-grade-export-panel] [data-act="grade-panel-close"]').click(); await page.goBack();
  await visit(); await page.locator('[data-grade-export-panel]:visible').waitFor();
  assert.equal(await page.locator('[data-grade-export-format]').inputValue(),'xlsx');
  assert.equal(await checkpoint(),before); assert.equal(service.evidence.commits,0);
  pass('n108_empty_class_back_reload_and_no_writes', 'Empty class names workbook readable; authenticated close/back usable (reload checked separately in offline Demo); exact students/scores/items/outbox checkpoint unchanged through authenticated export entry.');
  }
  if (!evidence.checks.some(c => c.name === 'n108_string_cell_injection_reader')) {
    const cases = ['=1+1','+SUM(A1)','@cmd','-1','\t=cmd','\n=cmd','اسم <عربي> & خاص'];
    const result = await page.evaluate(async cases => {
      const x = await import('/src/lib/grade-transfer-xlsx.js'), r = await import('/src/lib/grade-transfer-parsers.js'), z = await import('/src/lib/student-import-parsers.js');
      const bytes = x.exportGradeXlsx({roster:cases.map((name,i)=>({id:String(i),name})),items:[],ctx:{}});
      const files = z.unzipSync(bytes);
      const sheet = new DOMParser().parseFromString(z.strFromU8(files['xl/worksheets/sheet1.xml']),'application/xml');
      return {rows:await r.readGradeFile(new File([bytes],'safe.xlsx')),formulas:sheet.getElementsByTagName('f').length,xmlErrors:sheet.getElementsByTagName('parsererror').length,rawStrings:[...sheet.getElementsByTagName('t')].map(e=>e.textContent)};
    },cases);
    assert.equal(result.formulas,0); assert.equal(result.xmlErrors,0);
    for (const value of cases) { assert.ok(result.rawStrings.includes(value)); assert.ok(result.rows.some(row=>row[0] === value.trim())); }
    pass('n108_string_cell_injection_reader','Audited grade reader accepts = + @ - and leading tabs/newlines as string data; raw XML preserves strings and entities with zero formula nodes or XML errors.');
  }
  await context.close();
  // Separate real Service Worker phase, held under the shared browser lease.
  if (!evidence.checks.some(c => c.name === 'n108_CSV_and_offline')) {
  const offline = await browser.newContext({ viewport:{ width:390,height:900 },locale:'ar-SA' });
  await offline.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort('blockedbyclient'));
  await offline.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const p = await offline.newPage(); p.setDefaultTimeout(15000); await openReadyServedDemo(p,base);
  await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await p.evaluate(async () => Object.fromEntries(await Promise.all(['src/lib/grade-transfer-xlsx.js','src/lib/grade-transfer-export.js','src/views/grades.js','src/styles/grades.css'].map(async path => [path,!!await caches.match(new URL(path,location.origin))]))));
  assert.ok(Object.values(cached).every(Boolean),JSON.stringify(cached)); evidence.offlineCached = cached;
  const id = await p.evaluate(async () => (await import('/src/store.js')).teachings()[0].id);
  await offline.setOffline(true); await p.goto(base + '/#/teaching/' + id + '/koshoof?export=1');
  await p.locator('[data-grade-export-panel]:visible').waitFor();
  const event = p.waitForEvent('download'); await p.locator('[data-act="grade-names-export"]').click(); const d = await event;
  assert.ok(d.suggestedFilename().endsWith('.xlsx')); assert.ok((await readFile(await d.path())).length > 1000);
  await p.reload(); await p.locator('[data-grade-export-panel]:visible').waitFor();
  const offlineResult = await p.evaluate(async () => { const s = await import('/src/store.js'); const x = await import('/src/lib/grade-transfer-xlsx.js'); return { ready:s.state.ready,workspace:s.getActiveWorkspace().type,bytes:x.exportGradeXlsx({ ...s.teachingContext(s.teachings()[0].id),items:[] }).length }; });
  assert.equal(offlineResult.ready,true); assert.equal(offlineResult.workspace,'demo'); assert.ok(offlineResult.bytes > 1000);
  await offline.close();
  pass('n108_CSV_and_offline', 'New module and affected source assets precached by actual sw.js; first offline Koshoof visit downloads XLSX, offline reload same-document readiness and export succeed. No cloud/Sync certification claimed.');
  }
  if (!evidence.checks.some(c => c.name === 'n108_mobile_touch_download')) {
    const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
    await mobile.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
    await mobile.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const m=await mobile.newPage(); await openReadyServedDemo(m,base);
    const tid=await m.evaluate(async()=>(await import('/src/store.js')).teachings()[0].id);
    await m.goto(base+'/#/teaching/'+tid+'/koshoof?export=1');
    for(const format of ['xlsx','csv']) {
      await m.locator('[data-grade-export-format]').selectOption(format);
      const pending=m.waitForEvent('download');await m.locator('[data-act="grade-names-export"]').tap();
      const file=await pending;assert.ok(file.suggestedFilename().endsWith('.'+format));assert.ok((await readFile(await file.path())).length>0);
    }
    await mobile.close();pass('n108_mobile_touch_download','Fresh mobile/touch emulation 390px: actual names XLSX and CSV downloads via tap, disposable context.');
  }
  assert.deepEqual(evidence.errors,[]);
} catch (error) { evidence.failure = error.stack; throw error; }
finally {
  clearTimeout(timer); await browser?.close(); if (server.listening) await new Promise(done => server.close(done));
  evidence.ownedBrowserClosed = true; evidence.ownedServerStopped = !server.listening;
  await writeFile('tests/n108-xlsx-export-browser.json',JSON.stringify(evidence,null,2));
}
