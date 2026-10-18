/** AI: populate ONLY the fresh owned fabricated review through its actual service. */
import {randomUUID} from 'node:crypto';
import {A,SESSION} from '../../tests/fixtures/n88-existing-host/provider.mjs';
export async function prepareGuidanceExamples(review){
 const origin=new URL(review.url).origin,binding={ownerId:A,sessionId:SESSION,leaseId:'guidance-review',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const call=async(action,body={})=>{const response=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+review.testing.provider.token()},body:JSON.stringify({binding,teachingId:'teaching',...body})});if(!response.ok)throw Error('Synthetic guidance example unavailable');return (await response.json()).data;};
 const r=await call('list');
 await call('visibility',{policyRevision:r.policyRevision,expectedRosterRevision:r.rosterRevision,fields:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,true]))});
 const {tasks}=await call('guidance-list');
 const examples={
  overdue:['قارن 1/2 و3/4 بالرسم.\nاكتب سبب اختيارك في سطرين.','اكتب الحل في كراسة الرياضيات وأحضرها إلى الحصة القادمة.'],
  regular:['راجع نموذج الحل الذي ناقشناه في الفصل.','احتفظ بالتدريب في ملف إنجازك؛ الإنجاز مرصود لدى المعلم.'],
  late:['راجع جدول الضرب من 2 إلى 5 واكتب مثالين.','اعرض كراستك على المعلم في بداية الحصة.'],
  future:['أكمل النمط: 3، 6، 9، …\nاشرح قاعدة النمط.','نفّذ النشاط في ورقة واحدة وأحضرها في موعد المهمة.']
 };
 for(const t of tasks){const [executionInstructions,deliveryInstructions]=examples[t.subitemId]||['اقرأ المهمة ثم اكتب الحل.','أحضر كراسة الحل إلى الفصل.'];await call('guidance-save',{requestId:randomUUID(),guidance:{subitemId:t.subitemId,sourceStamp:t.sourceStamp,revision:t.revision,executionInstructions,deliveryInstructions,confirmClear:false}});}
 const roster=await call('list');await call('issue-missing',{expectedRosterRevision:roster.rosterRevision,requestId:randomUUID()});
 return review;
}
