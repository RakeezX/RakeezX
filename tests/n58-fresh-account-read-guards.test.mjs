// AI: affected read fallback keeps strict mutation/parent validation intact.
import 'fake-indexeddb/auto';
import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/store.js';
import * as d from '../src/lib/db.js';
import * as m from '../src/models.js';
import {calendarPresetRecords,getCalendarPreset} from '../src/lib/calendar-presets.js';
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
beforeEach(async()=>{await d.clearAll();s.state.ready=false;await s.init();});
after(()=>{s.closeChannel();d.closeDB();});
const snapshot=async()=>Object.fromEntries(await Promise.all(['years','terms','calendars','calendarDays','outbox','sessions'].map(async n=>[n,await d.getAll(n)])));
test('healthy first-use store still records context with both existing terms; queue serialization unchanged',async()=>{
 const year=s.activeYear(),section=await s.createSection({yearId:year.id,grade:4,label:'أ'});
 const teaching=await s.createTeaching({sectionId:section.id,termId:s.activeTerm().id,subjectId:'sub:digital-skills'});
 const session=await s.ensureSession(teaching.id,m.todayISO(),1);assert.ok(session);
 assert.equal(session.calendarContext.presetId,year.calendarPresetId);assert.equal(session.calendarContext.selectionRevision,undefined);
 const outbox=await d.getAll('outbox');
 assert.equal(outbox.find(x=>x.store==='years'&&x.op==='create').patch.calendar_preset_id,undefined);
 assert.equal(outbox.find(x=>x.store==='years'&&x.op==='patch').dependencies.length,2);
 assert.ok(outbox.find(x=>x.store==='sessions').dependencies.some(x=>x.calendarPresetId===year.calendarPresetId));
});
test('incomplete reads remain inspectable but strict projection, date edits and new session creation fail closed',async()=>{
 const year=s.activeYear(),term=s.activeTerm(),section=await s.createSection({yearId:year.id,grade:4,label:'أ'});
 const teaching=await s.createTeaching({sectionId:section.id,termId:term.id,subjectId:'sub:digital-skills'});
 const preset=calendarPresetRecords(getCalendarPreset());
 await d.putAcross({calendars:[preset.calendar],calendarDays:preset.calendarDays});
 await d.applyBatch({terms:{remove:[s.state.terms.find(t=>t.index===2).id]}});await s.init();
 const before=await snapshot();assert.equal(s.calendarReadStatus(year.id).ok,false);
 assert.ok(s.activeYear().label.includes('بيانات التقويم غير مكتملة'));assert.equal(s.termsOf(year.id).length,1);
 assert.ok(s.calendarRangesOf(year.id).length>0);assert.equal(s.isSessionEligibleDate(m.todayISO()),false);
 assert.throws(()=>s.effectiveTerm(term.id),/missing-official-term/);
 await assert.rejects(s.updateTermDates(term.id,'2026-08-31','2027-01-06'),/missing-official-term/);
 await assert.rejects(s.ensureSession(teaching.id,m.todayISO(),1),/بيانات التقويم غير مكتملة/);
 assert.deepEqual(await s.ensureSessionsForDate(m.todayISO()),{created:0,existing:0,skipped:0});
 assert.deepEqual(await snapshot(),before);
});
test('read warning does not persist a changed year label or attribute historical provenance',async()=>{
 const year=s.activeYear(),term=s.activeTerm();
 await d.applyBatch({terms:{remove:[s.state.terms.find(t=>t.index===2).id]}});
 await d.put('teachings',{id:'read-teaching',termId:term.id,deleted:false});await s.init();
 const before=await snapshot();
 const session={id:'read-history',teachingId:'read-teaching',status:'held',date:'2026-09-23',period:1};
 assert.equal(s.sessionStatusPresentation(session).provenance,'unrecorded');
 const context={yearId:year.id,termId:term.id,presetId:'sa-general-1448-1449',selectionRevision:7,kind:'remote',source:'custom',label:'Earlier'};
 assert.deepEqual(s.sessionStatusPresentation({...session,calendarContext:context}).calendarContext,context);
 assert.equal((await d.get('years',year.id)).label,year.label);assert.deepEqual(await snapshot(),before);
});
