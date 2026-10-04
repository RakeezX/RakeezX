import { html, raw, openSheet } from './dom.js';
import { APP_ICON_URL } from './brand.js';

const DEVICES = { ios: 'iPhone / iPad', android: 'Android', windows: 'Windows', mac: 'Mac' };

export function installContext({ ua = '', platform = '', touch = 0, standalone = false, prompt = false } = {}) {
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1);
  const device = ios ? 'ios' : /Android/i.test(ua) ? 'android' : /Win/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'mac' : null;
  const browser = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) && !/CriOS|FxiOS/.test(ua) ? 'safari' : null;
  const manual = (ios && browser === 'safari') || (device === 'android' && browser === 'chrome') ||
    (device === 'windows' && ['chrome', 'edge'].includes(browser)) || (device === 'mac' && browser === 'safari');
  return { device, browser, state: standalone ? 'standalone' : prompt && !ios && browser !== 'safari' ? 'native' : manual ? 'manual' : 'limited' };
}

export function currentInstallContext() {
  return installContext({ ua: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints,
    prompt: !!window.deferredInstallPrompt,
    standalone: !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true || document.referrer?.includes('android-app://')) });
}

export const INSTALL_COPY = {
  native: ['تثبيت ركيز على جهازك', 'سيكمل المتصفح عملية التثبيت.'],
  manual: ['تثبيت ركيز على جهازك', 'إرشادات واضحة خطوة بخطوة لجهازك.'],
  standalone: ['ركيز يعمل كتطبيق مستقل', 'ركيز يعمل كتطبيق مستقل على هذا الجهاز.'],
  limited: ['افتح ركيز في متصفح يدعم التثبيت', 'تقدر تواصل استخدام ركيز من المتصفح، أو تختار جهازك لمعرفة طريقة التثبيت.'],
};

export function installSteps(device, browser = 'edge') {
  if (device === 'ios') return [
    ['افتح المشاركة', 'في سفاري، افتح المشاركة من شريط الأدوات أو قائمة الصفحة.', 'toolbar', 'زر المشاركة'],
    ['أضف إلى الشاشة الرئيسية', 'اختر «إضافة إلى الشاشة الرئيسية» من قائمة المشاركة.', 'menu', 'إضافة إلى الشاشة الرئيسية'],
    ['أكّد الإضافة', 'إذا ظهر خيار «فتح كتطبيق ويب»، فعّله ثم اضغط «إضافة».', 'confirm', 'إضافة'],
  ];
  if (device === 'android') return [
    ['افتح قائمة كروم', 'اضغط قائمة النقاط الثلاث بجانب شريط العنوان.', 'toolbar', 'قائمة النقاط الثلاث'],
    ['اختر التثبيت', 'اختر «التثبيت وإنشاء اختصار»، ثم «تثبيت».', 'chain', 'التثبيت وإنشاء اختصار ← تثبيت'],
    ['أكّد التثبيت', 'اتبع تأكيد المتصفح واضغط «تثبيت» عند ظهوره.', 'confirm', 'تثبيت'],
  ];
  if (device === 'mac') return [
    ['افتح قائمة ملف', 'في سفاري على macOS Sonoma 14 أو أحدث، افتح «ملف».', 'macbar', 'ملف'],
    ['أضف إلى Dock', 'اختر «إضافة إلى Dock».', 'menu', 'إضافة إلى Dock'],
    ['أكّد الإضافة', 'راجع اسم ركيز ثم اضغط «إضافة».', 'confirm', 'إضافة'],
  ];
  if (device !== 'windows') return [];
  return browser === 'chrome' ? [
    ['افتح قائمة كروم', 'اضغط قائمة النقاط الثلاث في أعلى المتصفح.', 'toolbar', 'قائمة النقاط الثلاث'],
    ['اختر تثبيت الصفحة', 'اختر «بثّ وحفظ ومشاركة»، ثم «تثبيت الصفحة كتطبيق».', 'chain', 'بثّ وحفظ ومشاركة ← تثبيت الصفحة كتطبيق'],
    ['أكّد التثبيت', 'راجع اسم ركيز وأكّد التثبيت من نافذة المتصفح.', 'confirm', 'تثبيت'],
  ] : [
    ['افتح قائمة إيدج', 'اضغط قائمة النقاط الثلاث في أعلى المتصفح.', 'toolbar', 'قائمة النقاط الثلاث'],
    ['اختر تثبيت الموقع', 'اختر «المزيد من الأدوات»، ثم «التطبيقات»، ثم «تثبيت هذا الموقع كتطبيق».', 'chain', 'المزيد من الأدوات ← التطبيقات ← تثبيت هذا الموقع كتطبيق'],
    ['أكّد التثبيت', 'راجع اسم ركيز واضغط «تثبيت» في تأكيد المتصفح.', 'confirm', 'تثبيت'],
  ];
}

const symbols = { share: 'M12 15V3m-4 4 4-4 4 4M5 10v11h14V10', more: 'M12 5h.01M12 12h.01M12 19h.01', edge: 'M5 12h.01M12 12h.01M19 12h.01' };
const svg = (key) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${symbols[key] || symbols.more}"/></svg>`);
const mark = () => html`<img src="${APP_ICON_URL}" alt="" class="app-mark">`;

// Schematic browser controls are illustrations, not interactive or a second source of instructions.
function diagram(kind, label, device, browser) {
  let content;
  if (kind === 'toolbar') content = html`
    <div class="mock-page">${mark()}<span>ركيز المعلم</span><i></i><i></i></div>
    <div class="mock-toolbar ${device === 'ios' ? 'at-bottom' : ''}"><span>ركيز</span><span class="target icon-target">${svg(device === 'ios' ? 'share' : browser === 'edge' ? 'edge' : 'more')}</span></div>
    <span class="target-caption">${label}</span>`;
  else if (kind === 'chain') content = html`<div class="mock-menu">${label.split(' ← ').map(text => html`<div class="target chain-row">${text}</div>`)}</div>`;
  else if (kind === 'menu' || kind === 'macbar') content = html`${kind === 'macbar' ? html`<div class="mac-menu-bar">Safari · <strong>ملف</strong></div>` : ''}<div class="mock-menu"><div>خيارات أخرى</div><div class="target">${kind === 'macbar' ? 'إضافة إلى Dock' : label}</div></div>`;
  else content = html`<div class="mock-confirm"><div class="confirm-brand">${mark()}<strong>ركيز المعلم</strong></div>${device === 'ios' ? html`<div class="web-app-switch">فتح كتطبيق ويب <span class="target">✓</span></div>` : ''}<div class="mock-confirm-actions"><span>إلغاء</span><strong class="target">${label}</strong></div></div>`;
  return html`<div class="schematic" aria-hidden="true">${content}</div>`;
}

export function openInstallGuide(onNative) {
  let context = currentInstallContext();
  let device = context.device;
  let browser = context.browser === 'chrome' ? 'chrome' : 'edge';
  return openSheet({ title: INSTALL_COPY[context.state][0], body: html`<div data-install-content></div>`, onMount(root) {
    root.querySelector('.sheet').classList.add('n43-install-guide');
    const body = root.querySelector('[data-install-content]');
    function render() {
      const expanded = body.querySelector('.device-switch')?.open === true;
      const switcher = html`<details class="device-switch" ${expanded ? 'open' : ''}><summary tabindex="0">جهازك مختلف؟</summary><div class="device-options" role="group" aria-label="اختيار الجهاز">${Object.entries(DEVICES).map(([key, label]) => html`<button class="btn btn--quiet" type="button" data-device="${key}" aria-pressed="${device === key ? 'true' : 'false'}">${label}</button>`)}</div></details>`;
      const state = context.state;
      root.querySelector('.sheet__head h2, .sheet__title').textContent = INSTALL_COPY[state][0];
      body.innerHTML = (state === 'standalone' ? html`<p>${INSTALL_COPY[state][1]}</p>` : state === 'native' ? html`
        <p>${INSTALL_COPY[state][1]}</p><button class="btn btn--primary" type="button" data-native>تثبيت ركيز</button>${switcher}` : state === 'limited' ? html`
        <p>${INSTALL_COPY[state][1]}</p><button class="btn btn--primary" type="button" data-choose-device>اختر جهازك</button>${switcher}` : html`
        <div class="guide-context"><span>${DEVICES[device]} · ${device === 'ios' || device === 'mac' ? 'سفاري' : device === 'android' ? 'كروم' : browser === 'edge' ? 'إيدج' : 'كروم'}</span>
          ${device === 'windows' ? html`<label>المتصفح <select class="input" data-browser><option value="edge" ${browser === 'edge' ? 'selected' : ''}>إيدج</option><option value="chrome" ${browser === 'chrome' ? 'selected' : ''}>كروم</option></select></label>` : ''}</div>
      <ol class="visual-cards" role="list">${installSteps(device, browser).map(([heading, text, kind, label], index) => html`<li class="visual-step"><div class="step-title"><span class="step-number" aria-hidden="true">${index + 1}</span><h3>${heading}</h3></div>${diagram(kind, label, device, browser)}<p>${text}</p></li>`)}</ol>
        <p class="schematic-note">رسوم توضيحية؛ قد يختلف موضع الأزرار وأسماء الخيارات حسب إصدار المتصفح.</p>
        ${device === 'ios' ? html`<p class="small-hint">على آيباد قد يظهر ضمن «عرض المزيد»؛ وإذا غاب، ابحث عنه ضمن «تعديل الإجراءات».</p>` : device === 'android' ? html`<p class="small-hint">قد يظهر خيار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» في إصدارات أخرى.</p>` : ''}${switcher}`).value;
    }
    body.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-native')) { onNative(); return; }
      if (button.hasAttribute('data-choose-device')) { const details = body.querySelector('details'); details.open = true; details.querySelector('button').focus(); return; }
      if (DEVICES[button.dataset.device]) {
        device = button.dataset.device; context = { ...context, state: 'manual' }; render();
        const details = body.querySelector('details'); details.open = true;
        details.querySelector(`[data-device="${device}"]`).focus();
      }
    });
    body.addEventListener('change', event => { if (event.target.matches('[data-browser]')) { browser = event.target.value; render(); body.querySelector('[data-browser]').focus(); } });
    render();
  } });
}
