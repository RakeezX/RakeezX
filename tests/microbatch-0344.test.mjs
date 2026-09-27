import test from 'node:test';import assert from 'node:assert/strict';
import {classSubjectDefault} from '../src/lib/class-subject-default.js';
import {currentStudentSearchResults} from '../src/lib/student-search-ui.js';
import {smartGroupCounts,targetGroupSizes,validTargetCount} from '../src/lib/group-count-ui.js';
const options=[{subjectId:'a'},{subjectId:'b'},{subjectId:'digital'}];
test('N14 first-ever creation is empty, not Digital Skills',()=>assert.equal(classSubjectDefault(options,[],[]),undefined));
test('N14 one distinct subject remains safe across multiple teachings',()=>assert.equal(classSubjectDefault(options,[{subjectId:'a'},{subjectId:'a'}],[{subjectId:'a'}]),options[0]));
test('N14 multiple subjects never infer recency from mutable timestamps',()=>{for(const updatedAt of [0,999999,'2026-09-27'])assert.equal(classSubjectDefault(options,[{subjectId:'a',updatedAt},{subjectId:'b',updatedAt:1}],[{subjectId:'a',updatedAt},{subjectId:'b'}]),undefined);});
test('N14 history/deleted and explicit editing selection',()=>{assert.equal(classSubjectDefault(options,[{subjectId:'a',deleted:true}],[]),undefined);assert.equal(classSubjectDefault(options,[{subjectId:'a'}],[]),options[0]);assert.equal(classSubjectDefault(options,[],[],{subjectId:'b'}),options[1]);});
test('N19 uses distinct durable identities and exposes current contexts; inactive excluded',()=>{
 const s1={id:'one',name:'محمد أحمد',status:'active'},s2={id:'two',name:'محمد أحمد',status:'active'},former={id:'former',name:'محمد أحمد',status:'former'};
 const source={teachings:()=>[{id:'a',sectionId:'s1',subjectId:'math'},{id:'b',sectionId:'s1',subjectId:'science'},{id:'c',sectionId:'s2',subjectId:'math'}],students:id=>id==='c'?[s2,former]:[s1],getSection:id=>({id}),sectionLabel:s=>s.id,getSubject:id=>({name:id})};
 assert.deepEqual(currentStudentSearchResults('',source),[]);assert.deepEqual(currentStudentSearchResults('لا يوجد',source),[]);
 const matches=currentStudentSearchResults('محمد',source);assert.equal(matches.length,2);assert.deepEqual(matches[0].contexts.map(c=>c.teaching.id),['a','b']);assert.equal(matches[1].student.id,'two');
});
for(const [n,choices,recommended]of[[5,[1,2,3,4],1],[10,[2,3,4,5],3],[20,[4,5,6,7],5],[30,[7,8,9,10],8],[36,[8,9,10,11],9],[1,[1],1],[2,[1,2],1],[0,[],null]])test(`N28 eligible ${n} suggestions`,()=>assert.deepEqual(smartGroupCounts(n),{choices,recommended}));
for(const [n,k,sizes]of[[10,3,[4,3,3]],[12,3,[4,4,4]],[13,4,[4,3,3,3]],[18,5,[4,4,4,3,3]]])test(`N28 ${n}/${k} distribution`,()=>assert.deepEqual(targetGroupSizes(n,k),sizes));
test('N28 blank/invalid/excess counts cannot create empty groups',()=>{for(const value of['',0,-1,2.5,11,'bad']){assert.equal(validTargetCount(value,10),false);assert.deepEqual(targetGroupSizes(10,value),[]);}});
