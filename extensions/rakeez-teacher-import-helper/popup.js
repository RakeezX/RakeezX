import { isOfficialUrl, parsePastedTable, reviewNames, namesCsv } from './core.js';
import { readSelectedNameColumn } from './selection.js';
const $ = id => document.getElementById(id);
let names = null, generation = 0;
function clear() {
  generation++; names = null;
  $('names').replaceChildren(); $('review').checked = false;
  $('review').disabled = true; $('download').disabled = true;
}
function show(values, hiddenRows = 0) {
  const result = reviewNames(values); names = result.names;
  $('names').replaceChildren(...names.map((name, index) => {
    const li = document.createElement('li'), include = document.createElement('input'), input = document.createElement('input');
    include.type = 'checkbox'; include.checked = true; include.className = 'include-name'; include.setAttribute('aria-label', `تضمين الاسم ${index + 1}`);
    input.type = 'text'; input.value = name; input.maxLength = 80; input.setAttribute('aria-label', `الاسم ${index + 1}`);
    const edited = () => { names = null; $('review').checked = false; $('download').disabled = true; input.disabled = !include.checked; };
    include.addEventListener('change', edited); input.addEventListener('input', edited); li.append(include, input); return li;
  }));
  $('review').disabled = false;
  $('status').textContent = `${names.length} اسمًا للمراجعة؛ ${result.counts.empty} خلايا فارغة؛ ${hiddenRows} صفوف مخفية مستبعدة. لم يُنزّل ملف بعد.`;
}
function error(code) {
  clear();
  $('status').textContent = `تعذّرت المعاينة (${code}). لا ملف مُصدّر. اختر عنوان عمود الأسماء فقط؛ أو صدّر XLSX الرسمي واستخدم استيراد ركيز. التكرارات والأرقام والخلايا المركّبة تحتاج مراجعة.`;
}
$('table').addEventListener('input', clear);
$('paste').addEventListener('click', () => {
  clear();
  try { const values = parsePastedTable($('table').value); $('table').value = ''; show(values); }
  catch (e) { $('table').value = ''; error(e.message); }
});
$('selection').addEventListener('click', async () => {
  clear(); $('table').value = ''; const ticket = generation;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isOfficialUrl(tab.url)) throw new Error('UNSUPPORTED_ORIGIN');
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: 'ISOLATED', func: readSelectedNameColumn });
    if (ticket !== generation) return;
    if (results.length !== 1 || !results[0].result?.ok) throw new Error(results[0]?.result?.code || 'UNSUPPORTED_LAYOUT');
    show(results[0].result.values, results[0].result.hiddenRows);
  } catch (e) { if (ticket === generation) error(e.message && /^[A-Z_]+$/.test(e.message) ? e.message : 'READ_FAILED'); }
});
$('review').addEventListener('change', () => {
  $('download').disabled = true;
  if (!$('review').checked) return;
  try {
    names = reviewNames(Array.from($('names').children).filter(li => li.querySelector('.include-name').checked).map(li => li.querySelector('input[type=text]').value)).names;
    $('download').disabled = false;
    $('status').textContent = `${names.length} اسمًا مختارًا بعد المراجعة. لم يُنزّل ملف بعد.`;
  } catch (e) {
    names = null; $('review').checked = false;
    $('status').textContent = `غير محسوم (${e.message}). صحّح الأسماء المختارة وأعد المراجعة؛ لا ملف مُصدّر.`;
  }
});
$('download').addEventListener('click', () => {
  if (!names || !$('review').checked) return;
  const csv = namesCsv(names); clear();
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'rakeez-student-names.csv';
  try { document.body.append(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  $('status').textContent = 'طُلب تنزيل ملف واحد. افتحه عبر استيراد الطلاب في ركيز وراجع المعاينة قبل تأكيد الإضافة.';
});
$('cancel').addEventListener('click', () => { clear(); $('table').value = ''; $('status').textContent = 'أُلغيت المعاينة ومُسحت الأسماء. لم تُضف بيانات إلى ركيز.'; });

// AI: reached only after the actual ESM graph and entry handlers initialized.
window.n36Diagnostics?.moduleReady("popup.js");
