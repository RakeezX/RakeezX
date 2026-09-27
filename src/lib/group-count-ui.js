export function validTargetCount(value, students) {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= students;
}
export function targetGroupSizes(students, count) {
  if (!validTargetCount(count, students)) return [];
  return Array.from({length: Number(count)}, (_, index) => Math.floor(students / count) + (index < students % count ? 1 : 0));
}

export function smartGroupCounts(students) {
  if (!Number.isInteger(students) || students < 1) return { recommended: null, choices: [] };
  const recommended = Math.min(students, Math.max(1, Math.round(students / 4)));
  const length = Math.min(4, students);
  const start = Math.max(1, Math.min(recommended - 1, students - length + 1));
  return { recommended, choices: Array.from({ length }, (_, index) => start + index) };
}
