// Recognition affects new suggestions only; saved and edited labels stay intact.
const normalized = (value) => String(value ?? '').normalize('NFC')
  .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '').replace(/\s+/g, ' ').trim();

export function defaultSubitemName(parentName, rows = []) {
  const parent = normalized(parentName);
  const stem = ['الواجبات', 'الواجب', 'واجبات', 'واجب'].includes(parent) ? 'واجب'
    : ['المشاريع', 'المشروع', 'مشاريع', 'مشروع'].includes(parent) ? 'مشروع'
      : String(parentName ?? '').trim() || 'عنصر';
  const separator = stem === 'واجب' || stem === 'مشروع' ? '' : ' ';
  const used = new Set(rows.map((row) => normalized(row.name).replace(/[\u0660-\u0669\u06f0-\u06f9]/g,
    (digit) => String(digit.charCodeAt(0) - (digit <= '\u0669' ? 0x0660 : 0x06f0))).replace(/\s+/g, '')));
  let suffix = 1;
  while (used.has(normalized(stem).replace(/\s+/g, '') + suffix)) suffix++;
  return `${stem}${separator}${suffix}`;
}
