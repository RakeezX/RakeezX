// AI-authored N107: separate readable workbooks, one client-side ZIP download.
import { exportGradeXlsx } from './grade-transfer-xlsx.js';
import { gradeCsvFilename } from './grade-transfer-export.js';
import { zip } from './zip.js';
export function classKoshoofBundle(classes, namesOnly = true) {
  if (!classes.length) throw Error('اختر فصلًا واحدًا على الأقل.');
  const files = {}, used = new Set();
  for (const entry of classes) {
    const base = gradeCsvFilename({ className: entry.className, namesOnly }).replace(/\.csv$/, '');
    let name = base + '.xlsx', index = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${base} (${index++}).xlsx`;
    used.add(name.toLocaleLowerCase());
    files[name] = exportGradeXlsx({ ...entry, items: namesOnly ? [] : entry.items, includeIds: false, noorReview: false });
  }
  const names = Object.keys(files);
  return names.length === 1 ? { bytes: files[names[0]], filename: names[0], type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    : { bytes: zip(files), filename: 'كشوف الفصول - ركيز المعلم.zip', type: 'application/zip' };
}
export function downloadKoshoofBundle(bundle) {
  const url = URL.createObjectURL(new Blob([bundle.bytes], { type: bundle.type }));
  const link = document.createElement('a'); link.href = url; link.download = bundle.filename;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
