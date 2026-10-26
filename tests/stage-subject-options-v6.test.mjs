import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_V6_ROWS } from '../src/lib/official-v6-subject-data.js';
import {stageOfLegacyGrade,v6ProgramsForGrade,v6TracksForGrade,stageSubjectOptions} from '../src/lib/stage-subject-options.js';

const opts=[{token:'builtin:arabic',subjectId:'sub:arabic',name:'العربية',searchText:'اللغة العربية لغتي',builtin:true,used:true},
{token:'builtin:digital-skills',subjectId:'sub:digital-skills',name:'المهارات الرقمية',searchText:'المهارات الرقمية',builtin:true,used:true},
{token:'subject:custom-a',subjectId:'sub:custom-a',name:'نادي الابتكار',searchText:'نادي الابتكار',builtin:false,used:true}];

test('all 1,211 source course/domain offerings are packaged',()=>assert.equal(OFFICIAL_V6_ROWS.length,1211));
test('research names keep source programme, stage, level, track, kind, page',()=>{
  assert.ok(OFFICIAL_V6_ROWS.every(r=>r.length===7 && Number.isInteger(r[6]) && r[6]>=16 && r[6]<=72));
});
test('primary 1..6 map correctly',()=>{for(let grade=1;grade<=6;grade++)assert.deepEqual(stageOfLegacyGrade(grade),{stage:'primary',level:String(grade)});});
test('middle grade 7 maps first intermediate',()=>assert.deepEqual(stageOfLegacyGrade(7),{stage:'middle',level:'1'}));
test('secondary grade 12 maps third',()=>assert.deepEqual(stageOfLegacyGrade(12),{stage:'secondary',level:'3'}));
test('unsupported grades rejected conservatively',()=>{for(const n of [0,13,-1,2.3,null,'abc'])assert.equal(stageOfLegacyGrade(n),null);});
test('grade 4 offers a guide list of official sixth-edition course names',()=>{
  const r=stageSubjectOptions({grade:4,options:opts});
  assert.ok(r.guide.some(x=>x.name==='المهارات الرقمية'));
  assert.ok(r.guide.some(x=>x.name==='اللغة العربية'));
  assert.equal(r.scopeStatus,'reference_only');
});
test('official Arabic alias preserves existing built-in identity',()=>{
  const r=stageSubjectOptions({grade:4,options:opts});const x=r.guide.find(o=>o.name==='اللغة العربية');
  assert.equal(x.token,'builtin:arabic');assert.equal(x.used,true);
});
test('traditional subject catalog entries and personalized records never disappear',()=>{
  const r=stageSubjectOptions({grade:4,options:opts});
  assert.ok(r.other.some(x=>x.name==='نادي الابتكار'));
});
test('new official course uses explicit teacher custom name without backend writes',()=>{
  const r=stageSubjectOptions({grade:9,program:'chinese_pilot',options:opts});
  const x=r.guide.find(x=>x.name==='اللغة الصينية');
  assert.equal(x.token,'custom');assert.equal(x.customName,'اللغة الصينية');
});
test('no false tajweed in general grade five',()=>assert.equal(stageSubjectOptions({grade:5,options:opts}).guide.some(x=>x.name==='التجويد'),false));
test('tahfiz grade five offers tajweed and programme selector',()=>{
  const r=stageSubjectOptions({grade:5,program:'tahfiz',options:opts});
  assert.ok(r.guide.some(x=>x.name==='التجويد'));
  assert.ok(v6ProgramsForGrade(5).some(x=>x.value==='tahfiz'));
});
test('grades 11 and 12 require specific general track',()=>{
  for(const grade of [11,12])assert.deepEqual([stageSubjectOptions({grade}).scopeStatus,stageSubjectOptions({grade}).guide.length],['choose_track',0]);
});
test('secondary sixth edition track differences are preserved',()=>{
 const computer=stageSubjectOptions({grade:12,track:'computer_engineering',options:opts});
 const standard=stageSubjectOptions({grade:12,track:'general',options:opts});
 assert.ok(computer.guide.some(o=>o.name==='الأمن السيبراني'));
 assert.ok(!standard.guide.some(o=>o.name==='الأمن السيبراني'));
 assert.ok(v6TracksForGrade(12,'general').length>=5);
});
test('first secondary common year offers course selection without track override',()=>{
 const r=stageSubjectOptions({grade:10});assert.ok(r.guide.length>5);
});
test('special education domains not merged into general education',()=>{
 const r=stageSubjectOptions({grade:1,program:'autism'});
 assert.ok(r.guide.some(o=>o.name==='مجال التواصل'));
 assert.ok(!stageSubjectOptions({grade:1}).guide.some(o=>o.name==='مجال التواصل'));
});
test('extra-care teaching materials are labelled as supplementary only',()=>{
 const r=stageSubjectOptions({grade:4,program:'gifted_care'});
 assert.equal(r.supplementaryOnly,true);assert.ok(r.guide.some(o=>o.name==='الإثراء العام'));
});
test('all guide names have valid source references',()=>{
 const r=stageSubjectOptions({grade:4});assert.ok(r.guide.every(o=>o.sourcePage>0&&o.sourceUrl.startsWith('https://www.sncc.gov.sa/')));
});
test('manual subject creation remains possible when there is no catalog context',()=>{
 const r=stageSubjectOptions({grade:0,options:opts});assert.equal(r.guide.length,0);assert.equal(r.canAddManual,true);
});
test('research source explicitly says annual applicability not yet certified',()=>{
 const r=stageSubjectOptions({grade:4});assert.equal(r.sourceStatus,'edition_six_year_not_certified');
});
test('repeated option values are not duplicated when existing builtin alias recognized',()=>{
 const x=stageSubjectOptions({grade:4,options:opts});assert.equal(x.guide.filter(y=>y.name==='اللغة العربية').length,1);
});

test('official PE name uses old builtin identity rather than creating duplicate',()=>{
 const opt=[{token:'builtin:physical-education',subjectId:'sub:physical-education',name:'البدنية',
   searchText:'البدنية التربية البدنية والدفاع عن النفس',builtin:true,used:false}];
 const result=stageSubjectOptions({grade:4,options:opt});
 const subject=result.guide.find(x=>x.name==='التربية البدنية والدفاع عن النفس');
 assert.equal(subject.token,'builtin:physical-education');
 assert.equal(subject.subjectId,'sub:physical-education');
});
