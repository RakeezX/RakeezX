/** AI: current real service + browser codec, fabricated ports. No native/hosted campaign. */
import test from 'node:test';import assert from 'node:assert/strict';
import { fixture } from './service-fixture.mjs';
import { createPublicationClient, publicationFailure, parsePublicationStudentData, PUBLICATION_V2_READINESS } from '../../src/lib/student-portal-publication-client.js';
import { createUnifiedStudentPortalClient } from '../../src/lib/student-portal-unified-client.js';
const off={required:false,scheduled:false,completed:false,grade:false};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
function client(f,{timeoutMs=10000,store=storage(),preflight=()=>{},reply=r=>r,identity=()=>({scope:f.scope,binding:f.binding,key:'owned-current-context'})}={}){
 return {store,c:createPublicationClient({getIdentity:identity,storage:()=>store,timeoutMs,dispatch:async(path,init,mark)=>{preflight();mark();return reply(await f.request(path,{...init,headers:{...init.headers,Authorization:'Bearer '+f.token}}));}})};
}
test('server revisions, explicit four flags, grade components, manual preview and numeric student read',async()=>{
 const f=await fixture(),{c}=client(f);const list=await c.list();assert.equal(list.rows.length,4);assert(list.rows.every(r=>Object.values(r.decisions).every(v=>!v)));
 for(const [source,flag] of [['required','required'],['scheduled','scheduled'],['completed','completed'],['direct','grade']]){
  const l=await c.list(),r=l.rows.find(r=>r.sourceId===source);assert.match(r.sourceRevision,/^[a-f0-9]{64}$/);
  assert.equal((await c.save(r.id,{...off,[flag]:true})).state,'confirmed');
 }
 const l=await c.list(),child=l.rows.find(r=>r.sourceId==='completed');await c.save(child.id,{...off,grade:true,completed:true});
 await c.list();const manual=await c.preview({id:'manual-test',title:'شرح المعلم',description:'نص',startDate:'2026-10-31',dueDate:null,link:'https://example.test/exam'});
 assert.match(manual.sourceRevision,/^[a-f0-9]{64}$/);await c.save(manual.id,{...off,required:true});
 let cookie;
 const student=createUnifiedStudentPortalClient({publicationReadiness:{enabled:true,serviceRevision:PUBLICATION_V2_READINESS.serviceRevision},fetch:async(path,init)=>{
   const response=await f.request(path,{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})}});
   if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;
 }});
 const data=await student.claim(f.code);assert.equal(data.version,'n88-publication-v2');assert.equal(data.work.length,4);assert.equal(data.grades.length,2);
 assert.deepEqual(data.grades.map(r=>r.value),[5,4]);assert(!JSON.stringify(data).includes('total'));
 await student.end();await assert.rejects(()=>student.read());student.dispose();c.dispose();
});
test('lost ACK persists exact original command, reload permits status only; list never clears UNKNOWN',async()=>{
 const f=await fixture(),store=storage();let {c}=client(f,{store});const l=await c.list(),r=l.rows[0];f.state.lost=true;
 await assert.rejects(()=>c.save(r.id,{...off,grade:true}),e=>publicationFailure(e)==='unknown');
 assert.equal(c.pendingState(),'unknown');const sent=f.state.teacherCalls.find(b=>b.action==='item-publication-set');
 assert(![...store.m.values()].some(raw=>raw.includes('access_token')||raw.includes('value')));
 c.dispose();c=client(f,{store}).c;await c.list();assert.equal(c.pendingState(),'unknown');
 await assert.rejects(()=>c.save(r.id,off),e=>publicationFailure(e)==='unknown');
 assert.equal((await c.status()).state,'confirmed');assert.equal(c.pendingState(),'clear');
 assert.equal(f.state.teacherCalls.filter(b=>b.action==='item-publication-set').length,1);
 assert.deepEqual(f.state.teacherCalls.find(b=>b.action==='status').command,sent);c.dispose();
});
test('real pre-dispatch refusal is not_started; timeout/transport/body failures after dispatch stay UNKNOWN',async()=>{
 const f=await fixture();let refuse=false;const {c}=client(f,{preflight:()=>{if(refuse)throw Error('owner guard refusal');}});
 const l=await c.list();refuse=true;await assert.rejects(()=>c.save(l.rows[0].id,off),e=>publicationFailure(e)==='not_started');assert.equal(c.pendingState(),'clear');
 assert.equal(f.state.teacherCalls.filter(b=>b.action==='item-publication-set').length,0);c.dispose();
 const slow=client(f,{timeoutMs:20}).c;await slow.list();f.state.delay=60;
 await assert.rejects(()=>slow.save(l.rows[0].id,off),e=>publicationFailure(e)==='unknown');assert.equal(slow.pendingState(),'unknown');slow.dispose();f.state.delay=0;
 let corrupt=false;const malformed=client(f,{reply:r=>corrupt?new Response('not JSON',{status:200}):r}).c;
 const current=await malformed.list();corrupt=true;
 await assert.rejects(()=>malformed.save(current.rows[1].id,off),e=>publicationFailure(e)==='unknown');
 assert.equal(malformed.pendingState(),'unknown');malformed.dispose();
});
test('source/membership revision conflict, strict projection, stale owner/session and private-storage boundaries',async()=>{
 const f=await fixture();let context={scope:f.scope,binding:f.binding,key:'stable'};const {c}=client(f,{identity:()=>context});
 const list=await c.list();f.state.canonical.scoreSubitems[0].revision='2';
 await assert.rejects(()=>c.save(list.rows[0].id,{...off,grade:true}),e=>publicationFailure(e)==='unknown');
 assert.equal(c.pendingState(),'unknown');context={...context,binding:{...context.binding,sessionId:'other'}};
 await assert.rejects(()=>c.list(),e=>publicationFailure(e)==='stale');c.dispose();
 for(const data of [{work:[],grades:[],total:5},{work:[{id:'x',title:'x',categories:['required'],startDate:null,dueDate:null,description:'',link:'javascript:alert(1)'}],grades:[]},
  {work:[],grades:[{id:'x',title:'x',value:5,ownerId:'other'}]}])assert.throws(()=>parsePublicationStudentData(data));
 const denied=client(f,{store:{getItem:()=>null,setItem:()=>{throw Error();}}}).c;await denied.list();
 await assert.rejects(()=>denied.save(list.rows[0].id,off),e=>publicationFailure(e)==='not_started');denied.dispose();
});
test('default readiness remains OFF and V1 student endpoint remains selected',async()=>{
 assert.equal(PUBLICATION_V2_READINESS.enabled,false);const calls=[];
 const c=createUnifiedStudentPortalClient({fetch:async(path)=>{calls.push(path);return Response.json({version:'n88-student-v3'});}});
 await c.read();assert.deepEqual(calls,['/api/n88/student/read']);c.dispose();
});
test('changed membership CAS does not publish and a different class cannot adopt a pending command',async()=>{
 const f=await fixture(),store=storage();const {c}=client(f,{store});const listed=await c.list();
 f.state.canonical.enrollments[0].revision='2';
 await assert.rejects(()=>c.save(listed.rows[0].id,{...off,required:true}),e=>publicationFailure(e)==='unknown');
 assert(f.snapshot().scopes[0].publications.every(p=>!p.decisions.required));
 const before=f.state.teacherCalls.length;c.dispose();
 const other=client(f,{store,identity:()=>({scope:{...f.scope,sectionId:'other'},binding:f.binding,key:'other-class'})}).c;
 assert.equal(other.pendingState(),'clear');assert.equal(f.state.teacherCalls.length,before);other.dispose();
});
