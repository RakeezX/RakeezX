// AI-authored N107: independent direct XLSX files, no outer archive.
import { exportGradeXlsx } from './grade-transfer-xlsx.js';
import { gradeCsvFilename } from './grade-transfer-export.js';
export function classKoshoofBundle(classes, namesOnly = true) {
  if (!classes.length) throw Error('اختر فصلًا واحدًا على الأقل.');
  const files = [], used = new Set();
  for (const entry of classes) {
    const base = gradeCsvFilename({ className: entry.className, namesOnly }).replace(/\.csv$/, '');
    let name = base + '.xlsx', index = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${base} (${index++}).xlsx`;
    used.add(name.toLocaleLowerCase());
    files.push({ filename: name, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: exportGradeXlsx({ ...entry, items: namesOnly ? [] : entry.items, includeIds: false, noorReview: false }) });
  }
  return files;
}
export function downloadKoshoofBundle(bundle) {
  const url = URL.createObjectURL(new Blob([bundle.bytes], { type: bundle.type }));
  const link = document.createElement('a'); link.href = url; link.download = bundle.filename;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
