/**
 * A truthful, read-only four-page portfolio design prototype.
 * Source: the eleven categories in the user-provided "معلم" booklet.
 * Never infer performance scores, classroom quality, or applied strategies.
 */
export const PORTFOLIO_CRITERIA = Object.freeze([
  ['01', 'أداء الواجبات الوظيفية', 10],
  ['02', 'التفاعل مع المجتمع المهني', 10],
  ['03', 'التفاعل مع أولياء الأمور', 10],
  ['04', 'التنوع في استراتيجيات التدريس', 10],
  ['05', 'تحسين نتائج المتعلمين', 10],
  ['06', 'إعداد وتنفيذ خطة التعلم', 10],
  ['07', 'توظيف تقنيات ووسائل التعلم', 10],
  ['08', 'تهيئة البيئة التعليمية', 5],
  ['09', 'الإدارة الصفية', 5],
  ['10', 'تحليل نتائج المتعلمين', 10],
  ['11', 'تنويع أساليب التقويم', 10],
].map(([number, title, weight]) => Object.freeze({ number, title, weight })));

const VALID_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function isValidEvidenceDate(value) {
  const m = VALID_DATE.exec(String(value ?? ''));
  if (!m) return false;
  const y = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  const date = new Date(Date.UTC(y, mm - 1, dd));
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === mm && date.getUTCDate() === dd;
}
const validCount = x => Number.isSafeInteger(x) && x >= 0 ? x : 0;
const todayLocalISO = (now = new Date()) => [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');

export function portfolioAttendanceEvidence(report, teachingId, asOf = todayLocalISO()) {
  const empty = { teachingId: teachingId ?? null, rows: [], recordedSessions: 0, fullSessions: 0,
    partialSessions: 0, recordedMarks: 0, expectedMarks: 0, source: 'سجلات الحضور المؤرخة في ركيز',
    omitted: 0, asOf, criteriaNumber: '09' };
  if (!teachingId || !report?.teachings?.some(row => row?.id === teachingId) || !isValidEvidenceDate(asOf)) return empty;
  const seen = new Set();
  const rows = [];
  let omitted = 0;
  for (const entry of Array.isArray(report.rows) ? report.rows : []) {
    const session = entry?.session, completeness = entry?.completeness;
    if (entry?.teaching?.id !== teachingId || !session || !completeness) continue;
    if (!session.id || !isValidEvidenceDate(session.date) || session.date > asOf || completeness.state === 'excluded') continue;
    if (seen.has(session.id)) { omitted++; continue; }
    seen.add(session.id);
    const recorded = validCount(completeness.recorded), expected = validCount(completeness.expected);
    if (!recorded || !expected || recorded > expected) {
      if (recorded > expected) omitted++;
      continue;
    }
    // "completed" means roster marks exist for the entire selected dated session;
    // it does NOT mean every student attended, and is not a teacher rating.
    const full = completeness.state === 'completed' && recorded === expected;
    rows.push(Object.freeze({
      id: session.id, date: session.date, period: Number(session.period) || 0,
      recorded, expected, full, state: full ? 'رصد مكتمل' : 'رصد جزئي',
    }));
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period || a.id.localeCompare(b.id));
  return Object.freeze({
    ...empty, rows: Object.freeze(rows), recordedSessions: rows.length,
    fullSessions: rows.filter(row=>row.full).length,
    partialSessions: rows.filter(row=>!row.full).length,
    recordedMarks: rows.reduce((sum,row)=>sum+row.recorded,0),
    expectedMarks: rows.reduce((sum,row)=>sum+row.expected,0),
    omitted,
  });
}

export function portfolioDesignSummary(evidence) {
  // These are DOCUMENT-COVERAGE counts, not official evaluation scores.
  const present = Number(evidence?.recordedSessions) > 0;
  return Object.freeze({
    criteriaCount: PORTFOLIO_CRITERIA.length,
    evidenceCount: present ? 1 : 0,
    sourcedCriteriaCount: present ? 1 : 0,
    criteria: PORTFOLIO_CRITERIA.map(c => Object.freeze({
      ...c, hasSource: c.number === '09' && present,
      status: c.number === '09' && present ? 'شاهد أولي' : 'لم يُضف شاهد',
      page: c.number === '09' && present ? '4' : '—',
    })),
  });
}
