/** AI: owned fabricated ports run the published integrated V2 implementation unchanged. */
import { createHash } from 'node:crypto';
import { createIntegratedService } from '../../drafts/n88-student-portal/integrated-service.mjs';
import { createMemoryRepository } from '../../drafts/n88-student-portal/memory-repository.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { fixture as legacyFixture, A, SESSION } from '../n88-terminal-negative-20261028/fixture.mjs';
export { A, SESSION };
export const scope={ownerId:A,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'};
export const binding={sessionId:SESSION,leaseId:'n88-synthetic',contextRevision:'["1","1"]'};
export async function fixture() {
  const legacy=legacyFixture(1),memory=createMemoryRepository({scopes:[],receipts:[]}),token=legacy.provider.token();
  const row=(id,v={})=>({id,ownerId:A,deleted:false,deletedAt:null,revision:'1',...v});
  const c=Object.fromEntries(CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t=>[t,[]]));
  Object.assign(c,{
    years:[row('year',{status:'active'})],terms:[row('term',{status:'active',yearId:'year',startDate:'2026-08-01',endDate:'2027-06-01'})],
    sections:[row('class',{status:'active',yearId:'year',name:'الفصل المصطنع',grade:4,label:'أ'})],teachings:[row('teaching',{sectionId:'class',termId:'term',subjectId:'subject'})],
    students:[row('student-0',{name:'طالب مصطنع',status:'active'})],enrollments:[row('enrollment-0',{studentId:'student-0',sectionId:'class',status:'active',startDate:null,endDate:null})],
    items:[row('parent',{teachingId:'teaching',name:'توزيع المادة',scoreMode:'subitems',max:10,order:0}),row('direct',{teachingId:'teaching',name:'اختبار مستقل',scoreMode:'direct',max:10,order:1})],
    scoreSubitems:[row('required',{itemId:'parent',name:'مهمة مطلوبة',value:2,latePoints:1,startDate:'2026-10-20',dueDate:'2026-11-01',order:0}),
      row('scheduled',{itemId:'parent',name:'مهمة قادمة',value:3,latePoints:1,startDate:'2026-11-04',dueDate:'2026-11-05',order:1}),
      row('completed',{itemId:'parent',name:'مهمة مكتملة',value:5,latePoints:2,startDate:'2026-10-20',dueDate:'2026-10-30',order:2})],
    scoreSubitemCompletions:[row('completion',{studentId:'student-0',subitemId:'completed',checked:true,completionState:'regular'})],
    scores:[row('parent-score',{studentId:'student-0',itemId:'parent',value:5,manualValue:null}),row('direct-score',{studentId:'student-0',itemId:'direct',value:4})]
  });
  const state={canonical:c,current:true,studentCurrent:true,sessionId:SESSION,teacherCalls:[],studentCalls:0,lost:false,fail:false,delay:0};
  const ports={transaction:fn=>memory.transaction(async state=>{const guards=[];const result=await fn({state,beforeCommit:guard=>guards.push(guard)});for(const guard of guards)await guard();return result;}),readCurrent:async()=>({canonical:structuredClone(state.canonical),now:'2026-10-31'}),
    authenticate:async(request,tx,role)=>{
      if(role==='teacher')return {current:state.current&&request.headers.authorization==='Bearer '+token,ownerId:A,sessionId:state.sessionId};
      const studentToken=/__Secure-n88-student=([^;]+)/.exec(request.headers.cookie??'')?.[1];
      const sessions=legacy.snapshot().numericSessions;
      const session=studentToken&&sessions.find(s=>s.tokenHash===createHash('sha256').update(studentToken).digest('hex')&&s.revokedAt===null&&s.expiresAt>Date.now());
      return session&&state.studentCurrent?{current:true,ownerId:A,sessionId:session.id,scope:{...scope},studentId:session.studentId,enrollmentId:session.enrollmentId}:null;
    }};
  const service=createIntegratedService({...legacy.options,executionMode:'synthetic',publicationV2Enabled:true,publicationV2:ports},{verifyIngress:async()=>null},memory);
  const input=await legacy.input();await legacy.request('issue-missing',input);
  const list=await legacy.request('list',{uiProtocol:'n88-public-ui-v1'});
  const code=list.body.data.students[0].credential;
  if(!/^1[0-9]{5}$/.test(code))throw Error('synthetic numeric fixture did not provision');
  const request=async(path,init={})=>{
    const headers=Object.fromEntries(new Headers(init.headers));headers.origin=legacy.options.origin;
    const v2=path.endsWith('/publication-v2')||path.endsWith('/publication-v2/read');
    const body=init.body?JSON.parse(init.body):undefined;
    if(v2&&body){state.teacherCalls.push(structuredClone(body));}
    if(v2&&!body)state.studentCalls++;
    if(v2&&state.delay)await new Promise(r=>setTimeout(r,state.delay));
    if(v2&&state.fail)return Response.json({state:'unknown',retry:false},{status:503});
    const result=await (v2?service:legacy.service)({path:path.replace(/^\/api\/n88/,''),method:init.method??'GET',headers,body});
    if(v2&&body?.action==='item-publication-set'&&state.lost){state.lost=false;throw Error('fabricated lost response after service COMMIT');}
    return Response.json(result.body,{status:result.status,headers:result.headers});
  };
  return {state,legacy,service,ports,request,scope,binding,code,token,snapshot:memory.snapshot};
}
