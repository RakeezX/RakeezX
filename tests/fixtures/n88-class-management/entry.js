import { createClassPortalClient } from '/src/lib/student-portal-class-client.js';
import { mountClassPortal } from '/src/views/student-portal-class.js';
let binding={enabled:true,ownerId:'fabricated-owner',sessionId:'fabricated-session',leaseId:'fabricated-lease',teachingId:'teaching-a',classId:'class-a',termId:'term-a',contextRevision:'context-1',validUntil:Date.now()+300000};
let notify, mode='', release;
window.fixture={calls:[],copied:false,printed:false,setMode(value){mode=value;},switchOwner(){binding={...binding,ownerId:'other-owner',enabled:false};notify();},drift(){binding={...binding,contextRevision:'context-2'};notify();},release(){release?.();},expireSoon(){binding={...binding,validUntil:Date.now()+600};notify();},off(){binding={...binding,enabled:false};notify();}};
const getContext=()=>binding;
const client=createClassPortalClient({getContext,timeoutMs:150,request:async(path,init)=>{
  const action=path.split('/').pop();window.fixture.calls.push(action);
  const response=await fetch(path,init);
  if(action==='list')return response;
  if(mode==='uncertain'){mode='';const data=await response.json();data.data.uncertain=true;data.data.failed=[];return {ok:true,json:async()=>data};}
  if(mode==='lost'){mode='';return {ok:true,json:()=>new Promise(()=>{})};}
  if(mode==='delay'){mode='';const data=await response.json();window.fixture.pending=true;await new Promise(ok=>{release=ok;});window.fixture.pending=false;return {ok:true,json:async()=>data};}
  return response;
}});
window.fixture.handle=mountClassPortal(document.querySelector('#class-portal'),{client,getContext,subscribe:fn=>{notify=fn;return()=>{notify=()=>{};};},classLabel:()=> 'الفصل التجريبي',copy:text=>{window.fixture.copied=/^.+: 1[0-9]{11}/m.test(text);},print:()=>{window.fixture.printed=true;}});
