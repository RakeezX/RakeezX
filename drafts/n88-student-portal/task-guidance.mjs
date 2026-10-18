/** AI: server-only guidance. Canonical rows/policies supplied by the locked reader. */
import {createHash} from 'node:crypto';
import {studentPortalPublicationBindings,projectStudentPortal} from './student-projection.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
// Math such as x < 5 and 7 > 3 stays plain text. Reject actual tags, scripts and controls.
export const validGuidanceText=v=>typeof v==='string'&&v.length<=400&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?[A-Za-z][^>]*>|<!--|javascript\s*:/i.test(v);
export const validGuidanceInput=v=>exact(v,['subitemId','sourceStamp','revision','executionInstructions','deliveryInstructions','confirmClear'])&&typeof v.subitemId==='string'&&v.subitemId.length>0&&v.subitemId.length<=200&&/^[a-f0-9]{64}$/.test(v.sourceStamp)&&Number.isSafeInteger(v.revision)&&v.revision>=0&&validGuidanceText(v.executionInstructions)&&validGuidanceText(v.deliveryInstructions)&&typeof v.confirmClear==='boolean'&&((v.executionInstructions.trim()||v.deliveryInstructions.trim())||v.confirmClear);
export async function readTaskGuidance(ports,s){
 const r=await ports.query('select subitem_id,teaching_id,case when sum(octet_length(payload::text)) over(order by teaching_id,subitem_id rows unbounded preceding)<=2097152 then payload::text else null end as bounded_payload from n88_private.task_guidance where owner_id=$1::uuid and class_id=$2 and term_id=$3 and ($4::text is null or teaching_id=$4) order by teaching_id,subitem_id limit 2001',[s.ownerId,s.classId,s.termId,s.teachingId||null]);
 if(r.rows.length>2000||r.rows.some(r=>typeof r.bounded_payload!=='string'))throw Error('n88_guidance_unavailable');
 return r.rows.map(r=>({subitem_id:r.subitem_id,teaching_id:r.teaching_id,payload:JSON.parse(r.bounded_payload)}));
}
export function authorizedGuidanceSources(s,members,policy,inputFor){
 const sources=new Map();
 for(const m of [...members].sort((a,b)=>a.studentId.localeCompare(b.studentId))){
  const input=inputFor(s,m),visibility=policy.members.find(p=>p.studentId===m.studentId&&p.enrollmentId===m.enrollmentId);
  if(!visibility)continue;
  let b,p;try{b=studentPortalPublicationBindings(input);p=projectStudentPortal({...input,visibility});}catch{continue;}
  for(const task of Object.values(p.work||{}).flat()){
   const publication=visibility.sources.find(x=>x.kind==='subitem'&&x.publicationId===task.id),src=b.sources.find(x=>x.kind==='subitem'&&x.sourceId===publication?.sourceId&&x.stamp===publication.stamp);
   const row=s.canonical.scoreSubitems.find(x=>x.id===src?.sourceId),item=s.canonical.items.find(x=>x.id===row?.itemId);
   if(!row||item?.teachingId!==s.teachingId)continue;
   const entry=sources.get(row.id)||{subitemId:row.id,title:row.name,bindings:[]};
   entry.bindings.push({studentId:m.studentId,enrollmentId:m.enrollmentId,scopeStamp:b.scopeStamp,stamp:src.stamp,publicationId:task.id});sources.set(row.id,entry);
  }
 }
 return [...sources.values()].map(x=>({...x,sourceStamp:hash([s.ownerId,s.classId,s.termId,s.teachingId,policy.revision,x.subitemId,x.bindings])}));
}
export function guidanceTeacherList(sources,stored){return sources.map(src=>{
 const p=stored.find(r=>r.subitem_id===src.subitemId)?.payload,valid=p?.sourceStamp===src.sourceStamp;
 return {subitemId:src.subitemId,title:src.title,sourceStamp:src.sourceStamp,revision:p?.revision||0,executionInstructions:valid?p.executionInstructions:'',deliveryInstructions:valid?p.deliveryInstructions:'',needsRepublication:!!p&&!valid};
});}
export async function saveTaskGuidance(ports,s,source,stored,input){
 if(!validGuidanceInput(input)||!source||input.sourceStamp!==source.sourceStamp)throw Error('n88_guidance_unavailable');
 const old=stored.find(r=>r.subitem_id===input.subitemId)?.payload;
 if((old?.revision||0)!==input.revision)throw Error('n88_guidance_unavailable');
 const payload={revision:input.revision+1,sourceStamp:source.sourceStamp,executionInstructions:input.executionInstructions,deliveryInstructions:input.deliveryInstructions,bindings:source.bindings};
 await ports.query('insert into n88_private.task_guidance(owner_id,class_id,term_id,teaching_id,subitem_id,payload) values($1::uuid,$2,$3,$4,$5,$6::jsonb) on conflict(owner_id,class_id,term_id,teaching_id,subitem_id) do update set payload=excluded.payload',[s.ownerId,s.classId,s.termId,s.teachingId,input.subitemId,JSON.stringify(payload)]);
 return {saved:true,subitemId:input.subitemId,revision:payload.revision,sourceStamp:source.sourceStamp};
}
export function guidanceForStudent(input,definition,publication){
 const item=input.canonical.items.find(x=>x.id===definition.itemId);
 const p=input.taskGuidance?.find(r=>r.subitem_id===definition.id&&r.teaching_id===item?.teachingId)?.payload;
 if(!p||!validGuidanceText(p.executionInstructions)||!validGuidanceText(p.deliveryInstructions))return {};
 const current=studentPortalPublicationBindings(input),src=current.sources.find(x=>x.kind==='subitem'&&x.sourceId===definition.id);
 if(!p.bindings.some(b=>b.studentId===input.studentId&&b.enrollmentId===input.enrollmentId&&b.scopeStamp===current.scopeStamp&&b.stamp===src?.stamp&&b.publicationId===publication.publicationId))return {};
 return {...(p.executionInstructions.trim()?{executionInstructions:p.executionInstructions}:{}),...(p.deliveryInstructions.trim()?{deliveryInstructions:p.deliveryInstructions}:{})};
}
