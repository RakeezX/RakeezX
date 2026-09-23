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
      .map((row) => ({ name: row.name, value: row.value, order: row.order })),
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
