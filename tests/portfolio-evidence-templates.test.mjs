import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {F09_EVIDENCE_TEMPLATES,templatesForCriterion} from '../src/lib/portfolio-evidence-templates.js';
import {buildAnnualPortfolioPlan} from '../src/lib/portfolio-annual-plan.js';

test('each of eleven evaluation categories has a ready editable example without invented personal history',()=>{
 const criteria=Array.from({length:11},(_,i)=>String(i+1).padStart(2,'0'));
 assert.deepEqual([...new Set(F09_EVIDENCE_TEMPLATES.map(x=>x.criterion))],criteria);
 assert.equal(new Set(F09_EVIDENCE_TEMPLATES.map(x=>x.id)).size,F09_EVIDENCE_TEMPLATES.length);
 for(const row of F09_EVIDENCE_TEMPLATES) {
   assert.equal(row.sourceKind,'template');
   assert.equal(row.requiresReview,false);
   assert.ok(row.title.length>4 && row.description.length>30 && row.imageHint);
   assert.ok(!/نفذت|طبقت|أعددتُ|استخدمتُ|قمتُ|أجريتُ/.test(row.description),'template does not claim the teacher carried out unrecorded work');
   assert.deepEqual(row.metrics,[],'no fabricated activity counts');
 }
 assert.ok(F09_EVIDENCE_TEMPLATES.length>=20);
});

// AI N126 v2: baseline fingerprint captured from edaefa3dcd34232433cc4c6b2a25f88ac3b9dbb3.
const newKeys = {
 '01':['duty-handover','procedure-checklist'],
 '02':['learning-transfer','lesson-study-question'],
 '03':['family-question-bank','accessible-family-notice'],
 '04':['worked-example-fading','multiple-expression'],
 '05':['misconception-reteaching','spaced-transfer-probe'],
 '06':['prerequisite-sequence','curriculum-reference-check'],
 '07':['debugging-trace','platform-learning-path'],
 '08':['room-visibility-check','sensory-readiness'],
 '09':['help-request-routine','materials-routine'],
 '10':['distractor-patterns','assessment-completeness'],
 '11':['open-book-reasoning','prototype-testing'],
};
const additions=F09_EVIDENCE_TEMPLATES.slice(56);

test('v2 preserves every original template field and order and appends two original starters per criterion',()=>{
 const original=F09_EVIDENCE_TEMPLATES.slice(0,56);
 assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),
   'cf7ce0a94e71e1e791872af17595ca7715a6019430d9c603a7e7ed8b6613080b');
 assert.equal(additions.length,22);
 assert.equal(new Set(F09_EVIDENCE_TEMPLATES.map(x=>x.title)).size,F09_EVIDENCE_TEMPLATES.length);
 assert.equal(new Set(F09_EVIDENCE_TEMPLATES.map(x=>x.description)).size,F09_EVIDENCE_TEMPLATES.length);
 assert.equal(new Set(additions.map(x=>x.imageHint)).size,22);
 for(const [criterion,keys] of Object.entries(newKeys)){
   assert.deepEqual(additions.filter(x=>x.criterion===criterion).map(x=>x.id),keys.map(k=>'template:'+criterion+':'+k));
   assert.ok(templatesForCriterion(criterion).length>=7,criterion+' has balanced coverage');
 }
});

test('v2 starters provide Arabic artifact hints and neutral customization without invented proof',()=>{
 for(const row of additions){
   assert.match(row.id,/^template:(0[1-9]|1[01]):[a-z]+(?:-[a-z]+)*$/);
   for(const field of ['title','description','imageHint']){
     assert.match(row[field],/[\u0621-\u064a]/,row.id+' '+field+' is Arabic');
     assert.equal(row[field],row[field].trim());
     assert.doesNotMatch(row[field],/[<>\u0000-\u001f\ufffd]/,'readable plain text');
     assert.doesNotMatch(row[field],/[0-9\u0660-\u0669\u06f0-\u06f9]|https?:|@/,'no fabricated amounts or private contact');
   }
   assert.ok(row.title.length>=12 && row.imageHint.length>=35);
   assert.match(row.description,/^(إعداد|صياغة|بناء|تصميم|تخطيط|رسم|تنظيم) /,'action proposal, not past execution');
   assert.match(row.description,/تخصيص/,'invites adaptation to actual context');
   assert.doesNotMatch(row.description,/نفذت|طبقت|أرسلت|حصلت|تحسنت|ارتفعت|اجتاز|حضر المعلم|تم التنفيذ|شهادة معتمدة|تقييم رسمي/);
   assert.equal(row.sourceKind,'template');
   assert.equal(row.source,'نموذج مقترح');
   assert.equal(row.automatic,false);
   assert.equal(row.requiresReview,false);
   assert.deepEqual(row.metrics,[]);
   assert.deepEqual(row.table,[]);
   assert.ok(Object.isFrozen(row));
 }
});

test('actual annual plan leaves all unused v2 starters out and respects explicit inclusion and visibility',()=>{
 const criteria=Object.keys(newKeys).sort().map(number=>({number,title:'معيار '+number}));
 const automatic={id:'recorded-source',criterion:'09',sourceKind:'automatic',title:'مصدر مسجل'};
 const args={criteria,templates:F09_EVIDENCE_TEMPLATES,sources:[automatic],
   contexts:new Map(additions.map(x=>[x.id,{action:'مسودة تخصيص'}])),
   photos:new Map(additions.map(x=>[x.id,[{id:'synthetic-photo'}]]))};
 const unused=buildAnnualPortfolioPlan(args);
 assert.equal(unused.criteriaCount,11);
 assert.deepEqual(unused.entries.map(x=>x.proposal.id),[automatic.id],
   'neither library membership, photos nor draft context opts a template into print');
 for(const item of additions){
   const selected={...args,included:new Set([item.id])};
   assert.equal(buildAnnualPortfolioPlan(selected).entries.filter(x=>x.proposal.sourceKind==='template').length,1);
   assert.ok(buildAnnualPortfolioPlan(selected).entries.some(x=>x.proposal.id===item.id));
   for(const visibility of [{excluded:new Set([item.id])},{hiddenWitnesses:new Set([item.id])},{hiddenCriteria:new Set([item.criterion])}]){
     assert.equal(buildAnnualPortfolioPlan({...selected,...visibility}).entries.some(x=>x.proposal.id===item.id),false);
   }
   assert.ok(buildAnnualPortfolioPlan(selected).entries.some(x=>x.proposal.id===item.id),'visibility restoration retains selection');
 }
});
test('strategy, games, technology and assessment examples have distinct sources and selectable IDs',()=>{
 const four=templatesForCriterion('04');
 const seven=templatesForCriterion('07');
 const eleven=templatesForCriterion('11');
 assert.ok(four.some(x=>x.title.includes('فكّر')));
 assert.ok(four.some(x=>x.title.includes('التعلم باللعب')));
 assert.ok(seven.some(x=>x.title.includes('الألعاب التعليمية')));
 assert.ok(seven.some(x=>x.title.includes('البرمجية')));
 assert.ok(eleven.some(x=>x.title.includes('العملي')));
 assert.ok(eleven.some(x=>x.title.includes('الاختبارات')));
 assert.equal(templatesForCriterion('unknown').length,0);
});

test('the editable starter library has balanced coverage and does not imply implementation',()=>{
 const counts=new Map();
 for(const item of F09_EVIDENCE_TEMPLATES) counts.set(item.criterion,(counts.get(item.criterion)||0)+1);
 for(let i=1;i<=11;i++){
   const n=String(i).padStart(2,'0');
   assert.ok(counts.get(n)>=4,'criterion '+n+' should have at least 4 curated starters');
 }
 assert.ok(F09_EVIDENCE_TEMPLATES.length>=46);
 assert.equal(F09_EVIDENCE_TEMPLATES.filter(x=>x.criterion==='03').some(x=>x.title==='لقاءات أولياء الأمور'),true);
 assert.equal(F09_EVIDENCE_TEMPLATES.filter(x=>x.criterion==='10').some(x=>x.title==='تحليل المهارات التي تحتاج دعمًا'),true);
 for(const row of F09_EVIDENCE_TEMPLATES){
   assert.equal(row.metrics.length,0);
   assert.equal(row.table.length,0);
 }
});
