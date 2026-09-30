import { shiftDate } from '../models.js';

// Presentation only: an official preset stores one day per date, while the
// reference selector offers one choice per actual holiday range.
export function officialRangeChoices(ranges) {
  const choices = [];
  const stable = new Map();
  for (const range of [...ranges].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const rangeId = range.rangeId ?? (range.id?.startsWith('legacy:') ? null : range.id);
    const stableKey = rangeId ? `${range.source}:${range.kind}:${range.label}:${rangeId}` : null;
    let choice = stableKey ? stable.get(stableKey) : choices.find((item) =>
      !item.stableKey && item.source === range.source && item.kind === range.kind &&
      item.label === range.label && range.startDate <= shiftDate(item.endDate, 1) &&
      range.endDate >= shiftDate(item.startDate, -1));
    if (!choice) {
      choice = { ...range, stableKey };
      choices.push(choice);
      if (stableKey) stable.set(stableKey, choice);
    } else {
      if (range.startDate < choice.startDate) choice.startDate = range.startDate;
      if (range.endDate > choice.endDate) choice.endDate = range.endDate;
    }
  }
  return choices.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
