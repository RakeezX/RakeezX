import flatpickr from 'flatpickr';
import { Arabic } from 'flatpickr/dist/l10n/ar.js';
import { normalizeDateTimeDigits, validDateTimeValue } from './rakeez-datetime-values.js';

const locale = { ...Arabic, firstDayOfWeek: 0 };
const selector = 'input[data-rakeez-datetime]';
const instances = new Map();

export function mountDateTimeControl(input) {
  if (instances.has(input)) return instances.get(input);
  const kind = input.dataset.rakeezDatetime;
  if (kind !== 'date' && kind !== 'time') throw new Error(`Unsupported RAKEEZ date/time kind: ${kind}`);
  const min = input.getAttribute('min') || '';
  const max = input.getAttribute('max') || '';
  const current = input.value;
  input.type = 'text';
  input.value = current;
  input.lang = 'en';
  input.dir = 'ltr';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.classList.add('rakeez-datetime');
  input.classList.add(`rakeez-datetime--${kind}`);

  const validate = () => {
    const value = normalizeDateTimeDigits(input.value);
    input.setCustomValidity(validDateTimeValue(value, kind, min, max) ? '' :
      kind === 'date' ? 'أدخل تاريخًا صحيحًا ضمن النطاق المحدد بصيغة YYYY-MM-DD' : 'أدخل وقتًا صحيحًا بصيغة HH:mm');
  };
  input.addEventListener('input', () => {
    const before = input.value;
    const after = normalizeDateTimeDigits(before);
    if (before !== after) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = after;
      input.setSelectionRange(start, end);
    }
    validate();
  });
  input.addEventListener('change', (event) => {
    validate();
    if (!input.checkValidity()) event.stopPropagation();
  });
  input.addEventListener('blur', validate);
  const picker = flatpickr(input, {
    locale,
    dateFormat: kind === 'date' ? 'Y-m-d' : 'H:i',
    enableTime: kind === 'time',
    noCalendar: kind === 'time',
    time_24hr: true,
    minuteIncrement: 1,
    allowInput: true,
    disableMobile: true,
    clickOpens: true,
    minDate: kind === 'date' && min ? min : undefined,
    maxDate: kind === 'date' && max ? max : undefined,
    minTime: kind === 'time' && min ? min : undefined,
    maxTime: kind === 'time' && max ? max : undefined,
    onReady: (_, __, instance) => {
      instance.calendarContainer.dir = 'rtl';
      instance.calendarContainer.lang = 'ar';
    },
    onChange: () => validate(),
  });
  input.value = current;
  validate();
  instances.set(input, picker);
  return picker;
}

export function mountDateTimeControls(root) {
  if (root.matches?.(selector)) mountDateTimeControl(root);
  root.querySelectorAll?.(selector).forEach(mountDateTimeControl);
}

// Views and sheets are rendered by separate owners. Observe only marked controls,
// including those inserted by a later repaint, and release removed picker instances.
export function startDateTimeAdapter() {
  if (typeof document === 'undefined' || !document.body || startDateTimeAdapter.started) return;
  startDateTimeAdapter.started = true;
  mountDateTimeControls(document.body);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1) mountDateTimeControls(node);
    }
    for (const [input, picker] of instances) if (!input.isConnected) {
      picker.destroy();
      instances.delete(input);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDateTimeAdapter, { once: true });
  else startDateTimeAdapter();
}
