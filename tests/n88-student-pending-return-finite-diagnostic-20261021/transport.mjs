/** AI: targeted current-context, bounded transport and finite diagnostic checks. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
const report={status:'PASS',checks:[]},good={version:'n88-student-v3',profile:{name:'synthetic'},secret:'never-project'};
const response=(status=200,body=good)=>new Response(JSON.stringify(body),{status,headers:{'Retry-After':'1'}});
const keys=['action','phase','outcome','httpStatusClass','elapsedMs','visibility','retirementReason'].sort();
function finite(d){assert.deepEqual(Object.keys(d).sort(),keys);assert.equal(d.elapsedMs%250,0);assert(d.elapsedMs>=0&&d.elapsedMs<=15000);assert(!JSON.stringify(d).includes('never-project'));}
for(const action of ['read','end'])for(const status of [200,401,403,410,429,503]){
 const calls=[],c=createUnifiedStudentPortalClient({fetch:async(url,init)=>{calls.push({url,init});return response(status);}});
 if(status===200){const data=await c[action]();if(action==='read'){assert.equal(data.secret,undefined);assert.equal(data.profile.name,'synthetic');}}
 else await assert.rejects(c[action](),e=>e.kind===([401,403,410].includes(status)?'session':status===429?'rate':'unavailable'));
 assert.equal(calls.length,1);const {url,init}=calls[0];assert.equal(url,'/api/n88/student/'+action);assert.equal(init.method,action==='read'?'GET':'POST');
 assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.referrerPolicy,'no-referrer');
 assert.equal(init.body,action==='end'?'{}':undefined);
 const d=c.getDiagnostic();finite(d);assert.equal(d.action,action);assert.equal(d.phase,action==='end'?'end':'manual');
 assert.equal(d.outcome,status===200?'success':[401,403,410].includes(status)?'denied':status===429?'rate':'unavailable');
 d.action='injected';assert.equal(c.getDiagnostic().action,action);c.dispose();report.checks.push(action+'-http-'+status+'-finite-no-replay');
}
for(const phase of ['initial','return','manual','INVALID_PRIVATE']){
 const c=createUnifiedStudentPortalClient({fetch:async()=>response()});await c.read({phase});assert.equal(c.getDiagnostic().phase,phase==='INVALID_PRIVATE'?'manual':phase);c.dispose();
}
// A resumed browser may deliver a fetch promise before its delayed timer runs.
for(const action of ['read','end']){
 const original=globalThis.performance;let clock=0;
 try{
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
 const c=createUnifiedStudentPortalClient({fetch:async()=>{clock=16000;return response();}});
 await assert.rejects(c[action](),e=>e.kind==='timeout');assert.equal(c.getDiagnostic().outcome,'timeout');assert.equal(c.getDiagnostic().elapsedMs,15000);c.dispose();
 }finally{Object.defineProperty(globalThis,'performance',{configurable:true,value:original});}
 report.checks.push(action+'-suspended-timer-late-promise-is-timeout');
}
for(const stage of ['fetch','body'])for(const action of ['read','end']){
 if(action==='end'&&stage==='body')continue;
 let late,signal;const c=createUnifiedStudentPortalClient({timeoutMs:30,fetch:async(url,init)=>{signal=init.signal;if(stage==='fetch')return new Promise(ok=>late=()=>ok(response()));return {ok:true,status:200,json:()=>new Promise(ok=>late=()=>ok(good))};}});
 await assert.rejects(c[action](),e=>e.kind==='timeout');assert(signal.aborted);assert.equal(c.getDiagnostic().outcome,'timeout');finite(c.getDiagnostic());
 late();await new Promise(ok=>setTimeout(ok,10));assert.equal(c.getDiagnostic().outcome,'timeout');c.dispose();report.checks.push(action+'-'+stage+'-timeout-ignores-abort-no-late-adoption');
}
for(const action of ['read','end'])for(const reason of ['hidden','pagehide','disposed','context']){
 let late;const c=createUnifiedStudentPortalClient({fetch:()=>new Promise(ok=>late=()=>ok(response()))});const pending=c[action]();c.invalidate(reason);
 await assert.rejects(pending,e=>e.kind==='stale');assert.equal(c.getDiagnostic().outcome,'stale');assert.equal(c.getDiagnostic().retirementReason,reason);
 late();await new Promise(ok=>setTimeout(ok,5));assert.equal(c.getDiagnostic().outcome,'stale');c.dispose();report.checks.push(action+'-'+reason+'-retirement-no-ack');
}
{
 const resolvers=[],c=createUnifiedStudentPortalClient({fetch:()=>new Promise(ok=>resolvers.push(ok))});
 const old=c.read({phase:'initial'}),rejected=assert.rejects(old,e=>e.kind==='stale');const current=c.read({phase:'return'});await rejected;
 resolvers[1](response());await current;resolvers[0](response(401));await new Promise(ok=>setTimeout(ok,5));assert.equal(c.getDiagnostic().phase,'return');assert.equal(c.getDiagnostic().outcome,'success');c.dispose();
 report.checks.push('superseded-read-cannot-overwrite-current-diagnostic');
}
for(const malformed of [{version:'wrong'},null,{version:'n88-student-v3',grades:{items:'invalid'}}]){
 const c=createUnifiedStudentPortalClient({fetch:async()=>response(200,malformed)});await assert.rejects(c.read(),e=>e.kind==='unavailable');assert.equal(c.getDiagnostic().outcome,'unavailable');assert.equal(c.getDiagnostic().httpStatusClass,'2xx');c.dispose();
}
{
 const c=createUnifiedStudentPortalClient({fetch:async()=>{throw Error('PRIVATE provider payload');}});await assert.rejects(c.read(),e=>!e.message.includes('PRIVATE'));finite(c.getDiagnostic());c.dispose();
}
for(const status of [401,503]){
 let n=0;const c=createUnifiedStudentPortalClient({fetch:async()=>{n++;return response(status);}});await assert.rejects(c.claim('123456'),e=>e.claimState===(status===401?'rejected':'uncertain'));
 assert.equal(n,1);assert.equal(c.getDiagnostic(),null);c.dispose();
}
{
 const actions=[],c=createUnifiedStudentPortalClient({fetch:async url=>{actions.push(url.split('/').at(-1));return response();}});await c.claim('123456');assert.deepEqual(actions,['claim','read']);assert.equal(c.getDiagnostic().action,'read');c.dispose();
}
report.checks.push('malformed-raw-error-claim-budget-and-diagnostic-allowlist');
await writeFile('tests/n88-student-pending-return-finite-diagnostic-20261021/transport.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
