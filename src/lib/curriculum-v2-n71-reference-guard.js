/**
 * N71 V2 research only — canonical graph read validation.
 * This does NOT authorize Cloud Restore, CAS, RLS or a provider snapshot.
 */
import {SYNC_V2_SCHEMAS} from './sync-v2.js';

const blocked=code=>{throw Object.assign(new Error(code),{code});};
const ensure=(ok,code)=>{if(!ok)blocked(code);};
const isLive=row=>!!row && row.deleted!==true;
const uid=(record,ownerId)=>!record.ownerId || record.ownerId===ownerId;

export function assertN71V2ReferenceGraph(data,{stores,ownerId}={}){
  ensure(Array.isArray(stores)&&stores.length>0&&ownerId,
    'N71_V2_GRAPH_CONTEXT_INVALID');
  const indexed=Object.fromEntries(stores.map(name=>[
    name,new Map((data[name]??[]).map(record=>[record.id,record])),
  ]));
  const lookup=(name,id)=>{
    if(id==null||id==='')return null;
    const row=indexed[name]?.get(id);
    ensure(row&&uid(row,ownerId),'N71_V2_GRAPH_PARENT_MISSING:'+name);
    return row;
  };
  for(const name of stores){
    if(['sectionCurriculumScopes','teachingCourseBindings'].includes(name))continue;
    const schema=SYNC_V2_SCHEMAS[name];
    ensure(schema!=null,'N71_V2_GRAPH_SCHEMA_MISSING:'+name);
    for(const row of data[name]){
      ensure(uid(row,ownerId),'N71_V2_GRAPH_FOREIGN_OWNER:'+name);
      // Technical tombstones may outlive their parents after a scoped delete.
      // Live descendants may NEVER depend on absent/deleted ancestors.
      if(!isLive(row))continue;
      for(const [field,parent] of Object.entries(schema.references??{})){
        const value=row[field];
        if(value==null||value==='')continue;
        ensure(typeof value==='string','N71_V2_GRAPH_ID_INVALID:'+name+':'+field);
        const ancestor=lookup(parent,value);
        ensure(isLive(ancestor),'N71_V2_GRAPH_TOMBSTONED_PARENT:'+name+':'+field);
      }
    }
  }
  for(const teaching of data.teachings.filter(isLive)){
    const sec=lookup('sections',teaching.sectionId);
    const term=lookup('terms',teaching.termId);
    ensure(sec.yearId===term.yearId,'N71_V2_GRAPH_ACADEMIC_YEAR_MISMATCH');
  }
  const item=(id)=>lookup('items',id);
  const teaching=(id)=>lookup('teachings',id);
  const session=(id)=>lookup('sessions',id);
  for(const row of data.items.filter(isLive)){
    const t=teaching(row.teachingId);
    const s=lookup('sections',t.sectionId);
    const unit=row.unitId?lookup('units',row.unitId):null;
    const lesson=row.lessonId?lookup('lessons',row.lessonId):null;
    if(unit)ensure(unit.subjectId===t.subjectId &&
      Number(unit.grade)===Number(s.grade),'N71_V2_GRAPH_ITEM_CURRICULUM_MISMATCH');
    if(lesson){
      const lessonUnit=lookup('units',lesson.unitId);
      ensure(lessonUnit.subjectId===t.subjectId &&
        Number(lessonUnit.grade)===Number(s.grade),
        'N71_V2_GRAPH_LESSON_CURRICULUM_MISMATCH');
      if(unit)ensure(lesson.unitId===unit.id,
        'N71_V2_GRAPH_UNIT_LESSON_CONFLICT');
    }
  }
  for(const row of data.assignments.filter(isLive)){
    const linkedItem=row.itemId?item(row.itemId):null;
    if(linkedItem)ensure(linkedItem.teachingId===row.teachingId,
      'N71_V2_GRAPH_ASSIGNMENT_ITEM_MISMATCH');
    const linkedLesson=row.lessonId?lookup('lessons',row.lessonId):null;
    if(linkedLesson&&linkedItem?.lessonId)
      ensure(linkedItem.lessonId===linkedLesson.id,
        'N71_V2_GRAPH_ASSIGNMENT_LESSON_MISMATCH');
  }
  for(const row of data.sessions.filter(isLive)){
    if(row.slotId){
      const slot=lookup('slots',row.slotId);
      ensure(slot.teachingId===row.teachingId,
        'N71_V2_GRAPH_SESSION_SLOT_MISMATCH');
    }
    if(row.makeupForId){
      const old=session(row.makeupForId);
      ensure(old.teachingId===row.teachingId,
        'N71_V2_GRAPH_MAKEUP_TEACHING_MISMATCH');
    }
  }
  for(const name of ['attendance','sessionRosterSnapshots','notes','logs','classGoals']){
    for(const row of data[name].filter(isLive)){
      if(!row.sessionId || !row.teachingId)continue;
      const matched=session(row.sessionId);
      ensure(matched.teachingId===row.teachingId,
        'N71_V2_GRAPH_SESSION_TEACHING_MISMATCH:'+name);
    }
  }
  for(const row of data.sessionRosterSnapshots.filter(isLive)){
    const t=teaching(row.teachingId);
    ensure(t.sectionId===row.sectionId,
      'N71_V2_GRAPH_SESSION_SECTION_MISMATCH');
  }
  for(const report of data.closedTermReports.filter(isLive)){
    if(report.termId&&report.yearId){
      const term=lookup('terms',report.termId);
      ensure(term.yearId===report.yearId,
        'N71_V2_GRAPH_REPORT_YEAR_MISMATCH');
    }
  }
  return Object.freeze({ok:true,liveRecordsChecked:stores.reduce((n,key)=>
    n+(data[key]??[]).filter(isLive).length,0)});
}
