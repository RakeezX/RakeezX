/** Convert Arabic-Indic and Eastern Arabic-Indic numerals in presentation text. */
export function visibleLatinDigits(value) {
  return String(value ?? '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
  });
}

/** Keep numeric form values and bounds while avoiding locale-shaped native number widgets. */
export function wireVisibleNumberInputs(root) {
  root.querySelectorAll('input[type="number"]').forEach((input) => {
    const min = input.hasAttribute('min') ? Number(input.min) : -Infinity;
    const max = input.hasAttribute('max') ? Number(input.max) : Infinity;
    const step = input.getAttribute('step') ?? '1';
    input.type = 'text';
    input.inputMode ||= step && Number(step) < 1 ? 'decimal' : 'numeric';
    input.dir = 'ltr';
    const normalize = () => {
      const start = input.selectionStart;
      const visible = visibleLatinDigits(input.value);
      if (visible !== input.value) {
        input.value = visible;
        if (start != null) input.setSelectionRange(start, start);
      }
      const value = Number(visible);
      const valid = !visible || (/^(?:\d+)(?:\.\d+)?$/.test(visible)
        && value >= min && value <= max
        && (!step || step === 'any' || !Number.isFinite(Number(step))
          || Math.abs((value - (Number.isFinite(min) ? min : 0)) / Number(step)
            - Math.round((value - (Number.isFinite(min) ? min : 0)) / Number(step))) < 1e-8));
      input.setCustomValidity(valid ? '' : 'أدخل رقمًا صحيحًا ضمن الحدود المحددة');
    };
    input.addEventListener('input', normalize);
    normalize();
  });
}
