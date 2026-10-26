import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTFOLIO_CRITERIA, portfolioAttendanceEvidence, portfolioYearEvidence, portfolioDesignSummary, isValidEvidenceDate } from '../src/lib/portfolio-design-preview.js';

const selected={id:'test:t1'},other={id:'test:t2'};
const row=(id,date,recorded,expected,state='completed',teaching=selected)=>({
  session:{id,date,period:1},teaching,
  completeness:{recorded,expected,state},
});
const report=(...rows)=>({teachings:[selected,other],rows});

test('criteria reproduce eleven named source sections and stated weights, not ratings',()=>{
 assert.equal(PORTFOLIO_CRITERIA.length,11);
 assert.equal(PORTFOLIO_CRITERIA.reduce((s,c)=>s+c.weight,0),100);
 assert.deepEqual(PORTFOLIO_CRITERIA.filter(c=>c.weight===5).map(c=>c.number),['08','09']);
 assert.equal(PORTFOLIO_CRITERIA[8].title,'الإدارة الصفية');
 assert.equal(PORTFOLIO_CRITERIA[10].title,'تنويع أساليب التقويم');
 assert.equal(PORTFOLIO_CRITERIA.some(c=>'score' in c || 'rating' in c),false);
});

test('only genuine dated roster attendance marks count; no names, scheduled-only rows or unsupported claims',()=>{
 const input=report(
   row('s1','2026-09-06',24,24),
   row('s2','2026-09-07',11,24,'pending'),
   row('s3','2026-09-08',0,24,'pending'),
   row('s4','2026-11-06',24,24,'completed'), // future after asOf
   row('s5','2026-09-09',24,24,'excluded'),
   row('s6','2026-09-06',24,24,'completed',other),
   row('s1','2026-09-06',24,24),
   row('s7','2026-09-10',28,24,'completed'),
 );
 const frozen=JSON.stringify(input);
 const result=portfolioAttendanceEvidence(input,selected.id,'2026-10-25');
 assert.equal(result.recordedSessions,2);
 assert.equal(result.fullSessions,1);
 assert.equal(result.partialSessions,1);
 assert.equal(result.recordedMarks,35);
 assert.equal(result.expectedMarks,48);
 assert.equal(result.omitted,2);
 assert.deepEqual(result.rows.map(x=>x.id),['s2','s1']);
 assert.equal(JSON.stringify(input),frozen);
 assert.equal(JSON.stringify(result).includes('studentName'),false);
});

test('empty evidence does not create achievements or falsely complete any criterion',()=>{
 const empty=portfolioAttendanceEvidence(report(row('s1','2026-09-06',0,24,'pending')),selected.id,'2026-10-25');
 const overview=portfolioDesignSummary(empty);
 assert.equal(empty.recordedSessions,0);
 assert.equal(overview.evidenceCount,0);
 assert.equal(overview.sourcedCriteriaCount,0);
 assert.equal(overview.criteria.every(x=>x.page==='—' && x.status==='لم يُضف شاهد'),true);
});

test('one initial classroom-management witness is not an official completion grade',()=>{
 const e=portfolioAttendanceEvidence(report(row('s1','2026-09-06',23,23)),selected.id,'2026-10-25');
 const s=portfolioDesignSummary(e);
 assert.equal(s.evidenceCount,1);
 assert.equal(s.criteria.filter(c=>c.hasSource).length,1);
 assert.equal(s.criteria.find(c=>c.number==='09').status,'شاهد أولي');
 assert.equal(s.criteria.find(c=>c.number==='09').page,'4');
 assert.equal('performanceScore' in s,false);
});

test('invalid/future dates cannot count as source evidence',()=>{
 assert.equal(isValidEvidenceDate('2026-02-29'),false);
 assert.equal(isValidEvidenceDate('2026-09-06'),true);
 const invalid=portfolioAttendanceEvidence(report(row('s1','not-a-date',23,23)),selected.id,'2026-10-25');
 assert.equal(invalid.recordedSessions,0);
 assert.equal(portfolioAttendanceEvidence(report(),selected.id,'bad-date').recordedSessions,0);
});

test('Preview loads CSS as a linked stylesheet on Cloudflare source-ESM, not a JS CSS import',()=>{
 const src=readFileSync(new URL('../src/views/portfolio-design-preview.js',import.meta.url),'utf8');
 assert.match(src,/link\.rel = 'stylesheet'/);
 assert.doesNotMatch(src,/^\s*import\s+['"][^'"]+\.css['"];?$/m);
 assert.match(src,/data-folio-document/);
 for(const verb of ['store.save(','store.patchProfile(','store.setAttendance(']) assert.equal(src.includes(verb),false);
 assert.doesNotMatch(src,/عبدالله بخيت المعبدي|عبدالله الحربي/);
});


test('one annual portfolio aggregates every term, class, and subject, never a single chosen teaching', () => {
 const a = { ...selected, sectionId:'section-A',subjectId:'subject-M',sectionLabel:'رابع / 1',subjectName:'الرياضيات' };
 const b = { ...other, sectionId:'section-B',subjectId:'subject-D',sectionLabel:'خامس / 3',subjectName:'المهارات الرقمية' };
 const groups=[
   {teachings:[a],report:{teachings:[a],rows:[row('session-A','2026-09-10',22,22,'completed',a)]}},
   {teachings:[b],report:{teachings:[b],rows:[row('session-B','2026-10-10',18,20,'pending',b)]}},
 ];
 const before=JSON.stringify(groups);
 const e=portfolioYearEvidence(groups,'2026-10-25');
 assert.equal(e.recordedSessions,2);
 assert.equal(e.sectionCount,2);
 assert.equal(e.subjectCount,2);
 assert.equal(e.assignmentCount,2);
 assert.deepEqual(e.rows.map(r=>r.section),['خامس / 3','رابع / 1']);
 assert.deepEqual(e.rows.map(r=>r.subject),['المهارات الرقمية','الرياضيات']);
 assert.equal(e.recordedMarks,40);
 assert.equal(JSON.stringify(groups),before);
});

test('year-wide source deduplicates a session already in another term or report snapshot', () => {
 const a = { ...selected, sectionId:'section-A',subjectId:'subject-M' };
 const input = row('session-1','2026-09-15',15,15,'completed',a);
 const e=portfolioYearEvidence([
   {teachings:[a],report:{teachings:[a],rows:[input]}},
   {teachings:[a],report:{teachings:[a],rows:[input]}},
 ]);
 assert.equal(e.recordedSessions,1);
 assert.equal(e.recordedMarks,15);
});
