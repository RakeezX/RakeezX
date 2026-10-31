/** AI: affected discriminants, selector/legacy MAC and original commit guards. */
import test from 'node:test';import assert from 'node:assert/strict';
import {parseStudentScopePath,signingText,FORWARDED} from '../../drafts/n88-student-portal/web-protocol.mjs';
import {parseStudentScopeData,PUBLICATION_V2_READINESS} from '../../src/lib/student-portal-publication-client.js';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
import {createPublicationV2Service} from '../../drafts/n88-student-portal/publication-v2-service.inactive.mjs';
import {fixture} from '../n88-publication-ui-1031/service-fixture.mjs';
const choices=[{teachingId:'one',label:'العلوم — الفصل الأول'},{teachingId:'two',label:'العلوم — الفصل الثاني'}];
const choice={version:'n88-student-scope-v2',state:'choice',choices};
const selected=id=>({version:choice.version,state:'selected',choices,teachingId:id,projection:{work:[],grades:[{id,title:id,value:id==='one'?8:3}]}});
test('exact scope discriminants reject ambiguous/hidden or malformed projection shapes',()=>{
 assert.equal(parseStudentScopeData(choice).state,'choice');assert.equal(parseStudentScopeData(selected('one')).projection.grades[0].value,8);
 for(const v of [{...choice,projection:{work:[],grades:[]}},{...choice,choices:[choices[0]]},{...choice,state:'empty'},selected('foreign'),{...selected('one'),ownerId:'browser-owner'},
  {...selected('one'),projection:{work:[],grades:[],total:8}},{...choice,choices:[choices[0],choices[0]]}])assert.throws(()=>parseStudentScopeData(v));
});
test('strict optional selector and exact legacy serialization remain separate',()=>{
 const base='/api/n88/student/publication-v2/read';assert.equal(parseStudentScopePath(base).teachingId,null);
 assert.equal(parseStudentScopePath(base+'?teaching='+encodeURIComponent('مادة & ثانية')).teachingId,'مادة & ثانية');
 for(const suffix of ['?teaching=','?teaching=%74wo','?teaching=x&teaching=y','?owner=x','?teaching=x&owner=y','?teaching=%00','?teaching=%C2%85','#fragment'])assert.equal(parseStudentScopePath(base+suffix),null);
 const headers=new Headers({'cookie':'fabricated','origin':'https://synthetic.invalid'}),args={origin:'https://synthetic.invalid',path:'/api/n88/student/read',method:'GET',headers,bodyHash:'a'.repeat(64),time:'1793440000',nonce:'11111111-1111-4111-8111-111111111111',source:'b'.repeat(64)};
 assert.equal(signingText(args),JSON.stringify(['n88-ingress-v1',args.origin,args.path,args.method,FORWARDED.map(n=>headers.get(n)||''),args.bodyHash,args.time,args.nonce,args.source]));
 assert.notEqual(signingText({...args,path:base+'?teaching=one'}),signingText({...args,path:base+'?teaching=two'}));assert.equal(FORWARDED.length,6);
});
test('client binds selection to current server choices and rejects late replies/context switches',async()=>{
 let held,delay=false;const paths=[];
 const c=createUnifiedStudentPortalClient({publicationReadiness:{...PUBLICATION_V2_READINESS,enabled:true},fetch:async p=>{paths.push(p);if(delay){delay=false;return new Promise(r=>held=r);}return Response.json(p.includes('?')?selected(p.endsWith('one')?'one':'two'):choice);}});
 await c.read();assert.throws(()=>c.selectTeaching('foreign'));c.selectTeaching('one');delay=true;const late=c.read();await Promise.resolve();c.selectTeaching('two');const fresh=await c.read();held(Response.json(selected('one')));await assert.rejects(late);assert.equal(fresh.teachingId,'two');assert.equal(c.selectedTeaching(),'two');
 c.invalidate('context');assert.equal(c.selectedTeaching(),null);assert.throws(()=>c.selectTeaching('one'));assert(paths.includes('/api/n88/student/publication-v2/read?teaching=two'));c.dispose();
 const legacy=[];const v1=createUnifiedStudentPortalClient({fetch:async p=>{legacy.push(p);return Response.json({version:'n88-student-v3'});}});await v1.read();assert.deepEqual(legacy,['/api/n88/student/read']);assert.equal(PUBLICATION_V2_READINESS.enabled,false);v1.dispose();
 const off=createUnifiedStudentPortalClient({fetch:async()=>Response.json(choice)});await assert.rejects(()=>off.read());assert.equal(off.selectedTeaching(),null);off.dispose();
});
test('choice-only and selected replies revalidate membership/eligible set at original commit guard',async()=>{
 const f=await fixture();
 for(const state of ['choice','empty','selected'])for(const change of ['transfer','remove','archive','session']){
  let calls=0,committed=false;
  const auth={current:true,ownerId:f.scope.ownerId,sessionId:f.binding.sessionId,scope:state==='selected'?f.scope:null,studentId:'student-0',enrollmentId:'enrollment-0',selectionState:state,choices:state==='empty'?[]:state==='selected'?[{teachingId:f.scope.teachingId,label:'العلوم'}]:choices,eligibilityRevision:'before'};
  const svc=createPublicationV2Service({enabled:true,executionMode:'synthetic',origin:'https://synthetic.invalid',
   authenticate:async()=>{calls++;return structuredClone(calls===1?auth:{...auth,...(change==='session'?{current:false}:{eligibilityRevision:change})});},
   readCurrent:f.ports.readCurrent,transaction:async fn=>{const guards=[];const r=await fn({state:{scopes:[],receipts:[]},beforeCommit:g=>guards.push(g)});for(const g of guards)await g();committed=true;return r;}});
  const r=await svc({path:'/student/publication-v2/read',method:'GET',body:null,headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1'}});assert.equal(r.status,503);assert.equal(committed,false);assert.equal(calls,2);
 }
});
