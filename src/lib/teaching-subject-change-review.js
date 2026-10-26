/**
 * Read-only impact preview for changing the subject of a Teaching.
 * A local preview is NEVER permission to mutate or a complete cloud snapshot.
 * An authorized live change requires CAS, owner/lease, server revision, N71
 * full-domain restore, and a curriculum binding transition.
 */
import { STORES } from './db.js';
import { DEFAULT_ITEMS } from '../models.js';

export const SUBJECT_CHANGE_REVIEW_VERSION = 1;
const REQUIRED = Object.freeze(STORES.filter(s => !['device','meta','profile'].includes(s)));
const SHARED = new Set(['years','terms','subjects','sections','students','enrollments',
  'calendars','calendarDays','timeProfiles','device','meta','profile']);
const LABELS = Object.freeze({
  items:'بنود التقييم',scoreSubitems:'عناصر الدرجات',
  scoreSubitemCompletions:'رصد العناصر',scores:'الدرجات',
  slots:'الجدول',sessions:'الحصص',sessionRosterSnapshots:'كشوف الحصص',
  attendance:'الحضور',logs:'الرصد السريع',notes:'الملاحظات',
  classRules:'قواعد الفصل',classGoals:'الأهداف',classCharterSelections:'الميثاق',
  groupArrangements:'المجموعات',assignments:'الواجبات',submissions:'التسليمات',
  closedTermReports:'التقارير التاريخية',teachingCourseBindings:'ربط المقررات V2',
  sectionCurriculumScopes:'سياق المنهج V2',units:'الوحدات',lessons:'الدروس',
  outbox:'تغييرات معلّقة',
});
const rows = (data,key) => Array.isArray(data[key]) ? data[key] : [];
const live = row => !!row && !row.deleted;
const ident = list => new Set(list.map(r=>r.id));
const contains = (v,needle,depth=0) => {
  if(!v||!needle||depth>10) return false;
  if(typeof v==='string') return v===needle||v.includes(needle);
  if(Array.isArray(v)) return v.some(x=>contains(x,needle,depth+1));
  if(typeof v==='object') return Object.entries(v).some(([k,x])=>
    contains(k,needle,depth+1)||contains(x,needle,depth+1));
  return false;
};
const pristineItem = (r,t,i) => live(r)&&Number(r.order)===i&&r.name===t.name&&
  Number(r.max)===Number(t.max)&&(r.auto??null)===(t.auto??null)&&
  Number(r.perPoint??1)===1&&Number(r.penalty??1)===1&&
  (r.scoreMode??'direct')==='direct'&&(r.distributionMode??null)===null&&
  (r.portabilityGroupId??null)===null&&(r.distributionOriginId??null)===null&&
  (r.unitId??null)===null&&(r.lessonId??null)===null&&
  Number(r.distributionVersion??1)===1;
const outcome=(status,reason,extra={})=>Object.freeze({
  version:SUBJECT_CHANGE_REVIEW_VERSION,status,reason,
  canCommit:false,requiresServerCAS:true,preserveHistory:true,
  suggestedAction:'none',...extra,
});
const counts=groups=>Object.freeze(Object.fromEntries(Object.entries(groups)
  .filter(([,list])=>list.length>0)
  .map(([key,list])=>[key,Object.freeze({count:list.length,label:LABELS[key]??key})])));

/**
 * Requires a complete owner-bound single-workspace snapshot. The caller must
 * separately establish authentication, cloud freshness and write lease.
 * Returns counts and safe reason codes, never student names or record contents.
 */
export function reviewTeachingSubjectChange({
  snapshot,teachingId,targetSubjectId,ownerId,currentTermId=null,
}={}) {
  if(!snapshot||typeof snapshot!=='object'||!teachingId||!targetSubjectId||!ownerId)
    return outcome('blocked','invalid_context');
  const missing=REQUIRED.filter(key=>!Array.isArray(snapshot[key]));
  if(missing.length) return outcome('blocked','incomplete_local_snapshot',{
    missingStores:Object.freeze(missing),
  });
  const teaching=rows(snapshot,'teachings').find(r=>r.id===teachingId&&live(r));
  if(!teaching) return outcome('blocked','source_teaching_missing');
  const section=rows(snapshot,'sections').find(r=>r.id===teaching.sectionId&&live(r));
  const term=rows(snapshot,'terms').find(r=>r.id===teaching.termId&&live(r));
  const year=rows(snapshot,'years').find(r=>r.id===section?.yearId&&live(r));
  const oldSubject=rows(snapshot,'subjects').find(r=>r.id===teaching.subjectId&&live(r));
  const target=rows(snapshot,'subjects').find(r=>r.id===targetSubjectId&&live(r));
  if(!section||!term||!year||!oldSubject||!target||term.yearId!==section.yearId)
    return outcome('blocked','academic_identity_incomplete');
  if([section,term,year,oldSubject,target,teaching].some(r=>r.ownerId&&r.ownerId!==ownerId))
    return outcome('blocked','foreign_owner_record');
  if(currentTermId&&term.id!==currentTermId)
    return outcome('blocked','different_active_term');
  if(section.status==='archived'||term.status==='closed'||year.status==='archived')
    return outcome('blocked','historical_scope_readonly');
  if(oldSubject.id===target.id) return outcome('unchanged','same_subject');
  const existing=rows(snapshot,'teachings').find(r=>live(r)&&r.sectionId===section.id&&
    r.termId===term.id&&r.subjectId===target.id);
  if(existing) return outcome('target_exists','teaching_already_exists_for_subject',{
    suggestedAction:'open_existing_teaching',
  });

  const items=rows(snapshot,'items').filter(r=>r.teachingId===teachingId);
  const itemIds=ident(items);
  const subitems=rows(snapshot,'scoreSubitems').filter(r=>itemIds.has(r.itemId));
  const subitemIds=ident(subitems);
  const sessions=rows(snapshot,'sessions').filter(r=>r.teachingId===teachingId);
  const sessionIds=ident(sessions);
  const assignments=rows(snapshot,'assignments').filter(r=>r.teachingId===teachingId);
  const assignmentIds=ident(assignments);
  const unitIds=new Set(items.map(r=>r.unitId).filter(Boolean));
  const lessonIds=new Set([...items.map(r=>r.lessonId).filter(Boolean),
    ...sessions.map(r=>r.lessonId).filter(Boolean)]);
  const groups={
    items,scoreSubitems:subitems,
    scoreSubitemCompletions:rows(snapshot,'scoreSubitemCompletions')
      .filter(r=>subitemIds.has(r.subitemId)),
    scores:rows(snapshot,'scores').filter(r=>itemIds.has(r.itemId)),
    slots:rows(snapshot,'slots').filter(r=>r.teachingId===teachingId),
    sessions,sessionRosterSnapshots:rows(snapshot,'sessionRosterSnapshots')
      .filter(r=>r.teachingId===teachingId||sessionIds.has(r.sessionId)),
    attendance:rows(snapshot,'attendance')
      .filter(r=>r.teachingId===teachingId||sessionIds.has(r.sessionId)),
    logs:rows(snapshot,'logs')
      .filter(r=>r.teachingId===teachingId||sessionIds.has(r.sessionId)),
    notes:rows(snapshot,'notes')
      .filter(r=>r.teachingId===teachingId||sessionIds.has(r.sessionId)),
    classRules:rows(snapshot,'classRules').filter(r=>r.teachingId===teachingId),
    classGoals:rows(snapshot,'classGoals').filter(r=>r.teachingId===teachingId),
    classCharterSelections:rows(snapshot,'classCharterSelections')
      .filter(r=>r.teachingId===teachingId),
    groupArrangements:rows(snapshot,'groupArrangements')
      .filter(r=>r.teachingId===teachingId),
    assignments,submissions:rows(snapshot,'submissions')
      .filter(r=>assignmentIds.has(r.assignmentId)),
    teachingCourseBindings:rows(snapshot,'teachingCourseBindings')
      .filter(r=>r.teachingId===teachingId),
    sectionCurriculumScopes:rows(snapshot,'sectionCurriculumScopes')
      .filter(r=>r.sectionId===section.id),
    units:rows(snapshot,'units').filter(r=>unitIds.has(r.id)),
    lessons:rows(snapshot,'lessons')
      .filter(r=>lessonIds.has(r.id)||unitIds.has(r.unitId)),
    closedTermReports:rows(snapshot,'closedTermReports').filter(r=>
      contains(r.payload,teachingId)||contains(r.sourceManifest,teachingId)),
  };
  const allRelated=new Set([teachingId,...itemIds,...subitemIds,
    ...sessionIds,...assignmentIds]);
  const pending=rows(snapshot,'outbox').filter(r=>
    r.state!=='superseded'&&r.state!=='confirmed'&&
    [...allRelated].some(id=>contains(r,id)));
  const standardItems=items.length===DEFAULT_ITEMS.length &&
    DEFAULT_ITEMS.every((t,i)=>{
      const candidates=items.filter(r=>Number(r.order)===i);
      return candidates.length===1&&pristineItem(candidates[0],t,i);
    });
  const groupsWithPending={...groups,outbox:pending};
  const recordCounts=counts(groupsWithPending);
  const shared=new Set(rows(snapshot,'enrollments')
    .filter(r=>r.sectionId===section.id&&live(r)&&r.status==='active')
    .map(r=>r.studentId)).size;
  const affected=Object.freeze({
    sectionId:section.id,teachingId,sourceSubjectId:oldSubject.id,targetSubjectId:target.id,
    termId:term.id,sharedStudents:shared,defaultAssessmentItems:items.length,
    assessmentDefaultsUnchanged:standardItems,
    recordCounts,totalLinkedRows:Object.values(recordCounts)
      .reduce((sum,x)=>sum+x.count,0),
    pendingOutbox:pending.length,
    includesCurriculumLinks:groups.teachingCourseBindings.length>0||
      groups.sectionCurriculumScopes.length>0||
      groups.units.length>0||groups.lessons.length>0,
  });
  const classified=new Set([...Object.keys(groups),'outbox','teachings']);
  const unknown=STORES.filter(s=>!SHARED.has(s)&&!classified.has(s))
    .filter(s=>rows(snapshot,s).some(r=>contains(r,teachingId)));
  if(unknown.length) return outcome('blocked','unclassified_teaching_links',{
    affected,unknownStores:Object.freeze(unknown),
  });
  if(pending.length) return outcome('review_required','pending_sync_requires_reconciliation',{
    suggestedAction:'wait_for_sync_then_review',affected,
  });
  const meaningful=!standardItems ||
    Object.entries(groups).some(([key,arr])=>key!=='items'&&arr.length>0);
  if(!meaningful)
    return outcome('preflight_ready','pristine_subject_selection_correction',{
      suggestedAction:'prepare_authorized_subject_rebind',affected,
    });
  return outcome('review_required','linked_teaching_history_requires_choice',{
    suggestedAction:'add_teaching_keep_existing_history',
    affected,automaticScoreTransfer:false,automaticAttendanceTransfer:false,
  });
}
