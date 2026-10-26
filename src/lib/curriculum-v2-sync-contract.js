/**
 * V2 research SYNC contract: PURE, NEVER IMPORTED BY LIVE SYNC.
 * Real sync requires deployed owner-scoped schema, explicit migration,
 * RLS tests, owner/lease integration and backup/restore support.
 */
const fields=Object.freeze({
  scope:['id','owner_id','section_id','year_id','program_key','stage_key','level_key',
    'track_key','edition_key','edition_year_verified','source_url','review_status',
    'client_updated_at','device_id','deleted_at'],
  binding:['id','owner_id','section_id','section_scope_id','teaching_id','subject_id',
    'term_id','course_source_key','course_name','course_kind','source_page','source_url',
    'source_edition','edition_year_verified','review_status','client_updated_at',
    'device_id','deleted_at'],
});
const value=(v,key)=>{
  if(typeof v!=='string'||!v.trim())throw Error('V2_MISSING_'+key);
  return v;
};
const timestamp=(v)=>{
  if(!Number.isSafeInteger(v)||v<=0)throw Error('V2_INVALID_UPDATED_AT');
  return v;
};
const owner=(record,expected)=>{
  value(expected,'expectedOwner');
  if((record.ownerId??record.owner_id)!==expected)throw Error('V2_OWNER_CONTEXT_MISMATCH');
  return expected;
};
const encode=(...values)=>values.map(v=>v===null?'N':'V'+encodeURIComponent(String(v))).join('|');
const scopeKey=(s)=>encode(s.program,s.stage,s.level,s.track??null,s.edition);
const iso=(v)=>new Date(timestamp(v)).toISOString();
const clean=(obj,keys)=>Object.fromEntries(keys.map(k=>[k,obj[k]??null]));
// PostgreSQL drivers may return Date objects. Date.parse(Date) stringifies the
// object and silently loses milliseconds, causing false tombstone conflicts.
const normalizedDate=(v)=>v==null?null:iso(v instanceof Date?v.getTime():Date.parse(v));
function contextInput(src){
  return {
    id:value(src.id,'id'),ownerId:value(src.ownerId,'ownerId'),
    sectionId:value(src.sectionId,'sectionId'),yearId:value(src.yearId,'yearId'),
    program:value(src.program,'program'),stage:value(src.stage,'stage'),
    level:value(src.level,'level'),track:src.track??null,
    edition:value(src.edition,'edition'),updatedAt:timestamp(src.updatedAt),
    deleted:!!src.deleted,
  };
}
export function v2ScopeToCloud(src,expectedOwner,{deviceId='research-only',sourceUrl=null}={}){
  owner(src,expectedOwner);
  const x=contextInput(src);
  if(x.track!=null)value(x.track,'track');
  const row={
    id:x.id,owner_id:expectedOwner,section_id:x.sectionId,year_id:x.yearId,
    program_key:x.program,stage_key:x.stage,level_key:x.level,track_key:x.track,
    edition_key:x.edition,edition_year_verified:false,
    source_url:sourceUrl??src.sourceUrl??null,review_status:'draft',
    client_updated_at:x.updatedAt,device_id:value(deviceId,'deviceId'),
    deleted_at:x.deleted?(src.deletedAt??iso(x.updatedAt)):null
  };
  return clean(row,fields.scope);
}
export function v2ScopeFromCloud(row,expectedOwner){
  owner(row,expectedOwner);
  const x={
    id:value(row.id,'id'),ownerId:expectedOwner,sectionId:value(row.section_id,'sectionId'),
    yearId:value(row.year_id,'yearId'),program:value(row.program_key,'program'),
    stage:value(row.stage_key,'stage'),level:value(row.level_key,'level'),
    track:row.track_key??null,edition:value(row.edition_key,'edition'),
    sourceUrl:row.source_url??null,
    deleted:row.deleted_at!=null,deletedAt:normalizedDate(row.deleted_at),
    updatedAt:timestamp(Number(row.client_updated_at)),
    syncStatus:'research_adapter_only',sourceStatus:'edition_not_validated',
  };
  x.scopeKey=scopeKey(x);
  return x;
}
export function v2BindingToCloud(src,expectedOwner,{deviceId='research-only',sourcePage=null}={}){
  owner(src,expectedOwner);
  const x={
    id:value(src.id,'id'),sectionId:value(src.sectionId,'sectionId'),
    sectionScopeIdentity:value(src.sectionScopeIdentity,'sectionScopeIdentity'),
    teachingId:value(src.teachingId,'teachingId'),
    subjectId:value(src.subjectId,'subjectId'),termId:value(src.termId,'termId'),
    courseKey:value(src.courseKey,'courseKey'),
    name:value(src.name??src.courseName,'courseName'),
    kind:src.kind??'course',
    edition:value(src.edition,'edition'),
    updatedAt:timestamp(src.updatedAt)
  };
  if(!['course','learning_domain','enrichment','national_identity'].includes(x.kind))throw Error('V2_INVALID_COURSE_KIND');
  const page=sourcePage??src.sourcePage??(String(src.sourceUrl??'').match(/#page=(\d+)/)?.[1]??null);
  if(page!==null&&(!Number.isInteger(Number(page))||Number(page)<1))throw Error('V2_INVALID_SOURCE_PAGE');
  const row={
    id:x.id,owner_id:expectedOwner,section_id:x.sectionId,
    section_scope_id:x.sectionScopeIdentity,teaching_id:x.teachingId,
    subject_id:x.subjectId,term_id:x.termId,course_source_key:x.courseKey,
    course_name:x.name,course_kind:x.kind,source_page:page===null?null:Number(page),
    source_url:src.sourceUrl??null,
    source_edition:x.edition,edition_year_verified:false,
    review_status:'draft',client_updated_at:x.updatedAt,
    device_id:value(deviceId,'deviceId'),
    deleted_at:src.deleted?(src.deletedAt??iso(x.updatedAt)):null
  };
  return clean(row,fields.binding);
}
export function v2BindingFromCloud(row,expectedOwner){
  owner(row,expectedOwner);
  return {
    id:value(row.id,'id'),ownerId:expectedOwner,
    sectionId:value(row.section_id,'sectionId'),
    sectionScopeIdentity:value(row.section_scope_id,'sectionScopeIdentity'),
    teachingId:value(row.teaching_id,'teachingId'),
    subjectId:value(row.subject_id,'subjectId'),termId:value(row.term_id,'termId'),
    courseKey:value(row.course_source_key,'courseKey'),
    name:value(row.course_name,'courseName'),kind:row.course_kind??'course',
    edition:value(row.source_edition,'edition'),
    sourceUrl:row.source_url??null,sourcePage:row.source_page??null,
    deleted:row.deleted_at!=null,deletedAt:normalizedDate(row.deleted_at),
    updatedAt:timestamp(Number(row.client_updated_at)),
    syncStatus:'research_adapter_only'
  };
}
const immutable=Object.freeze({
  scope:['id','ownerId','sectionId','yearId','scopeKey','program','stage','level','track','edition'],
  binding:['id','ownerId','sectionId','sectionScopeIdentity','teachingId',
    'subjectId','termId','courseKey','kind','edition'],
});
/**
 * Explicitly refuses owner identity changes, source identity changes, and
 * tombstone resurrection. Other updates only use LWW after immutable check.
 * The real Product Sync has additional marker/outbox/lease rules.
 */
export function reconcileV2Research(local,remote,{kind,expectedOwner}){
  if(!immutable[kind])throw Error('V2_UNKNOWN_RECORD_KIND');
  owner(local,expectedOwner);owner(remote,expectedOwner);
  for(const key of immutable[kind]){
    if((local[key]??null)!==(remote[key]??null))
      return {status:'conflict',reason:'immutable_'+key,accepted:null};
  }
  const l=timestamp(local.updatedAt),r=timestamp(remote.updatedAt);
  if(Boolean(local.deleted)!==Boolean(remote.deleted)){
    if(remote.deleted&&r>l)return {status:'remote_tombstone',accepted:remote};
    if(local.deleted&&l>r)return {status:'local_tombstone',accepted:local};
    return {status:'conflict',reason:'tombstone_resurrection_requires_review',accepted:null};
  }
  if(l===r){
    const localSafe={...local,deletedAt:local.deletedAt??null};
    const remoteSafe={...remote,deletedAt:remote.deletedAt??null};
    const fieldsToCompare=['deleted','deletedAt','name','reviewStatus','sourceUrl'];
    if(fieldsToCompare.some(k=>String(localSafe[k]??'')!==String(remoteSafe[k]??'')))
      return {status:'conflict',reason:'same_revision_different_values',accepted:null};
    return {status:'equal',accepted:local};
  }
  if(r>l) return {status:'remote_newer',accepted:remote};
  if(local.deleted&&r<l) return {status:'local_tombstone',accepted:local};
  return {status:'local_newer',accepted:local};
}
export const V2_SYNC_RESEARCH_FIELDS=fields;
