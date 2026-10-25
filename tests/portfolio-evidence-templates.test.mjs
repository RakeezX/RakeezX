import test from 'node:test';
import assert from 'node:assert/strict';
import {F09_EVIDENCE_TEMPLATES,templatesForCriterion} from '../src/lib/portfolio-evidence-templates.js';

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
