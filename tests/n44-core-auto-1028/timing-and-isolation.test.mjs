/** AI: actual backend/repository/canonical/delivery with synthetic SQL, clock and provider only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackend} from '../../drafts/n44-push/backend.mjs';
import {readSource} from '../../drafts/n44-push/canonical-source.mjs';
import {runScheduled} from '../../drafts/n44-push/scheduler-entry.mjs';
import {fixture} from '../n44-fixture.mjs';
const O='a4400000-0000-4000-8000-000000000001',R='11111111-1111-4111-8111-111111111111';
const G='33333333-3333-4333-8333-333333333333',sha='a'.repeat(40),approval='b'.repeat(64);
async function setup(kind='lesson',zone='Asia/Riyadh',stage=0){
 const data=fixture(),source={year:data.years[0],terms:[data.terms[0]],calendars:[],days:[],teaching:data.teachings[0],section:data.sections[0],subject:data.subjects[0],source:kind==='lesson'?data.sessions[0]:{...data.scoreSubitems[0],scoreMode:'subitems'}};
 const p={lesson:true,due:true,lessonMinutes:15,dueDays:[3,2,1,0],timezone:zone,quiet:null};
 const f={source,now:0,sends:0,outcome:'accepted',queryCount:0,failCommit:false};
 const sourceQuery=async(sql,v)=>{
  if(sql.startsWith('select n44_push_draft.read_source')){assert.equal(v[0],O);return {rows:[{source:f.source}]};}
  if(sql.startsWith('select (extract(epoch')){assert.equal(v[2],zone);return {rows:[{ms:String(Date.parse(v[0]+'T'+v[1]+':00Z')-(zone==='Asia/Riyadh'?3:14)*3600000)}]};}
  throw Error('unexpected canonical SQL');
 };
 const canonical=await readSource(sourceQuery,O,kind,kind==='lesson'?'n44-session':'n44-due',p);
 const e=canonical.events[kind==='lesson'?0:3-stage];
 f.now=e.dueAt-60000;
 const descriptor={grantId:G,ownerId:O,activatedAt:f.now,hardEnd:f.now+3600000,tickMs:60000,tickCap:10,sendCap:1,targets:[{workspaceId:'w',deviceId:'d',registrationId:R,sourceKind:kind,sourceId:kind==='lesson'?'n44-session':'n44-due',sourceStamp:canonical.stamp,eventId:e.id}]};
 // Due midnight in Kiritimati/Riyadh is within a UTC day. Lesson too.
 const policy={v:2,approvalState:'active',approvalId:approval,serviceRevision:'n44-browser-service-v2',serviceSourceSha:sha,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'c'.repeat(64),observedAt:f.now-1000,activatedAt:f.now-1000};
 const {dueAt,...payload}=e;
 f.db={contexts:[{workspace_id:'w',device_id:'d',active:true,session_id:'s',session_revision:'s:'+approval,session_expires_at_ms:String(f.now+86400000),consent_revision:'c',push_consent:true,preferences:JSON.stringify(p)}],registrations:[{registration_id:R,workspace_id:'w',device_id:'d',session_id:'s',session_revision:'s:'+approval,consent_revision:'c',state:'active',expires_at_ms:String(f.now+86400000),sealed:'synthetic',fingerprint:'d'.repeat(64),binding_fingerprint:'e'.repeat(64)}],deliveries:[],budgets:[],endpoint_claims:[{fingerprint:'d'.repeat(64),registration_id:R}],events:[{owner_id:O,workspace_id:'w',device_id:'d',event_id:e.id,source_kind:kind,source_id:descriptor.targets[0].sourceId,source_stamp:canonical.stamp,due_at_ms:dueAt,payload}]};
 let tail=Promise.resolve();
 const acquire=async()=>{
  const previous=tail;let release;tail=new Promise(r=>release=r);await previous;
  let db=structuredClone(f.db);
  return {release(){release();},async query(sql,v=[]){
   f.queryCount++;
   if(sql==='commit'){f.db=db;if(f.failCommit){f.failCommit=false;throw Error('synthetic lost COMMIT ACK');}return {rows:[]};}
   if(sql==='rollback'||sql.startsWith('begin')||sql.startsWith('set local'))return {rows:[]};
   if(sql.startsWith('insert into n44_push_draft.owner_clock')||sql.startsWith('update n44_push_draft.owner_clock'))return {rows:[]};
   if(sql.includes('high_water_ms::text'))return {rows:[{high_water_ms:String(f.now)}]};
   if(sql.includes('clock_timestamp()'))return {rows:[{now_ms:String(f.now)}]};
   if(sql.includes('lock_current_session'))return {rows:[{user_id:O,session_id:'s',not_after_ms:null}]};
   if(sql.startsWith('select n44_push_draft.read_source')||sql.startsWith('select (extract(epoch'))return sourceQuery(sql,v);
   if(sql.startsWith('select * from n44_push_draft.events')){assert.equal(v[0],O);return {rows:db.events.filter(e=>v.length===1||e.workspace_id===v[1]&&e.device_id===v[2]&&e.event_id===v[3])};}
   const table=sql.match(/from n44_push_draft.(contexts|registrations|deliveries|budgets|endpoint_claims) /)?.[1];
   if(table&&sql.startsWith('select')){assert.equal(v[0],O);return {rows:structuredClone(db[table])};}
   const put=sql.match(/^insert into n44_push_draft.(\w+) \(([^)]+)\)/);
   if(put){assert.equal(v[0],O);const row=Object.fromEntries(put[2].split(',').slice(1).map((k,i)=>[k,v[i+1]]));
    const key=put[1]==='budgets'?'budget_key':put[1]==='deliveries'?'event_id':'registration_id';
    const at=db[put[1]].findIndex(x=>x[key]===row[key]);if(at<0)db[put[1]].push(row);else db[put[1]][at]=row;return {rows:[]};}
   throw Error('unexpected SQL: '+sql);
  }};
 };
 f.make=(scope=descriptor)=>createBackend({acquire,authUrl:'https://synthetic.example',apiKey:'synthetic',crypto:{sender:{async send(){f.sends++;return f.outcome;}}},rateKey:new Uint8Array(32),sessionPolicy:policy,serviceSourceSha:sha,now:()=>f.now,finiteScheduler:scope});
 f.backend=f.make();f.tick=()=>f.backend.schedule({operation:'finite-due',cursor:null,limit:1});f.event=e;f.descriptor=descriptor;return f;
}
test('automatic lesson and all due stages in Riyadh and Kiritimati, no early delivery',async()=>{
 for(const zone of ['Asia/Riyadh','Pacific/Kiritimati'])for(const stage of [-1,3,2,1,0]){
  const f=await setup(stage===-1?'lesson':'due',zone,stage);await f.tick();assert.equal(f.sends,0);
  f.now=f.event.dueAt;assert.equal((await f.tick()).outcomes[0],'sent');assert.equal(f.sends,1);
  f.now+=60000;await f.tick();assert.equal(f.sends,1);
 }
});
test('quiet/category, source cancellation/deletion, consent and device isolation',async()=>{
 for(const mutate of [f=>{const p=JSON.parse(f.db.contexts[0].preferences);p.quiet={start:0,end:0};f.db.contexts[0].preferences=JSON.stringify(p);},f=>{const p=JSON.parse(f.db.contexts[0].preferences);p.lesson=false;f.db.contexts[0].preferences=JSON.stringify(p);},f=>f.source.source.status='cancelled',f=>f.source.source.deleted=true,f=>f.db.contexts[0].push_consent=false,f=>f.db.contexts[0].active=false,f=>f.db.registrations[0].device_id='foreign']){
  const f=await setup();mutate(f);f.now=f.event.dueAt;await f.tick();assert.equal(f.sends,0);
 }
});
test('duplicate concurrent ticks, UNKNOWN, restart and changed descriptor cannot replenish',async()=>{
 const f=await setup();f.now=f.event.dueAt;f.outcome='uncertain';await Promise.all([f.tick(),f.tick()]);assert.equal(f.sends,1);
 f.backend=f.make();f.now+=60000;await f.tick();assert.equal(f.sends,1);
 f.backend=f.make({...f.descriptor,sendCap:2});f.now+=60000;await f.tick();assert.equal(f.sends,1);
});
test('lost tick COMMIT acknowledgment and hard end fail closed',async()=>{
 const f=await setup();f.now=f.event.dueAt;f.failCommit=true;await assert.rejects(f.tick());assert.equal(f.sends,0);
 await f.tick();assert.equal(f.sends,0);f.now=f.descriptor.hardEnd;
 assert.equal((await f.tick()).status,'disabled');assert.equal(f.sends,0);
});
test('scheduler uses signed finite operation, disabled defaults never fetch',async()=>{
 let calls=0;assert.equal((await runScheduled({}, {fetch(){calls++;}})).status,'disabled');assert.equal(calls,0);
 const result=await runScheduled({N44_ENABLED:'true',N44_SCHEDULER_ENABLED:'true',N44_FINITE_SCHEDULER:'true',N44_EDGE_URL:'https://synthetic.example/functions/v1/n44-notifications',N44_SCHEDULER_KEY:'a'.repeat(64)},{fetch:async request=>{calls++;assert.ok(request.headers.get('x-n44-signature'));assert.deepEqual(await request.json(),{operation:'finite-due',cursor:null,limit:1});return Response.json({status:'completed'});}});
 assert.equal(result.status,'completed');assert.equal(calls,1);
});


test('tick ceiling, source pin, owner guard and send ceiling are durable',async()=>{
 const f=await setup();f.backend=f.make({...f.descriptor,tickCap:1});await f.tick();f.now=f.event.dueAt;await f.tick();assert.equal(f.sends,0);
 const wrong=await setup();wrong.db.events[0].source_stamp='f'.repeat(64);wrong.now=wrong.event.dueAt;await wrong.tick();assert.equal(wrong.sends,0);
 const {finiteScope,finiteGuards}=await import('../../drafts/n44-push/core-teacher-scheduler.mjs');
 const a=finiteScope(f.descriptor),g=finiteGuards(a),budgets=new Map();
 const tx={get:(_t,k)=>budgets.get(k),set:(_t,k,v)=>budgets.set(k,v),entries:()=>[...budgets]};
 const r={workspaceId:'w',deviceId:'d',registrationId:R},payload={id:f.event.id,kind:'lesson'};
 assert.equal(g.beforePermit(tx,'foreign',r,payload,a.activatedAt),false);
 assert.equal(g.beforePermit(tx,O,r,payload,a.activatedAt),true);
 assert.equal(g.beforePermit(tx,O,r,payload,a.activatedAt+1),false);
 assert.throws(()=>finiteScope({...f.descriptor,hardEnd:f.descriptor.activatedAt+86400000}));
 assert.throws(()=>finiteScope({...f.descriptor,targets:[...f.descriptor.targets,...f.descriptor.targets]}));
});

test('staged scheduled callback executes finite signed driver without HTTP send endpoint',async()=>{
 const {default:worker}=await import('../../drafts/n44-push/activation/bundle/scheduler/worker.mjs');
 const original=globalThis.fetch;let pending,calls=0;
 try{
  globalThis.fetch=async request=>{calls++;assert.deepEqual(await request.json(),{operation:'finite-due',cursor:null,limit:1});return Response.json({status:'completed'});};
  worker.scheduled({}, {N44_ENABLED:'true',N44_SCHEDULER_ENABLED:'true',N44_FINITE_SCHEDULER:'true',N44_EDGE_URL:'https://synthetic.example/functions/v1/n44-notifications',N44_SCHEDULER_KEY:'a'.repeat(64)},{waitUntil(p){pending=p;}});
  assert.equal((await pending).status,'completed');assert.equal(calls,1);assert.equal(worker.fetch().status,503);
 }finally{globalThis.fetch=original;}
});

test('finite configuration denies general due/cleanup operations',async()=>{
 const f=await setup();const before=f.queryCount;
 for(const operation of ['due','cleanup','one-device-test'])assert.equal((await f.backend.schedule({operation,cursor:null,limit:1})).status,'disabled');
 assert.equal(f.queryCount,before);assert.equal(f.sends,0);
});
