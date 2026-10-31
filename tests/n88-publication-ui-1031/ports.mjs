/** AI: trusted test-only readiness injection, never part of the production import graph. */
import {mountClassService} from '/src/lib/student-portal-runtime.js';
export function install(){
 const f=window.uiFixture={enabled:true,readTimeoutMs:1500,writeRefusal:false};
 f.mount=(root,options)=>{
   f.getBinding=options.getBinding;
   return mountClassService(root,{...options,readTimeoutMs:f.readTimeoutMs,
     getBinding:write=>{if(write&&f.writeRefusal)throw Error('synthetic_preflight');return options.getBinding(write);},
     ...(f.enabled?{publicationReadiness:{enabled:true,serviceRevision:'n88-item-publication-v2'}}:{})});
 };
}
