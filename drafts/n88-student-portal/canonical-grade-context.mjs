/** AI: exact existing teacher context algorithms, isolated over one locked owner's rows.
 * Function bodies are copied verbatim from src/store.js and checked for drift.
 * No browser store/global mutation and no new scoring or portability policy. */
import {indexScores,sortByOrder,normalizeSearchText} from '../../src/models.js';
export function canonicalGradeContext(state,studentId,teachingId) {
 const live=rows=>rows.filter(r=>!r.deleted);
 const getTeaching=id=>live(state.teachings).find(r=>r.id===id)??null;
 const getSection=id=>live(state.sections).find(r=>r.id===id)??null;
 const items=id=>sortByOrder(live(state.items).filter(r=>r.teachingId===id));
 const scoresOf=id=>live(state.scores).filter(r=>r.studentId===id);
 const enrollmentsOf=id=>live(state.enrollments).filter(r=>r.studentId===id);
 const logsOf=id=>live(state.logs).filter(r=>r.studentId===id);
 const attendanceOf=id=>live(state.attendance).filter(r=>r.studentId===id);
function portableGroup(item) {
  return item && !item.deleted && item.scoreMode !== 'subitems' &&
    typeof item.portabilityGroupId === 'string' && item.portabilityGroupId.trim()
    ? item.portabilityGroupId : null;
}

function scoreForItem(studentId, itemId) {
  return scoresOf(studentId).find((score) => score.itemId === itemId) ?? null;
}

function portableGradeScore(studentId, item) {
  const direct = scoreForItem(studentId, item?.id);
  if (direct) return direct;

  const group = portableGroup(item);
  const teaching = getTeaching(item?.teachingId);
  if (!group || !teaching || item.auto) return null;
  if (items(teaching.id).filter((candidate) => portableGroup(candidate) === group).length !== 1) return null;

  // لا نعرض درجة من شعبة لم ينتسب إليها الطالب قط، حتى لو صادف أنها تحمل
  // مادة وبندًا بالاسم نفسيهما.
  const targetSection = getSection(teaching.sectionId);
  const targetEnrollment = enrollmentsOf(studentId).find((enrollment) => enrollment.sectionId === teaching.sectionId);
  if (!targetSection || !targetEnrollment) return null;
  const transferredSections = new Set(enrollmentsOf(studentId)
    .filter((enrollment) => enrollment.status === 'transferred')
    .map((enrollment) => enrollment.sectionId));
  const candidates = [];
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !transferredSections.has(sourceTeaching.sectionId) ||
        getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId ||
        getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
    const matches = items(sourceTeaching.id)
      .filter((candidate) => !candidate.auto && portableGroup(candidate) === group);
    if (matches.length !== 1) continue;
    const score = scoreForItem(studentId, matches[0].id);
    if (score) candidates.push(score);
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function portableScoresByItem(studentId, tchId) {
  const directScores = indexScores(scoresOf(studentId));
  const out = Object.create(null);
  for (const item of items(tchId)) {
    const score = directScores[item.id] ?? portableGradeScore(studentId, item);
    if (score) out[item.id] = score;
  }
  return out;
}

function automaticItemIdentity(item) {
  if (!item?.auto) return null;
  const name = normalizeSearchText(item.name);
  if (!name) return null;
  return `${item.auto}\u0000${name}`;
}

function automaticItemKey(item) {
  const identity = automaticItemIdentity(item);
  const max = Number(item?.max);
  if (!identity || !Number.isFinite(max) || max <= 0) return null;
  const factor = item.auto === 'participation' ? Number(item.perPoint ?? 1) :
    item.auto === 'attendance' ? Number(item.penalty ?? 1) : null;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return `${identity}\u0000${max}\u0000${factor}`;
}

function dedupeRecords(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function compatibleAutomaticTeachingIds(studentId, item) {
  const teaching = getTeaching(item?.teachingId);
  const group = portableGroup(item);
  const key = automaticItemKey(item);
  if (!teaching || !key) return null;
  if (!group) return new Set([teaching.id]);

  const targetMatches = items(teaching.id).filter((candidate) =>
    portableGroup(candidate) === group);
  if (targetMatches.length !== 1 || automaticItemKey(targetMatches[0]) !== key) return null;

  const targetSection = getSection(teaching.sectionId);
  const targetEnrollment = enrollmentsOf(studentId).find((enrollment) => enrollment.sectionId === teaching.sectionId);
  if (!targetSection || !targetEnrollment) return new Set([teaching.id]);
  const transferredSections = new Set(enrollmentsOf(studentId)
    .filter((enrollment) => enrollment.status === 'transferred')
    .map((enrollment) => enrollment.sectionId));
  const teachingIds = new Set([teaching.id]);
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !transferredSections.has(sourceTeaching.sectionId) ||
        getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId ||
        getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
    const sameItem = items(sourceTeaching.id).filter((candidate) => portableGroup(candidate) === group);
    if (!sameItem.length) continue;
    if (sameItem.length !== 1 || automaticItemKey(sameItem[0]) !== key) return null;
    teachingIds.add(sourceTeaching.id);
  }
  return teachingIds;
}

function portableAutomaticByItem(studentId, tchId) {
  const out = Object.create(null);
  for (const item of items(tchId).filter((candidate) => candidate.auto)) {
    const teachingIds = compatibleAutomaticTeachingIds(studentId, item);
    if (!teachingIds) {
      out[item.id] = null;
      continue;
    }
    if (item.auto === 'participation') {
      out[item.id] = {
        logs: dedupeRecords(logsOf(studentId).filter((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation')),
        classHasParticipation: live(state.logs).some((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation'),
      };
    } else if (item.auto === 'attendance') {
      out[item.id] = {
        attendance: dedupeRecords(attendanceOf(studentId).filter((record) =>
          teachingIds.has(record.teachingId))),
      };
    }
  }
  return out;
}
return {scoresByItem:portableScoresByItem(studentId,teachingId),automaticByItem:portableAutomaticByItem(studentId,teachingId)};
}
