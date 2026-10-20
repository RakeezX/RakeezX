import {sourceClasses,selectedSourceClass,coverageMessage} from './source-roster.js';
import {CATEGORIES,parseCategoryTable,validateCategory,stageCategory,bundle} from './categories.js';
import {readSelectedCategoryTable} from './selection.js';
import {mountDateTimeControl} from './lib/rakeez-datetime.js';
import {namesCsv} from './core.js';
import { HANDOFF_TTL, validateHandoff } from './handoff-protocol.js';
const $=id=>document.getElementById(id);
let draft=null,staged=[],generation=0,sourceRoster=null,chosenClass='',sourceInfo=null,pendingBatch=null,batchProgress=new Map(),classTotals=new Map();
window.n36HasSourceRoster=()=>!!sourceRoster;
const automaticFailures=new Set();
let lastTransferFailure=null,setupReceipt=null,profileFailure=null;
const setupFields=new Map();
const reasonRank={missing:0,current:1,saved:2,conflict:3,unsupported:3,ambiguous:3,unrecognized:3};
function mergeSetupField(map,d){if(!map.has(d.field)||reasonRank[d.reason]>=reasonRank[map.get(d.field).reason])map.set(d.field,d);}
// AI: diagnostic codes are fixed, counts-only; never surface source text or runtime messages.
const transferCodes=new Set(['SOURCE_CHANGED','REVIEW_EXPIRED','HANDOFF_SCHEMA','HANDOFF_SETUP','HANDOFF_BATCH','HANDOFF_LIMIT_OR_EXPIRED','HANDOFF_VALUE','HANDOFF_DUPLICATE','HANDOFF_UNAVAILABLE','BATCH_EXPIRED','APP_CHANGED','APP_FRAME','APP_DOCUMENT_BINDING','HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER']);
const transferCode=error=>transferCodes.has(error?.message)?error.message:'HANDOFF_UNAVAILABLE';
const failureHelp=code=>code==='APP_CHANGED'?'ارجع إلى تبويب ركيز الذي بدأ منه التشغيل.':code==='BATCH_EXPIRED'||code==='REVIEW_EXPIRED'?'انتهت صلاحية التشغيل؛ استكمل ما وصل إلى ركيز من الحساب نفسه.':code==='SOURCE_CHANGED'?'تغيّرت صفحة المصدر؛ أُوقف النقل لحماية بياناتك.':'تحقق من أن الإضافة وحساب ركيز المفتوح محدّثان، ثم استكمل الدفعة المحفوظة.';
const sourceBatch=()=>selectedSourceClass(sourceRoster,chosenClass,batchProgress.get(chosenClass)?.offset??0);
const message=value=>{$('category-status').textContent=value;};
let sourceView=null,exportRevision=0;
const invalidateExport=()=>{exportRevision++;$('bundle-review').checked=false;$('bundle-download').disabled=true;$('bundle-csv').disabled=true;$('handoff-transfer').disabled=true;};
// AI: the visible class/batch is bound in module state, never by a spoofable checkbox.
function sourceTransferReady(){
 return !!(sourceView&&sourceRoster===sourceView.roster&&chosenClass===sourceView.classroom&&
  (batchProgress.get(chosenClass)?.offset??0)===sourceView.offset&&sourceView.rows.length&&!pendingBatch&&
  window.n36HandoffSource?.()&&(window.n36AutomaticBatch||sourceInfo.complete||$('partial-approval')?.checked));
}
function refreshSourceTransfer(){if(sourceRoster)$('handoff-transfer').disabled=!sourceTransferReady();}
function destroyPickers(container){for(const input of container.querySelectorAll('input')){input.value='';input._flatpickr?.destroy();}}
function clearDraft(){destroyPickers($('category-preview'));generation++;draft=null;$('category-preview').replaceChildren();$('category-review').checked=false;$('category-review').disabled=true;$('category-stage').disabled=true;invalidateExport();}
function error(e){clearDraft();message(`غير محسوم (${e.message}). صحّح التسميات أو الحقول وأعد المعاينة؛ لا تصدير لهذه البيانات.`);}
function edits(container,category,rows,onEdit){
 for(const [index,row] of rows.entries()){
  const group=document.createElement('fieldset');group.dataset.row=String(index);
  const legend=document.createElement('legend'),include=document.createElement('input');include.type='checkbox';include.checked=true;include.className='include-row';
  legend.append(include,document.createTextNode(` تضمين الصف ${index+1}`));group.append(legend);
  for(const [field,label] of Object.entries(CATEGORIES[category].fields)){
   const line=document.createElement('label'),selected=document.createElement('input'),input=document.createElement('input');
   selected.type='checkbox';selected.checked=Object.hasOwn(row,field);selected.className='include-field';selected.dataset.field=field;selected.setAttribute('aria-label',`تضمين ${label}، الصف ${index+1}`);
   input.type='text';input.value=row[field]??'';input.maxLength=80;input.dataset.field=field;input.setAttribute('aria-label',`${label}، الصف ${index+1}`);input.disabled=!selected.checked;
   if(field==='time'){
    const end=document.createElement('input');end.type='text';end.dataset.field=field;end.dataset.timePart='end';input.dataset.timePart='start';
    const parts=(row[field]??'').split('-');input.value=parts[0];end.value=parts[1]??'';
    input.setAttribute('aria-label',`وقت البداية، الصف ${index+1}`);end.setAttribute('aria-label',`وقت النهاية (اختياري)، الصف ${index+1}`);
    for(const control of [input,end]){control.dataset.rakeezDatetime='time';control.disabled=!selected.checked;control.addEventListener('input',onEdit);control.addEventListener('change',onEdit);}
    selected.addEventListener('change',()=>{input.disabled=end.disabled=!selected.checked;onEdit();});
    line.append(selected,document.createTextNode(label+' (بداية / نهاية اختيارية)'),input,end);group.append(line);
    mountDateTimeControl(input);mountDateTimeControl(end);
    const close=document.createElement('button');close.type='button';close.className='close-time-picker';close.textContent='إغلاق اختيار الوقت';
    close.addEventListener('click',()=>{close.focus();input._flatpickr.close();end._flatpickr.close();});group.append(close);
   }else{
    selected.addEventListener('change',()=>{input.disabled=!selected.checked;onEdit();});input.addEventListener('input',onEdit);line.append(selected,document.createTextNode(label),input);group.append(line);
   }
  }
  include.addEventListener('change',()=>{group.classList.toggle('excluded',!include.checked);onEdit();});container.append(group);
 }
}
function readEdits(container,category){
 const rows=Array.from(container.querySelectorAll('fieldset')).filter(g=>g.querySelector('.include-row').checked).map(g=>Object.fromEntries(Array.from(g.querySelectorAll('.include-field')).filter(c=>c.checked).map(c=>{
  if(c.dataset.field==='time'){const start=g.querySelector('[data-time-part=start]').value,end=g.querySelector('[data-time-part=end]').value;return ['time',start+(end?'-'+end:'')];}
  return [c.dataset.field,g.querySelector(`input[type=text][data-field="${c.dataset.field}"]`).value];
 })));
 return validateCategory(category,rows);
}
function show(category,rows,source){
 draft={category,source};edits($('category-preview'),category,rows,()=>{$('category-review').checked=false;$('category-stage').disabled=true;invalidateExport();message('تغيّرت المعاينة. راجع القيم وعدّل غير المحسوم ثم أكّد المراجعة.');});
 $('category-review').disabled=false;message(`${CATEGORIES[category].label}: ${rows.length} صف للمراجعة، دون حفظ أو تصدير.`);
}
function renderStaged(){
 destroyPickers($('staged-categories'));$('staged-categories').replaceChildren();invalidateExport();
 for(const item of staged){
  const group=document.createElement('section');group.dataset.category=item.category;
  const label=document.createElement('label'),included=document.createElement('input');included.type='checkbox';included.checked=true;included.className='include-category';label.append(included,document.createTextNode(CATEGORIES[item.category].label));group.append(label);
  const remove=document.createElement('button');remove.type='button';remove.textContent='مسح هذه الفئة';remove.addEventListener('click',()=>{staged=staged.filter(c=>c!==item);renderStaged();});group.append(remove);
  const fields=document.createElement('div');fields.className='staged-fields';edits(fields,item.category,item.rows,invalidateExport);group.append(fields);included.addEventListener('change',invalidateExport);$('staged-categories').append(group);
 }
 $('bundle-review').disabled=!staged.length;
}
function selectedStaged(){
 return Array.from($('staged-categories').querySelectorAll('section')).filter(s=>s.querySelector('.include-category').checked).map(s=>{const original=staged.find(c=>c.category===s.dataset.category);return {...original,rows:readEdits(s.querySelector('.staged-fields'),original.category)};});
}
function sourceEdit(){clearDraft();message('تغيّر المصدر أو الفئة؛ أُبطلت المعاينة. الفئات المحتفظ بها تبقى ظاهرة حتى تمسحها.');}
$('category').addEventListener('change',()=>{sourceEdit();$('category-table').value='';$('category-help').textContent=$('category').value==='names'?'CSV الأسماء يستخدم المسار السابق.':Object.values(CATEGORIES[$('category').value].fields).join(' ← ');$('legacy-names').hidden=$('category').value!=='names';$('structured-category').hidden=$('category').value==='names';$('cancel').click();});
$('category-table').addEventListener('input',sourceEdit);
$('category-paste').addEventListener('click',()=>{
 clearDraft();const category=$('category').value,text=$('category-table').value;$('category-table').value='';
 try{show(category,parseCategoryTable(category,text),'pasted-visible');}catch(e){error(e);}
});
$('category-extract').addEventListener('click',async()=>{
 clearDraft();$('category-table').value='';const ticket=generation,category=$('category').value;
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const u=new URL(tab?.url??'');const official=u.protocol==='https:'&&!u.port&&['madrasati.moe.gov.sa','madrasatibeta.moe.gov.sa'].includes(u.hostname);
  const local=['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(!tab?.id||(!official&&!local))throw Error('UNSUPPORTED_ORIGIN');
  const result=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',func:readSelectedCategoryTable,args:[category]});
  if(ticket!==generation)return;if(result.length!==1||!result[0].result?.ok)throw Error(result[0]?.result?.code??'READ_FAILED');
  show(category,parseCategoryTable(category,result[0].result.text),'selected-visible');
 }catch(e){if(ticket===generation)error(Error(/^[A-Z_]+$/.test(e.message)?e.message:'READ_FAILED'));}
});
$('category-review').addEventListener('change',()=>{
 $('category-stage').disabled=true;
 if(!$('category-review').checked||!draft)return;
 try{readEdits($('category-preview'),draft.category);$('category-stage').disabled=false;}catch(e){$('category-review').checked=false;message(`غير محسوم (${e.message}). عدّل الحقول أو استبعد الصف؛ لم يُحتفظ به.`);}
});
$('category-stage').addEventListener('click',()=>{
 if(!draft||!$('category-review').checked||$('category-stage').disabled)return;
 try{const selected=selectedStaged();staged=stageCategory(selected,draft.category,readEdits($('category-preview'),draft.category),draft.source);clearDraft();renderStaged();message('احتُفظ بالفئة مؤقتًا. راجع الفئات أدناه؛ لا ملف ولا إضافة إلى ركيز.');}catch(e){message(`غير محسوم (${e.message}). لم تتغير الفئات المحتفظ بها.`);}
});
$('category-cancel').addEventListener('click',()=>{clearDraft();$('category-table').value='';message('أُلغيت المعاينة فقط. لمسح كل الفئات استخدم «مسح الكل».');});
$('bundle-clear').addEventListener('click',()=>{clearDraft();staged=[];$('category-table').value='';renderStaged();message('مُسحت جميع البيانات المؤقتة. لم تُضف بيانات إلى ركيز.');window.dispatchEvent(new Event('n36:discard'));});
$('bundle-review').addEventListener('change',()=>{
 $('bundle-download').disabled=true;$('bundle-csv').disabled=true;$('handoff-transfer').disabled=true;if(!$('bundle-review').checked)return;
 try{if(sourceRoster){refreshSourceTransfer();return;}const selected=selectedStaged();bundle(selected);$('bundle-download').disabled=false;$('bundle-csv').disabled=!selected.some(c=>c.category==='students');$('handoff-transfer').disabled=!window.n36HandoffSource?.()||!selected.some(c=>c.category==='students');}catch(e){$('bundle-review').checked=false;message(`غير محسوم (${e.message}). لا يمكن تصدير الحزمة.`);}
});
$('handoff-transfer').addEventListener('click',async()=>{
 if($('handoff-transfer').disabled||(sourceRoster?!sourceTransferReady():!$('bundle-review').checked))return;
 const view=sourceView,revision=exportRevision,sourceMode=!!sourceRoster;
 $('handoff-transfer').disabled=true;
 try {
  await window.n36BeforeExport?.();
  if(sourceMode?(revision!==exportRevision||view!==sourceView||!sourceTransferReady()):!$('bundle-review').checked)throw Error('SOURCE_CHANGED');
  const source=window.n36HandoffSource?.();if(!source)throw Error('SOURCE_CHANGED');
  const rows=sourceMode?view.rows:selectedStaged().find(c=>c.category==='students')?.rows;
  window.n36Diagnostics?.publish({stage:'saving',transfer:'sending',receipt:'not-available',failure:'none',failurePhase:'none',failureStep:'none'});
  const createdAt=Date.now();
  const envelope=validateHandoff({schema:'rakeez-extension-names',version:window.n36AutomaticBatch?3:1,...source,...(window.n36AutomaticBatch?{batchId:window.n36AutomaticBatch,complete:sourceInfo.complete,setup:sourceInfo.setup??[]}:{}),createdAt,expiresAt:createdAt+HANDOFF_TTL,rows});
  if(sourceMode){$('source-class-select').disabled=true;$('partial-approval').disabled=true;}
  const result=await chrome.runtime.sendMessage({type:'n36-create',envelope});
  // Cancellation/expiry already queued transport erasure; a late reply cannot revive its UI.
  if(sourceMode&&(revision!==exportRevision||view!==sourceView||!window.n36HandoffSource?.()))return;
  if(!result?.ok)throw Error(transferCodes.has(result?.code)?result.code:'HANDOFF_UNAVAILABLE');
  window.n36Diagnostics?.publish({transfer:'pending',receipt:'pending'});
  window.dispatchEvent(new Event('n36:exported'));
  if(sourceRoster){pendingBatch={actionId:result.actionId,classroom:chosenClass,count:rows.length};invalidateExport();$('source-class-select').disabled=true;$('source-retry').hidden=false;}
  $('direct-handoff').hidden=false;
  $('handoff-status').textContent=window.n36AutomaticBatch?'جار الاستيراد في تبويب ركيز المفتوح؛ ننتظر إيصال الحفظ المحلي، لا مهلة انتظار إلزامية.':'فُتح ركيز في المتصفح نفسه. اختر فصلًا مملوكًا وراجع ثم أكّد؛ لم تُحفظ أسماء تلقائيًا. النقل لمرة واحدة ولمدة دقيقتين.';
 } catch (error) {
  const code=transferCode(error);lastTransferFailure=code;window.n36Diagnostics?.publish({transfer:'error',failure:code});
  if(sourceMode&&(!sourceRoster||view.roster!==sourceRoster))return;
  if(sourceMode){$('source-class-select').disabled=false;$('partial-approval').disabled=false;}
  invalidateExport();$('direct-handoff').hidden=false;
  $('handoff-status').textContent=`تعذّر إرسال الدفعة (${code}). ${failureHelp(code)} لم يُفترض حفظها.`;
  if(window.n36AutomaticBatch&&sourceMode){
   // A transport rejection affects the destination, so stop rather than retry it for every class.
   for(const group of sourceClasses(sourceRoster))if((batchProgress.get(group.classroom)?.offset??0)<group.count)automaticFailures.add(group.classroom);
   $('source-retry').hidden=false;
   // A failed send must not leave an endless importing state or advance its receipt cursor.
   queueMicrotask(advanceAutomatic);
  }
 }
});
$('handoff-cancel').addEventListener('click',()=>{chrome.runtime.sendMessage({type:'n36-cancel'});$('bundle-clear').click();$('direct-handoff').hidden=false;$('handoff-status').textContent='مُسحت بيانات الإضافة وأُلغي النقل التالي؛ ما حُفظ محليًا في ركيز يبقى محفوظًا.';});
$('bundle-download').addEventListener('click',async()=>{
 if(!$('bundle-review').checked||$('bundle-download').disabled)return;
 try{
  await window.n36BeforeExport?.();if(!$('bundle-review').checked||$('bundle-download').disabled)return;
  const payload=bundle(selectedStaged());const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='rakeez-private-teacher-setup-v1.json';
  try{document.body.append(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  invalidateExport();message('طُلب تنزيل حزمة محلية واحدة. تكامل ملف التعريف والجدول مع ركيز لم يُتحقق منه بعد.');
  window.dispatchEvent(new Event('n36:exported'));
 }catch(e){invalidateExport();message(`تعذّر التصدير (${e.message}).`);}
});
$('bundle-csv').addEventListener('click',async()=>{
 if(!$('bundle-review').checked||$('bundle-csv').disabled)return;
 try{
  await window.n36BeforeExport?.();if(!$('bundle-review').checked||$('bundle-csv').disabled)return;
  const chosen=selectedStaged().find(c=>c.category==='students');const csv=namesCsv(chosen?.rows.map(r=>r.name)??[]);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='rakeez-student-names.csv';
  try{document.body.append(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  invalidateExport();window.dispatchEvent(new Event('n36:exported'));
 }catch(e){invalidateExport();message(`تعذّر تصدير الأسماء (${/^[A-Z_]+$/.test(e.message)?e.message:'SOURCE_CHANGED'}). لا ملف.`);}
});
window.addEventListener('n36:preview',({detail})=>{clearDraft();staged=bundle(detail).categories;renderStaged();const hasStudents=staged.some(c=>c.category==='students'&&c.rows.length);$('legacy-tools').open=hasStudents;$('legacy-tools').querySelector('summary').textContent=hasStudents?'معاينة البيانات ومراجعتها قبل النقل':'تفاصيل البيانات الأخرى (اختياري)';$('structured-category').hidden=false;$('legacy-names').hidden=true;});
window.addEventListener('n36:clear',({detail})=>{if(!detail?.continuing)classTotals.clear();if(sourceView){sourceView.roster=null;sourceView.rows.length=0;}sourceView=null;$('bundle-review').closest('label').hidden=false;sourceRoster=null;sourceInfo=null;pendingBatch=null;batchProgress.clear();chosenClass='';const approval=$('bundle-review').closest('label');$('staged-categories').after(approval);$('source-class-review')?.remove();clearDraft();staged=[];renderStaged();$('table').value='';$('category-table').value='';$('cancel').click();});

// AI: only one reviewed transport batch materializes; receipt, never send/claim, advances it.
function renderSourceChoice(){
 const names=$('source-class-names'),status=$('source-class-status');if(!names||!sourceRoster)return;
 names.replaceChildren();invalidateExport();if($('partial-approval'))$('partial-approval').checked=false;
 const progress=batchProgress.get(chosenClass)??{offset:0,added:0,existing:0};
 const totals=classTotals.get(chosenClass)??{collected:0,added:0,existing:0};
 const count=sourceRoster.filter(r=>r.classroom===chosenClass).length;
 const rows=chosenClass&&progress.offset<count?sourceBatch():[];names.hidden=!rows.length;
 if($('partial-approval'))$('partial-approval').disabled=!!pendingBatch;
 sourceView={roster:sourceRoster,classroom:chosenClass,offset:progress.offset,rows};
 for(const row of rows){const li=document.createElement('li');li.textContent=row.name;names.append(li);}
 status.textContent=window.n36AutomaticBatch?(pendingBatch?'جار حفظ الدفعة في ركيز…':'جار نقل الأسماء المتاحة؛ لا مراجعة فصلية مطلوبة.') : chosenClass?`${rows.length} اسمًا للمراجعة${count>300?' — من أصل '+count+' في الفصل':''}${totals.added||totals.existing?'؛ أضيف محليًا '+totals.added+'، موجود سابقًا '+totals.existing:''}.`:'اختر الفصل لعرض أسمائه.';
 $('bundle-review').disabled=!rows.length||!!pendingBatch;
 $('handoff-transfer').hidden=!!window.n36AutomaticBatch;
 $('handoff-status').hidden=!!window.n36AutomaticBatch;
 $('handoff-transfer').textContent=window.n36AutomaticBatch?'استكمال النقل':'راجعت الأسماء — نقل الفصل إلى ركيز';
 refreshSourceTransfer();
}
window.addEventListener('n36:source-roster',({detail})=>{
 const groups=sourceClasses(detail.rows);
 window.n36Diagnostics?.publish({valid:detail.rows.length,staged:detail.rows.length,classes:groups.length,coverage:detail.coverage,hasNext:detail.hasNextReport,processedPages:detail.processedReportPages,excluded:detail.excluded});
 if(!detail.continuing){setupFields.clear();classTotals.clear();automaticFailures.clear();lastTransferFailure=null;setupReceipt=null;profileFailure=null;}
 for(const group of groups){const prior=classTotals.get(group.classroom)??{collected:0,added:0,existing:0};classTotals.set(group.classroom,{...prior,collected:prior.collected+group.count});}
 clearDraft();staged=[];sourceInfo=detail;sourceRoster=detail.rows;chosenClass='';pendingBatch=null;batchProgress.clear();renderStaged();
 $('source-class-review')?.remove();
 const section=document.createElement('section');section.id='source-class-review';
 const label=document.createElement('label');label.textContent='اختر الفصل';
 const select=document.createElement('select');select.id='source-class-select';
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='اختر فصلًا ثم راجع أسماء الدفعة';select.append(placeholder);
 for(const group of groups){const option=document.createElement('option');option.value=group.classroom;option.textContent=`${group.classroom}: ${group.count} اسمًا متاحًا في الكشف`;select.append(option);}
 const coverage=document.createElement('p');coverage.id='source-coverage';coverage.textContent=window.n36AutomaticBatch?(detail.complete?'ثبتت نهاية صفحات الكشف.':'التغطية جزئية؛ سيُحفظ المتاح فقط، دون افتراض اكتمال المصدر.'):detail.complete?'':coverageMessage(detail);
 const partial=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='partial-approval';partial.append(check,document.createTextNode(' أفهم أن الكشف ناقص أو غير معلوم الاكتمال وأوافق على استيراد المتاح فقط'));partial.hidden=detail.complete;
 check.addEventListener('change',()=>{invalidateExport();refreshSourceTransfer();});
 const status=document.createElement('p');status.id='source-class-status';
 const names=document.createElement('ol');names.id='source-class-names';
 select.addEventListener('change',()=>{chosenClass=select.value;check.checked=false;renderSourceChoice();});
 const retry=document.createElement('button');retry.id='source-retry';retry.type='button';retry.hidden=true;retry.textContent=window.n36AutomaticBatch?'استكمال الفصول غير المحسومة':'إعادة نقل الدفعة نفسها';
 retry.addEventListener('click',()=>{profileFailure=null;pendingBatch=null;select.disabled=false;retry.hidden=true;renderSourceChoice();if(window.n36AutomaticBatch){automaticFailures.clear();queueMicrotask(advanceAutomatic);}$('handoff-status').textContent='جار استكمال الدفعة؛ يفحص ركيز الأسماء الموجودة قبل أي إضافة.';});
 const approval=$('bundle-review').closest('label');approval.hidden=true;approval.lastChild.textContent=' راجعت أسماء هذه الدفعة والفصل؛ سأطابقه بفصل مملوك لي وأؤكد داخل ركيز';
 const summary=document.createElement('p');summary.id='source-class-summary';summary.textContent=`جُمعت ${sourceRoster.length} أسماء / ${groups.length} فصول`;label.append(select);section.append(summary,coverage,label,status,names,partial,approval,retry);$('direct-handoff').before(section);$('direct-handoff').hidden=false;
 $('legacy-tools').open=false;renderSourceChoice();if(window.n36AutomaticBatch){section.querySelector('label').hidden=true;partial.hidden=true;names.hidden=true;queueMicrotask(advanceAutomatic);}
});
setInterval(async()=>{
 const pending=pendingBatch;if(!pending||!sourceRoster)return;
 try{
  const result=await chrome.runtime.sendMessage({type:'n36-result',actionId:pending.actionId});
  if(pendingBatch!==pending||!result?.ok||result.status==='pending')return;
  window.n36Diagnostics?.publish({receipt:result.status,transfer:result.status==='unknown'?'error':'idle',...(result.failure?{failure:result.failure.code,failurePhase:result.failure.phase,failureStep:result.failure.step}:{})});
  if(['saved','existing'].includes(result.status)&&result.total===pending.count&&result.remaining===0&&result.added+result.existing===pending.count){
   if(result.setup){setupReceipt=result.setup;for(const d of result.setup.details??[]){mergeSetupField(setupFields,d);}}
   const progress=batchProgress.get(pending.classroom)??{offset:0,added:0,existing:0};
   batchProgress.set(pending.classroom,{offset:progress.offset+pending.count,added:progress.added+result.added,existing:progress.existing+result.existing});
   const totals=classTotals.get(pending.classroom);if(totals)classTotals.set(pending.classroom,{...totals,added:totals.added+result.added,existing:totals.existing+result.existing});
   pendingBatch=null;$('source-class-select').disabled=false;$('source-retry').hidden=true;renderSourceChoice();if(window.n36AutomaticBatch)queueMicrotask(advanceAutomatic);
   $('handoff-status').textContent='وصل إيصال ركيز: حُفظت الدفعة محليًا أو تحققت الأسماء الموجودة. لا إثبات مزامنة خادم. يستكمل التشغيل المصرّح الدفعة التالية تلقائيًا.';
  }else{
   // Retain exact rows/cursor on unknown, failure, restart or expiry.
   if(window.n36AutomaticBatch){if(result.failure?.phase==='profile')profileFailure=result.failure;else automaticFailures.add(pending.classroom);pendingBatch=null;queueMicrotask(advanceAutomatic);}
   $('source-retry').hidden=false;
   $('handoff-status').textContent='لم يصل إيصال حفظ مؤكد لهذه الدفعة. تحقق من السبب في تبويب ركيز، ثم استكمل غير المحسوم؛ الأسماء المؤكدة لن تتكرر.';
  }
 }catch{/* No receipt is not success. */}
},750);

// AI: reached only after the actual ESM graph and entry handlers initialized.
window.n36Diagnostics?.moduleReady("categories-popup.js");

// AI: exactly one initiated batch. Only a genuine canonical receipt advances a cursor.
function advanceAutomatic(){
 if(!window.n36AutomaticBatch||!sourceRoster||pendingBatch)return;
 const group=sourceClasses(sourceRoster).find(c=>!automaticFailures.has(c.classroom)&&(batchProgress.get(c.classroom)?.offset??0)<c.count);
 if(!group||profileFailure){
  const totals=[...batchProgress.values()];
  $('source-class-status').textContent='';
  const failed=!!profileFailure||!!automaticFailures.size;
  window.n36Diagnostics?.publish({stage:failed?'unresolved':'saved',transfer:failed?'error':'idle',receipt:failed?'unknown':'saved'});
  $('source-retry').hidden=!failed;
  $('source-retry').textContent=profileFailure?'استكمال الدفعة المحفوظة':'استكمال الفصول غير المحسومة فقط';
  $('handoff-status').textContent=profileFailure?`توقف حفظ إعداد الحساب (${profileFailure.code}). الدفعة محفوظة في ركيز للاستكمال؛ لم يتأكد اكتمال الحفظ.`:`الطلاب: ${totals.reduce((n,p)=>n+p.added,0)} جديد، ${totals.reduce((n,p)=>n+p.existing,0)} موجود. ${automaticFailures.size?'تحتاج '+automaticFailures.size+' فصول مراجعة. ':''}${formatSetupFields([...setupFields.values()],sourceInfo.sourceIssues??[])} ${sourceInfo.complete?'':'المتاح جزئي من المصدر. '}${automaticFailures.size?'لم يتأكد اكتمال الحفظ محليًا':'حُفظ المتاح محليًا'}؛ المزامنة لم تتأكد بعد.`;
  window.n36Diagnostics?.publish({fieldResults:[...setupFields.values(),...(sourceInfo.sourceIssues??[])]});
  $('run-status').textContent=$('handoff-status').textContent;
  window.dispatchEvent(new CustomEvent('n36:automatic-finished',{detail:{unresolved:failed,summary:$('source-class-summary').textContent}}));
  return;
 }
 chosenClass=group.classroom;$('source-class-select').value=chosenClass;renderSourceChoice();
 $('source-class-names').hidden=true;
 $('handoff-transfer').click();
}

// Finite labels/reasons only; never interpolate imported private values.
export function formatSetupFields(details,issues=[]){
 const fields=new Map();for(const d of details)mergeSetupField(fields,d);for(const d of issues)if(!fields.has(d.field)||fields.get(d.field).reason==='missing')fields.set(d.field,d);
 const reasons={saved:'حُدث',current:'مطابق مسبقًا',missing:'غير متاح من المصدر',conflict:'تعارض يحتاج مراجعة',unsupported:'بنية غير مدعومة',ambiguous:'أكثر من قيمة؛ لم يتغير',unrecognized:'تسمية غير معروفة؛ لم تتغير'};
 return [...fields.values()].filter(d=>CATEGORIES[d.field]&&reasons[d.reason]).map(d=>CATEGORIES[d.field].label+': '+reasons[d.reason]).join('؛ ')+'.';
}
