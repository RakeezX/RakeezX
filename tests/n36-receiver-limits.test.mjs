import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBundle, reviewPlan, uniqueOptions } from '../src/lib/teacher-setup-import.js';
import { exportedBundle } from './n36-receiver-fixture.mjs';
test('recorded canonical version1 fixture is accepted without collecting additional fields', () => {
  assert.deepEqual(parseBundle(JSON.stringify(exportedBundle)), exportedBundle);
});
test('strict envelope, fields, provenance, privacy grammar and source limits', () => {
  const variants = [
    b => b.version = 2, b => b.sourceURL = 'https://example.invalid', b => b.token = 'secret',
    b => b.categories[0].rows[0].phone = '0500000000', b => b.categories[0].rows[0].nationalID = '123',
    b => b.categories[0].rows[0].name = '<img onerror=alert(1)>', b => b.categories[0].rows[0].name = 'معلم 1234',
    b => b.categories[0].provenance = ['arbitrary-page'], b => b.categories[0].rows.push({name:'معلم آخر'}),
    b => b.categories.push(b.categories[0]), b => b.categories[3].rows.push(b.categories[3].rows[0]),
    b => b.categories[5].rows.push({...b.categories[5].rows[0],classroom:'خامس باء'}),
    b => b.categories[4].rows = Array.from({length:301}, (_,i)=>({name:'طالب',classroom:'فصل '+i})),
  ];
  for (const change of variants) { const b = structuredClone(exportedBundle); change(b); assert.throws(()=>parseBundle(JSON.stringify(b))); }
  assert.throws(()=>parseBundle('{"__proto__":{},"schema":"rakeez-private-teacher-setup"}'), /PROTOTYPE_KEY/);
  assert.throws(()=>parseBundle(' '.repeat(100001)), /BUNDLE_LIMIT/);
  assert.throws(()=>parseBundle('ع'.repeat(60000)), /BUNDLE_LIMIT/);
  const many=structuredClone(exportedBundle); many.categories=[...['classes','students','timetable'].map(category=>({category,provenance:['pasted-visible'],rows:Array.from({length:201},()=>({}))}))];
  assert.throws(()=>parseBundle(JSON.stringify(many)));
});
test('missing values and ambiguous mappings remain unresolved; only reviewed unique references pass', () => {
  const b = structuredClone(exportedBundle); delete b.categories[5].rows[0].time;
  const parsed = parseBundle(JSON.stringify(b)); assert.equal(parsed.categories[5].rows[0].time, '');
  const ctx={yearId:'y',termId:'t',years:[{id:'y',status:'active'}],terms:[{id:'t',yearId:'y',status:'active'}],classes:[{id:'s',name:'خامس ألف'}],subjects:[{id:'sub',name:'علوم تجريبية'}],teachings:[{id:'teach',sectionId:'s',subjectId:'sub',termId:'t'}],students:[],enrollments:[]};
  const maps={classes:{'خامس ألف':'s'},subjects:{'علوم تجريبية':'sub'}};
  assert.ok(reviewPlan(parsed,new Set(['timetable']),ctx,maps).issues.some(i=>i.includes('الوقت')));
  assert.equal(reviewPlan(parseBundle(JSON.stringify(exportedBundle)),new Set(['timetable']),ctx,maps).issues.length,0);
  ctx.classes.push({id:'other',name:'خامس ألف'}); assert.deepEqual(uniqueOptions(ctx.classes),[]);
  assert.ok(reviewPlan(parsed,new Set(['classes']),ctx,maps).issues.length);
  assert.ok(reviewPlan(parsed,new Set(),ctx,maps).issues.length);
});
