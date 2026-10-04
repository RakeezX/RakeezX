import '../vendor/flatpickr/flatpickr.min.js';
import '../vendor/flatpickr/ar.js';
import { dateControlBounds, normalizeDateTimeDigits, validDateTimeValue } from './rakeez-datetime-values.js';

const flatpickr = globalThis.flatpickr;
const Arabic = flatpickr.l10ns.ar;
const locale = { ...Arabic, firstDayOfWeek: 0, amPM: ['صباحًا', 'مساءً'] };
const selector = 'input[data-rakeez-datetime]';
const instances = new Map();

function useAsciiPickerNumerals(element) {
  element.lang = 'en';
  element.dir = 'ltr';
  if (element.matches('input')) element.inputMode = 'numeric';
}

function syncVisibleYears(instance, bounds) {
  const container = instance.calendarContainer;
  const yearInput = container.querySelector('.numInput.cur-year');
  const wrapper = yearInput?.closest('.numInputWrapper');
  if (!wrapper) throw new Error('RAKEEZ year control is missing');
  wrapper.classList.add('rakeez-year-input-hidden');
  wrapper.setAttribute('aria-hidden', 'true');
  let select = container.querySelector('.rakeez-year-select');
  if (!select) {
    select = document.createElement('select');
    select.className = 'rakeez-year-select';
    select.setAttribute('aria-label', 'السنة');
    select.lang = 'en';
    select.dir = 'ltr';
    wrapper.after(select);
    select.addEventListener('change', () => instance.changeYear(Number(select.value)));
  }
  const visible = bounds.years.map(String);
  if ([...select.options].map((option) => option.value).join(',') !== visible.join(',')) {
    select.replaceChildren(...visible.map((year) => new Option(year, year)));
  }
  select.disabled = !visible.length;
  if (visible.length && !visible.includes(String(instance.currentYear))) instance.jumpToDate(bounds.min);
  select.value = visible.includes(String(instance.currentYear)) ? String(instance.currentYear) : visible[0] ?? '';
}

export function mountDateTimeControl(input) {
  if (instances.has(input)) return instances.get(input);
  const kind = input.dataset.rakeezDatetime;
  if (kind !== 'date' && kind !== 'time') throw new Error(`Unsupported RAKEEZ date/time kind: ${kind}`);
  const declaredMin = input.getAttribute('min') || '';
  const declaredMax = input.getAttribute('max') || '';
  const scope = kind === 'date' ? input.dataset.rakeezDateScope : '';
  let bounds = kind === 'date' ? dateControlBounds(scope, declaredMin, declaredMax) : null;
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
    const range = kind === 'date' ? dateControlBounds(scope, declaredMin, declaredMax) : null;
    input.setCustomValidity(validDateTimeValue(value, kind, range?.min ?? declaredMin, range?.max ?? declaredMax) ? '' :
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
    time_24hr: false,
    minuteIncrement: 1,
    allowInput: true,
    disableMobile: true,
    clickOpens: true,
    minDate: kind === 'date' ? bounds.min : undefined,
    maxDate: kind === 'date' ? bounds.max || undefined : undefined,
    minTime: kind === 'time' && declaredMin ? declaredMin : undefined,
    maxTime: kind === 'time' && declaredMax ? declaredMax : undefined,
    onReady: (_, __, instance) => {
      instance.calendarContainer.dir = 'rtl';
      instance.calendarContainer.lang = 'ar';
      instance.calendarContainer.querySelectorAll('.numInput, .flatpickr-day').forEach(useAsciiPickerNumerals);
      if (kind === 'date') syncVisibleYears(instance, bounds);
      // Normalize edits before flatpickr reads a numeric subcontrol's input event.
      instance.calendarContainer.addEventListener('input', (event) => {
        if (event.target.matches('.numInput')) {
          event.target.value = normalizeDateTimeDigits(event.target.value);
        }
      }, true);
    },
    onDayCreate: (_, __, ___, day) => useAsciiPickerNumerals(day),
    onOpen: (_, __, instance) => {
      if (kind !== 'date') return;
      const next = dateControlBounds(scope, declaredMin, declaredMax);
      if (next.min !== bounds.min || next.max !== bounds.max) {
        bounds = next;
        instance.set('minDate', bounds.min);
        instance.set('maxDate', bounds.max || undefined);
      }
      syncVisibleYears(instance, bounds);
      validate();
    },
    onYearChange: (_, __, instance) => {
      if (kind === 'date') syncVisibleYears(instance, bounds);
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
