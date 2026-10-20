// AI: strict section protocol and atomic projection negatives, no server/network.
import test from 'node:test';import assert from 'node:assert/strict';
import {validateDeletePlan,validateSubjectlessPlan,subjectlessDeleteWrites} from '../../src/lib/n77-delete.js';
const plan=()=>({protocol:'N36_SECTION_DELETE_V1',ownerId:'owner',sectionId:'section',yearId:'year',termId:'term',scope:'section',selectedTeachingId:null,teachingIds:[],cascadeTeachingIds:['hist'],enrollmentIds:['en'],fingerprint:'a'.repeat(32)});
const receipt=()=>({...plan(),mutationId:'mutation',outcome:'deleted',orphanStudentIds:[]});
const data=()=>({device:[{id:'device',activeYearId:'year',activeTermId:'term',n77DeleteIntent:{kind:'subjectless-section',sectionId:'section',selectedTeachingId:null,ownerId:'owner',mutationId:'mutation',plan:plan()}}],years:[{id:'year',status:'active'}],terms:[{id:'term',yearId:'year',status:'active'}],sections:[{id:'section',yearId:'year',ownerId:'owner'}],teachings:[{id:'hist',sectionId:'section',deleted:true,ownerId:'owner'}],enrollments:[{id:'en',sectionId:'section',ownerId:'owner',studentId:'shared'}],students:[{id:'shared',ownerId:'owner'}],items:[],sessions:[],assignments:[],outbox:[],closedTermReports:[{id:'report',payload:{immutable:true}}]});
test('typed section-only receipt rejects confusion, forgery and extra fields; old validator unchanged',()=>{
 assert.deepEqual(validateSubjectlessPlan(plan(),plan()),plan());
 assert.throws(()=>validateDeletePlan(plan(),{ownerId:'owner',sectionId:'section',teachingId:null}));
 for(const edit of [p=>p.ownerId='foreign',p=>p.yearId='other',p=>p.selectedTeachingId='fake',p=>p.teachingIds=['fake'],p=>p.cascadeTeachingIds=['hist','hist'],p=>p.extra=true,p=>p.protocol='N77',p=>p.fingerprint='bad']){const p=plan();edit(p);assert.throws(()=>validateSubjectlessPlan(p,plan()));}
 const p=receipt();p.orphanStudentIds=['shared'];assert.throws(()=>validateSubjectlessPlan(p,plan(),true));
});
test('atomic projection preserves shared pupil and immutable history and refuses stale/foreign/local recovery changes',()=>{
 const current=data(),original=structuredClone(current),writes=subjectlessDeleteWrites(current,receipt(),123);
 assert.deepEqual(current,original);assert.equal(writes.sections.put[0].deleted,true);assert.equal(writes.enrollments.put[0].deleted,true);assert.equal(writes.students,undefined);assert.equal(writes.closedTermReports,undefined);assert.equal(writes.device.put[0].n77DeleteIntent,null);
 for(const edit of [c=>c.sections[0].ownerId='foreign',c=>c.enrollments[0].ownerId='foreign',c=>c.teachings.push({id:'new',sectionId:'section'}),c=>c.enrollments.push({id:'new',sectionId:'section'}),c=>c.device[0].studentLifecycleResume={},c=>c.device[0].cloudRestoreResume={},c=>c.device[0].activeYearId='other',c=>c.terms[0].status='closed',c=>c.device[0].n77DeleteIntent.kind='other']){const c=data();edit(c);assert.throws(()=>subjectlessDeleteWrites(c,receipt(),123));}
});
