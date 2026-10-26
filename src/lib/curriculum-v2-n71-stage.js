/**
 * N71 V2 RESEARCH ONLY: read-only planner. The live N71 gate remains active.
 * No actual provider receipt, migration, restore or write is supported.
 */
import {PORTABLE_CLOUD_RESTORE_STORES} from './backup-v2.js';
import {validateBackupIntegrity,sha256Hex} from './export.js';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding} from './curriculum-context-v2.js';
import {deletionScope} from './restore-deletion-scope.js';
import {assertScoreSnapshotInvariant} from './initial-restore.js';
import {assertN71V2ReferenceGraph} from './curriculum-v2-n71-reference-guard.js';
import {classifyN71V2SourceCompleteness} from './curriculum-v2-n71-source-compat.js';

export const N71_V2_RESEARCH_PROTOCOL='N71_V2_RESEARCH_ONLY';
const SIDECARS=['sectionCurriculumScopes','teachingCourseBindings'];
const ORDER=[...PORTABLE_CLOUD_RESTORE_STORES];
ORDER.splice(ORDER.indexOf('sections')+1,0,SIDECARS[0]);
ORDER.splice(ORDER.indexOf('teachings')+1,0,SIDECARS[1]);
export const N71_V2_RESEARCH_STORES=Object.freeze(ORDER);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const one=(rows,id)=>rows.find(r=>r.id===id);
const validTime=r=>Number.isSafeInteger(r.updatedAt)&&r.updatedAt>0&&
  (r.serverRevision==null || Number.isSafeInteger(r.serverRevision)&&r.serverRevision>=1)&&
  (r.deleted===true
    ? Number.isSafeInteger(Date.parse(r.deletedAt))&&Date.parse(r.deletedAt)===r.updatedAt
    : r.deletedAt==null);
const identity=(r,name)=>name===SIDECARS[0]
  ? [r.id,r.ownerId,r.sectionId,r.yearId,r.scopeKey,r.program,r.stage,
     r.level,r.track??null,r.edition,r.sourceUrl??null,r.deleted===true]
  : [r.id,r.ownerId,r.sectionId,r.sectionScopeIdentity,r.teachingId,r.subjectId,
     r.termId,r.courseKey,r.name,r.kind,r.edition,r.sourceUrl??null,r.deleted===true];
function requireComplete(data,prefix){
  need(data && typeof data==='object'&&!Array.isArray(data),prefix+'_SNAPSHOT_MISSING');
  for(const name of ORDER){
    const rows=data[name];
    need(Array.isArray(rows),prefix+'_STORE_MISSING:'+name);
    need(rows.length<=100000,prefix+'_STORE_OVER_LIMIT:'+name);
    need(rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&
      typeof r.id==='string'&&r.id.length>0),prefix+'_ROW_INVALID:'+name);
    need(new Set(rows.map(r=>r.id)).size===rows.length,prefix+'_DUPLICATE:'+name);
  }
}
export async function planN71V2ResearchRestore({
  payload,serverData,ownerId,ownerHistoryRevision,verifiedProvider=false,
}={}){
  // This Boolean denotes ONLY a synthetic test channel, not real provider Auth.
  need(verifiedProvider===true,'N71_V2_SIMULATION_PROVIDER_REQUIRED');
  need(typeof ownerId==='string'&&ownerId,'N71_V2_OWNER_REQUIRED');
  const integrity=await validateBackupIntegrity(payload);
  need(integrity.ok&&integrity.integrity==='verified'&&payload.version===5,
    'N71_V2_BACKUP_INTEGRITY_INVALID');
  need(payload.sourceOwnerId===ownerId,'N71_V2_BACKUP_OWNER_MISMATCH');
  const sourceCompatibility=classifyN71V2SourceCompleteness(payload);
  // Old V5 backups may legitimately lack the new stores. They must not be
  // misrepresented as a complete V2 backup by adding empty arrays silently.
  // Classify separately for a future explicit same-owner compatibility path.
  if(sourceCompatibility.status==='legacy_v5_review_required')
    fail('N71_V2_LEGACY_V5_NOT_SILENTLY_COMPLETE');
  const backup=payload.data,cloud=serverData;
  requireComplete(backup,'N71_V2_BACKUP');
  requireComplete(cloud,'N71_V2_SERVER');
  need(SIDECARS.every(n=>Array.isArray(payload.baselines?.[n])),
    'N71_V2_BASELINES_MISSING');
  for(const name of ORDER)
    need([...backup[name],...cloud[name]].every(r=>!r.ownerId||r.ownerId===ownerId),
      'N71_V2_CROSS_OWNER:'+name);
  const hasRemote=ORDER.some(n=>cloud[n].length>0);
  if(hasRemote)need(Number.isSafeInteger(Number(ownerHistoryRevision))&&
      Number(ownerHistoryRevision)>0,'N71_V2_SERVER_HISTORY_NOT_PROVEN');
  else need(String(ownerHistoryRevision)==='0',
      'N71_V2_EMPTY_OWNER_HISTORY_NOT_PROVEN');
  const result={...cloud},decisions=[],newRows={};
  for(const name of SIDECARS){
    const old=new Map(cloud[name].map(r=>[r.id,r]));
    const additions=[];
    for(const row of backup[name]){
      need(row.ownerId===ownerId&&validTime(row),'N71_V2_BACKUP_ROW_INVALID:'+name);
      const serverRow=old.get(row.id);
      if(serverRow){
        need(validTime(serverRow),'N71_V2_SERVER_ROW_INVALID:'+name);
        if(JSON.stringify(identity(serverRow,name))!==JSON.stringify(identity(row,name)))
          fail(serverRow.deleted&&!row.deleted?'N71_V2_TOMBSTONE_RESURRECTION':
            'N71_V2_ACTIVE_CONFLICT:'+name);
        decisions.push({store:name,id:row.id,decision:'KEEP_SERVER'});
      }else{
        additions.push(structuredClone(row));
        decisions.push({store:name,id:row.id,
          decision:row.deleted?'CREATE_TOMBSTONE':'CREATE'});
      }
    }
    newRows[name]=additions;
    result[name]=[...cloud[name],...additions];
  }
  // Preserve every server ancestor. A backup cannot overwrite it locally.
  for(const name of ORDER){
    if(SIDECARS.includes(name))continue;
    const remoteRows=new Map(cloud[name].map(r=>[r.id,r]));
    for(const row of backup[name]){
      const current=remoteRows.get(row.id);
      if(current && Boolean(current.deleted)!==Boolean(row.deleted))
        fail('N71_V2_DELETION_ANCESTRY_CONFLICT:'+name);
    }
    result[name]=[...cloud[name],...backup[name].filter(r=>!remoteRows.has(r.id))];
  }
  // Full-domain recovery must preserve N77 deletion ancestry too.
  // A live score/historical dependent row cannot reappear under a deleted
  // section, teaching or item even if every individual ID looks plausible.
  try{assertScoreSnapshotInvariant(result);}
  catch{fail('N71_V2_SCORE_INVARIANT_INVALID');}
  const ancestry=deletionScope(result,result);
  for(const name of ORDER){
    if(name==='closedTermReports')continue;
    for(const row of result[name]){
      if(row.deleted!==true&&ancestry.isDeleted(name,row))
        fail('N71_V2_DELETED_ANCESTOR:'+name);
    }
  }
  // Validate complete parent references, not just deleted ancestry. A live
  // grade with an unknown student/assessment or a session in another Teaching
  // is a hard restore conflict, never an implicitly created dangling row.
  assertN71V2ReferenceGraph(result,{stores:ORDER,ownerId});
  const scopes=new Map(result.sectionCurriculumScopes.map(r=>[r.id,r]));
  const activeSections=new Set();
  for(const scope of result.sectionCurriculumScopes){
    need(scope.ownerId===ownerId&&validTime(scope),'N71_V2_SCOPE_INVALID');
    const sec=one(result.sections,scope.sectionId);
    const year=one(result.years,scope.yearId);
    need(sec&&year&&sec.yearId===scope.yearId&&
      (!sec.ownerId||sec.ownerId===ownerId)&&
      (!year.ownerId||year.ownerId===ownerId),
      'N71_V2_SCOPE_YEAR_OR_SECTION_MISSING');
    need(scope.legacyGrade==null||Number(scope.legacyGrade)===Number(sec.grade),
      'N71_V2_SCOPE_LEGACY_GRADE_MISMATCH');
    let expected;
    try{expected=evaluateSectionCurriculumScope({
      ownerId,sectionId:scope.sectionId,yearId:scope.yearId,
      program:scope.program,stage:scope.stage,level:scope.level,track:scope.track,
      legacyGrade:Number(sec.grade),
    });}catch{fail('N71_V2_SCOPE_SOURCE_INVALID');}
    need(expected.state==='draft'&&scope.id===expected.identity&&
      scope.scopeKey===expected.scopeKey&&scope.edition===expected.edition&&
      scope.sourceUrl===expected.dataSource,'N71_V2_SCOPE_SOURCE_INVALID');
    if(!scope.deleted){
      need(!sec.deleted&&!year.deleted,'N71_V2_LIVE_DELETED_ANCESTOR');
      need(!activeSections.has(scope.sectionId),
        'N71_V2_DUPLICATE_ACTIVE_SECTION_SCOPE');
      activeSections.add(scope.sectionId);
    }
  }
  const activeTeachings=new Set();
  for(const binding of result.teachingCourseBindings){
    need(binding.ownerId===ownerId&&validTime(binding),'N71_V2_BINDING_INVALID');
    const scope=scopes.get(binding.sectionScopeIdentity);
    const teaching=one(result.teachings,binding.teachingId);
    const subject=one(result.subjects,binding.subjectId);
    const term=one(result.terms,binding.termId);
    need(scope&&teaching&&subject&&term&&scope.sectionId===binding.sectionId&&
      teaching.sectionId===binding.sectionId&&
      teaching.subjectId===binding.subjectId&&
      teaching.termId===binding.termId&&term.yearId===scope.yearId&&
      (!teaching.ownerId||teaching.ownerId===ownerId)&&
      (!subject.ownerId||subject.ownerId===ownerId)&&
      (!term.ownerId||term.ownerId===ownerId),
      'N71_V2_BINDING_PARENT_MISMATCH');
    let expected;
    try{expected=evaluateTeachingCourseBinding({
      ownerId,sectionScope:{...scope,state:'draft'},sectionId:binding.sectionId,
      teachingId:binding.teachingId,subjectId:binding.subjectId,
      termId:binding.termId,name:binding.name,kind:binding.kind,
      sourcePage:binding.sourcePage??null,
    });}catch{fail('N71_V2_BINDING_SOURCE_INVALID');}
    need(expected.state==='draft'&&expected.identity===binding.id&&
      expected.courseKey===binding.courseKey&&
      expected.edition===binding.edition&&
      expected.sourceUrl===binding.sourceUrl,'N71_V2_BINDING_SOURCE_INVALID');
    if(!binding.deleted){
      need(!scope.deleted&&!teaching.deleted&&!subject.deleted&&!term.deleted,
        'N71_V2_LIVE_DELETED_ANCESTOR');
      need(!activeTeachings.has(binding.teachingId),
        'N71_V2_DUPLICATE_ACTIVE_BINDING');
      activeTeachings.add(binding.teachingId);
    }
  }
  // Bind actual canonical bytes, not only ID and revision. Two structurally
  // different server snapshots may contain the same IDs and revision numbers;
  // a revision-only hash would silently treat those snapshots as identical.
  // JSON normalization also preserves ISO strings for Date objects returned by
  // PostgreSQL clients before deterministic key sorting in sha256Hex.
  const manifest=[];
  for(const name of ORDER){
    for(const row of [...result[name]].sort((a,b)=>a.id.localeCompare(b.id))){
      const contents=JSON.parse(JSON.stringify(row));
      manifest.push({
        store:name,id:row.id,deleted:row.deleted===true,
        revision:Number(row.serverRevision??0),
        contentHash:await sha256Hex(contents),
      });
    }
  }
  manifest.push({store:'__n71_protocol__',id:N71_V2_RESEARCH_PROTOCOL,
    deleted:false,revision:2});
  const manifestDigest=await sha256Hex({ownerId,protocol:N71_V2_RESEARCH_PROTOCOL,manifest});
  return Object.freeze({
    protocol:N71_V2_RESEARCH_PROTOCOL,simulated:true,productionReady:false,
    ownerId,backupHash:payload.backupHash,manifestDigest,
    sourceRows:manifest.length-1,stores:[...ORDER],
    decisions:decisions.sort((a,b)=>a.store.localeCompare(b.store)||a.id.localeCompare(b.id)),
    syntheticWouldInsert:newRows.sectionCurriculumScopes.length+
      newRows.teachingCourseBindings.length,
    canonicalSidecars:{
      sectionCurriculumScopes:structuredClone(result.sectionCurriculumScopes),
      teachingCourseBindings:structuredClone(result.teachingCourseBindings),
    },
    invalidCloudActions:false,
  });
}
