/** Presentation only; never writes the stored profile name. */
function nameTokens(value) {
  return String(value ?? '').trim().split(/\s+/u).filter(Boolean);
}

export function firstName(value) {
  return nameTokens(value)[0] ?? '';
}

export function displayIdentity(value, fallback = 'المعلم') {
  const tokens = nameTokens(value);
  if (!tokens.length) return { display: fallback, initials: 'م' };
  const first = tokens[0], last = tokens.at(-1);
  return {
    display: tokens.length === 1 ? first : `${first} ${last}`,
    initials: tokens.length === 1 ? Array.from(first)[0] : `${Array.from(first)[0]} ${Array.from(last)[0]}`,
  };
}

export function effectiveTheme(preference, systemDark = false) {
  return preference === 'dark' || (preference !== 'light' && systemDark) ? 'dark' : 'light';
}
