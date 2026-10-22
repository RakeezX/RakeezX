// AI: retain the canonical actual-app fixture; model Chrome's documentIds
// pre-execution constraint, not a changed result after executing in an old DOM.
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
export async function documentBoundFixture(options){
 let sourceDocument=1,denials=0;
 const check=input=>{
  if(input.target.tabId===7&&input.target.documentIds&&!input.target.documentIds.includes('source-document-'+sourceDocument)){
   denials++;throw Error('SOURCE_BINDING_CHANGED');
  }
 };
 const worker=await backgroundFixture({...options,onRead:async(...args)=>{
  check(args[0]);await options.onRead?.(...args);check(args[0]);
 }});
 const original=worker.changeSourceDocument;
 worker.changeSourceDocument=()=>{sourceDocument++;original();};
 worker.documentTargetDenials=()=>denials;
 return worker;
}
