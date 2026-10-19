import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const slot='__n88Support1837SyntheticOnly';
const report={taskId:'continuous-n88-actual-teacher-and-brand-entry-20261019',runId:'2ae8ed4f-f05f-487a-a9e3-5420314db9d3',status:'FAIL',scope:'Actual Support module sanitizer and submit handler with inert local dependency seams; zero real support/network/browser/service operations'};
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const safe={phase:'http',httpStatus:503,elapsedMs:1234,sourceVersion:'n88-class-entry-1837-v1'};
let calls=[],reads=0,value={...safe,ownerId:'POISON_ID',token:'POISON_TOKEN',roster:['POISON_ROSTER'],payload:'POISON_BODY'},throwDiagnostic=false;
const previousFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('Network forbidden in this direct synthetic test');};
globalThis[slot]={request:(path,init)=>{calls.push({path,init});return Promise.resolve();},diagnostic:()=>{reads++;if(throwDiagnostic)throw Error('unavailable');return value;}};
try {
 const cloud=data("export let user={},session={};export function setAuth(on){user=on?{}:null;session=on?{}:null;}export const request=(...args)=>globalThis."+slot+".request(...args);");
 const runtime=data("export const studentPortalDiagnostic=()=>globalThis."+slot+".diagnostic();");
 let source=await readFile('src/lib/support.js','utf8');
 report.sourceSha256=createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
 for(const [from,to] of [["'./cloud.js'",JSON.stringify(cloud)],["'./db.js'",JSON.stringify(data('export const getAll=async()=>[];'))],["'../store.js'",JSON.stringify(data('export const state={};export const getActiveWorkspace=()=>null;'))],["'./support-origin.js'",JSON.stringify(data('export const SUPPORT_ROUTE_CATEGORIES={};'))],["'./student-portal-runtime.js'",JSON.stringify(runtime)]]){
  assert.equal(source.split(from).length,2,'one exact dependency seam');source=source.replace(from,to);
 }
 const module=await import(data(source)),auth=await import(cloud);
 assert.equal(reads,0,'module load does not capture diagnostics');
 const clean=module.sanitizeSupportDiagnostics({n88Portal:value,token:'POISON_TOP'});
 assert.deepEqual(clean,{n88Portal:{...safe,elapsedMs:1200}});
 for(const phase of ['binding','queue','dispatch','http','response','admitted','failure'])
  assert.equal(module.sanitizeSupportDiagnostics({n88Portal:{...safe,phase}}).n88Portal.phase,phase);
 for(const bad of [{phase:'raw/owner'},{httpStatus:99},{httpStatus:600},{httpStatus:'503'},{elapsedMs:-1},{elapsedMs:30001},{elapsedMs:Infinity},{elapsedMs:1.5},{sourceVersion:'other'}])
  assert.equal(module.sanitizeSupportDiagnostics({n88Portal:{...safe,...bad}}).n88Portal,undefined);
 for(const elapsedMs of [0,29999,30000]){
  const out=module.sanitizeSupportDiagnostics({n88Portal:{...safe,elapsedMs}}).n88Portal;
  assert(out.elapsedMs>=0&&out.elapsedMs<=30000&&out.elapsedMs%100===0);
 }
 for(const httpStatus of [0,100,599])assert.equal(module.sanitizeSupportDiagnostics({n88Portal:{...safe,httpStatus}}).n88Portal.httpStatus,httpStatus);
 const args={type:'technical',message:'Synthetic support handler check',diagnostics:{n88Portal:{...safe,phase:'admitted'},token:'POISON_CLIENT'}};
 const result=await module.submitSupportRequest(args);assert(result.id.startsWith('support:'));
 assert.equal(calls.length,1);assert.equal(reads,1);assert.equal(calls[0].path,'/support_requests');assert.equal(calls[0].init.method,'POST');
 const body=JSON.parse(calls[0].init.body);
 assert.deepEqual(body.diagnostics.n88Portal,{...safe,elapsedMs:1200});
 assert(!JSON.stringify(body).includes('POISON'));
 throwDiagnostic=true;
 await module.submitSupportRequest(args);
 assert.equal(JSON.parse(calls[1].init.body).diagnostics.n88Portal,undefined,'optional diagnostic failure cannot block valid support or trust supplied checkpoint');
 const captured=reads;
 auth.setAuth(false);
 await assert.rejects(module.submitSupportRequest(args),e=>e.code==='AUTH_REQUIRED');
 assert.equal(calls.length,2);assert.equal(reads,captured);
 auth.setAuth(true);
 await assert.rejects(module.submitSupportRequest({...args,type:'invalid'}),e=>e.code==='INVALID_TYPE');
 assert.equal(calls.length,2);assert.equal(reads,captured);
 report.status='PASS';
 report.checks=['finite strict phase/status/source allowlist','bounded100ms rounding and invalid numeric rejection','poisoned IDs/tokens/roster/payload omitted','actual submit handler collects only runtime snapshot after validation','optional getter failure falls back without trusting caller snapshot','Auth and input guards run before snapshot and mocked submit'];
 report.mockedHandlerCalls=2;report.realSends=0;report.networkCalls=0;
} catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{globalThis.fetch=previousFetch;delete globalThis[slot];await writeFile('tests/n88-1837/support-hook.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
