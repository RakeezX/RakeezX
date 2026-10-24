import { html, icon, openSheet, toast, fmtNum } from './dom.js';
import { achievementCard, achievementPng } from './student-achievements.js';
import { openDocumentPreview } from './document-preview.js';

const styleUrl = new URL('../styles/achievement-certificate.css', import.meta.url).href;
const WIDTH = 2970;
const HEIGHT = 2100;
const COLORS = { paper: '#fffdf7', ink: '#183e38', gold: '#a47c38', muted: '#68776e', line: '#ded4bb' };

function loadStyle() {
  if (document.querySelector('link[data-achievement-certificate-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  link.dataset.achievementCertificateStyle = '';
  document.head.append(link);
}

function text(ctx, value, x, y, size, weight = 500, color = COLORS.ink) {
  ctx.font = `${weight} ${size}px "Tajawal", sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(String(value), x, y);
}

function fitText(ctx, value, x, y, width, size, min = 22, weight = 700, color = COLORS.ink) {
  let fitted = size;
  for (; fitted > min; fitted -= 1) {
    ctx.font = `${weight} ${fitted}px "Tajawal", sans-serif`;
    if (ctx.measureText(String(value)).width <= width) break;
  }
  ctx.font = `${weight} ${fitted}px "Tajawal", sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(String(value), x, y, width);
}

function wrappedText(ctx, value, x, y, width, size, lineHeight, color = COLORS.muted) {
  ctx.font = `500 ${size}px "Tajawal", sans-serif`;
  const lines = [];
  let line = '';
  for (const word of String(value).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.forEach((item, index) => text(ctx, item, x, y + index * lineHeight, size, 500, color));
  return lines.length;
}

function star(ctx, x, y, radius) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const r = point % 2 ? radius * 0.46 : radius;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Paint only the explicit allowlisted achievementCard projection, never a profile or store. */
export function drawAchievementCertificate(canvas, card) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.scale(2, 2);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const w = WIDTH / 2;
  const center = w / 2;

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, w, HEIGHT / 2);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, w - 72, 978);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, w - 96, 954);

  // Quiet geometric corners, drawn locally; no external artwork or official seal.
  for (const [x, y, directionX, directionY] of [[70, 70, 1, 1], [w - 70, 70, -1, 1], [70, 980, 1, -1], [w - 70, 980, -1, -1]]) {
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 52 * directionY);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 52 * directionX, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    star(ctx, x + 20 * directionX, y + 20 * directionY, 5);
  }

  text(ctx, 'رَكيز المعلم', center, 112, 25, 700);
  ctx.fillStyle = '#f3ebd9';
  ctx.beginPath();
  ctx.arc(center, 192, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#cfb784';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(center, 192, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  star(ctx, center, 191, 21);
  text(ctx, 'شهادة تقدير', center, 314, 78, 800);
  text(ctx, 'تقديرًا للمشاركة والإنجاز الموثّق', center, 369, 27, 500, COLORS.muted);

  text(ctx, card.name ? 'تُهدى هذه الشهادة إلى' : 'نحتفي بالجهد والأثر الطيب', center, 437, 24, 500, COLORS.muted);
  const name = card.name || 'لصاحب هذا الإنجاز';
  ctx.font = '700 52px "Tajawal", sans-serif';
  if (ctx.measureText(name).width > 1110 && name.includes(' ')) {
    // Long Arabic names remain legible on two lines, inside the reserved name band.
    const words = name.split(/\s+/);
    let split = 1;
    let best = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const difference = Math.abs(ctx.measureText(words.slice(0, i).join(' ')).width - ctx.measureText(words.slice(i).join(' ')).width);
      if (difference < best) { best = difference; split = i; }
    }
    fitText(ctx, words.slice(0, split).join(' '), center, 490, 1120, 46, 22);
    fitText(ctx, words.slice(split).join(' '), center, 544, 1120, 46, 22);
  } else fitText(ctx, name, center, 518, 1120, 55, 22);

  const facts = card.evidence;
  const count = facts.length;
  if (!count) {
    text(ctx, 'اختر إنجازًا موثّقًا من الخيارات لتهيئة الشهادة', center, 678, 27, 500, COLORS.muted);
  } else {
    const panelWidth = count === 1 ? 750 : 555;
    const gap = 34;
    facts.forEach((fact, index) => {
      const x = center + (count === 1 ? 0 : (index === 0 ? 1 : -1) * (panelWidth + gap) / 2);
      ctx.fillStyle = '#f5f3ea';
      ctx.fillRect(x - panelWidth / 2, 594, panelWidth, 191);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(x + panelWidth / 2 - 3, 594, 3, 191);
      fitText(ctx, fact.count, x, 650, panelWidth - 40, 43, 22, 800);
      fitText(ctx, fact.title, x, 694, panelWidth - 40, 28, 20, 700);
      wrappedText(ctx, fact.scope, x, 733, panelWidth - 58, 18, 25);
    });
  }

  text(ctx, 'شكرًا لكل خطوة نحو التعلّم', center, 865, 29, 500);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(center - 135, 903);
  ctx.lineTo(center + 135, 903);
  ctx.stroke();
  text(ctx, card.demo ? 'بيانات تجريبية · رَكيز المعلم' : 'شهادة تقدير · رَكيز المعلم', center, 945, 21, 500, COLORS.muted);
  return canvas;
}

export function certificateDescription(card) {
  return ['شهادة تقدير', card.name, ...card.evidence.map(fact => `${fact.title}: ${fact.count} — ${fact.scope}`), card.demo ? 'بيانات تجريبية' : ''].filter(Boolean).join('، ');
}

/** An isolated print document contains only the reviewed certificate raster. */
export function certificatePrintHtml(canvas, card, confirmed = false) {
  if (confirmed !== true || !card.evidence.length) throw new Error('Review the selected certificate before printing');
  const png = canvas.toDataURL('image/png');
  if (!png.startsWith('data:image/png;base64,')) throw new Error('Certificate image is unavailable');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>شهادة تقدير - ركيز المعلم</title><style>
    @page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}body{width:297mm;height:210mm}img{display:block;width:297mm;height:210mm;object-fit:contain;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body><img alt="شهادة التقدير التي تمت مراجعتها" src="${png}"></body></html>`;
}

async function printCertificate(canvas, card, confirmed, isCurrent) {
  const documentHtml = certificatePrintHtml(canvas, card, confirmed);
  const frame = document.createElement('iframe');
  frame.title = 'طباعة شهادة التقدير';
  frame.dataset.certificatePrint = '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;pointer-events:none';
  let timer;
  const cleanup = () => { clearTimeout(timer); frame.remove(); };
  try {
    const ready = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Print document timed out')), 10000);
      frame.addEventListener('load', resolve, { once: true });
    });
    frame.srcdoc = documentHtml;
    document.body.append(frame);
    await ready;
    await frame.contentDocument.querySelector('img').decode();
    clearTimeout(timer);
    if (!isCurrent()) { cleanup(); return false; }
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    timer = setTimeout(cleanup, 120000);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    return true;
  } catch (error) {
    cleanup();
    throw error;
  }
}

/** Read-only local editor. It never saves, dispatches, uploads or sends student data. */
export function openAchievementCertificate(input, { studentName = '', demo = false } = {}) {
  loadStyle();
  const available = achievementCard(input, { selected: ['participation', 'scores'] }).evidence;
  return openSheet({
    title: 'شهادة تقدير',
    desc: 'اختر الإنجاز، راجع الشهادة، ثم احفظها أو اطبعها.',
    body: html`
      <div class="certificate-editor" dir="rtl">
        <aside class="certificate-editor__options">
          <fieldset class="certificate-fields">
            <legend>محتوى الشهادة</legend>
            <label class="certificate-choice"><input type="checkbox" data-certificate-name>
              <span><strong>إظهار اسم الطالب</strong><small>اختياري · الاسم مخفي افتراضيًا</small></span></label>
            <p class="certificate-fields__hint">اختر إنجازًا موثّقًا واحدًا على الأقل</p>
            ${available.map(fact => html`<label class="certificate-choice"><input type="checkbox" data-certificate-field="${fact.key}">
              <span><strong>${fact.title} <b class="certificate-choice__count">${fmtNum(fact.count)}</b></strong><small>${fact.scope}</small></span></label>`)}
            ${!available.length ? html`<p class="certificate-empty">لا تتوفر مشاركة إيجابية أو درجة كاملة موثّقة للشهادة حاليًا.</p>` : ''}
          </fieldset>
          <div class="certificate-local-note">${icon('check')} <span>تُجهّز على جهازك دون رفع أو إرسال</span></div>
        </aside>
        <section class="certificate-editor__preview" aria-label="معاينة الشهادة">
          <div class="certificate-preview-heading"><span>معاينة الشهادة <small>A4 · أفقي</small></span>
            <button class="btn btn--ghost" data-certificate-expand type="button">معاينة موسّعة</button></div>
          <div class="certificate-paper"><canvas data-certificate-canvas role="img" aria-label="معاينة شهادة التقدير"></canvas></div>
          <p class="certificate-status" data-certificate-status role="status">اختر إنجازًا لتجهيز الشهادة. الاسم مخفي افتراضيًا.</p>
        </section>
      </div>
      <label class="certificate-consent"><input type="checkbox" data-certificate-confirm disabled>
        <span>راجعت الشهادة وأوافق على تصدير المحتوى المختار</span></label>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button>
      <button class="btn btn--outline" data-certificate-print disabled>${icon('print')} طباعة / PDF</button>
      <button class="btn btn--primary" data-certificate-download disabled>${icon('download')} تنزيل الصورة</button>`,
    onMount(root) {
      root.classList.add('certificate-backdrop');
      root.querySelector('.sheet').classList.add('certificate-sheet');
      const canvas = root.querySelector('[data-certificate-canvas]');
      const confirm = root.querySelector('[data-certificate-confirm]');
      const download = root.querySelector('[data-certificate-download]');
      const print = root.querySelector('[data-certificate-print]');
      const expand = root.querySelector('[data-certificate-expand]');
      const status = root.querySelector('[data-certificate-status]');
      let card;
      let busy = false;
      let ready = false;
      let previewOpen = false;
      const syncButtons = () => {
        download.disabled = print.disabled = busy || !ready || confirm.disabled || !confirm.checked;
        expand.disabled = !ready || busy || previewOpen;
      };
      const redraw = () => {
        try {
          drawAchievementCertificate(canvas, card);
          canvas.setAttribute('aria-label', certificateDescription(card));
          ready = true;
          confirm.disabled = !card.evidence.length;
          status.textContent = card.evidence.length ? 'المعاينة هي المحتوى الذي سيظهر في الصورة والطباعة.' : card.name ? 'اختر إنجازًا موثّقًا لإتاحة التصدير.' : 'اختر إنجازًا لتجهيز الشهادة. الاسم مخفي افتراضيًا.';
        } catch {
          ready = false;
          confirm.disabled = true;
          confirm.checked = false;
          status.textContent = 'تعذرت معاينة الشهادة في هذا المتصفح.';
        }
        syncButtons();
      };
      const update = () => {
        confirm.checked = false;
        card = achievementCard(input, {
          selected: [...root.querySelectorAll('[data-certificate-field]:checked')].map(field => field.dataset.certificateField),
          includeName: root.querySelector('[data-certificate-name]').checked,
          studentName,
          demo,
        });
        redraw();
      };
      root.querySelectorAll('[data-certificate-name], [data-certificate-field]').forEach(field => field.addEventListener('change', update));
      confirm.addEventListener('change', syncButtons);
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
        if (busy || !ready || confirm.disabled || !confirm.checked) return;
        const selectedCard = card;
        busy = true;
        syncButtons();
        let url;
        try {
          if (kind === 'print') {
            const opened = await printCertificate(canvas, selectedCard, true, () => root.isConnected && selectedCard === card && confirm.checked);
            if (opened) status.textContent = 'من نافذة الطباعة يمكنك اختيار الطابعة أو «حفظ بتنسيق PDF».';
          } else {
            const blob = await achievementPng(canvas, selectedCard, true);
            if (!root.isConnected || selectedCard !== card || !confirm.checked) return;
            url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'rakeez-achievement-certificate.png';
            link.click();
            toast('تم تجهيز صورة الشهادة للتنزيل', 'ok');
          }
        } catch {
          toast(kind === 'print' ? 'تعذّر فتح الطباعة — يمكنك تنزيل الصورة' : 'تعذّر تنزيل الشهادة — حاول مرة أخرى', 'danger');
        } finally {
          if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
          busy = false;
          confirm.checked = false;
          syncButtons();
        }
      };
      download.addEventListener('click', () => exportCertificate('download'));
      print.addEventListener('click', () => exportCertificate('print'));
      update();
      document.fonts?.ready.then(() => { if (root.isConnected) redraw(); });
    },
  });
}
