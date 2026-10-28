/** AI: synthetic serialized query/ACK adapter, NOT PostgreSQL/RLS certification.
 * Actual integrated service, canonical reader, numeric issuer and official Auth
 * verifier execute unchanged. Only provider replies and repository I/O are fake.
 */
import assert from 'node:assert/strict';
import {createMemoryRepository} from '../../drafts/n88-student-portal/memory-repository.mjs';
import {createCanonicalAdapter} from '../../drafts/n88-student-portal/canonical-adapter.mjs';
import {createIntegratedService} from '../../drafts/n88-student-portal/integrated-service.mjs';
import {createTeacherVerifier} from '../../drafts/n88-student-portal/auth-verifier.mjs';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import {providerFixture,A,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
export {A,SESSION};
export const ID='synthetic-original-negative-0001';
export const binding={ownerId:A,sessionId:SESSION,leaseId:'browser-only-lease',contextRevision:'browser-only-revision',teachingId:'teaching',classId:'class',termId:'term'};
export const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const signingProvider=providerFixture();
export function fixture(n=28,{enabled=true}={}) {
 // The installed SDK caches JWKS under its default storage key. Keep ONE fixture
 // signing authority across cases; per-case fresh keys with the same kid are invalid.
 const provider={token:signingProvider.token,foreign:false,banned:false,denied:false,calls:[]};
 provider.fetch=(...args)=>{Object.assign(signingProvider,{foreign:provider.foreign,banned:provider.banned,denied:provider.denied,calls:provider.calls});return signingProvider.fetch(...args);};
 const tables={numericCredentials:'numeric_credentials',numericSessions:'numeric_sessions',numericRates:'numeric_rates',numericAttempts:'numeric_attempts',classReceipts:'class_credential_receipts',recovery:'code_recovery'};
 const source=Array.from({length:n},(_,i)=>({owner_id:A,enrollment_id:'enrollment-'+i,section_id:'class',student_id:'student-'+i,revision:'1',status:'active',end_date:null,enrollment_present:true,student_active:true,class_active:true,label:'Fabricated '+i,student_revision:'1',section_revision:'1',year_revision:'1'}));
 const seed={contexts:[{namespace:'synthetic_active_namespace_00001',ownerId:A,active:true}],memberships:[],sessions:[],publications:[],credentials:[],rates:[],...Object.fromEntries(Object.keys(tables).map(k=>[k,[]]))};
 const memory=createMemoryRepository(seed),state={source,teachingRevision:'1',termRevision:'1',term:'term',classId:'class',teaching:'teaching',active:true,current:true,rollback:false,lost:false,failRead:false,guardFailure:false,partial:false,events:[],pause:null,ingress:true};
 const rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
 const canonical=createCanonicalAdapter({rollout});
 const verifier=createTeacherVerifier({authUrl,apiKey:'fabricated-public-key',fetch:provider.fetch});
 const repository={transaction:action=>{
  const lost=state.lost;state.lost=false;
  return memory.transaction(async db=>{
   state.events.push('lock');
   if(state.pause){const p=state.pause;state.pause=null;p.entered.resolve();await p.release.promise;}
   const guards=[];let savepoint;
   const query=async(sql,args=[])=>{
    if(sql.includes('lock_current_session'))return {rows:state.current&&args[0]===A&&args[1]===SESSION?[{user_id:A,session_id:SESSION}]:[]};
    if(sql.startsWith('select n88_private.lock_'))return {rows:[]};
    if(sql.includes('from rakeezx.teachings t'))return {rows:state.active&&args[0]===A&&args[1]===state.teaching?[{id:state.teaching,section_id:state.classId,teaching_revision:state.teachingRevision,term_revision:state.termRevision}]:[]};
    if(sql.includes('from rakeezx.terms where'))return {rows:[{payload:JSON.stringify({id:state.term,owner_id:A,revision:state.termRevision,deleted_at:null,year_id:'year',status:state.active?'active':'closed',start_date:null,end_date:null})}]};
    if(sql.includes('from rakeezx.teachings where'))return {rows:[{payload:JSON.stringify({id:state.teaching,owner_id:A,revision:state.teachingRevision,deleted_at:null,section_id:state.classId,term_id:state.term,subject_id:'subject'})}]};
    if(sql.includes('from rakeezx.enrollments e'))return {rows:state.source.map(r=>({payload:JSON.stringify(r)}))};
    if(sql.includes('from rakeezx.items i'))return {rows:[]};
    if(sql.startsWith('select payload from n88_private.class_visibility'))return {rows:[]};
    if(sql.startsWith('select payload from n88_private.code_recovery'))return {rows:db.recovery.filter(r=>r.credentialId===args[0]).map(payload=>({payload}))};
    if(sql==='savepoint n88_member_recovery'){savepoint=structuredClone(db);return {rows:[]};}
    if(sql==='rollback to savepoint n88_member_recovery'){Object.assign(db,savepoint);return {rows:[]};}
    if(sql==='release savepoint n88_member_recovery')return {rows:[]};
    const found=Object.entries(tables).find(([,table])=>sql.includes('n88_private.'+table+' ')||sql.includes('n88_private.'+table+'('));
    if(found){const [key]=found;
     if(sql.startsWith('select case')){if(state.failRead)throw Error('fabricated read failure');return {rows:db[key].map(payload=>({payload:structuredClone(payload)}))};}
     if(sql.startsWith('insert into')){
      if(state.partial&&key==='recovery'&&db.recovery.length===1)throw Error('fabricated member failure');
      const row=JSON.parse(args[1]);if(key==='classReceipts')assert.equal(db[key].some(r=>r.ownerId===row.ownerId&&r.requestId===row.requestId),false);
      db[key].push(row);state.events.push('insert:'+key);return {rows:[],rowCount:1};
     }
     if(sql.startsWith('update ')){
      const row=JSON.parse(args[1]);assert.notEqual(key,'classReceipts');const i=db[key].findIndex(r=>(r.id??r.key)===args[0]);assert.ok(i>=0);db[key][i]=row;return {rows:[],rowCount:1};
     }
    }
    throw Error('Unhandled synthetic query: '+sql);
   };
   const ports={query,beforeCommit:g=>guards.push(g),canonicalReadMode:()=> 'serial',synchronizeOwner:owner=>canonical(db,{query},owner)};
   const result=await action(db,ports);
   if(state.guardFailure)state.current=false;
   for(const g of guards)await g();
   if(state.rollback){state.rollback=false;throw Error('fabricated rollback');}
   state.events.push('COMMIT');return result;
  }).then(result=>{if(lost)throw Error('fabricated lost COMMIT ACK');return result;});
 }};
 const options={origin:'https://synthetic.invalid',numericKey:Buffer.alloc(32,1),reservationKey:Buffer.alloc(32,2),recoveryKeys:new Map([['v1',Buffer.alloc(32,3)]]),recoveryActiveKeyVersion:'v1',rollout,...(enabled==='omitted'?{}:{terminalResolutionEnabled:enabled})};
 const adapter={verifyIngress:async()=>state.ingress?{clientKey:'synthetic'}:null,verifyTeacher:(request,ports)=>verifier(request.headers.authorization,undefined,ports)};
 const service=createIntegratedService(options,adapter,repository);
 const request=(action,body={},extra={})=>service({path:'/teacher/class/'+action,method:'POST',headers:{origin:options.origin,'content-type':'application/json','x-n88-csrf':'1','sec-fetch-site':'same-origin',authorization:'Bearer '+provider.token(),...extra.headers},body:{teachingId:binding.teachingId,binding:{...binding},...body},...Object.fromEntries(Object.entries(extra).filter(([k])=>k!=='headers'))});
 return {state,provider,options,repository,service,snapshot:memory.snapshot,request,
  mutate:fn=>memory.transaction(fn),
  async input(){const r=await request('list',{reconciliationVersion:1,terminalResolutionVersion:1,uiProtocol:'n88-public-ui-v1'});assert.equal(r.status,200);return {requestId:ID,expectedRosterRevision:r.body.data.rosterRevision,expectedCredentialRevision:r.body.data.credentialRevision};},
  terminal:(input,mode='close',extra={})=>request('revoke',{...input,resolutionVersion:1,resolution:mode,...extra}),
  hold(){const p={entered:deferred(),release:deferred()};state.pause=p;return p;},
  async clientTransport(url,init){const response=await request(url.split('/').at(-1),JSON.parse(init.body));const {rollout,...ack}=response.body;return {ok:response.status===200,status:response.status,headers:new Headers(),json:async()=>ack};}
 };
}
