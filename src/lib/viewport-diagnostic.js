// 0411 diagnostic only: read geometry, never read values/account/storage data.
const LIMIT = 120;
const BASE = 'a88a02bfdbecf246502a6598bf494182d34784fe';
const PUBLIC_IDS = new Set(['mini-hub-login-form', 'names-box', 'student-note-text', 'ses-reason']);
const PUBLIC_CLASSES = new Set(['input', 'textarea', 'select', 'first-run-auth__otp', 'btn', 'iconbtn', 'sheet']);
const PUBLIC_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BODY', 'DIV', 'BUTTON', 'A', 'HTML', 'SUMMARY']);
const number = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
const rect = node => {
  if (!node?.isConnected) return null;
  const r = node.getBoundingClientRect();
  return Object.fromEntries(['top', 'bottom', 'left', 'right', 'width', 'height'].map(key => [key, number(r[key])]));
};
const identity = node => node ? {
  tag: PUBLIC_TAGS.has(node.tagName) ? node.tagName : 'OTHER',
  id: !node.id ? '' : PUBLIC_IDS.has(node.id) ? node.id : '[redacted]',
  classes: [...node.classList].filter(name => PUBLIC_CLASSES.has(name)).slice(0, 6),
  otherClassesRedacted: [...node.classList].some(name => !PUBLIC_CLASSES.has(name)),
} : null;

export function installViewportDiagnostic() {
  if (new URLSearchParams(location.search).get('debugViewport') !== '1'
      || !(/^[a-z0-9-]+\.rakeezx\.pages\.dev$/.test(location.hostname)
        || ['localhost', '127.0.0.1'].includes(location.hostname))
      || document.querySelector('[data-viewport-diagnostic]')) return;
  const host = document.createElement('div');
  host.dataset.viewportDiagnostic = '';
  // The host must stay outside the inert app/modal tree and outside layout flow.
  host.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483646;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host { color-scheme:light; }
    * { box-sizing:border-box; }
    .panel { width:220px;max-width:calc(100vw - 16px);background:#fff;color:#142b38;border:1px solid #607b89;border-radius:8px;font:11px/1.35 system-ui;direction:rtl;pointer-events:auto; }
    button { font:12px system-ui;min-height:44px;border:0;background:#eef5f8;color:#142b38;cursor:pointer; }
    .toggle { width:100%;border-radius:8px;text-align:right;padding:4px 8px; }
    .live { display:block;direction:ltr;font:11px monospace; }
    pre { direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto;margin:0;padding:6px;font:10px/1.3 monospace; }
    .actions { display:flex;gap:1px; } .actions button { flex:1; }
    .status { padding:0 6px;font-size:10px; } [hidden] { display:none!important; }
    .safe-area { position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
  </style><section class="panel" aria-label="تشخيص العرض — تجريبي فقط">
    <button class="toggle" aria-expanded="false">تشخيص العرض — تجريبي فقط<span class="live"></span></button>
    <div class="details" hidden><pre aria-label="قيم التشخيص"></pre>
      <div class="actions"><button data-copy>نسخ بيانات التشخيص</button><button data-clear>مسح السجل</button></div>
      <div class="status" role="status" aria-live="polite"></div>
    </div></section><div class="safe-area" aria-hidden="true"></div>`;
  document.body.append(host);
  const toggle = shadow.querySelector('.toggle'), details = shadow.querySelector('.details');
  const display = shadow.querySelector('pre'), live = shadow.querySelector('.live');
  const status = shadow.querySelector('.status'), probe = shadow.querySelector('.safe-area');
  const vv = window.visualViewport, events = [];
  let dropped = 0, sequence = 0, frame, lastFocused = null;
  let sheets = new Set(), observedBody;
  const isControl = node => node?.matches?.('input:not([type=hidden]), textarea, select');
  const currentSheet = () => [...document.querySelectorAll('#modal-root .sheet')].at(-1);
  const snapshot = () => {
    const sheet = currentSheet(), body = sheet?.querySelector('.sheet__body');
    const head = sheet?.querySelector('.sheet__head'), foot = sheet?.querySelector('.sheet__foot');
    const active = document.activeElement, focused = isControl(active) ? active : lastFocused;
    const css = getComputedStyle(document.documentElement), safe = getComputedStyle(probe);
    const style = sheet ? getComputedStyle(sheet) : null;
    return {
      window: { innerWidth, innerHeight },
      document: { clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight },
      visualViewport: vv ? Object.fromEntries(['width', 'height', 'offsetTop', 'offsetLeft', 'pageTop', 'pageLeft', 'scale'].map(key => [key, number(vv[key])])) : null,
      active: identity(active), focusedControl: identity(focused?.isConnected ? focused : null),
      focusedInputRect: rect(focused), sheet: rect(sheet), header: rect(head),
      body: body ? { ...rect(body), scrollTop: number(body.scrollTop), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null,
      footer: rect(foot), primaryCTA: rect(foot?.querySelector('.btn--primary')),
      hasModal: document.body.classList.contains('has-modal'), scrollY: number(window.scrollY),
      orientation: { type: screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait'), angle: number(screen.orientation?.angle ?? window.orientation) },
      safeArea: Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map(side => [side.toLowerCase(), number(parseFloat(safe[`padding${side}`]))])),
      layout: { sheetPaddingTop: style?.paddingTop ?? null, sheetPaddingBottom: style?.paddingBottom ?? null, sheetMaxHeight: style?.maxHeight ?? null,
        headerMarginBottom: head ? getComputedStyle(head).marginBottom : null, footerMarginTop: foot ? getComputedStyle(foot).marginTop : null },
      css: { visibleHeight: css.getPropertyValue('--visible-viewport-height').trim(), visibleTop: css.getPropertyValue('--visible-viewport-top').trim() },
    };
  };
  const append = (event, phase = 'event') => {
    const record = { sequence: ++sequence, performanceMs: number(performance.now()), event, phase, ...snapshot() };
    events.push(record);
    if (events.length > LIMIT) { events.shift(); dropped++; }
    return record;
  };
  const paint = record => {
    const v = record.visualViewport;
    live.textContent = `h:${v?.height ?? record.window.innerHeight} top:${v?.offsetTop ?? 0} scale:${v?.scale ?? 'n/a'} · ${events.length}/${LIMIT}`;
    display.textContent = JSON.stringify(record, null, 2);
  };
  const record = event => {
    append(event);
    if (frame) return;
    // Event-time geometry and the subsequent layout frame are both retained.
    frame = requestAnimationFrame(() => { frame = null; paint(append('layout.frame', 'frame')); });
  };
  const listen = (target, event, label, options) => target?.addEventListener(event, ev => {
    if (ev.composedPath().includes(host)) return;
    if (event === 'focusin' && isControl(ev.target)) lastFocused = ev.target;
    record(label);
  }, options);
  listen(document, 'focusin', 'focusin'); listen(document, 'focusout', 'focusout');
  listen(vv, 'resize', 'visualViewport.resize'); listen(vv, 'scroll', 'visualViewport.scroll');
  listen(window, 'resize', 'window.resize'); listen(window, 'scroll', 'window.scroll', { passive: true });
  listen(window, 'orientationchange', 'orientationchange');
  listen(screen.orientation, 'change', 'orientationchange');
  listen(document, 'scroll', 'element.scroll', { capture: true, passive: true });
  const sizeObserver = window.ResizeObserver ? new ResizeObserver(() => record('sheet.resize')) : null;
  new MutationObserver(() => {
    const next = new Set(document.querySelectorAll('#modal-root .sheet'));
    for (const sheet of next) if (!sheets.has(sheet)) record('sheet.open');
    for (const sheet of sheets) if (!next.has(sheet)) record('sheet.close');
    sheets = next;
    const body = currentSheet()?.querySelector('.sheet__body');
    if (body !== observedBody) { sizeObserver?.disconnect(); observedBody = body; if (body) sizeObserver?.observe(body); }
  }).observe(document.getElementById('modal-root'), { childList: true, subtree: true });
  // Touching diagnostic buttons must not blur the email or dismiss its keyboard.
  shadow.addEventListener('pointerdown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });
  toggle.addEventListener('click', () => {
    details.hidden = !details.hidden; toggle.setAttribute('aria-expanded', String(!details.hidden));
    paint(events.at(-1) ?? append('display'));
  });
  shadow.querySelector('[data-copy]').addEventListener('click', async () => {
    const text = JSON.stringify({ ticket: 'N54-CODEX-IOS-INSTRUMENTED-DIAGNOSTIC-0411', baseSHA: BASE, limit: LIMIT, dropped, events }, null, 2);
    try { await navigator.clipboard.writeText(text); status.textContent = 'تم نسخ بيانات التشخيص'; }
    catch { status.textContent = 'تعذّر النسخ. اسمح بالنسخ ثم حاول مجددًا.'; }
  });
  shadow.querySelector('[data-clear]').addEventListener('click', () => {
    cancelAnimationFrame(frame); frame = null; events.length = 0; dropped = 0; sequence = 0;
    paint({ ...snapshot(), event: 'current' }); status.textContent = 'تم مسح السجل';
  });
  record('diagnostic.start');
}
