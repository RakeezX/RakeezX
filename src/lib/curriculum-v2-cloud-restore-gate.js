/**
 * Fail closed until V2 sidecars are represented by the N71 server manifest,
 * owner-scoped RLS, cloud Sync, and verified restore. Never strip sidecars.
 * This guard is intentionally read-only; it cannot activate Cloud writes.
 */
export const CURRICULUM_V2_UNSUPPORTED_CLOUD_STORES = Object.freeze([
  'sectionCurriculumScopes', 'teachingCourseBindings',
]);
const fail = () => Object.assign(
  new Error('Curriculum V2 cloud restore requires verified server migration and full-domain recovery'),
  { code: 'CURRICULUM_V2_CLOUD_RESTORE_NOT_READY' },
);
export function assertCurriculumV2CloudPayloadSupported(payload) {
  if (CURRICULUM_V2_UNSUPPORTED_CLOUD_STORES.some(
    (name) => Object.prototype.hasOwnProperty.call(payload?.data ?? {}, name) &&
      (!Array.isArray(payload.data[name]) || payload.data[name].length > 0)
  )) throw fail();
}
/** Check the installed local workspace too, so even an older backup cannot
 * replace legacy records underneath a newer, locally persisted V2 sidecar. */
export async function assertCurriculumV2CloudRestoreSupported(payload, database) {
  assertCurriculumV2CloudPayloadSupported(payload);
  for (const store of CURRICULUM_V2_UNSUPPORTED_CLOUD_STORES) {
    if ((await database.getAll(store)).length > 0) throw fail();
  }
}
