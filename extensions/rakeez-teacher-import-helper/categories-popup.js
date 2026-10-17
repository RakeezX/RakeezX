import {sourceClasses,selectedSourceClass,coverageMessage} from './source-roster.js';
import {CATEGORIES,parseCategoryTable,validateCategory,stageCategory,bundle} from './categories.js';
import {readSelectedCategoryTable} from './selection.js';
import {mountDateTimeControl} from './lib/rakeez-datetime.js';
import {namesCsv} from './core.js';
import { HANDOFF_TTL, validateHandoff } from './handoff-protocol.js';
const $=id=>document.getElementById(id);
let draft=null,staged=[],generation=0,sourceRoster=null,chosenClass='',sourceInfo=null,pendingBatch=null,batchProgress=new Map(),classTotals=new Map();
window.n36HasSourceRoster=()=>!!sourceRoster;
const sourceBatch=()=>selectedSourceClass(sourceRoster,chosenClass,batchProgress.get(chosenClass)?.offset??0);
window.n36CanContinue=()=>!!sourceRoster&&!pendingBatch&&sourceClasses(sourceRoster).every(c=>(batchProgress.get(c.classroom)?.offset??0)===c.count);
const message=value=>{$('category-status').textContent=value;};
const invalidateExport=()=>{$('bundle-review').checked=false;$('bundle-download').disabled=true;$('bundle-csv').disabled=true;$('handoff-transfer').disabled=true;};
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
 try{if(sourceRoster){sourceBatch();if(pendingBatch||!sourceInfo.complete&&!$('partial-approval')?.checked)throw Error('PARTIAL_REVIEW_REQUIRED');$('handoff-transfer').disabled=!window.n36HandoffSource?.();return;}const selected=selectedStaged();bundle(selected);$('bundle-download').disabled=false;$('bundle-csv').disabled=!selected.some(c=>c.category==='students');$('handoff-transfer').disabled=!window.n36HandoffSource?.()||!selected.some(c=>c.category==='students');}catch(e){$('bundle-review').checked=false;message(`غير محسوم (${e.message}). لا يمكن تصدير الحزمة.`);}
});
$('handoff-transfer').addEventListener('click',async()=>{
 if($('handoff-transfer').disabled||!$('bundle-review').checked)return;
 $('handoff-transfer').disabled=true;
 try {
  await window.n36BeforeExport?.();
  if(!$('bundle-review').checked)throw Error('SOURCE_CHANGED');
  const source=window.n36HandoffSource?.();if(!source)throw Error('SOURCE_CHANGED');
  const rows=sourceRoster?sourceBatch():selectedStaged().find(c=>c.category==='students')?.rows;
  const createdAt=Date.now();
  const envelope=validateHandoff({schema:'rakeez-extension-names',version:1,...source,createdAt,expiresAt:createdAt+HANDOFF_TTL,rows});
  const result=await chrome.runtime.sendMessage({type:'n36-create',envelope});
  if(!result?.ok)throw Error('HANDOFF_UNAVAILABLE');
  window.dispatchEvent(new Event('n36:exported'));
  if(sourceRoster){pendingBatch={actionId:result.actionId,classroom:chosenClass,count:rows.length};invalidateExport();$('source-class-select').disabled=true;$('source-retry').hidden=false;}
  $('direct-handoff').hidden=false;
  $('handoff-status').textContent='فُتح ركيز في المتصفح نفسه. اختر فصلًا مملوكًا وراجع ثم أكّد؛ لم تُحفظ أسماء تلقائيًا. النقل لمرة واحدة ولمدة دقيقتين.';
 } catch { invalidateExport();$('direct-handoff').hidden=false;$('handoff-status').textContent='تعذّر النقل أو تغيّر المصدر. أعد المراجعة؛ يمكنك استخدام الملفات ضمن الخيارات المتقدمة.'; }
});
$('handoff-cancel').addEventListener('click',()=>{chrome.runtime.sendMessage({type:'n36-cancel'});$('bundle-clear').click();$('direct-handoff').hidden=false;$('handoff-status').textContent='مُسحت البيانات وأُلغي أي نقل معلّق.';});
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
window.addEventListener('n36:clear',({detail})=>{if(!detail?.continuing)classTotals.clear();sourceRoster=null;sourceInfo=null;pendingBatch=null;batchProgress.clear();chosenClass='';const approval=$('bundle-review').closest('label');$('staged-categories').after(approval);$('source-class-review')?.remove();clearDraft();staged=[];renderStaged();$('table').value='';$('category-table').value='';$('cancel').click();});

// AI: only one reviewed transport batch materializes; receipt, never send/claim, advances it.
function renderSourceChoice(){
 const names=$('source-class-names'),status=$('source-class-status');if(!names||!sourceRoster)return;
 names.replaceChildren();invalidateExport();if($('partial-approval'))$('partial-approval').checked=false;
 const progress=batchProgress.get(chosenClass)??{offset:0,added:0,existing:0};
 const totals=classTotals.get(chosenClass)??{collected:0,added:0,existing:0};
 const count=sourceRoster.filter(r=>r.classroom===chosenClass).length;
 const rows=chosenClass&&progress.offset<count?sourceBatch():[];
 for(const row of rows){const li=document.createElement('li');li.textContent=row.name;names.append(li);}
 status.textContent=chosenClass?`${chosenClass}: جمعت ${totals.collected} حتى الآن؛ في هذه النافذة ${count}، صالح للمراجعة ${count-progress.offset}، ${sourceInfo.complete?'ثبت اكتمال الكشف':'بقية المصدر غير معلومة'}؛ مستبعد في النافذة ${sourceInfo.excluded}، أضيف بالفعل ${totals.added}، موجود سابقًا ${totals.existing}. الدفعة المختارة ${rows.length}؛ ${sourceInfo.complete?'كشف مكتمل':sourceInfo.coverage==='paused'?'نافذة مراجعة مؤقتة — بقيت صفحات كشف':'استيراد المتاح فقط — قد ينقص طلاب'}.`:`جمعت ${sourceRoster.length} اسمًا صالحًا في هذه النافذة. اختر فصل المصدر؛ لا حفظ تلقائي.`;
 $('bundle-review').disabled=!rows.length||!!pendingBatch;
 $('source-continue').disabled=!window.n36CanContinue();
 $('handoff-transfer').textContent=sourceInfo.complete?'نقل الدفعة للمراجعة في ركيز':'استيراد المتاح فقط';
}
window.addEventListener('n36:source-roster',({detail})=>{
 if(!detail.continuing)classTotals.clear();
 for(const group of sourceClasses(detail.rows)){const prior=classTotals.get(group.classroom)??{collected:0,added:0,existing:0};classTotals.set(group.classroom,{...prior,collected:prior.collected+group.count});}
 clearDraft();staged=[];sourceInfo=detail;sourceRoster=detail.rows;chosenClass='';pendingBatch=null;batchProgress.clear();renderStaged();
 $('source-class-review')?.remove();
 const section=document.createElement('section');section.id='source-class-review';
 const label=document.createElement('label');label.textContent='اختر فصل المصدر والدفعة (حتى 300 اسم لكل عملية؛ دون حد إجمالي)';
 const select=document.createElement('select');select.id='source-class-select';
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='اختر فصلًا ثم راجع أسماء الدفعة';select.append(placeholder);
 for(const group of sourceClasses(sourceRoster)){const option=document.createElement('option');option.value=group.classroom;option.textContent=`${group.classroom}: ${group.count} اسمًا متاحًا في النافذة`;select.append(option);}
 const coverage=document.createElement('p');coverage.id='source-coverage';coverage.textContent=coverageMessage(detail);
 const partial=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='partial-approval';partial.append(check,document.createTextNode(' أفهم أن الكشف ناقص أو غير معلوم الاكتمال وأوافق على استيراد المتاح فقط'));partial.hidden=detail.complete;
 check.addEventListener('change',invalidateExport);
 const status=document.createElement('p');status.id='source-class-status';
 const names=document.createElement('ol');names.id='source-class-names';
 select.addEventListener('change',()=>{chosenClass=select.value;check.checked=false;renderSourceChoice();});
 const next=document.createElement('button');next.type='button';next.id='source-continue';next.textContent=detail.complete&&!detail.hasNextReport?'متابعة البيانات الاختيارية بعد مراجعة الدفعات':'متابعة صريحة للصفحة أو النافذة التالية';next.hidden=!detail.hasNext;next.disabled=true;
 next.addEventListener('click',()=>{if(window.n36CanContinue()){next.disabled=true;window.dispatchEvent(new Event('n36:continue'));}});
 const retry=document.createElement('button');retry.id='source-retry';retry.type='button';retry.hidden=true;retry.textContent='إعادة مراجعة الدفعة نفسها (لا تجاوز دون إيصال)';
 retry.addEventListener('click',()=>{pendingBatch=null;select.disabled=false;retry.hidden=true;renderSourceChoice();$('handoff-status').textContent='لم يُفترض نجاح الدفعة السابقة. أعد النقل والمطابقة؛ يفحص ركيز الأسماء الموجودة قبل أي تأكيد جديد.';});
 const approval=$('bundle-review').closest('label');approval.lastChild.textContent=' راجعت أسماء هذه الدفعة والفصل؛ سأطابقه بفصل مملوك لي وأؤكد داخل ركيز';
 label.append(select);section.append(label,coverage,partial,status,names,approval,retry,next);$('direct-handoff').before(section);$('direct-handoff').hidden=false;
 $('legacy-tools').open=false;renderSourceChoice();
});
setInterval(async()=>{
 const pending=pendingBatch;if(!pending||!sourceRoster)return;
 try{
  const result=await chrome.runtime.sendMessage({type:'n36-result',actionId:pending.actionId});
  if(pendingBatch!==pending||!result?.ok||result.status==='pending')return;
  if(['saved','existing'].includes(result.status)&&result.total===pending.count&&result.remaining===0&&result.added+result.existing===pending.count){
   const progress=batchProgress.get(pending.classroom)??{offset:0,added:0,existing:0};
   batchProgress.set(pending.classroom,{offset:progress.offset+pending.count,added:progress.added+result.added,existing:progress.existing+result.existing});
   const totals=classTotals.get(pending.classroom);if(totals)classTotals.set(pending.classroom,{...totals,added:totals.added+result.added,existing:totals.existing+result.existing});
   pendingBatch=null;$('source-class-select').disabled=false;$('source-retry').hidden=true;renderSourceChoice();
   $('handoff-status').textContent='وصل إيصال ركيز: حُفظت الدفعة محليًا أو تحققت الأسماء الموجودة. لا إثبات مزامنة خادم. راجع وأكّد الدفعة التالية بنفسك.';
  }else{
   // Retain exact rows/cursor on unknown, failure, restart or expiry.
   $('handoff-status').textContent='لم يصل إيصال حفظ مؤكد. لا انتقال للدفعة التالية؛ أعد مراجعة الدفعة نفسها أو ابدأ مجددًا بعد انتهاء المهلة.';
  }
 }catch{/* No receipt is not success. */}
},750);
