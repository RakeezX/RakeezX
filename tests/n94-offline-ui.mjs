// Actual application DOM/handlers/source CSS over loopback HTTP, fresh synthetic
// account. All provider requests intercepted. Backend convergence is simulated.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { authenticated } from './helpers/remote-sync-browser.mjs';
import { capability, syntheticScoreBackend } from './n94-offline-backend.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = process.env.N94_OFFLINE_EVIDENCE || path.join(os.tmpdir(), 'rakeez-n94-offline-7cecbb0c');
await mkdir(directory, { recursive: true });
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  const relative = new URL(request.url, 'http://127.0.0.1').pathname.replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file)); } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let context, page, online = true, backend;
const evidence = { base, backend: 'simulated command receipts; no live SQL/Auth/RLS', checks: [], source: [], requests: [] };
try {
  context = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
  page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await authenticated(page, { async route(page) {
    await page.route('https://*.supabase.co/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1);
      evidence.requests.push(name);
      if (!online) return route.abort('internetdisconnected');
      if (name === 'user') return route.fulfill({ json: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
      if (name === 'score_foundation_capability') return route.fulfill({ json: capability });
      // Reconnect command traffic uses real cloud.js HTTP envelopes and the
      // existing dispatcher; synthetic server models command receipt replay.
      const body = JSON.parse(route.request().postData() || '{}');
      if (backend && name === 'apply_score_configuration_command') {
        return route.fulfill({ json: await backend.applyScoreConfigurationCommand({ mutationId: body.p_mutation_id,
          deviceId: body.p_device_id, itemId: body.p_item_id, expectedVersion: body.p_expected_version, payload: body.p_payload }) });
      }
      if (backend && name === 'apply_score_subitem_command_n94') {
        return route.fulfill({ json: await backend.applyScoreSubitemCommand({ mutationId: body.p_mutation_id,
          deviceId: body.p_device_id, itemId: body.p_item_id, studentId: body.p_student_id,
          subitemId: body.p_subitem_id, checked: body.p_completion_state !== 'unrecorded', completionState: body.p_completion_state }) });
      }
      return route.abort('internetdisconnected');
    });
  } });
  await page.evaluate(async () => {
    const db = await import('/src/lib/db.js'), m = await import('/src/models.js');
    await db.putAcross({
      sections: [{ ...m.makeSection({ id: 'n94-section', yearId: 'remote-year', grade: 4 }), serverRevision: 1 }],
      teachings: [{ ...m.makeTeaching({ id: 'n94-teaching', sectionId: 'n94-section', subjectId: 'remote-subject', termId: 'remote-term-1' }), serverRevision: 1 }],
      students: ['student', 'old-student'].map(id => ({ ...m.makeStudent({ id, name: id === 'student' ? 'طالب الاختبار' : 'طالب سابق' }), serverRevision: 1 })),
      enrollments: ['student', 'old-student'].map(studentId => m.makeEnrollment({ studentId, sectionId: 'n94-section', startDate: '2026-01-01' })),
      items: ['item', 'old-item'].map(id => ({ ...m.makeItem({ id, teachingId: 'n94-teaching', name: id === 'item' ? 'واجب الاختبار' : 'درجة سابقة', max: 10 }), serverRevision: 1 })),
      scores: [{ id: m.scoreId('old-student', 'old-item'), studentId: 'old-student', itemId: 'old-item', value: 7, serverRevision: 1 }],
    }); await db.closeDB();
  });
  await page.goto(base + '/#/teaching/n94-teaching/items');
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    ready = await page.evaluate(async () => {
      const s = await import('/src/store.js'); return s.state.ready && s.getActiveWorkspace()?.type === 'account' &&
        s.getOfflineLeaseStatus().editable && !!localStorage.getItem('rakeezx-score-capability-v1:' + s.getActiveWorkspace().id);
    });
    if (!ready) await page.waitForTimeout(100);
  }
  assert.equal(ready, true, 'actual account and durable verified capability ready');
  assert.ok(evidence.requests.includes('score_foundation_capability'));
  for (const relative of ['src/store.js', 'src/lib/cloud.js', 'src/views/items.js', 'src/views/grades.js', 'src/styles/components.css']) {
    const served = await context.request.get(base + '/' + relative);
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash(await served.body()), hash(await readFile(path.join(root, relative))));
    evidence.source.push({ path: relative, sha256: hash(await served.body()) });
  }
  const snapshot = () => page.evaluate(async () => {
    const db = await import('/src/lib/db.js'); return Object.fromEntries(await Promise.all(db.STORES.map(async n => [n, await db.getAll(n)])));
  });
  backend = syntheticScoreBackend(await snapshot());
  const oldGrade = (await snapshot()).scores.find(row => row.itemId === 'old-item');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Offline navigation/reload must be served by the real application SW.
  online = false; await context.setOffline(true);
  await page.reload();
  await page.locator('.boot').waitFor({ state: 'detached' });
  const edit = async (name) => {
    await page.locator('[data-act="configure"][data-id="item"]').click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const first = dialog.locator('[data-subitem-row]').first();
    await first.locator('[data-subitem-name]').fill(name);
    await first.locator('[data-subitem-due]').fill('2026-01-01');
    await first.locator('[data-subitem-late]').fill('2');
    await page.screenshot({ path: path.join(directory, name === 'واجب دون اتصال' ? 'offline-create.png' : 'offline-edit.png'), fullPage: true });
    await dialog.locator('[data-save-subitems]').click();
    await page.getByRole('button', { name: 'تأكيد التغيير', exact: true }).click();
    await page.locator('#toast').filter({ hasText: 'حُفظ توزيع العناصر' }).waitFor();
  };
  await edit('واجب دون اتصال');
  const definition = (await snapshot()).scoreSubitems[0];
  assert.equal(definition.latePoints, 2); assert.equal(definition.dueDate, '2026-01-01');
  await page.reload(); await page.locator('.boot').waitFor({ state: 'detached' });
  await edit('تعديل دون اتصال');
  assert.equal((await snapshot()).scoreSubitems[0].createdAt, definition.createdAt);
  await page.goto(base + '/#/teaching/n94-teaching/grades');
  await page.locator('[data-act="pick"][data-id="item"]').click();
  const button = () => page.locator(`[data-act="subitem-completion"][data-student="student"][data-subitem="${definition.id}"]`);
  const state = async selected => page.waitForFunction(({ id, selected }) =>
    document.querySelector(`[data-act="subitem-completion"][data-student="student"][data-subitem="${id}"]`)?.classList.contains('n94-completion--' + selected),
  { id: definition.id, selected });
  await button().click(); await state('late');
  assert.equal((await snapshot()).scores.find(row => row.itemId === 'item').value, 2);
  await page.screenshot({ path: path.join(directory, 'offline-late.png'), fullPage: true });
  await page.reload(); await page.locator('.boot').waitFor({ state: 'detached' });
  await page.locator('[data-act="pick"][data-id="item"]').click(); await state('late');
  await page.waitForTimeout(500); await button().click(); await state('regular');
  assert.equal((await snapshot()).scores.find(row => row.itemId === 'item').value, 10);
  await page.waitForTimeout(500); await button().click(); await state('unrecorded');
  assert.equal((await snapshot()).scores.find(row => row.itemId === 'item').value, null);
  await page.waitForTimeout(500); await button().click(); await state('late');
  const queued = (await snapshot()).outbox.filter(row => String(row.command).startsWith('score:')).sort((a,b) => a.sequence-b.sequence);
  assert.equal(queued.length, 6); assert.equal(new Set(queued.map(row => row.mutationId)).size, 6);
  assert.deepEqual((await snapshot()).scores.find(row => row.itemId === 'old-item'), oldGrade);
  assert.ok(!(await page.locator('#toast').textContent()).includes('Failed to fetch'));
  evidence.checks.push('actual_account_offline_create_edit_reload_deliberate_three_states_old_grade');
  online = true; await context.setOffline(false);
  const convergence = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js'), cloud = await import('/src/lib/cloud.js');
    const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
    const { runtimeSyncOwnershipGuard } = await import('/src/lib/sync-ownership.js');
    const engine = createSyncV2Engine({ database: db, transport: cloud, ownershipGuard: runtimeSyncOwnershipGuard,
      currentAuthenticatedUserId: () => cloud.user?.id });
    const passes = [];
    for (let i = 0; i < 8; i++) {
      const result = await engine.dispatchPending(); passes.push(result);
      if (!(await db.getAll('outbox')).some(row => String(row.command).startsWith('score:'))) break;
    }
    await (await import('/src/store.js')).refreshSyncedState();
    return passes;
  });
  evidence.convergence = convergence;
  assert.equal((await snapshot()).outbox.filter(row => String(row.command).startsWith('score:')).length, 0);
  assert.deepEqual(backend.applied, queued.map(row => row.mutationId));
  assert.equal(backend.state.scoreSubitemCompletions.length, 1);
  assert.equal((await snapshot()).scores.find(row => row.itemId === 'item').value, 2);
  assert.deepEqual((await snapshot()).scores.find(row => row.itemId === 'old-item'), oldGrade);
  await state('late');
  await page.screenshot({ path: path.join(directory, 'reconnected-late.png'), fullPage: true });
  assert.deepEqual(errors, []);
  evidence.checks.push('actual_HTTP_command_dispatch_reconnect_simulated_backend_once_no_loss_duplicates');
  evidence.queuedMutationIds = queued.map(row => row.mutationId); evidence.appliedMutationIds = backend.applied;
  console.log(JSON.stringify({ status: 'PASS', checks: evidence.checks, directory }));
} finally {
  await page?.screenshot({ path: path.join(directory, 'last-ui-state.png'), fullPage: true }).catch(() => {});
  await context?.close(); await browser.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(directory, 'result.json'), JSON.stringify(evidence, null, 2));
}
