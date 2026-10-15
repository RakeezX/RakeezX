// AI-authored N108. Minimal OOXML with a stored (uncompressed) ZIP container.
// Fixed entry paths, no formulas, links, IDs, timestamps or document properties.
import { gradeExportRows, gradeCsvFilename } from './grade-transfer-export.js';

import { zip } from './zip.js';
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const part = body => declaration + body;
function column(index) {
  let result = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
export function exportGradeXlsx(options) {
  // Noor keeps its existing explicit manual-only CSV path.
  if (options.noorReview || options.includeIds) throw new Error('هذا الكشف مخصص للأسماء والدرجات فقط.');
  const rows = gradeExportRows(options), count = rows[0].length;
  if (count > 16384 || rows.length > 1048576) throw new Error('الكشف يتجاوز حجم ورقة Excel.');
  const widths = rows[0].map((_, index) => index === 0 ? 55 : 40);
  const lines = (value, index) => String(value ?? '').split(/\r\n|\r|\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / (widths[index] * .65))), 0);
  const data = rows.map((row, index) => {
    const height = Math.min(409, Math.max(index === 0 ? 48 : 24, ...row.map((value, c) => lines(value, c) * 20 + 8)));
    return `<row r="${index + 1}" ht="${height}" customHeight="1">${row.map((value, c) => {
      const attrs = `r="${column(c)}${index + 1}" s="${index === 0 ? 1 : 0}"`;
      if (value === '' || value == null) return `<c ${attrs}/>`;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('درجة غير صالحة للتصدير.');
        return `<c ${attrs} t="n"><v>${value}</v></c>`;
      }
      if (String(value).length > 32767) throw new Error('نص طويل جدًا في الكشف.');
      return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join('')}</row>`;
  }).join('');
  return zip({
    '[Content_Types].xml': part('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': part(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': part(`<workbook xmlns="${main}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets><sheet name="الكشف" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': part(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': part(`<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B53"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    'xl/worksheets/sheet1.xml': part(`<worksheet xmlns="${main}"><dimension ref="A1:${column(count - 1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData></worksheet>`)
  });
}
export function downloadGradeXlsx(bytes, options = {}) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url;
  link.download = gradeCsvFilename(options).replace(/\.csv$/, '.xlsx');
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
