import { isTransferItem } from './grade-transfer.js';
import { itemScore } from '../models.js';
const text = value => {
  let string = String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(string)) string = "'" + string;
  return '"' + string.replaceAll('"', '""') + '"';
};
export function exportGradeCsv({ roster, items, ctx, className, subject, term, noorReview = false, blankTemplate = false, noorGroups = {}, noorConfirmed = false }) {
  if (noorReview) return exportNoorReview({ roster, items, ctx, groups: noorGroups, confirmed: noorConfirmed });
  if (blankTemplate) items = items.filter(isTransferItem);
  const title = blankTemplate ? 'قالب درجات فارغ' : 'كشف درجات ركيز';
  const lines = [['معرف الطالب', 'اسم الطالب', ...items.map(i => `${i.name} (العظمى ${i.max})`), 'الفصل', 'المادة', 'الفصل الدراسي', 'نوع الملف']];
  for (const s of [...roster].sort((a,b) => a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id))) {
    lines.push([s.id, s.name, ...items.map(i => blankTemplate ? '' : itemScore(i, ctx[s.id]) ?? ''), className, subject, term, title]);
  }
  return '\uFEFF' + lines.map(row => row.map(v => typeof v === 'number' ? String(v) : text(v)).join(',')).join('\r\n');
}
export function downloadGradeCsv(csv, noorReview = false) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = noorReview ? 'مراجعة للرصد في نور.csv' : 'درجات ركيز.csv';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Suggestions are not assignments: the teacher must confirm the complete current selection.
export function suggestNoorGroup(item) {
  if (item.auto === 'participation' || /^(?:المشاركة|المشاركة والتفاعل|الواجبات|المهام الأدائية|المشروع|المشاريع|الأنشطة والمشاريع|الواجبات المنزلية)$/.test(item.name)) return '40';
  if (/^(?:الاختبار|الاختبارات|التقويمات التحريرية|تقويمات تحريرية وتطبيقات عملية|التطبيقات العملية|الاختبارات القصيرة|الاختبار النهائي)$/.test(item.name)) return '60';
  return '';
}
export function exportNoorReview({ roster, items, ctx, groups, confirmed }) {
  if (!confirmed || !items.length || new Set(items.map(i => i.id)).size !== items.length ||
      items.some(i => !['40', '60'].includes(String(groups[i.id])) || !Number.isFinite(Number(i.max)) || Number(i.max) <= 0)) throw new Error('أكد تعيين كل بند إلى مجموعة 40 أو 60.');
  const grouped = ['40', '60'].map(group => items.filter(i => String(groups[i.id]) === group));
  if (grouped.some((list, index) => Math.abs(list.reduce((sum, i) => sum + Number(i.max), 0) - [40,60][index]) > 0.000001)) throw new Error('مجموع العظمى يجب أن يساوي 40 و60؛ لا نعيد تحجيم الدرجات.');
  const lines = [['اسم الطالب', 'المهام الأدائية والمشاركة والتفاعل (40)', 'تقويمات تحريرية وتطبيقات عملية (60)']];
  for (const student of [...roster].sort((a,b) => a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id))) {
    const totals = grouped.map((list, index) => {
      const values = list.map(item => itemScore(item, ctx[student.id]));
      // A group with even one missing mark stays blank; zero is a recorded mark.
      if (values.some(value => value == null)) return '';
      if (values.some((value, j) => !Number.isFinite(value) || value < 0 || value > Number(list[j].max))) throw new Error('درجة غير صالحة في مجموعة نور.');
      const total = Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
      if (total > [40,60][index]) throw new Error('مجموع خارج حدود مجموعة نور.');
      return total;
    });
    lines.push([student.name, ...totals]);
  }
  return '\uFEFF' + lines.map(row => row.map(v => typeof v === 'number' ? String(v) : text(v)).join(',')).join('\r\n');
}
