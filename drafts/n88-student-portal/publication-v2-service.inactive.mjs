/** AI-authored SOURCE ONLY. No DB implementation, deployment or live enablement.
 * Required port: a synthetic serial transaction over {scopes:[],receipts:[]}.
 * It owns locks, rollback, beforeCommit guards and ACK-after-COMMIT. Auth and
 * readCurrent are trusted injected server ports, NEVER request-derived proofs.
 * Browser lease/context are echo fences only, not server workspace authority.
 */
import { createHash } from 'node:crypto';
import { proposePublicationRows, samePublicationScope } from '../../src/lib/n88-item-publication-proposal.js';
import { manualTaskDraft } from '../../src/lib/n88-manual-task-link-safety.js';
import { validDateTimeValue } from '../../src/lib/rakeez-datetime-values.js';
import { CANONICAL_PROJECTION_REQUIREMENTS, studentPortalPublicationBindings, projectStudentPublicationV2 } from './student-projection.mjs';
import { PRIVATE_HEADERS } from './service.mjs';

export const PUBLICATION_V2_PATHS = Object.freeze(['/teacher/class/publication-v2', '/student/publication-v2/read']);
const flags = ['required', 'scheduled', 'completed', 'grade'];
const scopeKeys = ['ownerId', 'teachingId', 'sectionId', 'termId', 'subjectId'];
const bindingKeys = ['sessionId', 'leaseId', 'contextRevision'];
const commandKeys = ['version', 'action', 'requestId', 'scope', 'binding', 'expectedMembershipRevision', 'sourceId', 'rowId',
  'expectedSourceRevision', 'expectedPublicationRevision', 'decisions', 'manualTask'];
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200 && !v.includes('\0');
const revision = v => Number.isSafeInteger(v) && v >= 0;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const off = () => Object.fromEntries(flags.map(k => [k, false]));
const fail = () => { throw Error('n88_publication_v2_unavailable'); };
// Order-independent digest of exact validated wire objects, not insertion order.
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const active = r => r && r.deleted === false && r.deletedAt == null && r.archivedAt == null && !['archived', 'closed', 'retired'].includes(r.status);
const response = (status, body) => ({ status, body, headers: PRIVATE_HEADERS });
const unavailable = () => response(503, { state: 'unknown', retry: false });
const pupilInput = (snapshot, scope, member) => ({ canonical: snapshot.canonical, ownerId: scope.ownerId,
  classId: scope.sectionId, termId: scope.termId, studentId: member.studentId, enrollmentId: member.id,
  teacherContextVersion: 'n88-canonical-teacher-context-v1', now: snapshot.now });

function canonicalSnapshot(snapshot, scope) {
  const c = snapshot?.canonical;
  if (!c || !validDateTimeValue(snapshot.now, 'date') || !snapshot.now) fail();
  for (const table of CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    const rows = c[table];
    if (!Array.isArray(rows) || rows.length > 2000 || new Set(rows.map(r => r.id)).size !== rows.length ||
        rows.some(r => !id(r.id) || r.ownerId !== scope.ownerId || typeof r.deleted !== 'boolean' || !/^[1-9][0-9]*$/.test(String(r.revision)))) fail();
  }
  if (Buffer.byteLength(JSON.stringify(c)) > 2 * 1024 * 1024) fail();
  const one = (table, key) => c[table].find(r => r.id === key && active(r));
  const t = one('teachings', scope.teachingId), section = one('sections', scope.sectionId), term = one('terms', scope.termId);
  const year = one('years', section?.yearId);
  if (!t || !section || !term || !year || t.sectionId !== section.id || t.termId !== term.id || t.subjectId !== scope.subjectId ||
      section.yearId !== term.yearId || [section, term, year].some(r => r.status !== 'active') ||
      term.startDate && (!validDateTimeValue(term.startDate, 'date') || term.startDate > snapshot.now) ||
      term.endDate && (!validDateTimeValue(term.endDate, 'date') || term.endDate < snapshot.now)) fail();
  const members = c.enrollments.filter(r => active(r) && r.sectionId === section.id && r.status === 'active' && r.endDate == null);
  if (new Set(members.map(r => r.studentId)).size !== members.length) fail();
  for (const m of members) studentPortalPublicationBindings(pupilInput(snapshot, scope, m));
  // Also binds owner/section/term authority for a legitimate empty class.
  const membershipRevision = digest([scope, year, term, section, t, members,
    c.students.filter(s => members.some(m => m.studentId === s.id))]);
  return { c, members, membershipRevision };
}

function rowsFrom(snapshot, scope, manualTasks, retired = []) {
  const { c, members, membershipRevision } = canonicalSnapshot(snapshot, scope);
  const draft = proposePublicationRows({ scope, data: { ...c, ownerId: scope.ownerId,
    items: c.items.filter(r => active(r) && !retired.includes('items:' + r.id)),
    scoreSubitems: c.scoreSubitems.filter(r => active(r) && !retired.includes('scoreSubitems:' + r.id)) }, manualTasks: manualTasks.map(m => ({ ...m, scope })) });
  for (const row of draft.rows) {
    const item = c.items.find(i => i.id === row.itemId);
    const definition = row.kind === 'subitem' ? c.scoreSubitems.find(d => d.id === row.sourceId) : null;
    // Score VALUES as well as revisions participate, including persisted late
    // points/completion state. Unsupported source drift never inherits permission.
    const gradeInputs = row.kind === 'manual' ? [] : row.kind === 'subitem' ? [definition,
      c.scoreSubitemCompletions.filter(r => r.subitemId === row.sourceId && members.some(m => m.studentId === r.studentId))] :
      item?.auto || item?.portabilityGroupId ? c : [item, c.scores.filter(r => r.itemId === row.sourceId && members.some(m => m.studentId === r.studentId))];
    row.sourceRevision = digest([row.sourceRevision, gradeInputs]);
  }
  return { draft, members, membershipRevision };
}

function trackSources(stored, snapshot, scope) {
  const c = snapshot.canonical;
  const parents = c.items.filter(r => r.teachingId === scope.teachingId);
  const sources = [...parents.map(r => ({ table: 'items', row: r })),
    ...c.scoreSubitems.filter(r => parents.some(p => p.id === r.itemId)).map(r => ({ table: 'scoreSubitems', row: r }))];
  for (const prior of stored.sourceVersions) {
    const next = sources.find(s => prior.key === s.table + ':' + s.row.id);
    if (!next) prior.retired = true;
  }
  for (const { table, row } of sources) {
    const key = table + ':' + row.id;
    const prior = stored.sourceVersions.find(s => s.key === key);
    if (prior) {
      if (BigInt(row.revision) < BigInt(prior.revision)) fail();
      prior.revision = String(row.revision); prior.retired ||= !active(row);
    } else stored.sourceVersions.push({ key, revision: String(row.revision), retired: !active(row) });
  }
  if (stored.sourceVersions.length > 4000) fail();
  return stored.sourceVersions.filter(s => s.retired).map(s => s.key);
}

function reconcileSources(stored, current) {
  for (const p of stored.publications) {
    const row = current.draft.rows.find(r => r.id === p.rowId);
    if (p.tombstone) continue;
    if (!row || p.sourceRevision !== row.sourceRevision || p.membershipRevision !== current.membershipRevision) {
      p.publicationRevision++;
      if (!revision(p.publicationRevision)) fail();
      p.decisions = off(); p.tombstone = !row;
      if (row) p.sourceRevision = row.sourceRevision;
      p.membershipRevision = current.membershipRevision;
    }
  }
  for (const row of current.draft.rows) if (!stored.publications.some(p => p.rowId === row.id)) stored.publications.push({
    rowId: row.id, sourceRevision: row.sourceRevision, publicationRevision: 0, membershipRevision: current.membershipRevision,
    decisions: off(), tombstone: false });
}
function validCommand(r) {
  return exact(r, commandKeys) && r.version === 2 && ['item-publication-set', 'item-publication-delete'].includes(r.action) &&
    /^[A-Za-z0-9_-]{16,100}$/.test(r.requestId ?? '') && id(r.sourceId) && typeof r.rowId === 'string' && r.rowId.length <= 1000 &&
    /^[a-f0-9]{64}$/.test(r.expectedSourceRevision ?? '') && id(r.expectedMembershipRevision) && revision(r.expectedPublicationRevision) &&
    exact(r.decisions, flags) && flags.every(k => typeof r.decisions[k] === 'boolean') &&
    (r.manualTask === null || exact(r.manualTask, ['id', 'title', 'description', 'startDate', 'dueDate', 'link']));
}

function validStored(stored) {
  if (!Array.isArray(stored.manualTasks) || !Array.isArray(stored.publications) || !Array.isArray(stored.sourceVersions) ||
      new Set(stored.publications.map(p => p.rowId)).size !== stored.publications.length ||
      new Set(stored.manualTasks.map(m => m.id)).size !== stored.manualTasks.length ||
      new Set(stored.sourceVersions.map(s => s.key)).size !== stored.sourceVersions.length ||
      stored.publications.some(p => !exact(p, ['rowId', 'sourceRevision', 'publicationRevision', 'membershipRevision', 'decisions', 'tombstone']) ||
        typeof p.rowId !== 'string' || !hex(p.sourceRevision) || !hex(p.membershipRevision) || !revision(p.publicationRevision) ||
        typeof p.tombstone !== 'boolean' || !exact(p.decisions, flags) || !flags.every(k => typeof p.decisions[k] === 'boolean')) ||
      stored.sourceVersions.some(s => !exact(s, ['key', 'revision', 'retired']) || typeof s.key !== 'string' ||
        !/^[1-9][0-9]*$/.test(s.revision) || typeof s.retired !== 'boolean')) fail();
}

export function createPublicationV2Service({ executionMode, enabled = false, origin, transaction, authenticate, readCurrent }) {
  // No live adapter exists. Even an accidentally enabled non-synthetic service
  // cannot enter this source prototype. No environment/query/body flag is read.
  if (enabled !== true || executionMode !== 'synthetic') return async () => response(401, { error: 'unavailable' });
  if (![transaction, authenticate, readCurrent].every(fn => typeof fn === 'function') || !origin) fail();
  return async request => {
    const student = request.path === PUBLICATION_V2_PATHS[1], r = request.body;
    const h = request.headers ?? {};
    if (!PUBLICATION_V2_PATHS.includes(request.path) || request.method !== (student ? 'GET' : 'POST') ||
        h.origin !== origin || h['x-n88-csrf'] !== '1' || h['sec-fetch-site'] && h['sec-fetch-site'] !== 'same-origin' ||
        !student && h['content-type'] !== 'application/json') return response(401, { error: 'unavailable' });
    try {
      if (Buffer.byteLength(JSON.stringify(r ?? {})) > 16384) fail();
      return await transaction(async tx => {
        if (!tx?.state || !Array.isArray(tx.state.scopes) || !Array.isArray(tx.state.receipts) || typeof tx.beforeCommit !== 'function') fail();
        const auth = await authenticate(request, tx, student ? 'student' : 'teacher');
        if (auth?.current !== true || !id(auth.ownerId) || !id(auth.sessionId)) fail();
        const scope = student ? auth.scope : r?.scope;
        if (!exact(scope, scopeKeys) || !scopeKeys.every(k => id(scope[k])) || scope.ownerId !== auth.ownerId) fail();
        if (student) {
          if (r != null || !id(auth.studentId) || !id(auth.enrollmentId)) fail();
        } else if (!exact(r?.binding, bindingKeys) || !bindingKeys.every(k => id(r.binding[k])) || r.binding.sessionId !== auth.sessionId) fail();
        const snapshot = await readCurrent(tx, auth, scope);
        const snapshotDigest = digest(snapshot);
        // Runs at the actual synthetic COMMIT boundary, after any delayed race.
        tx.beforeCommit(async () => {
          const freshAuth = await authenticate(request, tx, student ? 'student' : 'teacher');
          if (digest(freshAuth) !== digest(auth) || freshAuth?.current !== true || digest(await readCurrent(tx, freshAuth, scope)) !== snapshotDigest) fail();
          if (tx.state.scopes.length > 2000 || tx.state.receipts.length > 10000 ||
              tx.state.scopes.some(s => s.publications.length > 2000 || s.manualTasks.length > 2000 || s.sourceVersions.length > 4000) ||
              Buffer.byteLength(JSON.stringify(tx.state)) > 4 * 1024 * 1024) fail();
        });
        if (tx.state.scopes.length > 2000 || tx.state.receipts.length >= 10000) fail();
        let matches = tx.state.scopes.filter(s => samePublicationScope(s.scope, scope));
        if (matches.length > 1) fail();
        let stored = matches[0];
        if (!stored) { stored = { scope: structuredClone(scope), manualTasks: [], publications: [], sourceVersions: [] }; tx.state.scopes.push(stored); }
        validStored(stored);
        canonicalSnapshot(snapshot, scope);
        const retired = trackSources(stored, snapshot, scope);
        let current = rowsFrom(snapshot, scope, stored.manualTasks, retired);
        reconcileSources(stored, current);
        if (student) {
          const member = current.members.find(m => m.studentId === auth.studentId && m.id === auth.enrollmentId);
          if (!member) fail();
          return response(200, projectStudentPublicationV2(pupilInput(snapshot, scope, member), current.draft, stored.publications));
        }
        if (r.action === 'manual-preview' && exact(r, ['action', 'scope', 'binding', 'manualTask']) &&
            exact(r.manualTask, ['id', 'title', 'description', 'startDate', 'dueDate', 'link'])) {
          const manual = manualTaskDraft(r.manualTask, new Date(snapshot.now + 'T12:00:00'));
          const preview = rowsFrom(snapshot, scope, [...stored.manualTasks.filter(t => t.id !== manual.id), manual], retired);
          const row = preview.draft.rows.find(row => row.kind === 'manual' && row.sourceId === manual.id);
          const p = stored.publications.find(p => p.rowId === row.id);
          return response(200, { version: 2, inactive: true, membershipRevision: current.membershipRevision,
            row: { ...row, publicationRevision: p?.publicationRevision ?? 0, tombstone: p?.tombstone ?? false } });
        }
        if (r.action === 'list' && exact(r, ['action', 'scope', 'binding'])) return response(200, {
          version: 2, inactive: true, scope, binding: r.binding, membershipRevision: current.membershipRevision,
          rows: current.draft.rows.map(row => { const p = stored.publications.find(p => p.rowId === row.id); return {
            ...row, decisions: { ...p.decisions }, publicationRevision: p.publicationRevision, tombstone: p.tombstone }; }) });
        const lookup = r.action === 'status' && exact(r, ['action', 'scope', 'binding', 'command']);
        const command = lookup ? r.command : r;
        if (!validCommand(command) || !samePublicationScope(command.scope, scope) || digest(command.binding) !== digest(r.binding)) fail();
        const key = { ownerId: auth.ownerId, requestId: command.requestId };
        const fingerprint = digest(command);
        const receipts = tx.state.receipts.filter(p => p.ownerId === key.ownerId && p.requestId === key.requestId);
        if (receipts.length > 1 || receipts.length && receipts[0].fingerprint !== fingerprint) return unavailable();
        // Immutable original receipt is never replaced by current publication.
        if (receipts.length || lookup) {
          const receipt = receipts[0]?.receipt;
          if (!receipt) return unavailable();
          if (!exact(receipt, ['version', 'scope', 'binding', 'requestId', 'rowId', 'sourceRevision', 'state', 'publicationRevision']) ||
              receipt.version !== 2 || !samePublicationScope(receipt.scope, scope) || digest(receipt.binding) !== digest(command.binding) ||
              receipt.requestId !== command.requestId || receipt.rowId !== command.rowId || receipt.sourceRevision !== command.expectedSourceRevision ||
              !['applied', 'rejected'].includes(receipt.state) || !revision(receipt.publicationRevision)) return unavailable();
          const p = stored.publications.find(p => p.rowId === command.rowId);
          const fresh = p && !p.tombstone && p.sourceRevision === command.expectedSourceRevision && p.membershipRevision === command.expectedMembershipRevision ?
            { ...receipt, fresh: true, publicationRevision: p.publicationRevision, membershipRevision: current.membershipRevision, decisions: { ...p.decisions } } : null;
          return response(200, { receipt: structuredClone(receipt), fresh });
        }
        let manual = null, next = current;
        if (command.manualTask && command.action === 'item-publication-set') {
          manual = manualTaskDraft(command.manualTask, new Date(snapshot.now + 'T12:00:00'));
          if (manual.id !== command.sourceId || command.rowId !== JSON.stringify(['manual', null, manual.id])) fail();
          const tasks = [...stored.manualTasks.filter(t => t.id !== manual.id), manual];
          next = rowsFrom(snapshot, scope, tasks, retired);
        }
        const row = next.draft.rows.find(row => row.id === command.rowId && row.sourceId === command.sourceId);
        const p = stored.publications.find(p => p.rowId === command.rowId);
        const allowed = row && !p?.tombstone && command.expectedMembershipRevision === current.membershipRevision &&
          row.sourceRevision === command.expectedSourceRevision && (p?.publicationRevision ?? 0) === command.expectedPublicationRevision &&
          (row.kind === 'manual' ? !command.decisions.grade : command.manualTask === null) &&
          (command.action !== 'item-publication-delete' || row.kind === 'manual' && command.manualTask === null && flags.every(k => !command.decisions[k])) &&
          (row.work || flags.filter(k => k !== 'grade').every(k => !command.decisions[k]));
        const receipt = { version: 2, scope: structuredClone(scope), binding: structuredClone(command.binding), requestId: command.requestId,
          rowId: command.rowId, sourceRevision: command.expectedSourceRevision, state: allowed ? 'applied' : 'rejected',
          publicationRevision: command.expectedPublicationRevision + (allowed ? 1 : 0) };
        if (!revision(receipt.publicationRevision)) fail();
        if (allowed) {
          if (manual) stored.manualTasks = [...stored.manualTasks.filter(t => t.id !== manual.id), manual];
          const publication = { rowId: row.id, sourceRevision: row.sourceRevision, publicationRevision: receipt.publicationRevision,
            membershipRevision: current.membershipRevision, decisions: structuredClone(command.decisions), tombstone: false };
          if (p) Object.assign(p, publication); else stored.publications.push(publication);
          if (command.action === 'item-publication-delete') {
            publication.tombstone = true;
            Object.assign(stored.publications.find(p => p.rowId === row.id), publication);
            stored.manualTasks = stored.manualTasks.filter(t => t.id !== row.sourceId);
          }
        }
        tx.state.receipts.push({ ...key, fingerprint, receipt: structuredClone(receipt) });
        if (stored.publications.length > 2000 || stored.manualTasks.length > 2000 || Buffer.byteLength(JSON.stringify(tx.state)) > 4 * 1024 * 1024) fail();
        const saved = stored.publications.find(p => p.rowId === command.rowId);
        return response(200, { receipt, fresh: saved && !saved.tombstone && saved.sourceRevision === command.expectedSourceRevision ?
          { ...receipt, fresh: true, membershipRevision: current.membershipRevision, decisions: { ...saved.decisions } } : null });
      });
    } catch { return unavailable(); } // includes rollback and lost COMMIT ACK; no retry permission
  };
}
