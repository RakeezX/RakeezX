// AI: bounded N36 bundle-to-existing-safe-store adapter tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleNamesTargets, parseBundle } from '../src/lib/teacher-setup-import.js';
import { exportedBundle } from './n36-receiver-fixture.mjs';
const selected=new Set(['students']);
const context=()=>({yearId:'y',termId:'t',years:[{id:'y',status:'active'}],terms:[{id:'t',yearId:'y',status:'active'}],classes:[{id:'s',name:'خامس ألف'}],subjects:[{id:'sub',name:'علوم'}],teachings:[{id:'teach',sectionId:'s',subjectId:'sub',termId:'t'}],students:[],enrollments:[]});
const maps={classes:{'خامس ألف':'s'},subjects:{}};
const bundle=()=>parseBundle(JSON.stringify(exportedBundle));
test('only validated students names with explicit unique mappings produce current teaching choices',()=>{
 const b=bundle(),c=context();
 assert.deepEqual(bundleNamesTargets(b,new Set(['teacher']),c,maps),[]);
 assert.deepEqual(bundleNamesTargets(b,selected,c,{classes:{},subjects:{}}),[]);
 const [target]=bundleNamesTargets(b,selected,c,maps);
 assert.deepEqual(target.rows,[['طالب تجريبي']]);assert.equal(target.id,'teach');
 assert.equal(Object.hasOwn(target,'studentId'),false);
 c.teachings.push({...c.teachings[0],id:'another'});
 assert.deepEqual(bundleNamesTargets(b,selected,c,maps).map(t=>t.id),['teach','another']);
 c.teachings[0].status='archived';c.teachings[1].termId='old';
 assert.deepEqual(bundleNamesTargets(b,selected,c,maps),[]);
});
test('unreviewed selected categories, ambiguous current classes and many source classes mapped to one are blocked',()=>{
 const b=bundle(),c=context();
 assert.deepEqual(bundleNamesTargets(b,new Set(['students','timetable']),c,maps),[]);
 c.classes.push({id:'duplicate',name:'خامس ألف'});
 assert.deepEqual(bundleNamesTargets(b,selected,c,maps),[]);
 c.classes.pop();b.categories.find(c=>c.category==='students').rows.push({name:'طالب آخر',classroom:'خامس باء'});
 assert.deepEqual(bundleNamesTargets(b,selected,c,{classes:{'خامس ألف':'s','خامس باء':'s'},subjects:{}}),[]);
});
test('malformed, grade-bearing, duplicate and identity-bearing JSON never reaches names preparation',()=>{
 for(const mutate of [b=>b.categories[4].rows[0].grade=10,b=>b.categories[4].rows[0].studentId='guess',b=>b.categories[4].rows[0].name='=BAD()',b=>b.categories[4].rows.push({...b.categories[4].rows[0]})]){
 const b=structuredClone(exportedBundle);mutate(b);assert.throws(()=>parseBundle(JSON.stringify(b)));
 }
});
