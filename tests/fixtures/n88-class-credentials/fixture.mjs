/** AI: fabricated service transaction stub, no PG/server/browser/live identities. */
import { createNumericCredentialOperations } from '../../../drafts/n88-student-portal/numeric-credentials.mjs';
import { createClassCredentialOperations } from '../../../drafts/n88-student-portal/class-credentials.mjs';
export function fixture({generate,issueMember}={}) {
  let state={contexts:[{ownerId:'owner-a',active:true},{ownerId:'owner-b',active:true}],memberships:[],
    numericCredentials:[],numericSessions:[],numericRates:[],classReceipts:[]};
  for(const [ownerId,classId] of [['owner-a','class-a'],['owner-b','class-b']])
    for(let i=1;i<=3;i++) state.memberships.push({ownerId,classId,studentId:`${ownerId}-student-${i}`,enrollmentId:`${ownerId}-enrollment-${i}`,
      revision:1,canonicalStamp:'stamp-1',status:'active',endDate:null,studentActive:true,classActive:true,label:`Fabricated ${i}`});
  let gate=Promise.resolve(),lose=false,rollback=false,time=1800000000000;
  const f={snapshot:()=>structuredClone(state),mutate:fn=>fn(state),authCurrent:true,authOwner:'owner-a',scopeCurrent:true,
    failCommit:()=>{rollback=true;},loseAck:()=>{lose=true;},advance:ms=>{time+=ms;},syncCalls:[]};
  const repository={transaction(action) {
    const task=gate.then(async()=>{
      const db=structuredClone(state),checks=[];
      const ports={synchronizeOwner:async owner=>{f.syncCalls.push(owner);},beforeCommit:fn=>checks.push(fn)};
      const value=await action(db,ports);
      for(const check of checks) await check();
      if(rollback){rollback=false;throw Error('synthetic rollback');}
      state=structuredClone(db);
      if(lose){lose=false;throw Error('synthetic lost commit ACK');}
      return structuredClone(value);
    });
    gate=task.catch(()=>{});return task;
  }};
  const numeric=createNumericCredentialOperations({keys:new Map([['v1',Buffer.alloc(32,7)]]),activeKeyVersion:'v1',
    reservationKey:Buffer.alloc(32,8),now:()=>time,...(generate?{generate}:{})});
  const verifyTeacher=async(_request,ports)=>{
    if(!f.authCurrent)return null;
    const ownerId=f.authOwner;
    ports.beforeCommit(()=>{if(!f.authCurrent || f.authOwner!==ownerId)throw Error('synthetic auth expired');});
    return {ownerId,sessionId:'synthetic-current-session',current:true};
  };
  const resolveClass=async(_db,_ports,auth,teachingId,input)=>{
    const target=teachingId??'teaching-a';
    const owner=target==='teaching-a'?'owner-a':target==='teaching-b'?'owner-b':null;
    return owner && f.scopeCurrent ? {ownerId:owner,classId:owner==='owner-a'?'class-a':'class-b',teachingId:target,current:true,revision:'teaching-revision-1'} : null;
  };
  const module=createClassCredentialOperations({repository,verifyTeacher,resolveClass,...numeric,origin:'https://synthetic.invalid',
    verifyIngress:async r=>r.trusted===false?null:{clientKey:'synthetic-trusted-ingress'},
    ...(issueMember?{issueMember:(...args)=>issueMember(numeric.issueMember,...args)}:{})});
  f.forRequest=r=>module.forRequest(r);
  const classRequest={method:'POST',headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json'}};
  const writes=module.forRequest(classRequest),reads=module.forRequest({method:'GET'});
  f.ops={...writes,listClass:reads.listClass};
  f.numeric=numeric;f.repository=repository;
  const handler=numeric.createStudentHandler({repository,verifyIngress:async r=>r.trusted===false?null:{clientKey:r.clientKey||'synthetic-client'},origin:'https://synthetic.invalid',
    project:async(_db,m)=>({ownerId:m.ownerId,studentId:m.studentId,tasks:[],grades:null})});
  f.request=(action,{code,cookie,clientKey,trusted,headers,...rest}={})=>handler({path:'/api/n88/student/'+action,method:action==='read'?'GET':'POST',
    headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json',...(cookie?{cookie}:{}),...headers},body:{code},clientKey,trusted,...rest});
  f.input=async(requestId='synthetic-request-0001')=>({requestId,expectedRosterRevision:(await f.ops.listClass('teaching-a')).body.rosterRevision});
  f.member=()=>{const r=state.memberships[0];return {studentId:r.studentId,enrollmentId:r.enrollmentId,revision:r.revision,
    credentialVersion:Math.max(0,...state.numericCredentials.filter(c=>c.ownerId===r.ownerId && c.studentId===r.studentId).map(c=>c.version))};};
  return f;
}
