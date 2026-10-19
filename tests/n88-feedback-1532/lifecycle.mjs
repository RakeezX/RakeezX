/** AI: source-level lifecycle regression only. No browser/rendered-UI claim or live identity. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createCloudflareEntry} from '../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {mountClassPortal} from '../../src/views/student-portal-class.js';
import {createSyncOwnershipGuard} from '../../src/lib/sync-ownership.js';
import {mountClassService,classBinding} from '../../src/lib/student-portal-runtime.js';
const report={taskId:'continuous-n88-stable-teacher-real-entry-20261019',runId:'9f6bf669-aa39-4bc2-b65d-b7a446a3a628',scope:'Source-level actual lifecycle modules with a minimal element sink; not a rendered DOM/browser test',status:'FAIL',checks:[]};
class Events {
 constructor(){this.listeners=new Map();}
 addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn);}
 removeEventListener(k,fn){this.listeners.get(k)?.delete(fn);}
 emit(k){for(const fn of [...(this.listeners.get(k)||[])])fn({target:this});}
}
class Element extends Events {
 constructor(doc){super();this.ownerDocument=doc;this.children=[];this.dataset={};this.attrs={};this.paints=0;this.classList={add(){},remove(){}};}
 set innerHTML(v){this.markup=v;this.children=[];this.paints++;}
 get innerHTML(){return this.markup||'';}
 replaceChildren(...v){this.markup='';this.children=v;this.paints++;}
 append(...v){this.children.push(...v);}
 prepend(...v){this.children.unshift(...v);}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelector(){return null;}
 querySelectorAll(){return [];}
 contains(){return false;}
 text(){return this.innerHTML+(this.textContent||'')+this.children.map(e=>e.text?.()||'').join('');}
 totalPaints(){return this.paints+this.children.reduce((n,e)=>n+(e.totalPaints?.()||0),0);}
}
function root(){const d=new Events();d.visibilityState='visible';d.defaultView=new Events();d.defaultView.location={origin:'http://synthetic.invalid'};d.createElement=()=>new Element(d);return new Element(d);}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const context=()=>({enabled:true,ownerId:'synthetic-owner',sessionId:'synthetic-session',leaseId:'synthetic-lease',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1',validUntil:Date.now()+60000});
const roster=()=>({classId:'class',rosterRevision:'a'.repeat(64),policyRevision:0,visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students:[{studentId:'student',enrollmentId:'enrollment',revision:1,label:'SYNTHETIC_ROSTER',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}]});
function subscriber(){const fns=new Set();return {subscribe:fn=>{fns.add(fn);return()=>fns.delete(fn);},emit:()=>{for(const fn of [...fns])fn();}};}
async function notifications(mount){
 const r=root(),s=subscriber();let lists=0,guidance=0;
 const h=mount(r,{getContext:context,subscribe:s.subscribe,copy:()=>{},share:null,client:{listClass:async()=>{lists++;return roster();},listGuidance:async()=>{guidance++;return {tasks:[]};}}});
 await delay(65);const beforePaint=r.totalPaints();
 for(let i=0;i<4;i++){s.emit();await delay(65);}
 const result={lists,guidance,extraPaints:r.totalPaints()-beforePaint};
 h.dispose();return result;
}
try{
 let old=execFileSync('git',['show','98885befd4f13c02210661309a4add21e04c72ca:src/views/student-portal-class.js'],{encoding:'utf8'});
 old=old.replaceAll("'../lib/dom.js'",JSON.stringify(pathToFileURL(process.cwd()+'/src/lib/dom.js').href)).replaceAll("'../lib/student-portal-class-client.js'",JSON.stringify(pathToFileURL(process.cwd()+'/src/lib/student-portal-class-client.js').href));
 const baseline=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
 report.baseline=await notifications(baseline.mountClassPortal);assert(report.baseline.lists>1&&report.baseline.guidance>1&&report.baseline.extraPaints>0);
 report.corrected=await notifications(mountClassPortal);assert.deepEqual(report.corrected,{lists:1,guidance:1,extraPaints:0});
 report.checks.push('Immutable base reproduces repeated identical list/guidance reads and repaints; corrected same-key notifications cause zero reads or paints.');
 // Actual composition/transport/ACK validators and binding gates; synthetic dependencies only.
 const s=subscriber(),r=root(),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 let leaseValid=true, hold=false,release,lists=0,guidance=0;
 const w={id:'lease',type:'account',authUserId:owner,databaseName:'synthetic',leaseGeneration:'1',ownershipState:'claimed',syncEligible:true},term={id:'term',yearId:'year',revision:1},teaching={id:'teaching',termId:'term',sectionId:'class',revision:1};
 const cloud={user:{id:owner},session:{access_token:'e30.'+Buffer.from(JSON.stringify({session_id:'session',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.signature'},authStatus:()=>({state:'authenticated'})};
 const store={state:{enrollments:[{id:'enrollment',sectionId:'class',studentId:'student'}],students:[{id:'student',revision:1}],sections:[{id:'class',revision:1}],items:[],scoreSubitems:[]},getActiveWorkspace:()=>w,getTeaching:()=>teaching,activeTerm:()=>term,isTeachingArchived:()=>false,assertClassOperationsAccess(){},assertLeaseWritable(){if(!leaseValid)throw Error('lease');}};
 const guard=createSyncOwnershipGuard({workspace:w});
 const bind=write=>classBinding({cloud,store,teachingId:'teaching',guard},write);
 const originalToken=cloud.session.access_token;cloud.session.access_token='e30.'+Buffer.from(JSON.stringify({session_id:'session',exp:1})).toString('base64url')+'.signature';assert.throws(()=>bind(false),e=>e.portalState==='session');cloud.session.access_token=originalToken;
 const key=bind(false).key;store.state.device={cloudProgress:1};assert.equal(bind(false).key,key);
 store.state.students[0].revision++;assert.notEqual(bind(false).key,key);
 const h=mountClassService(r,{getBinding:bind,subscribe:s.subscribe,fetch:async(path,init)=>{
  const b=JSON.parse(init.body);if(path.endsWith('/list')){lists++;if(hold)await new Promise(ok=>release=ok);}else guidance++;
  return {ok:true,json:async()=>({ack:true,binding:b.binding,requestId:null,rollout:'public',data:path.endsWith('/list')?roster():{tasks:[]}})};
 }});
 await delay(80);assert(r.text().includes('SYNTHETIC_ROSTER'));assert.equal(lists,1);assert.equal(guidance,1);
 const paint=r.totalPaints();for(let i=0;i<6;i++)s.emit();await delay(90);assert.equal(lists,1);assert.equal(guidance,1);assert.equal(r.totalPaints(),paint);
 hold=true;r.ownerDocument.defaultView.emit('focus');await delay(65);assert.equal(lists,2);assert(r.text().includes('SYNTHETIC_ROSTER'),'same-context refresh retains data while waiting');for(let i=0;i<6;i++)s.emit();
 guard.setWorkspace({...w,authUserId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});s.emit();assert(!r.text().includes('SYNTHETIC_ROSTER'),'owner denial clears synchronously');release();await delay(80);assert(!r.text().includes('SYNTHETIC_ROSTER'),'late response cannot restore data');
 guard.setWorkspace(w);hold=false;s.emit();await delay(80);assert(r.text().includes('SYNTHETIC_ROSTER'));
 store.state.students[0].revision++;hold=true;s.emit();assert(!r.text().includes('SYNTHETIC_ROSTER'),'canonical source change clears synchronously');await delay(15);release();hold=false;await delay(80);
 leaseValid=false;s.emit();assert(!r.text().includes('SYNTHETIC_ROSTER'),'lease denial clears synchronously');
 h.dispose();
 report.checks.push('Actual classBinding/ownership guard/composition/transport ACK validation; expired session denied: unrelated device notification stable; canonical student revision re-admits; delayed same-context refresh retains roster; owner/source/lease changes clear immediately; late response denied.');
 const docRequest=new Request('https://rakeezx.com/student');Object.defineProperty(docRequest,'cf',{value:{tlsVersion:'TLSv1.3'}});
 let upstream=0;const response=await createCloudflareEntry({fetch:()=>{upstream++;throw Error('unexpected upstream');}})(docRequest,{N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://rakeezx.com'});
 assert.equal(response.status,200);assert.equal(upstream,0);assert.equal(response.headers.get('cache-control'),'no-store, private');
 assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),'16a23577cc44f3d72584ef1ac0c1b44d6c3598ebdb2304c659c4e7d498c8e20c');
 report.checks.push('Existing actual ingress module serves exact qualified student HTML without any backend call or private key; no service source change required.');
 report.sourceHashSerialization='Git LF UTF-8';report.sourceSha256={};for(const p of ['src/lib/student-portal-runtime.js','src/views/student-portal-class.js','drafts/n88-student-portal/cloudflare-entry.mjs','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs'])report.sourceSha256[p]=createHash('sha256').update((await readFile(p,'utf8')).split(String.fromCharCode(13,10)).join(String.fromCharCode(10))).digest('hex');
 report.residual='Browser ownership refusal retained; this is not a real-owner browser journey, layout rendering proof, or diagnosis of the reported client host timeout.';
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await writeFile('tests/n88-feedback-1532/lifecycle.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
