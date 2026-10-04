import { visibleLatinDigits } from './visible-numerals.js';

/** Presentation boundary for academic-year forms; stored years stay numbers. */
export function wireHijriYearInput(root) {
  const input = root.querySelector('[name="hijriStart"]');
  const normalize = () => {
    const start = input.selectionStart;
    const visible = visibleLatinDigits(input.value);
    if (visible !== input.value) {
      input.value = visible;
      if (start != null) input.setSelectionRange(start, start);
    }
    const year = Number(visible);
    input.setCustomValidity(visible && /^[0-9]{4}$/.test(visible) && (year < 1300 || year > 1600)
      ? 'أدخل سنة هجرية بين 1300 و1600' : '');
  };
  input.addEventListener('input', normalize);
  normalize();
  return () => {
    normalize();
    if (!input.reportValidity()) return null;
    const year = Number(input.value);
    return Number.isInteger(year) && year >= 1300 && year <= 1600 ? year : null;
  };
}
