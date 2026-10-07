/** Read-only projection of server-authoritative N77 deletion ancestry. */
const PARENTS = Object.freeze({
  teachings: [['sectionId', 'sections']],
  enrollments: [['sectionId', 'sections']],
  notes: [['teachingId', 'teachings'], ['sessionId', 'sessions']],
  classRules: [['teachingId', 'teachings']],
  classCharterSelections: [['teachingId', 'teachings']],
  classGoals: [['teachingId', 'teachings'], ['sessionId', 'sessions']],
  groupArrangements: [['teachingId', 'teachings']],
  items: [['teachingId', 'teachings']],
  scoreSubitems: [['itemId', 'items']],
  scoreSubitemCompletions: [['subitemId', 'scoreSubitems']],
  scores: [['itemId', 'items']],
  logs: [['teachingId', 'teachings'], ['sessionId', 'sessions']],
  slots: [['teachingId', 'teachings']],
  sessions: [['teachingId', 'teachings'], ['slotId', 'slots']],
  sessionRosterSnapshots: [['teachingId', 'teachings'], ['sectionId', 'sections'], ['sessionId', 'sessions']],
  attendance: [['teachingId', 'teachings'], ['sessionId', 'sessions']],
  assignments: [['teachingId', 'teachings']],
  submissions: [['assignmentId', 'assignments']],
});

const mapRows = (rows) => new Map((rows ?? []).map((row) => [row.id, row]));

export function deletionScope(backupData, serverData, { trustBackupTombstones = false } = {}) {
  if (!Array.isArray(serverData?.sections) || !Array.isArray(serverData?.teachings)) {
    throw Object.assign(new Error('Server deletion ancestry is incomplete'), { code: 'RESTORE_DELETION_AUTHORITY_MISSING' });
  }
  const names = new Set([...Object.keys(PARENTS), 'sections', 'teachings', 'closedTermReports']);
  const backup = Object.fromEntries([...names].map((name) => [name, mapRows(backupData?.[name])]));
  const server = Object.fromEntries([...names].map((name) => [name, mapRows(serverData?.[name])]));
  const suppressed = new Set();
  const active = new Set();
  const has = (name, id) => !!id && (server[name]?.has(id) || backup[name]?.has(id));
  function deleted(name, id) {
    if (!id || !names.has(name)) return false;
    const key = `${name}\u0000${id}`;
    if (suppressed.has(key)) return true;
    if (active.has(key)) throw Object.assign(new Error('Cyclic restore ancestry'), { code: 'RESTORE_ANCESTRY_INVALID' });
    const remote = server[name].get(id);
    const local = backup[name].get(id);
    if (!remote && !local) return false;
    active.add(key);
    const isDeleted = remote?.deleted === true || (!remote && trustBackupTombstones && local?.deleted === true) ||
      [remote, local].filter(Boolean).some((row) =>
      (PARENTS[name] ?? []).some(([field, parent]) => deleted(parent, row[field])));
    active.delete(key);
    if (isDeleted) suppressed.add(key);
    return isDeleted;
  }
  function unresolved(name, row, seen = new Set()) {
    if (!row || seen.has(`${name}\u0000${row.id}`)) return false;
    seen.add(`${name}\u0000${row.id}`);
    return (PARENTS[name] ?? []).some(([field, parent]) => {
      const id = row[field];
      if (!id) return false;
      if (!has(parent, id)) return true;
      return unresolved(parent, server[parent].get(id) ?? backup[parent].get(id), seen);
    });
  }
  return { deleted, unresolved, has, isDeleted: (name, row) => deleted(name, row?.id) };
}

/** Immutable report bytes stay intact; only the Product-facing projection changes. */
export function visibleClosedTermReport(report, scope) {
  if (!report?.payload || !scope) return report;
  const payload = report.payload;
  const teachingDocuments = (payload.teachingDocuments ?? []).filter((document) =>
    scope.has('teachings', document.teaching?.id) && scope.has('sections', document.section?.id) &&
    !scope.deleted('teachings', document.teaching?.id) && !scope.deleted('sections', document.section?.id));
  let changed = teachingDocuments.length !== (payload.teachingDocuments ?? []).length;
  let executionDocument = payload.executionDocument;
  if (executionDocument) {
    const teachings = (executionDocument.teachings ?? []).filter((row) =>
      scope.has('teachings', row.id) && !scope.deleted('teachings', row.id));
    const rows = (executionDocument.rows ?? []).filter((row) =>
      scope.has('teachings', row.teaching?.id ?? row.session?.teachingId) &&
      scope.has('sections', row.section?.id) &&
      !scope.deleted('teachings', row.teaching?.id ?? row.session?.teachingId) &&
      !scope.deleted('sections', row.section?.id));
    changed ||= teachings.length !== (executionDocument.teachings ?? []).length ||
      rows.length !== (executionDocument.rows ?? []).length;
    if (!changed) return report;
    const counts = { generated: rows.length, completed: 0, pending: 0, future: 0, excluded: 0 };
    for (const row of rows) if (Object.hasOwn(counts, row.completeness?.state)) counts[row.completeness.state]++;
    const eligible = counts.completed + counts.pending;
    const sections = new Set(teachingDocuments.map((document) => document.section?.id).filter(Boolean));
    const memberships = new Set(teachingDocuments.flatMap((document) => document.membership ?? [])
      .filter((row) => row.status === 'active').map((row) => row.id));
    executionDocument = { ...executionDocument, teachings, rows, counts, sections: sections.size,
      students: memberships.size, percentage: eligible ? Math.round(counts.completed / eligible * 100) : null };
  }
  if (!changed) return report;
  return { ...report, payload: { ...payload, teachingDocuments, executionDocument } };
}
