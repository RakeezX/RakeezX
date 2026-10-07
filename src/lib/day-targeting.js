import { SCHOOL_WEEKDAYS } from '../models.js';

/** Shared target selection for manual timing edits and generated timing drafts. */
export function createDayTargets(currentDay) {
  const day = Number(currentDay);
  if (!SCHOOL_WEEKDAYS.includes(day)) throw new RangeError('Current day must be a school day');
  return { currentDay: day, expanded: false, selectedDays: [day] };
}

/** Only an explicit apply-to-other-days action selects the remaining school days. */
export function applyToOtherSchoolDays(targets) {
  return { ...targets, expanded: true, selectedDays: [...SCHOOL_WEEKDAYS] };
}

export function setTargetDaySelected(targets, day, selected) {
  const targetDay = Number(day);
  if (!targets.expanded || targetDay === targets.currentDay || !SCHOOL_WEEKDAYS.includes(targetDay)) {
    throw new RangeError('Only other school days can be changed after expansion');
  }
  return {
    ...targets,
    selectedDays: SCHOOL_WEEKDAYS.filter((schoolDay) => schoolDay === targets.currentDay
      || (schoolDay === targetDay ? selected : targets.selectedDays.includes(schoolDay))),
  };
}

export function selectedTargetDays(targets) {
  return [...targets.selectedDays];
}

function sameContent(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && sameContent(left[key], right[key]));
}

/**
 * Existing values are effective day content (periods and recess data as needed).
 * null/undefined means no authored target content to overwrite. Call once before
 * writing any targets so the caller can request a single confirmation.
 */
export function hasSelectedTargetDifference(targets, proposedContent, existingForDay) {
  if (!targets.expanded) return false;
  return targets.selectedDays.some((day) => {
    if (day === targets.currentDay) return false;
    const existing = existingForDay(day);
    return existing != null && !sameContent(existing, proposedContent);
  });
}
