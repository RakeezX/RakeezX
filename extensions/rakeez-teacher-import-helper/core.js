const headers = new Set(['اسم الطالب', 'اسم الطالبة', 'اسم الطالب/ة']);
export const isNameHeader = value => headers.has(String(value).normalize('NFC').trim().replace(/\s+/g, ' '));
export const isOfficialUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.port && !u.username && !u.password && ['madrasati.moe.gov.sa', 'madrasatibeta.moe.gov.sa'].includes(u.hostname); }
  catch { return false; }
};
const fail = code => { throw new Error(code); };
export function parsePastedTable(text) {
  if (typeof text !== 'string' || text.length > 100000) fail('LIMIT');
  const rows = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(row => row.split('\t'));
  if (rows.length > 301 || rows.some(row => row.length > 50)) fail('LIMIT');
  const columns = rows[0].map((cell, index) => isNameHeader(cell) ? index : -1).filter(index => index >= 0);
  if (columns.length !== 1) fail('AMBIGUOUS_HEADER');
  if (rows.some(row => row.length !== rows[0].length)) fail('IRREGULAR_TABLE');
  // Only the explicitly labelled name column leaves this function.
  return rows.slice(1).map(row => row[columns[0]]);
}
export function reviewNames(values) {
  if (!Array.isArray(values) || values.length > 300) fail('LIMIT');
  const names = [], seen = new Set();
  let empty = 0;
  for (const value of values) {
    if (typeof value !== 'string') fail('INVALID_NAME');
    const name = value.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!name) { empty++; continue; }
    // Conservative names-only grammar: no numbers, punctuation, formula, IDs or controls.
    if (name.length < 2 || name.length > 80 || !/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(name)) fail('INVALID_NAME');
    const key = name.replace(/[\s\u0640\u064B-\u065F\u0670]/g, '').toLowerCase();
    if (seen.has(key)) fail('DUPLICATE');
    seen.add(key); names.push(name);
  }
  if (!names.length) fail('EMPTY');
  return { names, counts: { accepted: names.length, empty } };
}
export function namesCsv(names) {
  const reviewed = reviewNames(names);
  return '\uFEFFاسم الطالب\r\n' + reviewed.names.map(name => `"${name}"`).join('\r\n') + '\r\n';
}
