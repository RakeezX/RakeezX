// AI: names-only boundary shared verbatim with the private MV3 package.
export const HANDOFF_TTL = 120000;
export const APP_ORIGIN = 'https://rakeezx.com';
export function handoffRoute(extensionId, nonce) {
  if (!/^[a-p]{32}$/.test(extensionId) || !/^[a-f0-9]{64}$/.test(nonce)) throw Error('HANDOFF_KEY');
  return '#/classes/koshoof?import=1&extension=' + extensionId + '&handoff=' + nonce;
}
export function validateHandoff(value, now = Date.now()) {
  const keys = (o, expected) => {
    if (!o || Object.getPrototypeOf(o) !== Object.prototype || Object.keys(o).sort().join() !== [...expected].sort().join()) throw Error('HANDOFF_SCHEMA');
  };
  keys(value, ['schema','version','source','scope','createdAt','expiresAt','rows']);
  if (value.schema !== 'rakeez-extension-names' || value.version !== 1 ||
      !['madrasati','noor'].includes(value.source) ||
      value.scope !== (value.source === 'noor' ? 'selected-visible-partial' : 'reviewed-run') ||
      !Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.expiresAt) ||
      value.createdAt > now + 5000 || value.expiresAt <= now || value.expiresAt - value.createdAt !== HANDOFF_TTL ||
      !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 300 ||
      new TextEncoder().encode(JSON.stringify(value)).length > 100000) throw Error('HANDOFF_LIMIT_OR_EXPIRED');
  const seen = new Set();
  const rows = value.rows.map(row => {
    keys(row, ['name','classroom']);
    for (const field of ['name','classroom']) {
      const v = row[field];
      if (typeof v !== 'string' || v !== v.normalize('NFC').trim().replace(/\s+/g, ' ') || v.length < 2 || v.length > 80 ||
          !(field === 'name' ? /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u : /^[\p{L}\p{M}0-9 ()-]+$/u).test(v) ||
          !/[\p{L}]/u.test(v)) throw Error('HANDOFF_VALUE');
    }
    const key = [row.classroom,row.name].map(v=>v.replace(/[\s\u0640\u064B-\u065F\u0670]/g,'').toLowerCase()).join('|');
    if (seen.has(key)) throw Error('HANDOFF_DUPLICATE');
    seen.add(key); return { name:row.name, classroom:row.classroom };
  });
  return { ...value, rows };
}
export function handoffBundle(value, now = Date.now()) {
  const e = validateHandoff(value, now);
  return {schema:'rakeez-private-teacher-setup',version:1,categories:[{
    category:'students', provenance:[e.source === 'noor' ? 'selected-visible' : 'teacher-readonly-run'], rows:e.rows,
  }]};
}
