/** AI: meaningful request/retirement/timeout guards, no live service. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
const report={status:'PASS',checks:[]},good={version:'n88-student-v3',profile:{name:'synthetic'}};
const response=(status=200)=>new Response(JSON.stringify(good),{status});
for(const operation of ['read','end'])for(const phase of ['fetch','body']){
 let late;const calls=[];const c=createUnifiedStudentPortalClient({timeoutMs:30,fetch:async(url,init)=>{calls.push({path:url,method:init.method,credentials:init.credentials,cache:init.cache});if(phase==='fetch')return new Promise(ok=>late=()=>ok(response()));return {ok:true,status:200,json:()=>new Promise(ok=>late=()=>ok(good))};}});
 if(operation==='end'&&phase==='body'){await c.end();assert.equal(late,undefined);}else{await assert.rejects(c[operation](),e=>e.kind==='unavailable');late();}
 assert.equal(calls.length,1);assert.equal(calls[0].credentials,'same-origin');assert.equal(calls[0].cache,'no-store');c.dispose();report.checks.push(operation+'-'+phase+'-bounded-no-replay');
}
for(const operation of ['read','end']){let release;const c=createUnifiedStudentPortalClient({fetch:()=>new Promise(ok=>release=()=>ok(response()))});const p=c[operation]();c.invalidate();await assert.rejects(p,e=>e.kind==='stale');release();c.dispose();report.checks.push(operation+'-retirement-before-late-response');}
for(const status of [401,403,410,429,503]){const c=createUnifiedStudentPortalClient({fetch:async()=>response(status)});await assert.rejects(c.read(),e=>e.kind===([401,403,410].includes(status)?'session':status===429?'rate':'unavailable'));c.dispose();report.checks.push('explicit-http-'+status);}
for(const [status,state] of [[401,'rejected'],[503,'uncertain']]){let posts=0;const c=createUnifiedStudentPortalClient({fetch:async()=>{posts++;return response(status);}});await assert.rejects(c.claim('123456'),e=>e.claimState===state);assert.equal(posts,1);c.dispose();}
await writeFile('tests/n88-student-reopen-end-guidance-20261021/transport.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
