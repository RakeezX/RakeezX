// AI: inert server-only policy contract. No persistence, grants or activation.
export const VISIBILITY_FIELDS = Object.freeze(['name', 'class', 'grades', 'required', 'completed', 'scheduled']);
export const VISIBILITY_VERSION = 'n88-visibility-v1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 300;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);

/** Validate trusted teacher-authored policy; reject unknown fields rather than
 * passing them through. Missing enabled fields mean OFF. Never accept from a
 * student request. Scope/source stamps are computed by the current locked reader.
 */
export function validateVisibilityPolicy(policy) {
  const fail = () => { throw new TypeError('n88_visibility_invalid'); };
  if (!exact(policy, ['version', 'ownerId', 'studentId', 'enrollmentId', 'classId', 'termId', 'scopeStamp', 'fields', 'sources']) ||
      policy.version !== VISIBILITY_VERSION || !hash(policy.scopeStamp) ||
      !['ownerId', 'studentId', 'enrollmentId', 'classId', 'termId'].every(key => text(policy[key])) ||
      !exact(policy.fields, VISIBILITY_FIELDS) || Object.values(policy.fields).some(value => typeof value !== 'boolean') ||
      !Array.isArray(policy.sources) || policy.sources.length > 2000) fail();
  const ids = new Set(), sources = new Set();
  for (const source of policy.sources) {
    if (!exact(source, ['kind', 'sourceId', 'publicationId', 'stamp']) ||
        !['item', 'subitem'].includes(source.kind) || !text(source.sourceId) || !uuid(source.publicationId) || !hash(source.stamp)) fail();
    const key = JSON.stringify([source.kind, source.sourceId]);
    if (ids.has(source.publicationId) || sources.has(key)) fail();
    ids.add(source.publicationId); sources.add(key);
  }
  return structuredClone(policy);
}
