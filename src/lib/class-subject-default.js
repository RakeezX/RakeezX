// Read-only suggestion from existing teaching history; never a Digital Skills fallback.
export function classSubjectDefault(options, history, current, existing = null) {
  if (existing) return options.find(option => option.subjectId === existing.subjectId);
  const available = new Map(options.filter(option => option.subjectId).map(option => [option.subjectId, option]));
  const used = history.filter(teaching => !teaching.deleted && available.has(teaching.subjectId));
  if (!used.length) return undefined;
  const active = current.filter(teaching => !teaching.deleted && available.has(teaching.subjectId));
  const subjects = new Set((active.length ? active : used).map(teaching => teaching.subjectId));
  // Generic updatedAt is not a subject-usage event. Ambiguous history stays empty.
  return subjects.size === 1 ? available.get([...subjects][0]) : undefined;
}
