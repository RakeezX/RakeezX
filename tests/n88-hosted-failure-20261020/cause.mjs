import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {composition} from './composition.mjs';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
import {readCanonical} from '../../drafts/n88-student-portal/integrated-service.mjs';
import {A,SESSION} from '../fixtures/n88-existing-host/provider.mjs';
const baseline=process.env.N88_CAUSAL_BASELINE==='1',report={status:'FAIL',baseline,scope:'Real client / signed ingress / Web entry / Auth SDK / integrated repository, controlled synthetic PostgreSQL port. Not hosted account acceptance.',checks:[]};
const context={enabled:true,ownerId:A,sessionId:SESSION,leaseId:'synthetic-lease',teachingId:'tch:teach:synthetic',classId:'tch:sec:synthetic',termId:'term',contextRevision:'1',validUntil:Date.now()+120000};
let pending=[];
function client(service,c=context){return createClassPortalClient({getContext:()=>c,request:async(path,init)=>{const work=service.send(path,{...init,headers:{...init.headers,Authorization:'Bearer '+service.provider.token()},body:JSON.stringify({...JSON.parse(init.body),uiProtocol:'n88-public-ui-v1'})});pending.push(work);const response=await work;return {ok:response.ok,json:async()=>{const {rollout,...ack}=await response.json();assert.equal(rollout,'public');return ack;}};}});}
try{
 const service=composition({classId:context.classId,teachingId:context.teachingId,firstDelay:0,nextDelay:0,canonicalDelay:850}),started=performance.now();
 if(baseline)await assert.rejects(client(service).listClass(context.teachingId),e=>e.code==='timeout');
 else {const result=await client(service).listClass(context.teachingId);assert.equal(result.students.length,1);assert.equal(result.students[0].credential,null);}
 report.clientElapsedMs=Math.round(performance.now()-started);await Promise.all(pending);pending=[];
 report.canonicalReads=service.phases.filter(x=>x.startsWith('canonical:'));assert.equal(report.canonicalReads.length,baseline?13:2);assert(service.phases.includes('projection-source-lock'));assert(service.phases.includes('membership-synchronize'));assert(service.counts.commits>0);
 report.checks.push('Unchanged default 10000ms client deadline: baseline 13 sequential bounded reads times out; list-only 2 consumed families succeeds with actual commit ACK. Full source lock and authoritative membership synchronization retained.');
 if(!baseline){
  const full=[];await readCanonical({query:async(sql)=>{full.push(sql);return {rows:[]};}},A);assert.equal(full.length,14);assert(full[0].includes('lock_projection_sources'));report.checks.push('Full 13-family projection remains default for student/visibility/guidance; no SQL/type/lock contract rewritten.');
  const denied=composition({classId:context.classId,teachingId:context.teachingId,firstDelay:0,nextDelay:0,sourceDenied:true});await assert.rejects(client(denied).listClass(context.teachingId),e=>e.code==='rejected');
  const wrong=composition({classId:context.classId,teachingId:context.teachingId,firstDelay:0,nextDelay:0});await assert.rejects(client(wrong,{...context,ownerId:'00000000-0000-4000-8000-000000000099'}).listClass(context.teachingId),e=>e.code==='rejected');assert.equal(wrong.phases.filter(x=>x.startsWith('canonical:')).length,0);
  report.checks.push('Wrong owner and resolver source denial fail closed through actual authenticated composition.');
 }
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await Promise.allSettled(pending);await writeFile('tests/n88-hosted-failure-20261020/'+(baseline?'cause-baseline.json':'cause-corrected.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
