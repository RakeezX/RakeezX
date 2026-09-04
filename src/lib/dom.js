/**
 * طبقة عرض صغيرة: قوالب نصية آمنة + تفويض أحداث + أيقونات.
 * لا مكتبات خارجية — الملف كله أقل من كيلوبايتين بعد الضغط.
 */

/* ---------- الهروب من HTML ---------- */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** يهرب أي نص قادم من المستخدم (أسماء الطلاب مثلًا) قبل حقنه في HTML. */
export const esc = (v) =>
  v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const RAW = Symbol('raw');

/** يعلّم نصًا بأنه HTML جاهز فلا يُهرَّب. استعمله فقط مع نص تكتبه أنت. */
export const raw = (s) => ({ [RAW]: true, value: String(s ?? '') });

const flatten = (v) => {
  if (v === null || v === undefined || v === false) return '';
  if (v[RAW]) return v.value;
  if (Array.isArray(v)) return v.map(flatten).join('');
  return esc(v);
};

/**
 * قالب HTML آمن افتراضيًا:
 *   html`<div>${student.name}</div>`   ← يُهرَّب الاسم تلقائيًا
 *   html`<div>${html`<b>x</b>`}</div>` ← القوالب المتداخلة تمر كما هي
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += flatten(values[i]) + strings[i + 1];
  return raw(out);
}

/** يضع قالبًا داخل عنصر. */
export function render(el, tpl) {
  el.innerHTML = tpl && tpl[RAW] ? tpl.value : String(tpl ?? '');
  return el;
}

/** ينشئ عنصرًا من قالب ويعيد أول عقدة فيه. */
export function toNode(tpl) {
  const t = document.createElement('template');
  t.innerHTML = (tpl && tpl[RAW] ? tpl.value : String(tpl ?? '')).trim();
  return t.content.firstElementChild;
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- تفويض الأحداث ---------- */
/**
 * يربط مستمعًا واحدًا على الجذر، ويوزّع على الدوال حسب سمة البيانات.
 *   <button data-act="delete" data-id="5">   →  handlers.delete(el, ev)
 * الأنواع: data-act (نقر) · data-change · data-input · data-focus · data-submit · data-keydown
 */
const EVENT_ATTR = {
  click: 'act',
  change: 'change',
  input: 'input',
  focusin: 'focus',
  submit: 'submit',
  keydown: 'keydown',
};

export function delegate(root, getHandlers) {
  for (const [type, attr] of Object.entries(EVENT_ATTR)) {
    root.addEventListener(
      type,
      (ev) => {
        const el = ev.target.closest(`[data-${attr}]`);
        if (!el || !root.contains(el)) return;
        const name = el.dataset[attr];
        const fn = getHandlers()?.[name];
        if (!fn) return;
        if (type === 'submit') ev.preventDefault();
        fn(el, ev);
      },
      type === 'submit' ? true : undefined
    );
  }
}

/* ---------- تنبيه عابر ---------- */
let toastTimer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-danger', kind === 'danger');
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

/* ---------- الطبقة المنبثقة ---------- */
let sheetCleanup = null;

/**
 * يفتح لوحة منبثقة. يعيد Promise يُحلّ بما تمرره close(value).
 * body: قالب html · actions: [{label, kind, value}] أو رسم مخصص.
 */
export function openSheet({ title, desc, body, foot, onMount }) {
  closeSheet();
  return new Promise((resolve) => {
    const backdrop = toNode(html`
      <div class="sheet-backdrop" role="dialog" aria-modal="true">
        <div class="sheet">
          <div class="sheet__head">
            <div>
              <div class="sheet__title">${title}</div>
              ${desc ? html`<div class="sheet__desc">${desc}</div>` : ''}
            </div>
            <button class="iconbtn" data-sheet-close aria-label="إغلاق">${icon('x')}</button>
          </div>
          <div class="sheet__body">${body ?? ''}</div>
          ${foot ? html`<div class="sheet__foot">${foot}</div>` : ''}
        </div>
      </div>
    `);

    const done = (value) => {
      if (sheetCleanup) sheetCleanup();
      resolve(value);
    };

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop || ev.target.closest('[data-sheet-close]')) done(undefined);
    });

    const onKey = (ev) => {
      if (ev.key === 'Escape') done(undefined);
    };
    document.addEventListener('keydown', onKey);

    sheetCleanup = () => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      sheetCleanup = null;
    };

    document.getElementById('modal-root').append(backdrop);
    onMount?.(backdrop, done);

    const firstInput = backdrop.querySelector('input, textarea, select');
    if (firstInput && window.matchMedia('(min-width: 700px)').matches) firstInput.focus();
  });
}

export function closeSheet() {
  if (sheetCleanup) sheetCleanup();
}

/** تأكيد قبل فعل لا رجعة فيه. */
export function confirmSheet({ title, desc, confirmLabel = 'تأكيد', danger = false }) {
  return openSheet({
    title,
    desc,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${confirmLabel}</button>
    `,
    onMount: (root, done) => {
      root.querySelector('[data-confirm]').addEventListener('click', () => done(true));
    },
  }).then((v) => v === true);
}

/* ---------- الأيقونات ---------- */
const SIZE_CLASSES = {
  inline: 'icon--inline',
  compact: 'icon--compact',
  control: 'icon--control',
  status: 'icon--status',
  hero: 'icon--hero',
};

const P = (d, cls = '', extra = '') => {
  const classAttr = cls ? ` class="icon ${cls}"` : ' class="icon"';
  return `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
};

const ICONS = {
  classes:   '<path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  student:   '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  attendance:'<path d="M9 11.5 11.2 13.7 15.5 9.4"/><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
  grades:    '<path d="M9 3.5h6a1.5 1.5 0 0 1 1.5 1.5v.5h1.5A1.5 1.5 0 0 1 19.5 7v13A1.5 1.5 0 0 1 18 21.5H6A1.5 1.5 0 0 1 4.5 20V7A1.5 1.5 0 0 1 6 5.5h1.5V5A1.5 1.5 0 0 1 9 3.5Z"/><path d="M8.5 12h7M8.5 16h4"/>',
  picker:    '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
  groups:    '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  board:     '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 7 10.8M17 6h2.5v1.5A3.5 3.5 0 0 1 17 10.8"/>',
  reports:   '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  back:      '<path d="M9 6l6 6-6 6"/>',
  chev:      '<path d="M15 6l-6 6 6 6"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  minus:     '<path d="M5 12h14"/>',
  trash:     '<path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6m3 0v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V6"/><path d="M10 11v6M14 11v6"/>',
  edit:      '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter:    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  x:         '<path d="M18 6 6 18M6 6l12 12"/>',
  check:     '<path d="M20 6 9 17l-5-5"/>',
  print:     '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1.5"/>',
  sun:       '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  cloud:     '<path d="M18 18.5a4 4 0 0 0 .3-8A6.5 6.5 0 0 0 5.6 12 3.75 3.75 0 0 0 6 19.5h12Z"/>',
  spark:     '<path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  note:      '<path d="M14 3v5h5"/><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M9 13h6M9 17h4"/>',
  home:      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>',
  timetable: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8.5 9.5v11M14 9.5v11M3 15h18"/><path d="M8 2.5v4M16 2.5v4"/>',
  book:      '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a3 3 0 0 1 2 5.2V21a3 3 0 0 0-2-.8H5.5A1.5 1.5 0 0 1 4 18.7Z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a3 3 0 0 0-2 5.2V21a3 3 0 0 1 2-.8h4.5a1.5 1.5 0 0 0 1.5-1.5Z"/>',
  calendar:  '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/><circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="17" r="1.1" fill="currentColor" stroke="none"/>',
  more:      '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  session:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/><path d="M12 3v1.5M21 12h-1.5M12 21v-1.5M3 12h1.5"/>',
  share:     '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  refresh:   '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
};

/** يعيد أيقونة SVG جاهزة للحقن، مع دعم فئات الحجم الدلالية (inline, compact, control, status, hero). */
export const icon = (name, sizeOrClass = '') => {
  const cls = SIZE_CLASSES[sizeOrClass] || (sizeOrClass ? (sizeOrClass.startsWith('icon--') ? sizeOrClass : `icon--${sizeOrClass}`) : '');
  return raw(P(ICONS[name] ?? ICONS.note, cls));
};

/** رابط رجوع صريح إلى الشاشة الأم، مستقل عن سجل المتصفح. */
export const parentLink = (label, parentRoute) =>
  html`<a class="btn btn--quiet mt-3" href="#${parentRoute}">${icon('back')} ${label}</a>`;

/* ---------- تنسيق ---------- */
/** يعرض رقمًا بلا كسور زائدة: 8.50 → 8.5 · 8.00 → 8 */
/** نص نطاق وقت منطقي؛ العارض أدناه يعزله بصريًا داخل واجهات RTL. */
export const formatTimeRange = (start, end) => {
  const first = String(start ?? '').trim();
  const last = String(end ?? '').trim();
  return first && last ? `${first} – ${last}` : first || last;
};

/** نطاق وقت موحّد: البداية أول عنصر RTL، وكل وقت يحافظ على قراءة HH:MM. */
export const fmtTimeRange = (start, end) => {
  const first = String(start ?? '').trim();
  const last = String(end ?? '').trim();
  if (!first && !last) return '';
  return html`<span class="time-range"><span class="time-range__token" dir="ltr" data-time-token="start">${first}</span>${last ? html`<span class="time-range__dash" aria-hidden="true"> – </span><span class="time-range__token" dir="ltr" data-time-token="end">${last}</span>` : ''}</span>`;
};

export const fmtNum = (n, digits = 2) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const r = Number(n.toFixed(digits));
  return String(r);
};

export const fmtPct = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Math.round(n) + '٪');

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/** '2026-08-15' → 'السبت ١٥ أغسطس' (بأرقام لاتينية) */
function dateParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return { year, month, day };
}

const dateText = (parts) => `${parts.day} ${AR_MONTHS[parts.month - 1]} ${parts.year}`;
const isolate = (text) => `\u2068${text}\u2069`;

/** '2026-08-15' → 'السبت 15 أغسطس 2026'، مع عزل ثنائي الاتجاه. */
export function fmtDate(iso, withDay = true) {
  const parts = dateParts(iso);
  if (!parts) return '';
  const weekday = AR_DAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  return isolate(`${withDay ? weekday + ' ' : ''}${dateText(parts)}`);
}

/** نطاق تاريخي قابل لإعادة الاستخدام، يحافظ على ترتيب البداية والنهاية داخل RTL. */
export function fmtDateRange(startISO, endISO = startISO) {
  const start = dateParts(startISO), end = dateParts(endISO);
  if (!start || !end) return '';
  if (startISO === endISO) return html`<span class="date-display"><bdi>${dateText(start)}</bdi></span>`;
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;
  const first = sameMonth ? `${start.day}` : sameYear ? `${start.day} ${AR_MONTHS[start.month - 1]}` : dateText(start);
  const last = `${end.day} ${AR_MONTHS[end.month - 1]} ${end.year}`;
  return html`<span class="date-range" dir="rtl"><bdi>${first}</bdi><span class="date-range__dash" aria-hidden="true"> – </span><bdi>${last}</bdi></span>`;
}

export const fmtDateFull = (iso) => fmtDate(iso, false);
