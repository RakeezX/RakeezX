/** One explicit D-087 live job; never registered as a Playwright test.
 * No traces, screenshots, request headers, passwords or tokens are published.
 * The canonical Auth capability is imported by absolute path, independently
 * of this Product checkout. No Product service-role transport exists here.
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const TASK_RUN = 'c8d6edca-98b5-496d-aaf8-d15d40addc0f';
export const CANONICAL = 'C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/capabilities/d087';
export const PROJECT = 'xlrubcwjqktzzunrvuns';
const REPO = 'C:/Users/Abody/Projects/RakeezX';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => Object.assign(new Error(code), { safeCode: code });
const safeCode = error => /^[A-Z][A-Z0-9_]{2,80}$/.test(error?.safeCode ?? '') ? error.safeCode : 'LIVE_GATE_FAILED';
// Windows PowerShell 5 cannot load Security from inherited PowerShell 7 modules.
// Confine this ordinary module resolution repair to this Node process and children.
if (process.platform === 'win32') process.env.PSModulePath = [
  path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/Modules'),
  path.join(process.env.ProgramFiles, 'WindowsPowerShell/Modules'),
].join(';');
const loadModule = name => import(pathToFileURL(path.join(CANONICAL, name)).href);
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const git = async (...args) => (await exec('git', ['-C', ROOT, ...args], { windowsHide: true })).stdout.trim();
const G = 'sa-general-1448-1449', W = 'sa-western-1448-1449';
const YEAR = 'y:1448-1449';
const CONTEXTS = Object.freeze({ A1: 'A', A2: 'A', B1: 'B' });
const minute = 60_000;

export function liveDeadline(state, now = Date.now()) {
  const deadline = Math.min(Date.parse(state.issuedAt) + 45 * minute, Date.parse(state.expiresAt) - 15 * minute);
  if (!Number.isFinite(deadline) || deadline <= now || Date.parse(state.expiresAt) - deadline < 15 * minute)
    throw fail('LIVE_DEADLINE_EXHAUSTED');
  return deadline;
}

/** Cancellation closes only owned contexts before cleanup if work times out.
 * Every cleanup step is attempted even if the preceding one fails. This path
 * runs in the already-started Node process and never needs another model turn.
 */
export async function executeLifecycle({ operate, work, close, journal, bundles, deadline, now = Date.now }) {
  const abort = new AbortController();
  let timer, workError = null;
  const cleanup = [];
  await journal({ status: 'RUNNING', deadline: new Date(deadline).toISOString() });
  try {
    if (now() >= deadline) throw fail('LIVE_DEADLINE_EXHAUSTED');
    await operate('provision', 'provision');
    if (now() >= deadline) throw fail('LIVE_DEADLINE_EXHAUSTED');
    await operate('sign-in', 'provision');
    if (now() >= deadline) throw fail('LIVE_DEADLINE_EXHAUSTED');
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(fail('LIVE_DEADLINE_EXHAUSTED')); }, Math.max(1, deadline - now()));
    });
    await Promise.race([work(abort.signal), timeout]);
  } catch (error) {
    workError = safeCode(error);
  } finally {
    clearTimeout(timer);
    abort.abort();
    // Stop in-flight Product work before disposition; contexts never survive timeout.
    try { await close(); cleanup.push({ operation: 'close_owned_contexts', status: 'PASS' }); }
    catch { cleanup.push({ operation: 'close_owned_contexts', status: 'FAIL' }); }
    for (const operation of ['probe', 'retire', 'inspect', 'verify-denial']) {
      try { cleanup.push({ operation, status: 'PASS', result: await operate(operation, 'cleanup-only') }); }
      catch (error) { cleanup.push({ operation, status: 'FAIL', errorCode: safeCode(error) }); }
    }
    try { await bundles(); cleanup.push({ operation: 'closed_bundles', status: 'PASS' }); }
    catch (error) { cleanup.push({ operation: 'closed_bundles', status: 'FAIL', errorCode: safeCode(error) }); }
    await journal({ status: workError ? 'FAILED_DISARM_PENDING' : 'DISARM_PENDING', errorCode: workError,
      cleanup, functionDisarm: 'Requires explicit same-name connector redeploy/source readback and endpoint verification' });
  }
  return { workError, cleanup };
}

/** Use canonical binding/security/Auth functions, but allocate the card's exact
 * run identity here: canonical prepareRun's random operations-run ID is not the
 * activated card's authorized function-name suffix. Save once, before HTTP.
 */
export async function prepareGate(bindingFile, preparationReceiptFile) {
  const auth = await loadModule('run.mjs'), core = await loadModule('handler-core.mjs');
  const secure = await loadModule('private-state.mjs');
  const binding = await auth.validateCandidateBinding({ repo: REPO, binding: await json(bindingFile) });
  assert.equal(binding.candidateSha, await git('rev-parse', 'HEAD'));
  assert.equal(binding.preparationReceiptSha256, hash(await fs.readFile(preparationReceiptFile)));
  const contract = await json(path.join(CANONICAL, 'fixture-contract.json'));
  const source = (await exec('git', ['-C', REPO, 'show', binding.candidateSha + ':src/lib/cloud.js'], { windowsHide: true })).stdout;
  const key = source.match(/const PUBLISHABLE_KEY = '([^']+)';/)?.[1];
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '')) {
    const claims = key && JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
    assert.equal(claims?.role, 'anon'); assert.equal(claims?.ref, PROJECT);
  }
  const privateDir = path.join(REPO, 'artifacts/ops-supervisor-v4/capabilities/d087', TASK_RUN, 'private');
  await secure.securePrivateDirectory(REPO, privateDir, { create: true });
  const now = Date.now(), proof = () => randomBytes(32).toString('base64url');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const sectionId = 'sec:' + randomUUID(), termId = 'tm:' + YEAR + ':1', subjectId = 'sub:digital-skills';
  const teachingId = `tch:${sectionId}|${subjectId}|${termId}`;
  const state = { version: 1, kind: 'd087-private-run', runId: TASK_RUN, projectId: PROJECT,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 90 * minute).toISOString(),
    candidateSha: binding.candidateSha, previewUrl: binding.previewUrl, candidatePreparation: binding,
    functionName: 'ops-d087-' + TASK_RUN.replaceAll('-', '').slice(0, 20),
    cleanupFunctionName: 'ops-d087-retire-' + TASK_RUN.replaceAll('-', '').slice(0, 20),
    implementationSha256: await auth.implementationIdentity(), fixtureContractSha256: await core.sha256(core.canonical(contract)),
    capabilities: { provision: proof(), 'cleanup-only': proof() }, publishableKey: key,
    accounts: ['A', 'B'].map(slot => ({ slot, id: randomUUID(), email: core.fixtureEmail(TASK_RUN, slot), password: 'D087!aA1' + proof() })),
    foundationDefaults: (await import('../src/lib/account-provisioning.js')).buildAccountFoundationDefaults(),
    fixtureIds: { A: { sectionId, teachingId, termId, subjectId, itemIds: Array.from({ length: 5 }, randomUUID), date,
      successSessionId: `se:${teachingId}:${date}:1`, legacyDeniedSessionId: `se:${teachingId}:${date}:2`,
      staleDeniedSessionId: `se:${teachingId}:${date}:3`, snapshotId: `srs:se:${teachingId}:${date}:1`,
      mutationIds: Object.fromEntries(['section', 'teaching', 'selectGeneral', 'session', 'legacyDenied', 'switchWestern', 'staleDenied', 'bDenied'].map(k => [k, 'd087:' + randomUUID()])),
      // Factories allocate a discarded base ID even for an explicit natural ID.
      factoryIds: Object.fromEntries(['section', 'teaching', 'session'].map(k => [k, randomUUID()])),
    } }, tokens: {}, operations: {}, events: [], observations: {}, phase: null,
    gate: { status: 'NOT_RUN' }, disposition: { status: 'NOT_RUN' }, disarmed: false };
  await secure.writePrivateState(privateDir, state);
  await auth.writePublicReceipt(privateDir, state);
  return { privateDir, functionName: state.functionName, cleanupFunctionName: state.cleanupFunctionName, liveActions: 0 };
}

const READ_RPC = new Set(['account_contract', 'sync_v2_restore_manifest_full', 'sync_v2_restore_manifest_score_v2',
  'sync_v2_restore_canonical_full', 'sync_v2_restore_canonical_score_v2', 'sync_v2_score_domain_snapshot',
  'score_foundation_capability', 'get_curriculum_sync_bootstrap_status', 'owner_sync_change_marker']);
const FOUNDATION_RPC = new Set(['provision_account_profile', 'complete_account_profile', 'begin_account_provisioning', 'provision_account_workspace']);
const OWN_TABLES = new Set(['profile', 'account_access_grants', 'years', 'calendars', 'calendar_days', 'terms', 'subjects',
  'time_profiles', 'sections', 'teachings', 'items', 'sessions', 'session_roster_snapshots', 'sync_mutation_receipts',
  'students', 'enrollments', 'scores', 'score_subitems', 'score_subitem_completions', 'attendance', 'logs',
  'slots', 'units', 'lessons', 'notes', 'class_rules', 'class_goals', 'class_charter_selections', 'group_arrangements', 'closed_term_reports']);
export function foundationShape(defaults) {
  if (!defaults || typeof defaults !== 'object') return null;
  // Normal factories timestamp records at invocation. Compare every other
  // field/ID/count; an elapsed real clock is not a different foundation.
  return Object.fromEntries(Object.entries(defaults).sort().map(([entity, rows]) => [entity,
    Array.isArray(rows) ? rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'updatedAt').sort())) : rows,
  ]));
}

/** A request preflight, not a fake server: permitted calls always continue to
 * real PostgREST. Unlisted writes fail closed and cannot broaden the fixture.
 */
export function permittedRequest({ url, method, body, context, state }) {
  const u = new URL(url), f = state.fixtureIds.A, owner = state.accounts.find(a => a.slot === CONTEXTS[context])?.id;
  if (!owner || u.origin !== `https://${PROJECT}.supabase.co`) return false;
  if (u.pathname === '/auth/v1/user') return method === 'GET';
  if (!u.pathname.startsWith('/rest/v1/')) return false;
  const name = u.pathname.split('/').at(-1);
  if (method === 'GET') {
    if (!OWN_TABLES.has(name)) return false;
    if (u.searchParams.get('owner_id') === 'eq.' + owner) return true;
    if (context !== 'B1' || u.searchParams.get('owner_id') !== 'eq.' + state.accounts[0].id) return false;
    const ids = { years: [YEAR], calendars: ['cal:' + YEAR + ':preset:' + W], terms: [f.termId, 'tm:' + YEAR + ':2'],
      sections: [f.sectionId], teachings: [f.teachingId], sessions: [f.successSessionId], items: f.itemIds };
    return ids[name]?.includes(u.searchParams.get('id')?.slice(3)) && u.searchParams.get('id')?.startsWith('eq.');
  }
  if (method !== 'POST' || !u.pathname.startsWith('/rest/v1/rpc/')) return false;
  if (READ_RPC.has(name)) return body?.p_owner == null || body.p_owner === owner;
  if (FOUNDATION_RPC.has(name)) {
    if (context !== 'A1') return false;
    if (name === 'complete_account_profile') return JSON.stringify(body) === JSON.stringify({
      p_teacher_name: 'D087 synthetic A', p_phone: '0500000001', p_teacher_form: 'masculine', p_school_name: null,
    });
    if (name === 'provision_account_workspace') return JSON.stringify(foundationShape(body?.p_defaults)) === JSON.stringify(foundationShape(state.foundationDefaults));
    return JSON.stringify(body) === '{}';
  }
  if (name === 'apply_sync_v2_teaching_creation_command') return context === 'A1' &&
    body?.p_mutation_id === f.mutationIds.teaching && body.p_teaching_id === f.teachingId &&
    body.p_section_id === f.sectionId && body.p_subject_id === f.subjectId && body.p_term_id === f.termId &&
    JSON.stringify(body.p_item_ids) === JSON.stringify(f.itemIds);
  if (name !== 'apply_sync_v2_mutation') return false;
  const targets = {
    section: ['sections', f.sectionId, 'create'], selectGeneral: ['years', YEAR, 'patch'],
    session: ['sessions', f.successSessionId, 'create'], legacyDenied: ['sessions', f.legacyDeniedSessionId, 'create'],
    switchWestern: ['years', YEAR, 'patch'], staleDenied: ['sessions', f.staleDeniedSessionId, 'create'],
    bDenied: ['sections', f.sectionId, 'patch'],
  };
  const key = Object.keys(targets).find(k => f.mutationIds[k] === body?.p_mutation_id);
  if (!key || context !== (key === 'bDenied' ? 'B1' : 'A1')) return false;
  const [entity, id, op] = targets[key];
  if (body.p_entity !== entity || body.p_record_id !== id || body.p_operation !== op) return false;
  if (key === 'selectGeneral' || key === 'switchWestern') return Object.keys(body.p_patch ?? {}).join() === 'calendar_preset_id' &&
    body.p_patch.calendar_preset_id === (key === 'selectGeneral' ? G : W);
  if (key === 'bDenied') return JSON.stringify(body.p_patch) === JSON.stringify({ name: 'D087 denied B attempt' });
  return true;
}

async function installBoundary(context, label, state, signal, evidence, violation) {
  await context.route(`https://${PROJECT}.supabase.co/**`, async route => {
    const request = route.request();
    let body; try { body = request.postDataJSON(); } catch { body = null; }
    if (signal.aborted || !permittedRequest({ url: request.url(), method: request.method(), body, context: label, state })) {
      if (!signal.aborted) violation.push({ context: label, endpoint: new URL(request.url()).pathname, method: request.method() });
      return route.abort('blockedbyclient');
    }
    // Pass-through interception preserves the actual app HTTP/serializer path.
    if (request.method() === 'POST' && body?.p_mutation_id) {
      const response = await route.fetch({ timeout: 15000 });
      let receipt; try { receipt = await response.json(); } catch { throw fail('POSTGREST_RESPONSE_INVALID'); }
      evidence.push({ context: label, endpoint: new URL(request.url()).pathname, envelope: body,
        httpStatus: response.status(), receipt });
      await route.fulfill({ response });
    } else await route.continue();
  });
}

async function sessionInto(page, state, label) {
  const token = state.tokens[label], owner = state.accounts.find(a => a.slot === CONTEXTS[label]);
  assert.equal(token.ownerVerified, true);
  // Real password login was performed once by canonical sign-in and saved
  // privately. Install that ordinary application session; do not log in twice.
  await page.evaluate(async ({ access, refresh, expires, id, email }) => {
    const c = await import('/src/lib/cloud.js');
    localStorage.setItem(c.AUTH_STORAGE_KEY, JSON.stringify({ access_token: access, refresh_token: refresh,
      expires_at: Date.parse(expires) / 1000, user: { id, email, role: 'authenticated' } }));
    await c.init();
  }, { access: token.accessToken, refresh: token.refreshToken, expires: token.expiresAt, id: owner.id, email: owner.email });
}

async function mounted(page, owner) {
  await page.waitForFunction(async () => (await import('/src/store.js')).state.ready, null, { timeout: 45000 });
  return page.evaluate(async owner => {
    const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js');
    const db = await import('/src/lib/db.js'), v2 = await import('/src/lib/sync-v2.js');
    const guard = (await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;
    if (s.getActiveWorkspace()?.authUserId !== owner || c.user?.id !== owner) throw new Error('owner mismatch');
    await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();
    await s.renewOfflineLease();
    window.__n58Gate = { s, c, db, engine: v2.createSyncV2Engine({ ownershipGuard: guard, currentAuthenticatedUserId: () => c.user?.id }) };
    return { workspace: s.getActiveWorkspace(), lease: s.getOfflineLeaseStatus(), device: await db.get('device', 'device') };
  }, owner);
}

export async function allocateAction(page, ids, action, fixture) {
  return page.evaluate(async ({ ids, action, fixture: f }) => {
    const native = crypto.randomUUID.bind(crypto), queue = [...ids];
    crypto.randomUUID = () => { if (!queue.length) throw new Error('unallocated ID'); return queue.shift(); };
    try {
      const { s } = window.__n58Gate;
      if (action === 'section') await s.createSection({ id: f.sectionId, yearId: 'y:1448-1449', grade: 4, label: 'D087', name: 'D087 synthetic A' });
      if (action === 'teaching') await s.createTeaching({ sectionId: f.sectionId, subjectId: f.subjectId, termId: f.termId });
      if (action === 'session') await s.ensureSession(f.teachingId, f.date, 1, { slotId: null, timeProfileId: null, lessonId: null });
      if (queue.length) throw new Error('unused allocated ID');
      return await window.__n58Gate.db.getAll('outbox');
    } finally { crypto.randomUUID = native; }
  }, { ids, action, fixture });
}
async function dispatch(page) {
  const result = await page.evaluate(async () => {
    const g = window.__n58Gate, push = await g.engine.dispatchPending();
    await g.s.refreshSyncedState();
    return { push, outbox: await g.db.getAll('outbox') };
  });
  assert.equal(result.push.failed, 0); assert.equal(result.push.blocked, 0); assert.deepEqual(result.outbox, []);
  return result;
}
async function choose(page, preset, mutationId) {
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'التقويم', exact: true }).click();
  await page.evaluate(id => {
    const native = crypto.randomUUID.bind(crypto); let used = false;
    window.__n58Gate.restoreRandom = () => { crypto.randomUUID = native; };
    crypto.randomUUID = () => { if (used) throw new Error('unallocated ID'); used = true; return id; };
  }, mutationId);
  try {
    await page.locator(`[data-act="set-region"][data-id="${preset}"]`).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  } finally { await page.evaluate(() => window.__n58Gate.restoreRandom()); }
  await dispatch(page);
  const year = await page.evaluate(async () => window.__n58Gate.db.get('years', 'y:1448-1449'));
  assert.equal(year.calendarPresetId, preset); assert.ok(year.fieldRevisions.calendar_selection > 0);
  return year;
}
async function ownerRows(page, entity) {
  return page.evaluate(async entity => {
    const c = await import('/src/lib/cloud.js');
    return c.fetchRestoreEntityPage(entity);
  }, entity);
}
async function noRejectedRows(page, sessionId, mutationId) {
  const observed = await page.evaluate(async ({ sessionId, mutationId }) => {
    const c = window.__n58Gate.c, headers = { 'Accept-Profile': 'rakeezx' }, own = 'owner_id=eq.' + c.user.id;
    return { sessions: await c.request('/sessions?' + own + '&id=eq.' + encodeURIComponent(sessionId) + '&select=*', { headers }),
      receipts: await c.request('/sync_mutation_receipts?' + own + '&mutation_id=eq.' + encodeURIComponent(mutationId) + '&select=*', { headers }) };
  }, { sessionId, mutationId });
  assert.deepEqual(observed, { sessions: [], receipts: [] }); return observed;
}
async function rejectSession(page, fixture, originalEnvelope, kind) {
  const sessionId = kind === 'legacyDenied' ? fixture.legacyDeniedSessionId : fixture.staleDeniedSessionId;
  const envelope = { entity: 'sessions', recordId: sessionId, mutationId: fixture.mutationIds[kind],
    deviceId: originalEnvelope.p_device_id, baseRevision: 0, operation: 'create', clientUpdatedAt: Date.now(),
    patch: { ...originalEnvelope.p_patch, period: kind === 'legacyDenied' ? 2 : 3 } };
  if (kind === 'legacyDenied') delete envelope.patch.calendar_context;
  const result = await page.evaluate(async envelope => {
    try { return { accepted: true, receipt: await window.__n58Gate.c.applySyncV2Mutation(envelope) }; }
    catch (error) { return { accepted: false, status: error.status, code: error.code, message: error.message }; }
  }, envelope);
  assert.equal(result.accepted, false); assert.ok(result.status >= 400 && result.status < 500);
  const expected = kind === 'legacyDenied' ? 'N58_SESSION_CONTEXT_REQUIRED' : 'N58_STALE_CALENDAR_SELECTION';
  assert.ok(result.message.includes(expected));
  return { envelope, rejection: result, zeroRows: await noRejectedRows(page, sessionId, envelope.mutationId) };
}

async function runClientGate(state, signal, saveEvidence, owned) {
  const { chromium } = await import('@playwright/test');
  owned.browser = await chromium.launch();
  const pages = {}, receipts = [], violations = [];
  const A = state.accounts[0].id, f = state.fixtureIds.A;
  for (const label of Object.keys(CONTEXTS)) {
    const context = await owned.browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh', viewport: { width: 390, height: 844 } });
    owned.contexts.push(context);
    await installBoundary(context, label, state, signal, receipts, violations);
    pages[label] = await context.newPage(); pages[label].setDefaultTimeout(15000);
    await pages[label].goto(state.previewUrl, { waitUntil: 'domcontentloaded' });
  }
  const a = pages.A1;
  await sessionInto(a, state, 'A1'); await a.reload();
  await a.locator('[data-account-profile-form]').waitFor();
  await a.locator('[name="teacherName"]').fill('D087 synthetic A');
  await a.locator('[name="phone"]').fill('0500000001');
  await a.getByRole('button', { name: 'متابعة', exact: true }).click();
  const bindingA = await mounted(a, A);
  const contract = await json(path.join(CANONICAL, 'fixture-contract.json'));
  const foundation = {};
  for (const row of contract.foundationA.rows) {
    if (row.table === 'account_access_grants') continue; // Established by ordinary account_contract.
    foundation[row.table] = await ownerRows(a, row.table);
    assert.equal(foundation[row.table].length, row.count);
    if (row.ids) assert.deepEqual(foundation[row.table].map(r => r.id).sort(), [...row.ids].sort());
    assert.ok(foundation[row.table].every(r => r.owner_id === A));
  }
  const access = await a.evaluate(() => window.__n58Gate.c.getAccountContract());
  assert.equal(access.access.grantType, 'beta_full');
  for (const entity of ['students', 'enrollments', 'scores', 'attendance', 'logs']) assert.deepEqual(await ownerRows(a, entity), []);
  await a.getByRole('link', { name: 'التقويم', exact: true }).click();
  const general = await choose(a, G, f.mutationIds.selectGeneral);
  await allocateAction(a, [f.factoryIds.section, f.mutationIds.section], 'section', f); await dispatch(a);
  await allocateAction(a, [f.factoryIds.teaching, ...f.itemIds, f.mutationIds.teaching], 'teaching', f); await dispatch(a);
  assert.equal(await a.evaluate(date => window.__n58Gate.s.isSessionEligibleDate(date), f.date), true);
  await allocateAction(a, [f.factoryIds.session, f.mutationIds.session], 'session', f); await dispatch(a);
  const successful = receipts.find(r => r.envelope.p_mutation_id === f.mutationIds.session);
  assert.equal(successful?.httpStatus, 200); assert.equal(successful.receipt.outcome, 'applied');
  assert.equal(successful.envelope.p_patch.calendar_context.selectionRevision, general.fieldRevisions.calendar_selection);
  const session = (await ownerRows(a, 'sessions')).find(r => r.id === f.successSessionId);
  assert.deepEqual(session.calendar_context, successful.envelope.p_patch.calendar_context);
  const serverReceipts = await ownerRows(a, 'sync_mutation_receipts');
  assert.ok(serverReceipts.some(r => r.mutation_id === f.mutationIds.session));
  await saveEvidence({ bindingA, foundationCounts: Object.fromEntries(Object.entries(foundation).map(([k, rows]) => [k, rows.length])), general,
    successful, session, serverReceipts });
  const legacy = await rejectSession(a, f, successful.envelope, 'legacyDenied');
  const a2 = pages.A2; await sessionInto(a2, state, 'A2'); await a2.reload();
  const restoreA2 = await mounted(a2, A);
  assert.ok(restoreA2.device.initialRestoreReceipt?.ownerId === A);
  const restored = await a2.evaluate(async id => window.__n58Gate.db.get('sessions', id), f.successSessionId);
  assert.deepEqual(restored.calendarContext, session.calendar_context);
  const western = await choose(a, W, f.mutationIds.switchWestern);
  assert.ok(western.fieldRevisions.calendar_selection > general.fieldRevisions.calendar_selection);
  const stale = await rejectSession(a, f, successful.envelope, 'staleDenied');
  const afterSwitch = (await ownerRows(a, 'sessions')).find(r => r.id === f.successSessionId);
  assert.deepEqual(afterSwitch, session);
  await a2.evaluate(async () => { await window.__n58Gate.engine.pullStore('years'); await window.__n58Gate.engine.pullStore('sessions'); await window.__n58Gate.s.refreshSyncedState(); });
  const convergence = await a2.evaluate(async id => ({ year: await window.__n58Gate.db.get('years', 'y:1448-1449'), session: await window.__n58Gate.db.get('sessions', id) }), f.successSessionId);
  assert.equal(convergence.year.calendarPresetId, W); assert.equal(convergence.year.fieldRevisions.calendar_selection, western.fieldRevisions.calendar_selection);
  assert.deepEqual(convergence.session.calendarContext, session.calendar_context);
  const beforeB = {};
  for (const entity of ['years', 'calendars', 'terms', 'sections', 'teachings', 'items', 'sessions']) beforeB[entity] = await ownerRows(a, entity);
  const b = pages.B1; await sessionInto(b, state, 'B1'); // No reload/Profile/Provisioning for B.
  const isolation = await b.evaluate(async ({ A, f }) => {
    const c = await import('/src/lib/cloud.js'), headers = { 'Accept-Profile': 'rakeezx' }, reads = [];
    const ids = { years: ['y:1448-1449'], calendars: ['cal:y:1448-1449:preset:sa-western-1448-1449'], terms: [f.termId],
      sections: [f.sectionId], teachings: [f.teachingId], sessions: [f.successSessionId], items: f.itemIds };
    for (const [entity, keys] of Object.entries(ids)) for (const id of keys) reads.push({ entity, id,
      rows: await c.request('/' + entity + '?owner_id=eq.' + A + '&id=eq.' + encodeURIComponent(id) + '&select=*', { headers }) });
    const envelope = { entity: 'sections', recordId: f.sectionId, mutationId: f.mutationIds.bDenied, deviceId: 'D087-B1',
      baseRevision: 1, operation: 'patch', patch: { name: 'D087 denied B attempt' }, clientUpdatedAt: Date.now() };
    const receipt = await c.applySyncV2Mutation(envelope);
    return { reads, envelope, receipt, ownProfile: await c.fetchRestoreEntityPage('profile') };
  }, { A, f });
  assert.ok(isolation.reads.every(r => r.rows.length === 0)); assert.equal(isolation.receipt.outcome, 'not_found'); assert.deepEqual(isolation.ownProfile, []);
  const afterB = {}; for (const entity of Object.keys(beforeB)) afterB[entity] = await ownerRows(a, entity);
  assert.deepEqual(afterB, beforeB);
  const finalCounts = {};
  for (const entity of ['sections', 'teachings', 'items', 'sessions', 'session_roster_snapshots', 'students', 'enrollments', 'scores', 'attendance', 'logs']) finalCounts[entity] = (await ownerRows(a, entity)).length;
  assert.equal(finalCounts.sections, 1); assert.equal(finalCounts.teachings, 1); assert.equal(finalCounts.items, 5); assert.equal(finalCounts.sessions, 1);
  assert.ok(finalCounts.session_roster_snapshots <= 1);
  for (const entity of ['students', 'enrollments', 'scores', 'attendance', 'logs']) assert.equal(finalCounts[entity], 0);
  assert.deepEqual(violations, []);
  for (const width of [1440, 390, 320]) {
    await a.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await a.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.documentElement).direction === 'rtl'), true);
    }
  }
  await saveEvidence({ legacy, stale, restoreA2, restored, western, convergence, isolation,
    aUnchangedAfterB: hash(JSON.stringify(afterB)), finalCounts, receipts, violations, renderedCalendar: 'actual Preview DOM/handlers/CSS; 1440/390/320 light/dark RTL' });
}

export async function runGate(privateDir, { recoveryOnly = false } = {}) {
  const auth = await loadModule('run.mjs'), secure = await loadModule('private-state.mjs');
  const state = await secure.readPrivateState(REPO, privateDir);
  assert.equal(state.runId, TASK_RUN); assert.equal(state.projectId, PROJECT);
  assert.equal(path.resolve(privateDir).toLowerCase(), path.resolve(REPO, 'artifacts/ops-supervisor-v4/capabilities/d087', TASK_RUN, 'private').toLowerCase());
  const lock = await fs.open(path.join(privateDir, 'GATE_RUNNING.lock'), 'wx', 0o600);
  await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); await lock.sync();
  const owned = { browser: null, contexts: [] };
  const operate = (operation, mode) => auth.runOperation({ repo: REPO, privateDir, operation, mode, live: true });
  const journal = patch => secure.withPrivateRun(REPO, privateDir, async current => {
    current.gate = { ...current.gate, ...patch }; await secure.writePrivateState(privateDir, current); await auth.writePublicReceipt(privateDir, current);
  });
  const close = async () => {
    for (const context of owned.contexts) await context.close();
    await owned.browser?.close();
  };
  const bundles = () => auth.renderBundle({ repo: REPO, privateDir, mode: 'closed' });
  try {
    if (recoveryOnly) {
      if (Date.now() >= Date.parse(state.expiresAt)) {
        await journal({ status: 'CAPABILITY_EXPIRED_CLEANUP_PENDING' }); throw fail('CAPABILITY_EXPIRED_CLEANUP_PENDING');
      }
      return await executeLifecycle({ operate: (op, mode) => ['provision', 'sign-in'].includes(op) ? Promise.resolve() : operate(op, mode),
        work: async () => {}, close, journal, bundles, deadline: Date.now() + minute });
    }
    assert.equal(state.candidateSha, await git('rev-parse', 'HEAD'));
    assert.ok(state.cleanupStandbyVerifiedAt && state.phase === 'provision' && !state.cleanupStartedAt);
    assert.equal(state.gate.status, 'NOT_RUN'); // Retry is cleanup-only; never a second Product sequence.
    return await executeLifecycle({ operate,
      work: async signal => runClientGate(await secure.readPrivateState(REPO, privateDir), signal,
        evidence => journal({ evidence: { ...(state.gate.evidence ?? {}), ...evidence } }).then(() => Object.assign(state.gate, { evidence: { ...(state.gate.evidence ?? {}), ...evidence } })), owned),
      close, journal, bundles, deadline: liveDeadline(state) });
  } finally { await lock.close(); await fs.unlink(path.join(privateDir, 'GATE_RUNNING.lock')); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, first, second] = process.argv.slice(2);
    const result = command === 'prepare' ? await prepareGate(first, second) :
      command === 'run' ? await runGate(first) : command === 'recover' ? await runGate(first, { recoveryOnly: true }) : (() => { throw fail('EXPLICIT_GATE_COMMAND_REQUIRED'); })();
    // All output is nonsecret. No raw error stack or browser/Auth state.
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.workError || result.cleanup?.some(r => r.status === 'FAIL')) process.exitCode = 1;
  } catch (error) { process.stdout.write(JSON.stringify({ ok: false, errorCode: safeCode(error) }) + '\n'); process.exitCode = 1; }
}
