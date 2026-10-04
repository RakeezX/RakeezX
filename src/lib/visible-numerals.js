/** Convert Arabic-Indic and Eastern Arabic-Indic numerals in presentation text. */
export function visibleLatinDigits(value) {
  return String(value ?? '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
  });
}
