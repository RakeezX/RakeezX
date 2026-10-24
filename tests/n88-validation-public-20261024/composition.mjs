import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';import {randomBytes} from 'node:crypto';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import {createCloudflareEntry} from '../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {providerFixture,A,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const sdk=createRequire('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
// AI: immutable already-qualified native JavaScript, in-memory synthetic ports only.
const parent='f3eaef6dc3e268bb91de98c3b99e4df4714ccfe3';
const object=p=>execFileSync('git',['cat-file','blob',parent+':'+p],{encoding:'utf8',windowsHide:true,maxBuffer:4000000});
let prepare=object('drafts/n88-student-portal/activation/prepare-validation-family.mjs');
prepare=prepare.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';const parentRead=async p=>{const text=execFileSync('git',['cat-file','blob','f3eaef6dc3e268bb91de98c3b99e4df4714ccfe3:'+p],{encoding:'utf8',windowsHide:true,maxBuffer:4000000});return /(?:postgres-repository|integrated-service)\\.mjs$/.test(p)?text.replaceAll('\\n','\\r\\n'):text;};").replaceAll('await readFile(', 'await parentRead(');
const {native}=await (await import('data:text/javascript;base64,'+Buffer.from(prepare).toString('base64'))).prepareValidationFamily();
assert.equal((await import('node:crypto')).createHash('sha256').update(native).digest('hex'),'23ee1cb88197c5a3f34b88c7dd203d4f24c98c7894952439f52d1bf39033134e');
const built=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf('// supabase/functions/n88-student-portal/index.ts'))+'\nexport {createWebEntry};',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[{name:'existing-sdk-no-driver',setup(b){b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));b.onResolve({filter:/^pg$/},()=>({path:'pg',namespace:'unused-driver'}));b.onLoad({filter:/.*/,namespace:'unused-driver'},()=>({contents:'export default {};',loader:'js'}));}}]});
const {createWebEntry}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const manifest=JSON.parse(await fs.readFile('drafts/n88-student-portal/deployment.inactive.json','utf8')),identities=JSON.parse(await fs.readFile('drafts/n88-student-portal/activation/error-boundary-identities.json','utf8')),contract=JSON.parse(await fs.readFile('drafts/n88-student-portal/activation/error-boundary-contract.json','utf8'));
const operations=new Map(contract.operations.map(o=>[o.name,o])),sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const commonProvider=providerFixture();
export function composition({classId,teachingId,failStage=false,firstDelay=550,nextDelay=200,canonicalDelay=0,sourceDenied=false,failCanonical=false,delayStage=null,delayMs=6500,synchronizeFailure=null,canonicalShape=null,queryFixture=null,wireTamper=false,replyTransform=null}){
 let acquisitions=0,commits=0,rollbacks=0,destroyed=0,responseReturned=false,lateWrites=0;const transactionBudgets=[];const phases=[],origin='https://synthetic.invalid',provider=commonProvider;
 const common={owner_id:A,revision:'1',deleted_at:null};
 const canonical=canonicalShape||{years:[{...common,id:'year',status:'active'}],terms:[{...common,id:'term',year_id:'year',status:'active',start_date:null,end_date:null}],sections:[{...common,id:classId,year_id:'year',status:'active',archived_at:null,grade:1,label:'Ã',name:''}],teachings:[{...common,id:teachingId,section_id:classId,term_id:'term',subject_id:'subject'}],students:[{...common,id:'synthetic-student',status:'active',name:'ØÇáÈ ãÕØäÚ'}],enrollments:[{...common,id:'synthetic-enrollment',student_id:'synthetic-student',section_id:classId,status:'active',start_date:null,end_date:null}]};
 const acquire=async()=>{
  const n=++acquisitions;let canonicalLocks=0;phases.push('acquire');await sleep(delayStage==='acquire'?delayMs:(n===1?firstDelay:nextDelay));
  if(failStage)throw Error('synthetic_acquire_failure');
  return {release(error){if(error)destroyed++;},async query(text,values=[]){
   if(text.includes('pg_get_functiondef'))return {rows:identities};
   const name=/select \* from n88_private\.(boundary_\w+)\(/.exec(text)?.[1],op=name&&operations.get(name),sql=op?.sql||text;
   const intercepted=await queryFixture?.({text,values,op,sql});if(intercepted)return intercepted;
   let rows=[];if(sql.startsWith('rollback')){rollbacks++;return {rows:[]};}if(sql.startsWith('select set_config'))transactionBudgets.push(Number(values[2]));if(delayStage==='teacher'&&sql.includes('lock_current_session'))await sleep(delayMs);if(delayStage==='source'&&sql.startsWith('select t.id,t.section_id'))await sleep(delayMs);if(responseReturned&&(op?.effect||sql.startsWith('commit')))lateWrites++;
   // The resolver's first canonical lock belongs to source admission. Inject
   // only the second call, made by the actual synchronizeOwner adapter.
   const synchronization=sql.includes('lock_canonical_sources')?(++canonicalLocks===2?'lock':null):sql.includes('as enrollment_id')?'memberships':sql.includes('as item_id')?'sources':null;
   if(synchronization&&synchronizeFailure===synchronization)throw Error('SYNTHETIC_PRIVATE_QUERY_DETAIL');
   if(synchronization&&delayStage==='synchronize-'+synchronization)await sleep(delayMs);
   if(sql.startsWith('commit')){commits++;return {rows:[],command:'COMMIT'};}
   if(op?.effect)return {rows:[{affected:'1'}]};
   if(sql.includes('consume_ingress'))rows=[{accepted:true}];
   else if(sql.includes('lock_current_session'))rows=[{user_id:A,session_id:SESSION}];
   else if(sql.startsWith('select t.id,t.section_id'))rows=sourceDenied?[]:[{id:teachingId,section_id:classId,teaching_revision:'1',term_revision:'1'}];
   else if(sql.includes('as enrollment_id'))rows=canonical.enrollments.map(e=>({payload:JSON.stringify({owner_id:A,enrollment_id:e.id,section_id:e.section_id,student_id:e.student_id,revision:e.revision,status:e.status,end_date:e.end_date,enrollment_present:e.deleted_at===null,student_active:canonical.students.find(s=>s.id===e.student_id)?.status==='active',label:'ØÇáÈ ãÕØäÚ',class_active:true,student_revision:canonical.students.find(s=>s.id===e.student_id)?.revision||'1',section_revision:'1',year_revision:'1'})}));
   else if(sql.includes('as item_id'))rows=(canonical.items||[]).filter(i=>i.auto===null).map(i=>({payload:JSON.stringify({owner_id:A,item_id:i.id,title:i.name,teaching_id:i.teaching_id,section_id:canonical.teachings.find(t=>t.id===i.teaching_id).section_id,item_revision:i.revision,teaching_revision:'1',term_revision:'1'})}));
   else if(sql.includes('row_to_json(x)')){
    const table=/from rakeezx\.(\w+) where owner_id/.exec(sql)?.[1];if(table){if(failCanonical)throw Error('SYNTHETIC_PRIVATE_QUERY_DETAIL');phases.push('canonical:'+table);await sleep(canonicalDelay);}
    rows=(canonical[table]||[]).map(r=>({payload:JSON.stringify(r)}));
   }
   if(sql.includes('lock_projection_sources'))phases.push('projection-source-lock');if(sql.includes('as enrollment_id'))phases.push('membership-synchronize');if(op?.voidResult)rows=[{}];
   return {rows,command:'SELECT',rowCount:rows.length};
  }};
 };
 const recovery=randomBytes(32),options={...manifest,origin,authUrl,apiKey:'SYNTHETIC_PUBLIC',secretKey:randomBytes(32),ingressKey:randomBytes(32),numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['v1',recovery]]),recoveryActiveKeyVersion:'v1',acquire,fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true};
 const rollout=createRolloutGuard(n=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[n]);
 options.rollout=rollout;options.canonicalBounds={...options.canonicalBounds,rollout};
 const edge=createWebEntry(options),gateway=createCloudflareEntry({fetch:async(url,init)=>{if(wireTamper)init.headers.set('x-n88-signature','0'.repeat(64));const response=await edge(new Request(url,init));if(!replyTransform)return response;const reply=await response.json();return Response.json(replyTransform(reply));}}),env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:options.ingressKey.toString('hex')};
 return {provider,phases,get counts(){return {acquisitions,commits,rollbacks,destroyed,lateWrites,transactionBudgets};},async send(path,init){
 const h=new Headers(init.headers);h.set('origin',origin);h.set('cf-connecting-ip','192.0.2.1');
 const request=new Request(origin+path,{...init,headers:h});Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
 const response=await gateway(request,env);responseReturned=true;return response;
 }};
}
