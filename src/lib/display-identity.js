/** Presentation only; never writes the stored profile name. */
export function displayIdentity(value, fallback = 'المعلم') {
  const tokens = String(value ?? '').trim().split(/\s+/u).filter(Boolean);
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
