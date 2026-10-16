export const normalizeDateTimeDigits = (value) => String(value ?? '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
  String(digit.charCodeAt(0) - (digit <= '\u0669' ? 0x0660 : 0x06f0)));

export const PRODUCT_DATE_FLOOR = '2026-08-01';

function localDateISO(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateControlBounds(scope, declaredMin = '', declaredMax = '', now = new Date()) {
  if (!['planning', 'historical', 'session'].includes(scope)) throw new Error(`Unknown date scope: ${scope}`);
  const min = declaredMin && declaredMin > PRODUCT_DATE_FLOOR ? declaredMin : PRODUCT_DATE_FLOOR;
  const ceiling = scope === 'planning' ? `${now.getFullYear() + 1}-12-31`
    : scope === 'historical' ? localDateISO(now) : '';
  const max = declaredMax && (!ceiling || declaredMax < ceiling) ? declaredMax : ceiling;
  const years = [];
  const lastYear = max ? Number(max.slice(0, 4)) : Number(min.slice(0, 4));
  if (!max || max >= min) for (let year = Number(min.slice(0, 4)); year <= lastYear; year++) years.push(year);
  return { min, max, years };
}

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
