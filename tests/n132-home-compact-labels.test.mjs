import test from 'node:test';
import assert from 'node:assert/strict';
import {homeCompactTeachingLabel,homeGreeting} from '../src/views/home.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

test.after(()=>{
 store.closeChannel();db.closeDB();
});

const teach=Object.freeze({id:'teaching:x',sectionId:'sec:x',subjectId:'subject:x'});
const section=Object.freeze({id:'sec:x',grade:5,label:'2'});
const subj=Object.freeze({id:'subject:x',name:'المهارات الرقمية'});

test('home uses the existing display-only class/material dictionary',()=>{
 const sectionFor=id=>id==='sec:x'?section:null;
 const subjectFor=id=>id==='subject:x'?subj:null;
 assert.equal(homeCompactTeachingLabel(teach,{sectionFor,subjectFor,nearbySubjects:[subj]}),'خامس/2 · رقمية');
 assert.equal(homeCompactTeachingLabel(null,{sectionFor,subjectFor,nearbySubjects:[subj]}),'');
 assert.equal(subj.name,'المهارات الرقمية');
 assert.equal(section.label,'2');
 assert.equal(teach.subjectId,'subject:x');
});

test('unknown custom material is not arbitrarily truncated',()=>{
 const custom={id:'subject:x',name:'الأنشطة المتقدمة للروبوت والذكاء الاصطناعي'};
 assert.equal(homeCompactTeachingLabel(teach,{
  sectionFor:()=>section,subjectFor:()=>custom,nearbySubjects:[custom]}),
 'خامس/2 · الأنشطة المتقدمة للروبوت والذكاء الاصطناعي');
});

test('two stored subjects with the same short form remain distinguishable',()=>{
 const arabic={id:'subject:x',name:'اللغة العربية'};
 const other={id:'subject:other',name:'العربية'};
 assert.equal(homeCompactTeachingLabel(teach,{
  sectionFor:()=>section,subjectFor:()=>arabic,nearbySubjects:[arabic,other]}),
 'خامس/2 · اللغة العربية');
});

test('home greeting is unaffected by presentation-only subject labels',()=>{
 assert.equal(homeGreeting({teacherName:''},new Date('2026-10-27T09:00:00+03:00')).startsWith('صباح الخير'),true);
});
