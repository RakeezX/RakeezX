/** Pure, two-decimal score arithmetic shared by local scoring and previews. */

export function scoreCents(value, { allowBlank = false } = {}) {
  if (allowBlank && (value === null || value === undefined || value === '')) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.abs(Math.round(number * 100) - number * 100) > 1e-7) {
    throw new RangeError('Score must be a non-negative number with at most two decimals');
  }
  return Math.round(number * 100);
}

export const fromScoreCents = (cents) => cents === null ? null : cents / 100;

export function distributeAutomatically(maximum, count) {
  const total = scoreCents(maximum);
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('At least one subitem is required');
  const each = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => fromScoreCents(
    index === count - 1 ? total - each * (count - 1) : each,
  ));
}

export function projectSubitemScore(item, definitions, completions, manualInput, { studentId = null, ownerId = null } = {}) {
  if (!studentId && completions.some((row) => row.studentId)) {
    throw new Error('Student identity is required for score projection');
  }
  const maximum = scoreCents(item.max);
  const active = definitions.filter((row) => !row.deleted && (!item.id || row.itemId === item.id) &&
    (!ownerId || !row.ownerId || row.ownerId === ownerId));
  const selected = new Set(completions.filter((row) => (!studentId || row.studentId === studentId) &&
    (!ownerId || !row.ownerId || row.ownerId === ownerId) && !row.deleted && row.checked === true &&
    active.some((definition) => definition.id === row.subitemId)).map((row) => row.subitemId));
  const derivedCents = Math.min(maximum, active.filter((row) => selected.has(row.id))
    .reduce((sum, row) => sum + scoreCents(row.value), 0));
  const requestedManual = scoreCents(manualInput, { allowBlank: true });
  const acceptedManual = requestedManual === null ? null : Math.min(requestedManual, Math.max(0, maximum - derivedCents));
  const recorded = selected.size > 0 || requestedManual !== null;
  return {
    derivedValue: fromScoreCents(derivedCents),
    manualValue: fromScoreCents(acceptedManual),
    value: recorded ? fromScoreCents(Math.min(maximum, derivedCents + (acceptedManual ?? 0))) : null,
    manualClamped: requestedManual !== null && acceptedManual !== requestedManual,
  };
}

export function scoreDefinitionSignature(item, subitems = []) {
  return JSON.stringify({
    name: item.name, max: item.max, order: item.order,
    auto: item.auto ?? null, perPoint: item.perPoint ?? 1, penalty: item.penalty ?? 1,
    unitId: item.unitId ?? null, lessonId: item.lessonId ?? null,
    scoreMode: item.scoreMode ?? 'direct', distributionMode: item.distributionMode ?? null,
    subitems: subitems.filter((row) => !row.deleted).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .map((row) => ({ name: row.name, value: row.value, order: row.order,
        startDate: row.startDate ?? null, dueDate: row.dueDate ?? null, latePoints: row.latePoints ?? null })),
  });
}

export function classifyIncomingItem(source, sourceSubitems, destinationItems, destinationSubitems) {
  const linked = destinationItems.filter((item) => !item.deleted && item.distributionOriginId === source.id);
  if (linked.length > 1) return { kind: 'CONFLICTING', reason: 'multiple-origin-matches', matches: linked };
  if (linked.length === 1) {
    const match = linked[0];
    const sourceSignature = scoreDefinitionSignature(source, sourceSubitems);
    const targetSignature = scoreDefinitionSignature(match, destinationSubitems.filter((subitem) => subitem.itemId === match.id));
    return sourceSignature === targetSignature
      ? { kind: 'EQUIVALENT', match }
      : { kind: 'CONFLICTING', reason: 'origin-content-differs', matches: linked };
  }
  const sameName = destinationItems.filter((item) => !item.deleted && item.name.trim() === source.name.trim());
  return sameName.length
    ? { kind: 'CONFLICTING', reason: 'unmapped-name-collision', matches: sameName }
    : { kind: 'MISSING', matches: [] };
}


const live = (rows = []) => rows.filter(row => !row.deleted);
const ordered = rows => [...rows].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
const fields = ['name', 'max', 'order', 'auto', 'perPoint', 'penalty', 'unitId', 'lessonId', 'scoreMode', 'distributionMode'];
const definition = row => Object.fromEntries(fields.map(key => [key, row[key] ??
  (key === 'scoreMode' ? 'direct' : ['perPoint', 'penalty'].includes(key) ? 1 : null)]));
function owned(row, ownerId) {
  if (row?.ownerId && row.ownerId !== ownerId) throw new Error('Distribution owner boundary is unavailable');
  return row;
}
function uniqueMatch(source, targets, used, label) {
  let matches = targets.filter(row => row.distributionOriginId === source.id);
  if (!matches.length) matches = targets.filter(row => row.name.trim() === source.name.trim());
  if (matches.length > 1 || matches.some(row => used.has(row.id))) {
    throw new Error(`البند «${label}» مكرر. افتح توزيع الفصل المستهدف وعدّل أسماء البنود المتكررة.`);
  }
  const match = matches[0];
  if (match) used.add(match.id);
  return match;
}
function boundary(current, sourceId, ownerId) {
  const source = owned(live(current.teachings).find(row => row.id === sourceId), ownerId);
  const section = owned(live(current.sections).find(row => row.id === source?.sectionId), ownerId);
  const term = owned(live(current.terms).find(row => row.id === source?.termId), ownerId);
  if (!source || !section || !term || term.yearId !== section.yearId || section.status === 'archived') {
    throw new Error('Source teaching boundary is unavailable');
  }
  return { source, section, term };
}
export function distributionTargets(current, sourceId, ownerId = null) {
  const { source, section } = boundary(current, sourceId, ownerId);
  return live(current.teachings).filter(row => {
    const target = live(current.sections).find(sec => sec.id === row.sectionId);
    return row.sectionId !== source.sectionId && row.subjectId === source.subjectId && row.termId === source.termId &&
      target?.yearId === section.yearId && target.grade === section.grade && target.status !== 'archived' &&
      (!row.ownerId || row.ownerId === ownerId) && (!target.ownerId || target.ownerId === ownerId);
  }).sort((a, b) => {
    const label = row => current.sections.find(sec => sec.id === row.sectionId)?.name ?? '';
    return label(a).localeCompare(label(b), 'ar', { numeric: true }) || a.id.localeCompare(b.id);
  });
}

// The token includes owned score evidence as well as definitions. It is checked again
// against IndexedDB records inside the one write transaction, never just in-memory state.
export function distributionToken(current, sourceId, targetIds) {
  const teachingIds = new Set([sourceId, ...targetIds]);
  const items = (current.items ?? []).filter(row => teachingIds.has(row.teachingId));
  const itemIds = new Set(items.map(row => row.id));
  const subs = (current.scoreSubitems ?? []).filter(row => itemIds.has(row.itemId));
  const subIds = new Set(subs.map(row => row.id));
  const teaching = (current.teachings ?? []).filter(row => teachingIds.has(row.id));
  const sectionIds = new Set(teaching.map(row => row.sectionId));
  const termIds = new Set(teaching.map(row => row.termId));
  const scores = (current.scores ?? []).filter(row => itemIds.has(row.itemId));
  const completions = (current.scoreSubitemCompletions ?? []).filter(row => subIds.has(row.subitemId));
  const studentIds = new Set([...scores, ...completions].map(row => row.studentId));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical([teaching, (current.sections ?? []).filter(row => sectionIds.has(row.id)),
    (current.terms ?? []).filter(row => termIds.has(row.id)), items, subs, scores, completions,
    (current.students ?? []).filter(row => studentIds.has(row.id)), current.units ?? [], current.lessons ?? []]
    .map(rows => [...rows].sort((a, b) => a.id.localeCompare(b.id)))));
}

export function planDistribution(current, sourceId, targetIds, { ownerId = null, removeItemIds = [], id = (() => { let sequence = 0; return () => `preview:${++sequence}`; })(), stamp = null } = {}) {
  if (!Array.isArray(targetIds) || !targetIds.length || new Set(targetIds).size !== targetIds.length) throw new Error('Choose distinct targets');
  const allowed = new Set(distributionTargets(current, sourceId, ownerId).map(row => row.id));
  if (targetIds.some(target => !allowed.has(target))) throw new Error('Copy target is not eligible');
  const { source: teaching } = boundary(current, sourceId, ownerId);
  const sourceItems = ordered(live(current.items).filter(row => row.teachingId === sourceId));
  const writes = { items: { put: [] }, scoreSubitems: { put: [] }, scores: { put: [] }, scoreSubitemCompletions: { put: [] } };
  const put = (store, row) => writes[store].put.push({ ...row, ...(stamp ? { updatedAt: stamp } : {}) });
  const targets = [];
  const removable = new Set();
  let requiresConfirmation = false;
  for (const targetId of targetIds) {
    const targetItems = live(current.items).filter(row => row.teachingId === targetId);
    targetItems.forEach(row => owned(row, ownerId));
    const used = new Set();
    const impact = [];
    for (const source of sourceItems) {
      owned(source, ownerId);
      scoreCents(source.max);
      scoreCents(source.perPoint ?? 1); scoreCents(source.penalty ?? 1);
      if (!['direct', 'subitems'].includes(source.scoreMode ?? 'direct') ||
        ![null, undefined, 'participation', 'attendance'].includes(source.auto)) throw new Error('Invalid distribution configuration');
      if (source.unitId || source.lessonId) {
        const lesson = source.lessonId ? owned(live(current.lessons).find(row => row.id === source.lessonId), ownerId) : null;
        const unit = owned(live(current.units).find(row => row.id === (source.unitId ?? lesson?.unitId)), ownerId);
        if (!unit || (source.lessonId && (!lesson || lesson.unitId !== unit.id)) ||
          unit.subjectId !== teaching.subjectId) throw new Error('Curriculum relationship is unavailable');
      }
      const prior = uniqueMatch(source, targetItems, used, source.name);
      const itemId = prior?.id ?? id();
      const sourceSubs = ordered(live(current.scoreSubitems).filter(row => row.itemId === source.id));
      const priorSubs = live(current.scoreSubitems).filter(row => row.itemId === prior?.id);
      const subUsed = new Set();
      const nextSubs = sourceSubs.map(sub => {
        owned(sub, ownerId); scoreCents(sub.value);
        const old = uniqueMatch(sub, priorSubs, subUsed, sub.name);
        if (old) owned(old, ownerId);
        return { ...(old ?? {}), id: old?.id ?? id(), itemId, name: sub.name, value: sub.value, order: sub.order,
          ...Object.fromEntries(['startDate', 'dueDate', 'latePoints'].filter(key => key in sub).map(key => [key, sub[key]])),
          distributionOriginId: sub.id, deleted: false, distributionVersion: prior?.distributionVersion ?? 1 };
      });
      if (source.scoreMode === 'subitems' && (!sourceSubs.length || !['auto', 'manual'].includes(source.distributionMode))) throw new Error('Invalid subitem definition');
      const next = { ...(prior ?? {}), ...definition(source), id: itemId, teachingId: targetId,
        deleted: false, portabilityGroupId: null, distributionOriginId: source.id,
        distributionVersion: prior?.distributionVersion ?? 1 };
      const same = prior && !prior.portabilityGroupId && prior.distributionOriginId === source.id &&
        nextSubs.every(sub => priorSubs.some(old => old.id === sub.id && old.distributionOriginId === sub.distributionOriginId)) &&
        scoreDefinitionSignature(source, sourceSubs) === scoreDefinitionSignature(prior, priorSubs);
      if (same) continue;
      next.distributionVersion += prior ? 1 : 0;
      put('items', next);
      nextSubs.forEach(sub => put('scoreSubitems', { ...sub, distributionVersion: next.distributionVersion }));
      const removedSubs = priorSubs.filter(sub => !subUsed.has(sub.id));
      removedSubs.forEach(sub => { owned(sub, ownerId); put('scoreSubitems', { ...sub, deleted: true }); });
      const removedIds = new Set(removedSubs.map(sub => sub.id));
      const priorSubIds = new Set(priorSubs.map(sub => sub.id));
      const completions = live(current.scoreSubitemCompletions).filter(row => priorSubIds.has(row.subitemId));
      completions.forEach(row => {
        owned(row, ownerId);
        if (!live(current.students).some(student => student.id === row.studentId && (!student.ownerId || student.ownerId === ownerId))) throw new Error('Completion student boundary is unavailable');
        if (removedIds.has(row.subitemId)) put('scoreSubitemCompletions', { ...row, deleted: true });
      });
      let affected = 0;
      const examples = [];
      const modeChanged = prior && ((prior.auto ?? null) !== next.auto || (prior.scoreMode ?? 'direct') !== next.scoreMode);
      if (modeChanged && next.scoreMode === 'subitems' && completions.length) {
        throw new Error('تحتاج اختيارات البنود الفرعية القديمة إلى مراجعة في الفصل المستهدف قبل تغيير طريقة الرصد.');
      }
      const scores = live(current.scores).filter(row => prior && row.itemId === prior.id);
      if (new Set(scores.map(row => row.studentId)).size !== scores.length ||
        new Set(completions.map(row => `${row.studentId}:${row.subitemId}`)).size !== completions.length ||
        completions.some(row => !scores.some(score => score.studentId === row.studentId))) {
        throw new Error('تحتاج سجلات هذا البند إلى مراجعة في الفصل المستهدف قبل النسخ.');
      }
      for (const score of scores) {
        owned(score, ownerId);
        const student = live(current.students).find(row => row.id === score.studentId);
        if (!student) throw new Error('Score student boundary is unavailable');
        owned(student, ownerId);
        let projection;
        if (next.scoreMode === 'subitems') {
          const manual = prior?.scoreMode !== 'subitems' && !prior?.auto ? score.value
            : modeChanged ? null : score.manualValue;
          projection = projectSubitemScore(next, nextSubs, completions, manual,
            { studentId: score.studentId, ownerId });
        } else {
          const value = next.auto || modeChanged ? null : score.value == null ? null : Math.min(scoreCents(score.value), scoreCents(next.max)) / 100;
          projection = { value, manualValue: null, derivedValue: null };
        }
        if (projection.value !== score.value || projection.manualValue !== (score.manualValue ?? null) || projection.derivedValue !== (score.derivedValue ?? null)) {
          put('scores', { ...score, ...projection }); affected++;
          if (examples.length < 3) examples.push({ before: score.value, after: projection.value });
        }
      }
      const destructive = !!modeChanged || affected > 0 || removedSubs.length > 0;
      requiresConfirmation ||= destructive;
      impact.push({ name: source.name, beforeMax: prior?.max ?? null, max: source.max, affected, examples,
        modeChanged: !!modeChanged, removedSubitems: removedSubs.length, created: !prior });
    }
    const extras = targetItems.filter(row => !used.has(row.id));
    for (const extra of extras) {
      removable.add(extra.id);
      if (!removeItemIds.includes(extra.id)) continue;
      requiresConfirmation = true;
      put('items', { ...extra, deleted: true });
      const subs = (current.scoreSubitems ?? []).filter(row => row.itemId === extra.id);
      const ids = new Set(subs.map(row => row.id));
      for (const [store, rows] of [['scoreSubitems', subs], ['scores', (current.scores ?? []).filter(row => row.itemId === extra.id)],
        ['scoreSubitemCompletions', (current.scoreSubitemCompletions ?? []).filter(row => ids.has(row.subitemId))]]) {
        live(rows).forEach(row => { owned(row, ownerId); put(store, { ...row, deleted: true }); });
      }
    }
    targets.push({ teachingId: targetId, impact, extras: extras.map(row => ({ id: row.id, name: row.name })) });
  }
  if (new Set(removeItemIds).size !== removeItemIds.length || removeItemIds.some(itemId => !removable.has(itemId))) throw new Error('Removal must name an extra in a selected target');
  return { token: distributionToken(current, sourceId, targetIds), targets, writes, requiresConfirmation,
    changedCount: writes.items.put.length };
}
