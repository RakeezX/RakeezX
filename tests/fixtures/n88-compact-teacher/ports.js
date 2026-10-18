/** AI: fabricated ports only; actual shell/route/view/client/owner guard/CSS. */
import {mountClassPortal} from '/src/views/student-portal-class.js';
import {createClassPortalClient,PORTAL_FIELDS} from '/src/lib/student-portal-class-client.js';
export function install() {
 const f=window.compactFixture={calls:[],copied:null,shared:null,failCopy:false,failShare:false,failNext:false,uncertain:false,delay:0,override:null,notify:null};
 const fields=Object.fromEntries(PORTAL_FIELDS.map(k=>[k,false]));
 const student=(studentId,label,credential,recoveryStatus='recoverable')=>({studentId,enrollmentId:'e-'+studentId,label,credential,revision:1,credentialVersion:1,recoveryStatus,hasActiveCode:true});
 f.roster={classId:'class',rosterRevision:'a'.repeat(64),policyRevision:0,visibility:fields,students:[student('one','عبد الرحمن محمد عبد الله',String(100000+12345)),student('two','خالد أحمد',String(100000+23456)),student('old','سالم علي',null,'legacy')]};
 f.mount=(root,{getBinding,subscribe,classLabel})=>{
  f.getBinding=getBinding;
  const getContext=()=>{try{const current=getBinding(false).context;return f.override??current;}catch{return null;}};
  const client=createClassPortalClient({getContext,request:async(url,init)=>{
   getBinding(true);const body=JSON.parse(init.body),action=url.split('/').at(-1);f.calls.push({action,body});
   const roster=structuredClone(f.roster),fail=f.failNext,uncertain=f.uncertain;f.failNext=false;f.uncertain=false;
   await new Promise(ok=>setTimeout(ok,f.delay));
   if(fail || action==='list' && f.failList){f.failList=false;throw Error('synthetic');}
   let data;
   if(action==='list')data=roster;
   if(action==='visibility') {if(body.policyRevision!==f.roster.policyRevision)throw Error('CAS');f.roster.visibility=body.fields;f.roster.policyRevision++;data={updated:true,policyRevision:f.roster.policyRevision,fields:body.fields};}
   if(action==='issue-missing')data={requestId:body.requestId,created:[],skipped:roster.students.map(s=>({studentId:s.studentId,reason:'existing'})),failed:[],uncertain:false};
   if(action==='rotate'||action==='revoke'){
    const s=f.roster.students.find(s=>s.studentId===body.studentId);
    if(body.revision!==s.revision||body.credentialVersion!==s.credentialVersion)throw Error('CAS');
    if(action==='rotate'){s.credentialVersion++;s.credential=String(100000+34567);s.recoveryStatus='recoverable';data={rotated:true,studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion,credential:s.credential};}
    else{s.credential=null;s.hasActiveCode=false;s.recoveryStatus='inactive';data={revoked:true,studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion};}
   }
   if(uncertain)throw Error('unknown ACK');
   return {ok:true,json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,data})};
  }});
  const handle=mountClassPortal(root,{client,getContext,classLabel,subscribe:fn=>{f.notify=fn;return subscribe(fn);},copy:text=>{if(f.failCopy)throw Error('synthetic');f.copied=text;},share:f.noShare?null:data=>{if(f.failShare)return Promise.reject(Error('synthetic'));f.shared=data.text;}});
  f.handle=handle;return handle;
 };
}
