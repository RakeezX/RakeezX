/**
 * طبقة عرض صغيرة: قوالب نصية آمنة + تفويض أحداث + أيقونات.
 * لا مكتبات خارجية — الملف كله أقل من كيلوبايتين بعد الضغط.
 */

import { normalizeDateTimeDigits } from './rakeez-datetime-values.js';
import { wireVisibleNumberInputs } from './visible-numerals.js';
import { syncSheetViewport } from './visible-viewport.js';

/* ---------- الهروب من HTML ---------- */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** يهرب أي نص قادم من المستخدم (أسماء الطلاب مثلًا) قبل حقنه في HTML. */
export const esc = (v) =>
  v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const RAW = Symbol('raw');

/** يعلّم نصًا بأنه HTML جاهز فلا يُهرَّب. استعمله فقط مع نص تكتبه أنت. */
export const raw = (s) => ({
  [RAW]: true,
  value: String(s ?? ''),
  toString() { return this.value; },
});

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
  wireVisibleNumberInputs(el);
  return el;
}

/** ينشئ عنصرًا من قالب ويعيد أول عقدة فيه. */
export function toNode(tpl) {
  const t = document.createElement('template');
  t.innerHTML = (tpl && tpl[RAW] ? tpl.value : String(tpl ?? '')).trim();
  wireVisibleNumberInputs(t.content);
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
  el.classList.remove('is-danger', 'is-warn', 'is-info');
  if (kind === 'danger') el.classList.add('is-danger');
  if (kind === 'warn') el.classList.add('is-warn');
  if (kind === 'info') el.classList.add('is-info');
  const urgent = kind === 'danger';
  el.setAttribute('role', urgent ? 'alert' : 'status');
  el.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), urgent ? 5000 : 3200);
}

/* ---------- الطبقة المنبثقة ---------- */
const sheetStack = [];
let sheetCounter = 0;

const focusableSelector = [
  '[autofocus]',
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const initialFocusSelector = '[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** يحوّل الإدخال العربي/الغربي إلى HH:mm غربي صالح دون تغيير ما يُخزَّن. */
export function normalizeTimeDigits(value) {
  let text = String(value ?? '').trim().replace(/[٠-٩]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
  text = text.replace(/[^0-9:]/g, '');
  const parts = text.split(':');
  if (parts.length >= 2) {
    const hour = Math.max(0, Math.min(23, Number(parts[0]) || 0));
    const minute = Math.max(0, Math.min(59, Number(parts[1]) || 0));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  if (text.length >= 3) {
    const hour = Math.max(0, Math.min(23, Number(text.slice(0, -2)) || 0));
    const minute = Math.max(0, Math.min(59, Number(text.slice(-2)) || 0));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return text;
}

/**
 * يفتح لوحة منبثقة. يعيد Promise يُحلّ بما تمرره close(value).
 * body: قالب html · actions: [{label, kind, value}] أو رسم مخصص.
 */
export function openSheet({ title, desc, body, foot, onMount }) {
  return new Promise((resolve) => {
    const depth = sheetStack.length;
    const id = ++sheetCounter;
    const titleId = `sheet-title-${id}`;
    const descId = desc ? `sheet-desc-${id}` : '';
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = toNode(html`
      <div class="sheet-backdrop" style="z-index:${100 + depth * 20}">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${titleId}"
             ${descId ? html`aria-describedby="${descId}"` : ''} tabindex="-1">
          <div class="sheet__head">
            <div>
              <div class="sheet__title" id="${titleId}">${title}</div>
              ${desc ? html`<div class="sheet__desc" id="${descId}">${desc}</div>` : ''}
            </div>
            <button class="iconbtn" data-sheet-close aria-label="إغلاق">${icon('x')}</button>
          </div>
          <div class="sheet__body">${body ?? ''}</div>
          ${foot ? html`<div class="sheet__foot">${foot}</div>` : ''}
        </div>
      </div>
    `);

    let closed = false;
    const entry = {
      backdrop,
      opener,
      done(value) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        const index = sheetStack.indexOf(entry);
        if (index >= 0) sheetStack.splice(index, 1);
        const previous = sheetStack.at(-1);
        if (previous) {
          previous.backdrop.inert = false;
          previous.backdrop.removeAttribute('aria-hidden');
        } else {
          const appRoot = document.getElementById('app');
          if (appRoot) {
            appRoot.inert = false;
            appRoot.removeAttribute('aria-hidden');
          }
          document.body.classList.remove('has-modal');
        }
        if (entry.opener?.isConnected) entry.opener.focus({ preventScroll: true });
        resolve(value);
      },
    };

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop || ev.target.closest('[data-sheet-close]')) entry.done(undefined);
    });

    const onKey = (ev) => {
      if (sheetStack.at(-1) !== entry) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        entry.done(undefined);
        return;
      }
      if (ev.key !== 'Tab') return;
      const controls = [...backdrop.querySelectorAll(focusableSelector)].filter((el) =>
        !el.hidden && el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true'
      );
      if (!controls.length) {
        ev.preventDefault();
        backdrop.querySelector('.sheet')?.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    const previous = sheetStack.at(-1);
    if (previous) {
      previous.backdrop.inert = true;
      previous.backdrop.setAttribute('aria-hidden', 'true');
    } else {
      const appRoot = document.getElementById('app');
      if (appRoot) {
        appRoot.inert = true;
        appRoot.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.add('has-modal');
    }
    sheetStack.push(entry);
    (document.getElementById('modal-root') ?? document.body).append(backdrop);
    onMount?.(backdrop, entry.done);
    syncSheetViewport(backdrop.querySelector('.sheet'));

    if (!backdrop.contains(document.activeElement)) {
      (backdrop.querySelector(initialFocusSelector) ?? backdrop.querySelector(focusableSelector) ?? backdrop.querySelector('.sheet'))
        ?.focus({ preventScroll: true });
    }
  });
}

export function closeSheet() {
  sheetStack.at(-1)?.done(undefined);
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
  login:     '<path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
  attendance:'<path d="M9 11.5 11.2 13.7 15.5 9.4"/><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
  grades:    '<path d="M9 3.5h6a1.5 1.5 0 0 1 1.5 1.5v.5h1.5A1.5 1.5 0 0 1 19.5 7v13A1.5 1.5 0 0 1 18 21.5H6A1.5 1.5 0 0 1 4.5 20V7A1.5 1.5 0 0 1 6 5.5h1.5V5A1.5 1.5 0 0 1 9 3.5Z"/><path d="M8.5 12h7M8.5 16h4"/>',
  picker:    '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
  groups:    '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  grip:      '<circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/>',
  users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  star:      '<path d="m12 2.5 2.9 5.88 6.49.95-4.7 4.57 1.11 6.46L12 17.3l-5.8 3.06 1.11-6.46-4.7-4.57 6.49-.95Z"/>',
  'book-open':'<path d="M2.5 4.5h6A3.5 3.5 0 0 1 12 8v13a3.5 3.5 0 0 0-3.5-3.5h-6Z"/><path d="M21.5 4.5h-6A3.5 3.5 0 0 0 12 8v13a3.5 3.5 0 0 1 3.5-3.5h6Z"/>',
  board:     '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 7 10.8M17 6h2.5v1.5A3.5 3.5 0 0 1 17 10.8"/>',
  reports:   '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  archive:   '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M9 13h6M5 3h14a1 1 0 0 1 1 1v1H4V4a1 1 0 0 1 1-1Z"/>',
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
  snowflake: '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07 19.07 4.93"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  device:    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sliders:   '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>',
  cloud:     '<path d="M18 18.5a4 4 0 0 0 .3-8A6.5 6.5 0 0 0 5.6 12 3.75 3.75 0 0 0 6 19.5h12Z"/>',
  whatsapp:  '<path d="M20.2 11.5a8.2 8.2 0 0 1-12 7.2L3 20l1.4-4.9A8.2 8.2 0 1 1 20.2 11.5Z"/><path d="M8.2 8.2c.2-.4.5-.4.7-.4h.5c.2 0 .4.1.5.4l.9 1.6c.1.2.1.4-.1.6l-.7.9a7.5 7.5 0 0 0 2.8 2.7l.9-.8c.2-.2.4-.2.6-.1l1.7.8c.3.2.4.4.3.7l-.2.8c-.2.6-.9.9-1.5.9-3.5-.3-6.5-3.4-6.7-6.6Z"/>',
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

export function timingProfileIcon(name = '') {
  const value = String(name).trim();
  if (value.includes('صيفي')) return 'sun';
  if (value.includes('شتوي')) return 'snowflake';
  if (value.includes('رمضان')) return 'moon';
  if (value.includes('مدمج') || value.includes('هجين') || value.includes('عن بعد')) return 'device';
  return 'sliders';
}

/** رابط رجوع يحافظ على سياق ركيز السابق، مع الشاشة الأم كوجهة آمنة للرابط المباشر. */
export const parentLink = (label, parentRoute) =>
  html`<a class="btn btn--quiet mt-3" href="#${parentRoute}" data-act="app-back" data-back-fallback="#${parentRoute}">${icon('back')} ${label}</a>`;

/* ---------- تنسيق ---------- */
/** Presentation only: accept clock times with optional seconds; leave other text legible. */
export const fmtSessionTime = (value) => {
  const visible = normalizeDateTimeDigits(value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(visible);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : visible;
};

/** نص نطاق وقت منطقي؛ العارض أدناه يعزله بصريًا داخل واجهات RTL. */
export const formatTimeRange = (start, end) => {
  const first = fmtSessionTime(start);
  const last = fmtSessionTime(end);
  return first && last ? `${first} – ${last}` : first || last;
};

/** نطاق وقت موحّد: البداية أول عنصر RTL، وكل وقت يحافظ على قراءة HH:MM. */
export const fmtTimeRange = (start, end) => {
  const first = fmtSessionTime(start);
  const last = fmtSessionTime(end);
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

/** ISO date keys are technical values; keep their numeric order stable inside RTL text. */
export function fmtISODate(iso) {
  if (!dateParts(iso)) return '';
  return html`<bdi class="date-key tabular" dir="ltr">${iso}</bdi>`;
}
