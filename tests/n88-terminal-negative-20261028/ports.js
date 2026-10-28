/** AI: inject synthetic HTTP transport only; real runtime/owner guard/client/DOM. */
import {mountClassService} from '/src/lib/student-portal-runtime.js';
export function install(){
 const f=window.negativeFixture={calls:[],seed:true};
 f.mount=(root,options)=>{
  const b=options.getBinding(false),c=b.context;
  f.getBinding=options.getBinding;
  const scope=JSON.stringify([c.ownerId,c.leaseId,b.receiptScope??'',c.teachingId,c.classId,c.termId]);
  f.hintKey='rakeezx-n88-uncertain-v1:'+encodeURIComponent(scope);
  // Original intent was not observed committing. Seed ONLY its existing local hint.
  const mount=async()=>{
   const input=await (await fetch('/review/input')).json();
   if(f.seed)localStorage.setItem(f.hintKey,JSON.stringify({version:1,scope,rows:[{version:1,action:'issue-missing',...input,sourceStamp:null,expectedRevision:null,createdAt:Date.now()}]}));
   f.handle=mountClassService(root,{...options,fetch:(url,init)=>{
    f.calls.push({action:url.split('/').at(-1),body:JSON.parse(init.body)});
    return fetch(url,init);
   }});
  };
  void mount();return {dispose(){f.handle?.dispose();}};
 };
}
