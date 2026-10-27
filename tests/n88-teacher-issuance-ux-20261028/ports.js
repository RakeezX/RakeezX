/** AI-authored synthetic transport for the real app route/runtime/client/ownership guard. */
import {mountClassService} from '/src/lib/student-portal-runtime.js';
export function install(){
 const fields={name:false,class:false,grades:false,required:true,scheduled:true,completed:true};
 const f=window.compactFixture={calls:[],mode:'normal',seedUnknown:false,terminal:false,missingRevision:false,failGuidance:false,failVisibility:false,failCopy:false,failShare:false,delay:0};
 const student=(i)=>({studentId:'synthetic-'+i,enrollmentId:'synthetic-enrollment-'+i,revision:1,label:'طالب مصطنع '+i,hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null});
 f.roster={classId:'class',rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64),reconciliation:[],policyRevision:0,visibility:fields,students:Array.from({length:28},(_,i)=>student(i+1))};
 f.tasks=[{subitemId:'synthetic-task',title:'مهمة مصطنعة من توزيع المادة',sourceStamp:'c'.repeat(64),revision:1,executionInstructions:'تعليمات مصطنعة',deliveryInstructions:'تسليم مصطنع',needsRepublication:false},{subitemId:'synthetic-revised',title:'مهمة مصطنعة معدّلة',sourceStamp:'d'.repeat(64),revision:2,executionInstructions:'',deliveryInstructions:'',needsRepublication:true}];
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>{if(f.failCopy)return Promise.reject(Error('synthetic'));f.copied=text;return Promise.resolve();}}});
 Object.defineProperty(navigator,'share',{configurable:true,value:data=>{if(f.failShare)return Promise.reject(Error('synthetic'));f.shared=data.text;return Promise.resolve();}});
 const listeners=new Set();f.notify=()=>{for(const fn of [...listeners])fn();};
 f.mount=(root,options)=>{
  f.getBinding=options.getBinding;
  const binding=options.getBinding(false),c=binding.context;
  const scope=JSON.stringify([c.ownerId,c.leaseId,binding.receiptScope??'',c.teachingId,c.classId,c.termId]);
  f.hintKey='rakeezx-n88-uncertain-v1:'+encodeURIComponent(scope);
  if(f.seedUnknown&&!localStorage.getItem(f.hintKey))localStorage.setItem(f.hintKey,JSON.stringify({version:1,scope,rows:[{version:1,action:'issue-missing',requestId:'synthetic-unknown-request-0001',expectedRosterRevision:f.roster.rosterRevision,expectedCredentialRevision:f.roster.credentialRevision,sourceStamp:null,expectedRevision:null,createdAt:Date.now()}]}));
  const fetch=async(url,init)=>{
   const body=JSON.parse(init.body),action=url.split('/').at(-1);f.calls.push({action,body});
   const data=structuredClone(f.roster);await new Promise(r=>setTimeout(r,f.delay));
   const response=(data,status=200)=>({ok:status===200,status,headers:new Headers({'x-n88-service-region':f.region??'ap-south-1','x-n88-service-stage':'untrusted-stage'}),json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,rollout:'public',data})});
   if(action==='list'){
    if(f.mode==='denied')return response(null,403);
    if(f.missingRevision){delete data.credentialRevision;delete data.reconciliation;}
    else data.reconciliation=body.reconcile.map(()=>({state:f.mode==='committed'?'committed':'unknown',created:0,skipped:0,failed:0}));
    if(f.terminal)data.terminalResolution='n88-terminal-no-issuance-v1';
    return response(data);
   }
   if(action==='guidance-list')return f.failGuidance?response(null,503):response({tasks:structuredClone(f.tasks)});
   if(action==='visibility'){
    if(f.failVisibility)return response(null,503);
    if(body.policyRevision!==f.roster.policyRevision)throw Error('synthetic CAS');
    f.roster.visibility=body.fields;f.roster.policyRevision++;
    return response({updated:true,policyRevision:f.roster.policyRevision,fields:body.fields});
   }
   if(action==='guidance-save'){
    const g=body.guidance,t=f.tasks.find(t=>t.subitemId===g.subitemId);
    if(t.sourceStamp!==g.sourceStamp||t.revision!==g.revision)throw Error('synthetic CAS');
    if(f.guidanceFailure)return response(null,503);
    Object.assign(t,{executionInstructions:g.executionInstructions,deliveryInstructions:g.deliveryInstructions,revision:t.revision+1,needsRepublication:false});
    return response({saved:true,subitemId:t.subitemId,revision:t.revision,sourceStamp:t.sourceStamp});
   }
   if(action==='issue-missing')return response(null,503); // Never issue even synthetic codes in the reported UNKNOWN scenario.
   if(action==='rotate'||action==='revoke'){
    const s=f.roster.students.find(s=>s.studentId===body.studentId);
    if(!s||s.revision!==body.revision||s.credentialVersion!==body.credentialVersion)throw Error('synthetic CAS');
    if(action==='revoke'){s.hasActiveCode=false;s.credential=null;s.recoveryStatus='inactive';return response({revoked:true,studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion});}
    s.credentialVersion++;s.hasActiveCode=true;s.credential='199999';s.recoveryStatus='recoverable';
    return response({rotated:true,studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion,credential:s.credential});
   }
   throw Error('Unexpected synthetic operation');
  };
  f.handle=mountClassService(root,{...options,fetch,subscribe:fn=>{listeners.add(fn);const unsubscribe=options.subscribe(fn);return()=>{listeners.delete(fn);unsubscribe?.();};}});return f.handle;
 };
}
