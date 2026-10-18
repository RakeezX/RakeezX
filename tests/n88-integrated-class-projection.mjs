/** AI: current canonical projection vs actual teacher store/model entry, no browser or service. */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as store from '../src/store.js';
import {itemScore} from '../src/models.js';
import {fixture} from './fixtures/n88-student-projection/canonical.mjs';
import {canonicalGradeContext} from '../drafts/n88-student-portal/canonical-grade-context.mjs';
import {projectStudentPortal,studentPortalPublicationBindings} from '../drafts/n88-student-portal/student-projection.mjs';
const input=fixture();input.teacherContextVersion='n88-canonical-teacher-context-v1';const c=input.canonical;
const source=(await readFile('src/store.js','utf8')).replaceAll('\r\n','\n'),copy=await readFile('drafts/n88-student-portal/canonical-grade-context.mjs','utf8');
for(const name of ['portableGroup','scoreForItem','portableGradeScore','portableScoresByItem','automaticItemIdentity','automaticItemKey','dedupeRecords','compatibleAutomaticTeachingIds','portableAutomaticByItem'])assert.ok(copy.includes(source.match(new RegExp('^function '+name+'\\([^]*?^}', 'm'))[0]),name+' drift');
const clone=(r,id,props)=>({...r,id,...props});
c.sections.push(clone(c.sections[0],'old-class',{label:'ب'}));c.teachings.push(clone(c.teachings[0],'old-teaching',{sectionId:'old-class'}));
c.enrollments.push(clone(c.enrollments[0],'old-enrollment',{sectionId:'old-class',status:'transferred',endDate:'2026-09-01'}));
for(const kind of ['direct','participation','attendance']){
  const target=c.items.find(x=>x.id===kind);target.portabilityGroupId='reviewed-'+kind;
  c.items.push(clone(target,'old-'+kind,{teachingId:'old-teaching'}));
}
c.scores=c.scores.filter(x=>x.itemId!=='direct');c.scores.push(clone(c.scores[0],'old-score',{itemId:'old-direct',value:0}));
c.logs.push(clone(c.logs[0],'old-log',{teachingId:'old-teaching',delta:1}));
c.sessions.push(clone(c.sessions[0],'old-session',{teachingId:'old-teaching'}));c.attendance.push(clone(c.attendance[0],'old-att',{teachingId:'old-teaching',sessionId:'old-session',status:'absent'}));
function compare(){
  Object.assign(store.state,c);
  const actual=store.studentContext(input.studentId,'teaching'),isolated=canonicalGradeContext(c,input.studentId,'teaching');
  for(const item of c.items.filter(i=>i.teachingId==='teaching'))assert.equal(itemScore(item,isolated),itemScore(item,actual),item.id);
  const binding=studentPortalPublicationBindings(input);
  input.visibility={version:'n88-visibility-v1',...Object.fromEntries(['ownerId','studentId','enrollmentId','classId','termId'].map(k=>[k,input[k]])),scopeStamp:binding.scopeStamp,fields:{grades:true},sources:binding.sources.map((s,n)=>({...s,publicationId:'00000000-0000-4000-8000-'+String(n+1).padStart(12,'0')}))};
  const projected=projectStudentPortal(input);assert.deepEqual(projected.grades.items.map(x=>x.value),c.items.filter(i=>i.teachingId==='teaching').map(i=>itemScore(i,actual)));return projected;
}
let projected=compare();assert.equal(projected.grades.items[0].value,0);assert.equal(projected.grades.items[3].value,6);assert.equal(projected.grades.items[4].value,6);
// Ambiguous reviewed group never picks a first score; incompatible auto settings never union grades.
c.items.push(clone(c.items.find(i=>i.id==='old-direct'),'old-direct-duplicate',{}));c.items.find(i=>i.id==='old-attendance').penalty=3;
projected=compare();assert.equal(projected.grades.items[0].value,null);assert.equal(projected.grades.items[4].value,null);
assert.equal(JSON.stringify(projected).includes('old-class'),false);
await writeFile('tests/n88-integrated-class-projection.json',JSON.stringify({taskId:'continuous-n88-integrated-class-student-journey-20261018',runId:'01c87cee-6ed3-4bf6-a51c-503fa03b1248',checks:[{name:'canonical_grade_context_matches_actual_teacher_store',status:'PASS',evidence:'All nine teacher context function bodies match current store. Real studentContext/itemScore equals isolated canonical projection for direct zero, automatic participation/attendance transferred context, subitems, unrecorded values, ambiguous group and incompatible automatic settings; source identifiers absent.'}]},null,2)+'\n');
console.log('N88 canonical projection/actual teacher store equivalence PASS');
