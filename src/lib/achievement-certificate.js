import { html, icon, openSheet, toast, fmtDateFull } from './dom.js';
import { todayISO } from '../models.js';
import { CERTIFICATE_DESIGNS, CERTIFICATE_TEXT_LIMIT, HEADER_FONT_FAMILY, certificateText, defaultCertificateText, certificateMetadata, drawCertificateDesign } from './certificate-designs.js';
import { openDocumentPreview } from './document-preview.js';
import { getMinistryLogo, loadMinistryLogo } from './ministry-brand.js';
import { certificatePdfFromJpeg } from './certificate-pdf.js';

const styleUrl = new URL('../styles/achievement-certificate.css', import.meta.url).href;
const brandedCanvases = new WeakSet();
const headerFontUrl = new URL('../../assets/fonts/noto-naskh-arabic/NotoNaskhArabic-Bold.ttf', import.meta.url).href;
const titleArtworkUrls = {
  ornate: new URL('../../assets/certificates/title-approved-first-gold.svg', import.meta.url).href,
  school: new URL('../../assets/certificates/title-approved-first-green.svg', import.meta.url).href,
};
let headerFontReady;
let titleArtworksReady;
let titleArtworks;

function prepareHeaderFont() {
  if (headerFontReady) return headerFontReady;
  if (!globalThis.document?.fonts || typeof FontFace === 'undefined') return Promise.reject(new Error('Certificate font loading is unavailable'));
  const font = new FontFace(HEADER_FONT_FAMILY, `url(${headerFontUrl})`, { weight: '700', style: 'normal' });
  headerFontReady = font.load().then(loaded => {
    document.fonts.add(loaded);
    return loaded;
  }).catch(error => { headerFontReady = null; throw error; });
  return headerFontReady;
}

function prepareTitleArtworks() {
  if (titleArtworksReady) return titleArtworksReady;
  titleArtworksReady = Promise.all(Object.entries(titleArtworkUrls).map(async ([design, url]) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth !== 766 || image.naturalHeight !== 165) throw new Error('Unexpected certificate title artwork');
    return [design, image];
  })).then(entries => { titleArtworks = Object.fromEntries(entries); return titleArtworks; })
    .catch(error => { titleArtworksReady = null; titleArtworks = null; throw error; });
  return titleArtworksReady;
}

export async function prepareCertificateAssets() {
  const [, logo] = await Promise.all([globalThis.document?.fonts?.ready, loadMinistryLogo(), prepareHeaderFont(), prepareTitleArtworks()]);
  return logo;
}

function requireMinistryMark(canvas) {
  if (canvas?.ownerDocument && !brandedCanvases.has(canvas)) throw new Error('Ministry logo is not ready');
}

function loadStyle() {
  if (document.querySelector('link[data-achievement-certificate-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  link.dataset.achievementCertificateStyle = '';
  document.head.append(link);
}

/** Only the student's display name and the teacher's certificate text enter the artwork. */
export function certificateCard({ studentName = '', text = '', demo = false } = {}) {
  return Object.freeze({
    name: Array.from(String(studentName).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 240).join(''),
    text: certificateText(text),
    demo: demo === true,
  });
}

export function isCertificateReady(card) {
  return !!(card?.name?.trim() && certificateText(card.text));
}

const filenameEncoder = new TextEncoder();
const filenamePart = value => String(value ?? '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
  .replace(/[\\/]+/g, ' - ').replace(/[<>:"|?*]/g, ' ')
  .replace(/\s+/g, ' ').replace(/(?:\s*-\s*){2,}/g, ' - ')
  .replace(/^[. -]+|[. -]+$/g, '');
const boundedFilenamePart = (value, bytes) => {
  let result = '', length = 0;
  for (const character of filenamePart(value)) {
    const size = filenameEncoder.encode(character).length;
    if (length + size > bytes) break;
    result += character; length += size;
  }
  return result.replace(/[. -]+$/g, '');
};

/** A cross-platform filename stem; the downloader or print dialog adds the extension. */
export function certificateFilename({ studentName = '', className = '', studentCount = 1 } = {}) {
  const multiple = Number.isSafeInteger(studentCount) && studentCount > 1;
  const title = multiple ? 'شهادات شكر وتقدير' : 'شهادة شكر وتقدير';
  const classroom = boundedFilenamePart(className, 80);
  if (multiple) return [title, classroom, `${studentCount} طلاب`].filter(Boolean).join(' - ');
  const fixed = [title, classroom].filter(Boolean).join(' - ') + ' - ';
  const name = boundedFilenamePart(studentName, 240 - filenameEncoder.encode(fixed).length) || 'طالب';
  return [title, name, classroom].filter(Boolean).join(' - ');
}

export function certificatePng(canvas, card) {
  if (!isCertificateReady(card)) return Promise.reject(new Error('Certificate name and text are required'));
  try { requireMinistryMark(canvas); } catch (error) { return Promise.reject(error); }
  return new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}

export async function certificatePdf(canvas, card) {
  if (!isCertificateReady(card)) throw new Error('Certificate name and text are required');
  requireMinistryMark(canvas);
  const width = canvas.width, height = canvas.height;
  const jpeg = await new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob?.type === 'image/jpeg' ? resolve(blob) : reject(new Error('Certificate JPEG is unavailable')), 'image/jpeg', 0.98));
  return certificatePdfFromJpeg(new Uint8Array(await jpeg.arrayBuffer()), width, height);
}

function requestCertificateDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // Allow the browser to consume the Blob; only a few pending files are retained.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** One named file per student, one reusable canvas. "prepared" is not a disk-save receipt. */
export async function downloadCertificates(entries, { format = 'pdf', isCurrent = () => true, onProgress = () => {} } = {}) {
  if (!['png', 'pdf'].includes(format)) throw new Error('Unsupported certificate format');
  if (!Array.isArray(entries) || !entries.length || entries.some(entry => !isCertificateReady(entry?.card))) {
    throw new Error('Each selected certificate requires a name and text');
  }
  const total = entries.length;
  let prepared = 0;
  const result = cancelled => ({ prepared, total, cancelled });
  onProgress({ prepared, total });
  if (!isCurrent()) return result(true);
  await prepareCertificateAssets();
  if (!isCurrent()) return result(true);
  const scratch = document.createElement('canvas');
  const filenames = new Map();
  try {
    for (const entry of entries) {
      if (!isCurrent()) return result(true);
      const canvas = entry.canvas || drawAchievementCertificate(scratch, entry.card, entry.options);
      const blob = format === 'pdf' ? await certificatePdf(canvas, entry.card) : await certificatePng(canvas, entry.card);
      if (!isCurrent()) return result(true);
      const stem = certificateFilename({ studentName: entry.card.name, className: entry.options?.className });
      const occurrence = (filenames.get(stem) || 0) + 1;
      filenames.set(stem, occurrence);
      const suffix = occurrence > 1 ? ` - ${occurrence}` : '';
      const filename = boundedFilenamePart(stem, 240 - filenameEncoder.encode(suffix).length) + suffix;
      requestCertificateDownload(blob, `${filename}.${format}`);
      prepared++;
      onProgress({ prepared, total });
      if (prepared < total) await new Promise(resolve => setTimeout(resolve, 150));
    }
    return result(false);
  } finally { scratch.width = scratch.height = 1; }
}

/** Shared artwork, driven only by explicit certificate display projections. */
export function drawAchievementCertificate(canvas, card, options = {}) {
  brandedCanvases.delete(canvas);
  const ministryLogo = options.ministryLogo ?? getMinistryLogo();
  const titleArtwork = options.titleArtwork ?? titleArtworks?.[options.design === 'school' ? 'school' : 'ornate'];
  if (canvas?.ownerDocument && !ministryLogo) throw new Error('Ministry logo is not ready');
  const result = drawCertificateDesign(canvas, card, { ...options, ministryLogo, titleArtwork });
  if (ministryLogo) brandedCanvases.add(canvas);
  return result;
}

export function certificateIssueDate(iso = todayISO()) {
  const gregorian = fmtDateFull(iso);
  if (!gregorian) return '';
  const [year, month, day] = iso.split('-').map(Number);
  try {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
    return `${hijri} · ${gregorian}`;
  } catch { return gregorian; }
}

export function certificateDescription(card, options = {}) {
  const meta = certificateMetadata(options);
  return ['شهادة شكر وتقدير', 'وزارة التعليم', card.name, meta.schoolName, meta.educationDepartment,
    meta.className, meta.subjectName,
    certificateText(card.text),
    meta.teacherName, meta.principalName, meta.dateLabel,
    card.demo ? 'بيانات تجريبية' : ''].filter(Boolean).join('، ');
}

function certificateRaster(canvas, card) {
  if (!isCertificateReady(card)) throw new Error('Certificate name and text are required');
  requireMinistryMark(canvas);
  const png = canvas.toDataURL('image/png');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png)) throw new Error('Certificate image is unavailable');
  return png;
}

function rasterDocument(images, filename) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${String(html`${filename}`)}</title><style>
    @page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}body{width:297mm}.certificate-page{width:297mm;height:209.8mm;overflow:hidden;break-inside:avoid;break-after:page}.certificate-page:last-child{break-after:auto}img{display:block;width:297mm;height:209.8mm;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body>${images.map(src => `<div class="certificate-page"><img alt="شهادة تقدير" src="${src}"></div>`).join('')}</body></html>`;
}

/** Isolated print documents contain only the selected certificate rasters. */
export function certificatePrintHtml(canvas, card, options = {}) {
  const filename = certificateFilename({ studentName: card?.name, className: options.className });
  return rasterDocument([certificateRaster(canvas, card)], filename);
}

async function printDocument(documentHtml, isCurrent, filename) {
  const frame = document.createElement('iframe');
  frame.title = filename;
  frame.dataset.certificatePrint = '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;pointer-events:none';
  let timer;
  let originalTitle = null;
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener('afterprint', cleanup);
    frame.contentWindow?.removeEventListener('afterprint', cleanup);
    // A route or another document operation may have replaced our temporary title.
    if (originalTitle !== null && document.title === filename) document.title = originalTitle;
    originalTitle = null;
    frame.remove();
  };
  try {
    const ready = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Print document timed out')), 20000);
      frame.addEventListener('load', resolve, { once: true });
    });
    frame.srcdoc = documentHtml;
    document.body.append(frame);
    await ready;
    await Promise.all([...frame.contentDocument.images].map(img => img.decode()));
    clearTimeout(timer);
    if (!isCurrent()) { cleanup(); return false; }
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    window.addEventListener('afterprint', cleanup, { once: true });
    timer = setTimeout(cleanup, 120000);
    originalTitle = document.title;
    document.title = filename;
    frame.contentWindow.focus();
    frame.contentWindow.print();
    return true;
  } catch (error) { cleanup(); throw error; }
}

async function printCertificate(canvas, card, isCurrent, options = {}) {
  const filename = certificateFilename({ studentName: card.name, className: options.className });
  return printDocument(certificatePrintHtml(canvas, card, options), isCurrent, filename);
}

/** Read-only local editor. It never saves, dispatches, uploads or sends student data. */
export function openAchievementCertificate({ studentName = '', demo = false, metadata = {} } = {}) {
  loadStyle();
  const initialOptions = certificateMetadata({ ...metadata, dateLabel: metadata.dateLabel || certificateIssueDate() });
  const initialText = defaultCertificateText();
  return openSheet({
    title: 'شهادة تقدير',
    desc: 'خصّص نص الشهادة وتصميمها، ثم احفظها أو اطبعها.',
    body: html`
      <div class="certificate-editor" dir="rtl">
        <aside class="certificate-editor__options">
          <fieldset class="certificate-fields certificate-design-fields">
            <legend>تصميم الشهادة</legend>
            <div class="certificate-design-options">${CERTIFICATE_DESIGNS.map(design => html`<label class="certificate-design-choice"><input type="radio" name="certificate-design" data-certificate-design value="${design.id}" ${design.id === initialOptions.design ? 'checked' : ''}><canvas data-certificate-thumbnail="${design.id}" aria-hidden="true"></canvas><span>${design.label}</span></label>`)}</div>
          </fieldset>
          <details class="certificate-identity"><summary>بيانات المدرسة والتوقيع</summary><p>تُملأ تلقائيًا من بياناتك في ركيز. يمكنك تعديلها لهذه الشهادة فقط.</p>
            ${[['schoolName', 'المدرسة'], ['educationDepartment', 'إدارة التعليم'], ['teacherName', initialOptions.teacherLabel], ['principalName', initialOptions.principalLabel]].map(([key, label]) => html`<label class="field"><span class="field__label">${label} <small>اختياري</small></span><input class="input" data-certificate-meta="${key}" value="${initialOptions[key]}" maxlength="100" autocomplete="off"></label>`)}
          </details>
          <label class="field certificate-message-field"><span class="field__label">نص الشهادة</span>
            <textarea class="input certificate-message" data-certificate-text rows="6" maxlength="${CERTIFICATE_TEXT_LIMIT}" aria-describedby="certificate-message-hint">${initialText}</textarea>
            <small id="certificate-message-hint" class="certificate-message-hint">عبارة تقدير جاهزة، يمكنك تعديلها لتعبّر عن تقديرك للطالب.</small>
          </label>
          <div class="certificate-local-note">${icon('check')} <span>تُجهّز على جهازك دون رفع أو إرسال</span></div>
        </aside>
        <section class="certificate-editor__preview" aria-label="معاينة الشهادة">
          <div class="certificate-preview-heading"><span>معاينة الشهادة <small>A4 · أفقي</small></span>
            <button class="btn btn--ghost" data-certificate-expand type="button">معاينة موسّعة</button></div>
          <div class="certificate-paper"><canvas data-certificate-canvas role="img" aria-label="معاينة شهادة التقدير"></canvas></div>
          <p class="certificate-status" data-certificate-status role="status" hidden></p>
          <p class="certificate-export-status" data-certificate-export-status role="status"></p>
        </section>
      </div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>
      <button class="btn btn--ghost" data-certificate-print disabled>${icon('print')} طباعة</button>
      <button class="btn btn--outline" data-certificate-download disabled><span class="certificate-export-icon" aria-hidden="true">${icon('download')}</span> تنزيل الصورة</button>
      <button class="btn btn--primary" data-certificate-pdf disabled><span class="certificate-export-icon" aria-hidden="true">${icon('download')}</span> تنزيل PDF</button>`,
    onMount(root) {
      root.classList.add('certificate-backdrop');
      root.querySelector('.sheet').classList.add('certificate-sheet');
      const canvas = root.querySelector('[data-certificate-canvas]');
      const download = root.querySelector('[data-certificate-download]');
      const print = root.querySelector('[data-certificate-print]');
      const pdf = root.querySelector('[data-certificate-pdf]');
      const expand = root.querySelector('[data-certificate-expand]');
      const status = root.querySelector('[data-certificate-status]');
      const exportStatus = root.querySelector('[data-certificate-export-status]');
      let card;
      let options = initialOptions;
      let busy = false;
      let exportKind = null;
      let ready = false;
      let previewOpen = false;
      let assetsReady = false;
      let assetsFailed = false;
      const syncButtons = () => {
        download.disabled = pdf.disabled = print.disabled = busy || !ready || !isCertificateReady(card) || previewOpen;
        download.setAttribute('aria-busy', String(busy && exportKind === 'download'));
        pdf.setAttribute('aria-busy', String(busy && exportKind === 'pdf'));
        expand.disabled = !ready || busy || previewOpen;
      };
      const redraw = () => {
        if (!assetsReady) {
          ready = false;
          status.textContent = assetsFailed ? 'تعذّر تحميل الشعار أو خط الشهادة. أعد فتح الشهادة للمحاولة.' : 'جارٍ تجهيز الشهادة وشعار وزارة التعليم…';
          status.hidden = false;
          syncButtons();
          return;
        }
        try {
          drawAchievementCertificate(canvas, card, options);
          canvas.setAttribute('aria-label', certificateDescription(card, options));
          ready = true;
          status.textContent = !card.text ? 'اكتب نص الشهادة لإتاحة التصدير.' : !card.name ? 'تعذّر تحديد اسم الطالب للشهادة.' : '';
        } catch {
          ready = false;
          status.textContent = 'تعذرت معاينة الشهادة في هذا المتصفح.';
        }
        status.hidden = !status.textContent;
        syncButtons();
      };
      const update = () => {
        options = certificateMetadata({ ...initialOptions,
          ...Object.fromEntries([...root.querySelectorAll('[data-certificate-meta]')].map(field => [field.dataset.certificateMeta, field.value])),
          design: root.querySelector('[data-certificate-design]:checked').value,
        });
        card = certificateCard({
          text: root.querySelector('[data-certificate-text]').value,
          studentName,
          demo,
        });
        redraw();
      };
      root.querySelectorAll('[data-certificate-design]').forEach(field => field.addEventListener('change', update));
      root.querySelectorAll('[data-certificate-meta], [data-certificate-text]').forEach(field => field.addEventListener('input', update));
      expand.addEventListener('click', async () => {
        if (previewOpen) return;
        previewOpen = true;
        syncButtons();
        try {
          await openDocumentPreview({ title: 'معاينة شهادة التقدير', canvas, description: 'يمكنك التكبير أو ملاءمة الشهادة للشاشة، ثم العودة لمتابعة التصدير.' });
        } catch { toast('تعذّر فتح المعاينة الموسّعة — حاول مرة أخرى', 'danger'); }
        finally {
          previewOpen = false;
          syncButtons();
          if (root.isConnected) expand.focus({ preventScroll: true });
        }
      });
      const exportCertificate = async (kind) => {
        if (busy || !ready || !isCertificateReady(card) || previewOpen) return;
        const selectedCard = card;
        const selectedOptions = options;
        const isCurrent = () => root.isConnected && selectedCard === card && ready && isCertificateReady(card);
        busy = true;
        exportKind = kind;
        exportStatus.textContent = kind === 'print' ? 'جارٍ تجهيز الطباعة…' : kind === 'pdf' ? 'جارٍ تجهيز ملف PDF…' : 'جارٍ تجهيز صورة الشهادة…';
        syncButtons();
        try {
          await prepareCertificateAssets();
          if (!isCurrent()) { exportStatus.textContent = 'تغيّرت الشهادة. أعد التنزيل بالبيانات الحالية.'; return; }
          drawAchievementCertificate(canvas, selectedCard, selectedOptions);
          if (kind === 'print') {
            const opened = await printCertificate(canvas, selectedCard, isCurrent, selectedOptions);
            exportStatus.textContent = opened ? 'فُتحت نافذة الطباعة.' : 'تغيّرت الشهادة. أعد الطباعة بالبيانات الحالية.';
          } else {
            const result = await downloadCertificates([{ canvas, card: selectedCard, options: selectedOptions }], {
              format: kind === 'pdf' ? 'pdf' : 'png', isCurrent,
            });
            exportStatus.textContent = result.cancelled ? 'تغيّرت الشهادة. أعد التنزيل بالبيانات الحالية.' : 'تم تجهيز ملف الشهادة للتنزيل.';
            if (!result.cancelled) toast('تم تجهيز ملف الشهادة للتنزيل', 'ok');
          }
        } catch {
          exportStatus.textContent = 'تعذّر تجهيز الشهادة. حاول مرة أخرى.';
          toast(kind === 'print' ? 'تعذّر فتح الطباعة — يمكنك تنزيل الصورة' : 'تعذّر تنزيل الشهادة — حاول مرة أخرى', 'danger');
        } finally {
          busy = false;
          exportKind = null;
          syncButtons();
        }
      };
      download.addEventListener('click', () => exportCertificate('download'));
      pdf.addEventListener('click', () => exportCertificate('pdf'));
      print.addEventListener('click', () => exportCertificate('print'));
      const drawThumbnails = () => root.querySelectorAll('[data-certificate-thumbnail]').forEach(thumbnail => {
        const sample = document.createElement('canvas');
        drawAchievementCertificate(sample, certificateCard({ studentName: 'اسم الطالب', text: defaultCertificateText() }), { design: thumbnail.dataset.certificateThumbnail });
        thumbnail.width = 300; thumbnail.height = 212;
        thumbnail.getContext('2d').drawImage(sample, 0, 0, 300, 212);
        sample.width = sample.height = 1;
      });
      update();
      prepareCertificateAssets().then(() => {
        if (!root.isConnected) return;
        assetsReady = true;
        redraw();
        drawThumbnails();
      }).catch(() => {
        if (!root.isConnected) return;
        assetsFailed = true;
        redraw();
      });
    },
  });
}
