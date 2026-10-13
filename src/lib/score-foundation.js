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

/** Teacher dates use the application's YYYY-MM-DD local-calendar convention. */
export function normalizeSubitemDatesAndPoints(row) {
  scoreCents(row.value);
  const date = (input) => {
    if (input == null || input === '') return null;
    if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
        !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input) {
      throw new RangeError('استخدم تاريخًا صحيحًا');
    }
    return input;
  };
  const startDate = date(row.startDate), dueDate = date(row.dueDate);
  if (startDate && dueDate && dueDate < startDate) throw new RangeError('موعد التسليم لا يسبق البداية');
  const latePoints = row.latePoints == null || row.latePoints === '' ? null : Number(row.latePoints);
  if (latePoints !== null && scoreCents(latePoints) > scoreCents(row.value)) {
    throw new RangeError('درجة التأخر لا تزيد على الدرجة العادية');
  }
  return { startDate, dueDate, latePoints };
}

export function subitemCompletionState(row) {
  if (!row || row.deleted || row.checked !== true) return 'unrecorded';
  return row.completionState === 'late' ? 'late' : 'regular';
}

export function subitemSelectedPoints(definition, completion) {
  const state = subitemCompletionState(completion);
  if (state === 'unrecorded') return null;
  return state === 'late' ? definition.latePoints ?? definition.value : definition.value;
}

// Time chooses only the NEXT deliberate action; saved records are never inferred.
export function nextSubitemCompletionState(definition, completion, localDate) {
  const state = subitemCompletionState(completion);
  const overdue = definition.dueDate && localDate > definition.dueDate;
  if (overdue) return { unrecorded: 'late', late: 'regular', regular: 'unrecorded' }[state];
  return state === 'unrecorded' ? 'regular' : 'unrecorded';
}

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
  const selected = new Map(completions.filter((row) => (!studentId || row.studentId === studentId) &&
    (!ownerId || !row.ownerId || row.ownerId === ownerId) && !row.deleted && row.checked === true &&
    active.some((definition) => definition.id === row.subitemId)).map((row) => [row.subitemId, row]));
  const derivedCents = Math.min(maximum, active.filter((row) => selected.has(row.id))
    .reduce((sum, row) => sum + Math.min(scoreCents(row.value), scoreCents(subitemSelectedPoints(row, selected.get(row.id)))), 0));
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
