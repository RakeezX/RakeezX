// AI: materially affected first-use/history contracts, not rendered UI evidence.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import * as db from '../src/lib/db.js';
import * as s from '../src/store.js';
import {makeYear,makeTerm} from '../src/models.js';
import {getCalendarPreset,calendarPresetRecords} from '../src/lib/calendar-presets.js';
import {encodeSyncV2Patch,decodeSyncV2Canonical} from '../src/lib/sync-v2.js';
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
beforeEach(async()=>{await db.clearAll();s.state.ready=false;await s.init();});
after(()=>{s.closeChannel();db.closeDB();});
test('first boot stores selected projection but sends unselected year then term-dependent selection',async()=>{
 const outbox=await db.getAll('outbox'),year=s.activeYear();
 const create=outbox.find(x=>x.store==='years'&&x.op==='create'),select=outbox.find(x=>x.store==='years'&&x.op==='patch');
 assert.equal(create.patch.calendar_preset_id,undefined);assert.equal(select.patch.calendar_preset_id,year.calendarPresetId);
 assert.equal(select.dependencies.length,2);assert.ok(select.dependencies.every(x=>x.store==='terms'&&x.requiresServerRevision));
 assert.equal((await db.getAll('calendars')).length,0);assert.equal((await db.getAll('calendarDays')).length,0);
 assert.ok(s.state.terms.every(t=>t.calendarId===null));
 const before=await db.getAll('outbox');await s.init();assert.deepEqual(await db.getAll('outbox'),before);
});
test('both selected presets project official reads without rewriting stored IDs or dates',async()=>{
 for(const presetId of ['sa-western-1448-1449','sa-general-1448-1449']){
  const year={...s.activeYear(),calendarPresetId:presetId};await db.put('years',year);await s.init();
  const raw=await db.getAll('terms'),snapshot=await db.getAll('outbox');
  const projected=s.termsOf(year.id);assert.equal(projected[0].startDate,getCalendarPreset(presetId).terms[0].startDate);
  assert.deepEqual(projected.map(t=>t.id),raw.map(t=>t.id));assert.ok(s.calendarRangesOf(year.id).length>0);
  assert.deepEqual(await db.getAll('terms'),raw);assert.deepEqual(await db.getAll('outbox'),snapshot);
 }
});
test('65 retained rejections/blocks and historical sessions remain byte-preserved through init and hold',async()=>{
 const year=s.activeYear(),term=s.activeTerm();
 const context={yearId:year.id,termId:term.id,presetId:'sa-general-1448-1449',selectionRevision:8,kind:'remote',source:'custom',label:'Recorded past'};
 const sessions=[{id:'retained-recorded',teachingId:'retained-teaching',date:'2026-09-23',period:1,status:'held',calendarContext:context},
  {id:'retained-unknown',teachingId:'retained-teaching',date:'2026-09-23',period:2,status:'held'}];
 const originals=Array.from({length:65},(_,i)=>({id:'retained-'+i,protocol:'v2',mutationId:'retained-'+i,store:i?'calendarDays':'years',state:i?'blocked':'rejected',envelopeLocked:true,patch:{evidence:i},lastError:{code:i?null:'22023'},queuedAt:1}));
 await db.clearStore('outbox');await db.putAcross({outbox:originals,sessions,teachings:[{id:'retained-teaching',termId:term.id,deleted:false}]});
 const persistedOriginals=await db.getAll('outbox');
 await s.init();
 assert.equal(s.sessionStatusPresentation(sessions[0]).provenance,'recorded');
 assert.equal(s.sessionStatusPresentation(sessions[1]).provenance,'unrecorded');
 assert.equal(s.sessionStatusPresentation(sessions[1]).calendarContext,null);
 const denied=await s.applyCalendarPreset('sa-general-1448-1449');assert.equal(denied.reason,'calendar-switch-temporary-hold');
 assert.deepEqual(await db.getAll('sessions'),sessions);assert.deepEqual(await db.getAll('outbox'),persistedOriginals);
});
test('a retained year tombstone cannot be recreated as first-use foundation',async()=>{
 await db.clearAll();const deleted={...makeYear(),deleted:true,deletedAt:'2026-10-01T00:00:00Z'};
 await db.put('years',deleted);await s.init();assert.deepEqual(await db.getAll('years'),[deleted]);
 assert.equal((await db.getAll('terms')).length,0);assert.equal((await db.getAll('outbox')).filter(x=>x.store==='years').length,0);
});
test('a selected year with missing/tombstoned term fails closed without filling missing evidence',async()=>{
 await db.clearAll();const records=calendarPresetRecords(getCalendarPreset());
 const deleted={...records.terms[1],deleted:true};await db.putAcross({years:[records.year],terms:[records.terms[0],deleted]});
 await s.init();assert.deepEqual(await db.getAll('terms'),[records.terms[0],deleted]);
 assert.throws(()=>s.effectiveTerm(records.terms[0].id),/missing-official-term/);
 assert.equal((await db.getAll('outbox')).filter(x=>x.store==='terms').length,0);
});
test('scoped overrides serialize stored ISO dates and canonical reads round-trip their scope',()=>{
 const local={id:'scope',yearId:'year',source:'custom',presetId:'sa-western-1448-1449',termDateOverrides:{term:{startDate:'2026-08-31',endDate:'2027-01-06'}}};
 const wire=encodeSyncV2Patch('calendars',local);assert.deepEqual(wire.term_date_overrides,{term:{start_date:'2026-08-31',end_date:'2027-01-06'}});
 const decoded=decodeSyncV2Canonical('calendars',{...wire,id:'scope',revision:1});assert.deepEqual(decoded.termDateOverrides,local.termDateOverrides);
 assert.equal(encodeSyncV2Patch('calendars',{...local,source:'preset:legacy'}).preset_id,undefined);
});
