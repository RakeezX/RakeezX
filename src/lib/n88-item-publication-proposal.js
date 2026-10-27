/** AI-authored. Dormant, pure V2 proposal. Context fences are NOT server authority. */
import { validDateTimeValue } from './rakeez-datetime-values.js';
import { manualTaskDraft } from './n88-manual-task-link-safety.js';

const scopeKeys = ['ownerId', 'teachingId', 'sectionId', 'termId', 'subjectId'];
const flags = ['required', 'scheduled', 'completed', 'grade'];
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const rev = v => Number.isSafeInteger(v) && v >= 0;
const fail = () => { throw Error('invalid_or_stale_publication_scope'); };
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const privateFlags = () => Object.fromEntries(flags.map(k => [k, false]));
const bindingKeys = ['sessionId', 'leaseId', 'contextRevision'];
const sameBinding = (a, b) => exact(a, bindingKeys) && exact(b, bindingKeys) && bindingKeys.every(k => id(a[k]) && a[k] === b[k]);
export function samePublicationScope(a, b) {
  return exact(a, scopeKeys) && exact(b, scopeKeys) && scopeKeys.every(k => id(a[k]) && a[k] === b[k]);
}
function scopeCheck(scope, data) {
  if (!samePublicationScope(scope, scope) || data?.ownerId !== scope.ownerId) fail();
  const one = (rows, key) => {
    const matches = rows.filter(r => r.id === scope[key] && r.ownerId === scope.ownerId && !r.deleted);
    if (matches.length !== 1) fail();
    return matches[0];
  };
  const teaching = one(data.teachings, 'teachingId');
  const section = one(data.sections, 'sectionId'), term = one(data.terms, 'termId');
  if (teaching.sectionId !== section.id || teaching.termId !== term.id || teaching.subjectId !== scope.subjectId || section.yearId !== term.yearId) fail();
}
const storedDate = value => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !validDateTimeValue(value, 'date')) fail();
  return value;
};
const titleOf = r => { if (!id(r.id) || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 2000) fail(); return r.name; };

/** Explicit adapter for saved items/scoreSubitems; never derives dates from today or guidance. */
export function proposePublicationRows({ scope, data, previous = null, manualTasks = [] }) {
  scopeCheck(scope, data);
  const rows = [];
  const add = (kind, parent, source, work, manual = null) => {
    const title = manual ? manual.title : titleOf(source);
    const startDate = storedDate(manual ? manual.startDate : source.startDate);
    const dueDate = storedDate(manual ? manual.dueDate : source.dueDate);
    if (startDate && dueDate && dueDate < startDate) fail();
    const rowId = JSON.stringify([kind, parent?.id ?? null, source.id]);
    // Local content token includes grading and parent/source versions. A future server must mint its own authoritative revision.
    const sourceRevision = JSON.stringify([kind, parent?.name ?? null, parent?.scoreMode ?? null, parent?.revision ?? null, parent?.distributionVersion ?? null,
      parent?.updatedAt ?? null, parent?.max ?? null, source.revision ?? null, source.distributionVersion ?? null,
      source.updatedAt ?? null, title, startDate, dueDate, source.value ?? null, manual?.description ?? '', manual?.link ?? null]);
    const old = samePublicationScope(scope, previous?.scope) ? previous.rows.find(r => r.id === rowId && r.sourceRevision === sourceRevision) : null;
    const decisions = privateFlags();
    for (const key of flags) decisions[key] = old?.decisions?.[key] === true && (key === 'grade' ? kind !== 'manual' : work);
    rows.push({ id: rowId, kind, sourceId: source.id, itemId: parent?.id ?? source.id, title, startDate, dueDate,
      sourceRevision, work, description: manual?.description ?? '', link: manual?.link ?? null, decisions });
  };
  const items = data.items.filter(r => r.ownerId === scope.ownerId && r.teachingId === scope.teachingId && !r.deleted);
  if (new Set(items.map(r => r.id)).size !== items.length) fail();
  for (const item of items) {
    titleOf(item);
    if (item.scoreMode === 'subitems') {
      for (const sub of data.scoreSubitems.filter(r => r.ownerId === scope.ownerId && r.itemId === item.id && !r.deleted)) add('subitem', item, sub, true);
    } else add('item', item, item, false);
  }
  for (const task of manualTasks) {
    if (!samePublicationScope(scope, task.scope)) fail();
    const manual = manualTaskDraft(task);
    add('manual', null, manual, true, manual);
  }
  if (new Set(rows.map(r => r.id)).size !== rows.length) fail();
  if (new Set(rows.filter(r => r.kind === 'subitem').map(r => r.sourceId)).size !== rows.filter(r => r.kind === 'subitem').length) fail();
  return { version: 2, localDraft: true, scope: Object.fromEntries(scopeKeys.map(k => [k, scope[k]])), rows };
}

export function decidePublication(draft, scope, rowId, flag, value) {
  if (!samePublicationScope(scope, draft?.scope) || !flags.includes(flag) || typeof value !== 'boolean') fail();
  const row = draft.rows.find(r => r.id === rowId);
  if (!row || (flag === 'grade' ? row.kind === 'manual' : !row.work)) fail();
  return { ...draft, rows: draft.rows.map(r => r === row ? { ...r, decisions: { ...r.decisions, [flag]: value } } : r) };
}

/** Proposed wire codec only. No transport exists and no command is sent. */
export function publicationCommand({ draft, scope, rowId, requestId, expectedPublicationRevision, expectedMembershipRevision, binding }) {
  if (!samePublicationScope(scope, draft?.scope) || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId ?? '')
      || !rev(expectedPublicationRevision) || !id(expectedMembershipRevision)
      || !exact(binding, bindingKeys) || !Object.values(binding).every(id)) fail();
  const row = draft.rows.find(r => r.id === rowId);
  if (!row || !exact(row.decisions, flags) || !flags.every(k => typeof row.decisions[k] === 'boolean')
      || row.kind === 'manual' && row.decisions.grade || !row.work && flags.some(k => k !== 'grade' && row.decisions[k])) fail();
  return { version: 2, action: 'item-publication-set', requestId, scope: { ...draft.scope }, binding: { ...binding },
    expectedMembershipRevision, sourceId: row.sourceId, rowId, expectedSourceRevision: row.sourceRevision,
    expectedPublicationRevision, decisions: { ...row.decisions },
    manualTask: row.kind === 'manual' ? { id: row.sourceId, title: row.title, description: row.description, startDate: row.startDate, dueDate: row.dueDate, link: row.link } : null };
}

/** UNKNOWN never becomes permission to resend, including after a fresh source list. */
export function reconcilePublication(command, currentScope, receipt, fresh, currentBinding) {
  if (!samePublicationScope(command.scope, currentScope) || !sameBinding(command.binding, currentBinding)) return { state: 'blocked', retry: false };
  const receiptKeys = ['version', 'scope', 'binding', 'requestId', 'rowId', 'sourceRevision', 'state', 'publicationRevision'];
  const matches = value => value?.version === 2 && samePublicationScope(value.scope, currentScope)
    && sameBinding(value.binding, command.binding) && value.requestId === command.requestId && value.rowId === command.rowId && value.sourceRevision === command.expectedSourceRevision;
  if (!exact(receipt, receiptKeys) || !exact(fresh, [...receiptKeys, 'fresh', 'membershipRevision', 'decisions'])
      || !matches(receipt) || !matches(fresh) || fresh.fresh !== true || fresh.state !== receipt.state
      || !rev(command.expectedPublicationRevision) || !rev(receipt.publicationRevision)
      || !exact(fresh.decisions, flags) || !flags.every(k => typeof fresh.decisions[k] === 'boolean')
      || fresh.membershipRevision !== command.expectedMembershipRevision) return { state: 'unknown', retry: false };
  if (receipt.state === 'rejected' && receipt.publicationRevision === command.expectedPublicationRevision
      && fresh.publicationRevision === command.expectedPublicationRevision) return { state: 'rejected', retry: false };
  if (receipt.state !== 'applied' || receipt.publicationRevision !== command.expectedPublicationRevision + 1
      || fresh.publicationRevision !== receipt.publicationRevision || !exact(fresh.decisions, flags)
      || !flags.every(k => fresh.decisions[k] === command.decisions[k])) return { state: 'unknown', retry: false };
  return { state: 'confirmed', retry: false, publicationRevision: receipt.publicationRevision };
}

/** Synthetic projection contract: caller supplies freshly authorized server facts. Never an access control substitute. */
export function projectStudentFixture({ scope, draft, membership, publications, grades = [] }) {
  if (!samePublicationScope(scope, draft?.scope) || !samePublicationScope(scope, membership?.scope)
      || membership.active !== true || !id(membership.studentId) || !id(membership.enrollmentId) || !id(membership.revision)) fail();
  const work = [], visibleGrades = [];
  for (const row of draft.rows) {
    const candidates = publications.filter(p => samePublicationScope(scope, p.scope) && p.rowId === row.id);
    const p = candidates.length === 1 ? candidates[0] : null;
    if (!p || p.state !== 'confirmed' || p.tombstone || p.sourceRevision !== row.sourceRevision
        || p.membershipRevision !== membership.revision || !rev(p.publicationRevision) || p.publicationRevision < 1
        || !exact(p.decisions, flags) || !flags.every(k => typeof p.decisions[k] === 'boolean')) continue;
    const categories = flags.filter(k => k !== 'grade' && p.decisions[k]);
    if (row.work && categories.length) work.push({ id: row.id, title: row.title, startDate: row.startDate, dueDate: row.dueDate,
      categories, description: row.description, link: row.link });
    if (row.kind !== 'manual' && p.decisions.grade) {
      const values = grades.filter(g => samePublicationScope(scope, g.scope) && g.rowId === row.id && g.studentId === membership.studentId && g.enrollmentId === membership.enrollmentId && g.sourceRevision === row.sourceRevision);
      if (values.length === 1 && typeof values[0].value === 'number' && Number.isFinite(values[0].value)) visibleGrades.push({ id: row.id, title: row.title, value: values[0].value });
    }
  }
  // No aggregate/denominator/rank/completion detail derived from hidden grade components.
  return { work, grades: visibleGrades };
}
