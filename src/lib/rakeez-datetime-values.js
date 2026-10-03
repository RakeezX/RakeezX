export const normalizeDateTimeDigits = (value) => String(value ?? '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
  String(digit.charCodeAt(0) - (digit <= '\u0669' ? 0x0660 : 0x06f0)));

export function validDateTimeValue(value, kind, min = '', max = '') {
  if (!value) return true;
  if (kind === 'time') return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    && (!min || value >= min) && (!max || value <= max);
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day && (!min || value >= min) && (!max || value <= max);
}
