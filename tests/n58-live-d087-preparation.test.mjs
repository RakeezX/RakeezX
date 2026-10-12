import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { executeLifecycle, liveDeadline, permittedRequest, allocateAction, TASK_RUN } from './n58-live-d087.e2e.mjs';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const f = { sectionId: 'sec:declared', teachingId: 'tch:sec:declared|sub:digital-skills|tm:y:1448-1449:1',
  termId: 'tm:y:1448-1449:1', subjectId: 'sub:digital-skills', itemIds: ['i1','i2','i3','i4','i5'], date: '2026-10-12',
  successSessionId: 'success', legacyDeniedSessionId: 'legacy', staleDeniedSessionId: 'stale',
  mutationIds: Object.fromEntries(['section','teaching','selectGeneral','session','legacyDenied','switchWestern','staleDenied','bDenied'].map(k => [k, 'declared-' + k])) };
const state = { runId: TASK_RUN, accounts: [{slot:'A',id:A}, {slot:'B',id:B}], fixtureIds:{A:f}, foundationDefaults: buildAccountFoundationDefaults() };
const request = (endpoint, method, body, context = 'A1') => permittedRequest({ url:'https://xlrubcwjqktzzunrvuns.supabase.co/' + endpoint, method, body, context, state });

test('preparation: only exact owner reads and fixed two denied session IDs can cross the boundary', () => {
  assert.equal(request('auth/v1/user','GET'),true);
  assert.equal(request('auth/v1/token?grant_type=password','POST',{}),false, 'normal sign-in belongs to the private canonical runner only');
  assert.equal(request('rest/v1/sessions?owner_id=eq.'+A,'GET'),true);
  assert.equal(request('rest/v1/sessions','GET'),false);
  assert.equal(request('rest/v1/sessions?owner_id=eq.'+A,'GET',null,'B1'),false);
  assert.equal(request('rest/v1/sections?owner_id=eq.'+A+'&id=eq.sec:declared','GET',null,'B1'),true);
  const envelope={p_entity:'sessions',p_record_id:'legacy',p_mutation_id:f.mutationIds.legacyDenied,p_operation:'create',p_patch:{}};
  assert.equal(request('rest/v1/rpc/apply_sync_v2_mutation','POST',envelope),true);
  assert.equal(request('rest/v1/rpc/apply_sync_v2_mutation','POST',{...envelope,p_record_id:'other'}),false);
  assert.equal(request('rest/v1/rpc/apply_sync_v2_mutation','POST',envelope,'B1'),false);
  assert.equal(request('rest/v1/rpc/apply_sync_v2_mutation','POST',{...envelope,p_entity:'students'}),false);
  assert.equal(request('rest/v1/sessions?owner_id=eq.'+A,'DELETE'),false);
  assert.equal(request('rest/v1/rpc/arbitrary_function','POST',{}),false);
});

test('preparation: A foundation must equal the current ordinary defaults; B/A2 never provision', () => {
  const body = {p_defaults: state.foundationDefaults};
  assert.equal(request('rest/v1/rpc/provision_account_workspace','POST',body),true);
  const later=structuredClone(body);
  for(const rows of Object.values(later.p_defaults))for(const row of rows)row.updatedAt+=10000;
  assert.equal(request('rest/v1/rpc/provision_account_workspace','POST',later),true,'ordinary current factory timestamps are allowed');
  assert.equal(request('rest/v1/rpc/provision_account_workspace','POST',body,'B1'),false);
  assert.equal(request('rest/v1/rpc/provision_account_workspace','POST',body,'A2'),false);
  const expanded=structuredClone(body); expanded.p_defaults.students=[{id:'forbidden'}];
  assert.equal(request('rest/v1/rpc/provision_account_workspace','POST',expanded),false);
  const teaching={p_mutation_id:f.mutationIds.teaching,p_teaching_id:f.teachingId,p_section_id:f.sectionId,p_subject_id:f.subjectId,p_term_id:f.termId,p_item_ids:f.itemIds};
  assert.equal(request('rest/v1/rpc/apply_sync_v2_teaching_creation_command','POST',teaching),true);
  assert.equal(request('rest/v1/rpc/apply_sync_v2_teaching_creation_command','POST',{...teaching,p_item_ids:[...f.itemIds,'extra']}),false);
});

test('preparation: real deadline is at most 45 minutes from prepare and reserves at least 15', () => {
  const now=Date.now(), prepared={issuedAt:new Date(now).toISOString(), expiresAt:new Date(now+90*60000).toISOString()};
  assert.equal(liveDeadline(prepared,now),now+45*60000);
  assert.throws(()=>liveDeadline(prepared,now+46*60000),{safeCode:'LIVE_DEADLINE_EXHAUSTED'});
  assert.equal(liveDeadline({...prepared,expiresAt:new Date(now+30*60000).toISOString()},now),now+15*60000);
});

for (const failure of ['provision','sign-in','work','none']) test(`preparation: finally disposes exact pair after ${failure}, persists disarm pending`, async () => {
  const calls=[], journals=[];
  const result=await executeLifecycle({ deadline:Date.now()+1000,
    operate:async(op,mode)=>{calls.push([op,mode]); if(op===failure)throw Object.assign(new Error('private credential never emitted'),{safeCode:'EXPECTED_FAILURE'}); return {ok:true};},
    work:async()=>{if(failure==='work')throw Object.assign(new Error('private token never emitted'),{safeCode:'EXPECTED_FAILURE'});},
    close:async()=>calls.push(['close']), bundles:async()=>calls.push(['bundles']), journal:async patch=>journals.push(patch),
  });
  assert.deepEqual(calls.slice(-6),[['close'],['probe','cleanup-only'],['retire','cleanup-only'],['inspect','cleanup-only'],['verify-denial','cleanup-only'],['bundles']]);
  assert.equal(result.workError,failure==='none'?null:'EXPECTED_FAILURE');
  assert.match(journals.at(-1).status,/DISARM_PENDING$/);
  assert.ok(!JSON.stringify(journals).includes('private credential'));
});
test('preparation: cleanup failure does not suppress B disposition/token checks or closed bundles', async()=>{
  const calls=[];
  const result=await executeLifecycle({deadline:Date.now()+1000,operate:async(op)=>{calls.push(op);if(op==='retire')throw Object.assign(new Error(),{safeCode:'EXPECTED_FAILURE'});},
    work:async()=>{},close:async()=>{},journal:async()=>{},bundles:async()=>calls.push('bundles')});
  assert.deepEqual(calls,['provision','sign-in','probe','retire','inspect','verify-denial','bundles']);
  assert.equal(result.cleanup.find(c=>c.operation==='retire').status,'FAIL');
});
test('preparation: timeout aborts Product work and closes owned contexts before cleanup',async()=>{
  let signal,closed=false;
  const result=await executeLifecycle({deadline:Date.now()+15,operate:async(op)=>{if(op==='retire')assert.equal(closed,true);},
    work:async s=>{signal=s;await new Promise(resolve=>s.addEventListener('abort',resolve,{once:true}));},
    close:async()=>{closed=true;},journal:async()=>{},bundles:async()=>{}});
  assert.equal(signal.aborted,true); assert.equal(result.workError,'LIVE_DEADLINE_EXHAUSTED');
});

test('preparation: deterministic IDs reach actual current store/serializers with immutable N58 context', async()=>{
  globalThis.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>null};
  globalThis.matchMedia=()=>({matches:false});
  await store.init();
  store.state.years=[{id:'y:1448-1449',hijriStart:1448,hijriEnd:1449,status:'active',calendarPresetId:'sa-general-1448-1449'}];
  store.state.terms=[{id:f.termId,yearId:'y:1448-1449',index:1,status:'active'},
    {id:'tm:y:1448-1449:2',yearId:'y:1448-1449',index:2,status:'upcoming'}];
  store.state.subjects=[{id:f.subjectId,name:'Synthetic'}];
  store.state.device.deviceId='D087-preparation';
  await db.putMany('years',store.state.years); await db.putMany('terms',store.state.terms); await db.putMany('subjects',store.state.subjects);
  for(const row of await db.getAll('outbox'))await db.remove('outbox',row.id);
  globalThis.window={__n58Gate:{s:store,db}};
  const page={evaluate:async(fn,arg)=>fn(arg)};
  await allocateAction(page,['discard-section',f.mutationIds.section],'section',f);
  await allocateAction(page,['discard-teaching',...f.itemIds,f.mutationIds.teaching],'teaching',f);
  await allocateAction(page,['discard-session',f.mutationIds.session],'session',f);
  const outbox=await db.getAll('outbox');
  assert.deepEqual(outbox.map(r=>r.mutationId).sort(),[f.mutationIds.section,f.mutationIds.teaching,f.mutationIds.session].sort());
  assert.deepEqual(outbox.find(r=>r.command==='teaching:create').patch.itemIds,f.itemIds);
  const session=outbox.find(r=>r.store==='sessions');
  assert.equal(session.patch.calendar_context.presetId,'sa-general-1448-1449');
  assert.equal(session.patch.calendar_context.yearId,'y:1448-1449');
  assert.equal(session.patch.time_profile_id,null);
  assert.equal((await db.getAll('sessions')).length,1);
});
after(()=>{store.closeChannel();db.closeDB();});
