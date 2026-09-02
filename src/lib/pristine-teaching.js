import { DEFAULT_ITEMS, makeItem } from '../models.js';

// Comparison includes all properties: unknown extensions are not silently lost.
export const samePristineRecord = (a, b) => a && b &&
  JSON.stringify(Object.keys(a).sort().map((key) => [key, a[key]])) ===
  JSON.stringify(Object.keys(b).sort().map((key) => [key, b[key]]));

const references = (value, ids) => {
  if (typeof value === 'string') return [...ids].some((id) => value.includes(id));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => references(key, ids) || references(child, ids));
};

/** Inspect current disk data, including tombstones; never infer pristine from timestamps alone. */
export function inspectPristineTeaching(current, teachingId) {
  const blocked = (reason) => ({ pristine: false, reason });
  const teaching = current.teachings.find((row) => row.id === teachingId);
  if (!teaching || teaching.deleted || String(teachingId).startsWith('demo:')) return blocked('missing-or-deleted-teaching');
  const entry = current.outbox.find((row) => row.id === `teachings:${teachingId}`);
  const proof = entry?.pristineTeachingCreation;
  if (proof?.version !== 1 || !Array.isArray(proof.items) || !proof.teaching) return blocked('creation-proof-missing');
  // Section reconciliation is the ONLY allowed change to the original teaching.
  if (!samePristineRecord(teaching, { ...proof.teaching, sectionId: teaching.sectionId })) return blocked('teaching-modified');
  const items = current.items.filter((row) => row.teachingId === teachingId);
  if (DEFAULT_ITEMS.length !== 5 || items.length !== 5 || proof.items.length !== 5 ||
      new Set(proof.items.map((row) => row.id)).size !== 5) return blocked('default-item-count');
  for (let index = 0; index < DEFAULT_ITEMS.length; index++) {
    const original = proof.items[index];
    const item = items.find((row) => row.id === original.id);
    const canonical = makeItem({ ...DEFAULT_ITEMS[index], id: original.id,
      updatedAt: original.updatedAt, teachingId, order: index });
    if (!samePristineRecord(original, canonical) || !samePristineRecord(item, original)) return blocked('default-item-modified');
  }
  const abandonedIds = new Set([teachingId, ...items.map((row) => row.id)]);
  const expectedEntries = new Set();
  for (const [name, records] of [['teachings', [teaching]], ['items', items]]) {
    for (const record of records) {
      const key = `${name}:${record.id}`;
      const pending = current.outbox.filter((row) => row.id === key);
      if (pending.length !== 1 || pending[0].store !== name || pending[0].recordId !== record.id ||
          pending[0].op !== 'put' || pending[0].fields !== null || pending[0].updatedAt !== record.updatedAt ||
          Object.keys(pending[0]).some((key) => !['id', 'store', 'recordId', 'op', 'fields', 'updatedAt', 'queuedAt',
            ...(name === 'teachings' ? ['pristineTeachingCreation'] : [])].includes(key))) return blocked('meaningful-or-missing-outbox-work');
      expectedEntries.add(key);
    }
  }
  for (const [name, records] of Object.entries(current)) {
    for (const record of records) {
      if (name === 'teachings' && record.id === teachingId) continue;
      if (name === 'items' && items.some((item) => item.id === record.id)) continue;
      if (name === 'outbox' && expectedEntries.has(record.id)) continue;
      // Covers direct teachingId, item scores, composite IDs, orphan outbox IDs,
      // Groups dictionary KEYS, deferred stores, and unknown extension references.
      if (references(record, abandonedIds)) return blocked(`linked-data:${name}`);
    }
  }
  return { pristine: true, teaching, itemIds: items.map((item) => item.id), outboxIds: [...expectedEntries] };
}

/** Used only to check a repeat call. Does not authorize initial adoption. */
export const hasTeachingReferences = (current, teachingId) => Object.entries(current).some(([name, records]) =>
  records.some((row) => !(name === 'teachings' && row.id === teachingId) && references(row, new Set([teachingId]))));

export function teachingReplacementHash(hash, fromId, toId) {
  try {
    const [path, query] = hash.replace(/^#/, '').split('?');
    const match = path.match(/^\/teaching\/([^/]+)(.*)$/);
    if (match && decodeURIComponent(match[1]) === fromId) {
      return `#/teaching/${encodeURIComponent(toId)}${match[2]}${query === undefined ? '' : `?${query}`}`;
    }
    if (path.startsWith('/student/') && query) {
      const params = new URLSearchParams(query);
      let changed = false;
      for (const key of ['cls', 'teaching']) if (params.get(key) === fromId) { params.set(key, toId); changed = true; }
      if (changed) return `#${path}?${params}`;
    }
  } catch { /* Invalid route text must not affect persistence. */ }
  return hash;
}
