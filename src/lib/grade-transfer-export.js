import { itemScore } from '../models.js';
const text = value => {
  let string = String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(string)) string = "'" + string;
  return '"' + string.replaceAll('"', '""') + '"';
};
export function exportGradeCsv({ roster, items, ctx, className, subject, term, noorReview = false }) {
  const title = noorReview ? 'مراجعة للرصد في نور — مساعدة يدوية، ليست قالب رفع رسمي' : 'كشف درجات ركيز';
  const lines = [['معرف الطالب', 'اسم الطالب', ...items.map(i => `${i.name} (العظمى ${i.max})`), 'الفصل', 'المادة', 'الفصل الدراسي', 'نوع الملف']];
  for (const s of [...roster].sort((a,b) => a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id))) {
    lines.push([s.id, s.name, ...items.map(i => itemScore(i, ctx[s.id]) ?? ''), className, subject, term, title]);
  }
  return '\uFEFF' + lines.map(row => row.map(v => typeof v === 'number' ? String(v) : text(v)).join(',')).join('\r\n');
}
export function downloadGradeCsv(csv, noorReview = false) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = noorReview ? 'مراجعة للرصد في نور.csv' : 'درجات ركيز.csv';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
