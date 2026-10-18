/** Private in-process capability. Never serialize/export this through HTTP.
 * Issue ONLY after repository.atomic has resolved its durable sending commit. */
const permits = new WeakSet();
export function issueCommittedPermit(value) {
  const copy = structuredClone(value);
  Object.freeze(copy.payload); if(copy.binding)Object.freeze(copy.binding); Object.freeze(copy);
  permits.add(copy); return copy;
}
export function consumeCommittedPermit(value) {
  if (!value || !permits.has(value)) return false;
  permits.delete(value); return true;
}
