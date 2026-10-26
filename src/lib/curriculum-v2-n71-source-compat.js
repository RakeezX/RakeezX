/**
 * N71 V2 RESEARCH ONLY: distinguish genuinely shaped full-domain V5 backups
 * from older V5 files that predate the two V2 sidecar stores.
 *
 * A SHA-256 checksum proves internal integrity, NOT source authenticity.
 * Never silently fill absent V2 stores with [] and then claim full recovery.
 */
export const N71_V2_SIDECAR_STORES=Object.freeze([
  'sectionCurriculumScopes','teachingCourseBindings',
]);

export function classifyN71V2SourceCompleteness(payload){
  const result=(status,reason)=>Object.freeze({
    status,reason,
    requiresSameOwnerRecovery:true,
    shapeEligibleForV2Planning:status==='full_v2_backup',
    curriculumCompletenessProven:status==='full_v2_backup',
    requiresLegacySourceReview:status==='legacy_v5_review_required',
    canCommit:false,productionEligible:false,
    serverSidecarsMustBePreserved:true,
  });
  if(!payload || payload.version!==5 ||
    !payload.data||typeof payload.data!=='object'||Array.isArray(payload.data)||
    !payload.baselines||typeof payload.baselines!=='object')
    return result('unsupported','missing_or_non_v5_backup');
  const data=N71_V2_SIDECAR_STORES.map(name=>Object.hasOwn(payload.data,name));
  const baselines=N71_V2_SIDECAR_STORES.map(name=>Object.hasOwn(payload.baselines,name));
  if(data.every(x=>x===true)&&baselines.every(x=>x===true)&&
     N71_V2_SIDECAR_STORES.every(name=>
       Array.isArray(payload.data[name])&&Array.isArray(payload.baselines[name])))
    return result('full_v2_backup','complete_explicit_sidecar_arrays');
  if(data.every(x=>x===false)&&baselines.every(x=>x===false))
    return result('legacy_v5_review_required',
      'sidecars_absent_legacy_export_cannot_prove_v2_completeness');
  return result('partial_v2_invalid','one_or_more_sidecars_or_baselines_missing');
}
