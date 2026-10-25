/**
 * Read-only, source-linked attendance evidence. Never derives teacher
 * performance or "students present" from the number of attendance records.
 * Each accepted row is a dated saved session with at least one roster-bound mark.
 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function validEvidenceDate(value) {
  if (!DATE.test(String(value ?? ''))) return false;
  const [, year, month, day] = value.match(DATE).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
}
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function attendanceEvidenceProjection(report, { teachingId = '', from = '', to = '' } = {}) {
  const empty = { teachingId, from, to, rows: [], sourceSessions: 0, recordedSessions: 0,
    fullSessions: 0, partialSessions: 0, recordedMarks: 0, expectedMarks: 0,
    recordingPercent: null, pendingUnrecorded: 0, anomalies: 0, error: null };
  if (!teachingId || !report?.teachings?.some(teaching => teaching.id === teachingId)) return { ...empty, error: 'teaching' };
  if ((from && !validEvidenceDate(from)) || (to && !validEvidenceDate(to)) || (from && to && from > to))
    return { ...empty, error: 'dates' };

  const seen = new Set();
  const eligible = [];
  let anomalies = 0;
  for (const row of Array.isArray(report.rows) ? report.rows : []) {
    const session = row?.session, comp = row?.completeness;
    if (row?.teaching?.id !== teachingId || !session || !comp || !validEvidenceDate(session.date)) continue;
    if ((from && session.date < from) || (to && session.date > to) || comp.state === 'excluded') continue;
    // Unknown IDs do not qualify as evidence. Duplicates are counted as anomalies,
    // never counted twice in totals.
    if (!session.id || seen.has(session.id)) { anomalies++; continue; }
    seen.add(session.id);
    eligible.push(row);
  }

  const marked = [];
  let fullSessions = 0, partialSessions = 0, recordedMarks = 0, expectedMarks = 0;
  let pendingUnrecorded = 0;
  for (const row of eligible) {
    const raw = row.completeness, expected = count(raw.expected), recorded = count(raw.recorded);
    if (raw.state === 'pending' && !recorded) pendingUnrecorded++;
    if (!recorded || !expected) {
      if (recorded && !expected) anomalies++;
      continue;
    }
    if (recorded > expected) { anomalies++; continue; }
    const completed = raw.state === 'completed' && recorded === expected;
    if (completed) fullSessions++; else partialSessions++;
    recordedMarks += recorded;
    expectedMarks += expected;
    marked.push({
      id: row.session.id, date: row.session.date, period: Number(row.session.period) || 0,
      recorded, expected, completed,
    });
  }
  marked.sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period || a.id.localeCompare(b.id));
  return {
    ...empty, rows: marked, sourceSessions: eligible.length,
    recordedSessions: marked.length, fullSessions, partialSessions,
    recordedMarks, expectedMarks,
    recordingPercent: expectedMarks ? Math.round(recordedMarks / expectedMarks * 100) : null,
    pendingUnrecorded, anomalies,
  };
}