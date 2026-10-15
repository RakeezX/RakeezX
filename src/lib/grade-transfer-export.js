import { isTransferItem } from './grade-transfer.js';
import { itemScore } from '../models.js';
const text = value => {
  let string = String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(string)) string = "'" + string;
  return '"' + string.replaceAll('"', '""') + '"';
};
export function gradeExportRows({ roster, items, ctx, blankTemplate = false, includeIds = false }) {
  if (blankTemplate) items = items.filter(isTransferItem);
  const lines = [[...(includeIds ? ['معرف الطالب'] : []), 'اسم الطالب', ...items.map(i => `${i.name} (العظمى ${i.max})`)]];
  for (const s of [...roster].sort((a,b) => a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id))) {
    lines.push([...(includeIds ? [s.id] : []), s.name, ...items.map(i => blankTemplate ? '' : itemScore(i, ctx[s.id]) ?? '')]);
  }
  return lines;
}
export function exportGradeCsv(options) {
  if (options.noorReview) return exportNoorReview({ ...options, groups: options.noorGroups === undefined ? {} : options.noorGroups, confirmed: options.noorConfirmed });
  return '\uFEFF' + gradeExportRows(options).map(row => row.map(v => typeof v === 'number' ? String(v) : text(v)).join(',')).join('\r\n');
}
// AI-authored N105: class labels only, never student identity or timestamps.
export function gradeCsvFilename({ className, noorReview = false, namesOnly = false, blankTemplate = false } = {}) {
  if (blankTemplate) return 'نموذج أسماء الطلاب - ركيز المعلم.csv';
  const label = String(className ?? '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80).trim().replace(/[. ]+$/g,'') || 'غير مسمى';
  return `كشف ${noorReview ? 'رصد نور' : namesOnly ? 'أسماء طلاب' : 'درجات طلاب'} فصل ${label} - ركيز المعلم.csv`;
}
export function exportNamesTemplate() { return '\uFEFF"اسم الطالب"\r\n""\r\n""\r\n""'; }
export function downloadGradeCsv(csv, options = {}) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = gradeCsvFilename(options);
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
