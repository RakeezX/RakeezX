// AI: disposable Madrasati-only viewer; durable execution belongs to the worker.
import {startOrigin} from './navigation.js';
const $=id=>document.getElementById(id);
const announce=text=>{$('run-status').textContent=text;};
let backgroundView=null,popupStartPending=false,backgroundRevision=0;
if(new URL(location.href).searchParams.has('run'))document.body.classList.add('run-page');
function showStartDenial(error){
 const allowed=['SOURCE_ACCESS_REQUIRED','NO_ACTIVE_TAB','UNVERIFIED_START_ORIGIN','SOURCE_BINDING_CHANGED','SOURCE_CONTEXT_CHANGED','JOB_REQUEST','JOB_ACK_INVALID','BACKGROUND_UNAVAILABLE','HANDOFF_UNAVAILABLE','APP_NOT_READY','OPEN_ONE_RAKEEZ_TAB','APP_FINISH_CURRENT_EDIT','APP_UPDATE_REQUIRED','APP_ACADEMIC_SELECTION_REQUIRED','APP_BATCH_UNRESOLVED','SCHOOL_CHOICE_REQUIRED','REVIEW_EXPIRED'];
 const code=allowed.includes(error?.message)?error.message:'BACKGROUND_UNAVAILABLE';
 const source=['SOURCE_ACCESS_REQUIRED','NO_ACTIVE_TAB','UNVERIFIED_START_ORIGIN','SOURCE_BINDING_CHANGED','SOURCE_CONTEXT_CHANGED'].includes(code);
 window.n36Diagnostics?.publish({stage:'error',startPhase:'denied',failure:code,failureStep:source?'source-start':'none',failurePhase:source?'source':'none',failureJobPhase:'none'});
 announce(source?'افتح مدرستي ثم ابدأ الاستيراد من تبويب المصدر نفسه. لم يبدأ الجمع.':code==='APP_ACADEMIC_SELECTION_REQUIRED'?'اختر السنة والفصل الدراسي صراحةً في ركيز، ثم ابدأ. لم يبدأ جمع البيانات.':code==='APP_BATCH_UNRESOLVED'?'توجد دفعة غير محسومة. اقرأ التقدم المحلي في حساب ركيز نفسه؛ لا تبدأ جمعًا جديدًا.':code==='APP_FINISH_CURRENT_EDIT'?'أكمل التعديل المفتوح في ركيز ثم ابدأ مجددًا. لم يبدأ الجمع.':code==='APP_UPDATE_REQUIRED'?'حدّث ركيز من زر التحديث داخل التطبيق ثم ابدأ مجددًا. لم يبدأ الجمع.':code==='SCHOOL_CHOICE_REQUIRED'?'افتح صفحة المدرسة المطلوبة ودور المعلم في مدرستي ثم ابدأ. لم يبدأ الجمع.':code==='JOB_REQUEST'||code==='JOB_ACK_INVALID'||code==='BACKGROUND_UNAVAILABLE'?'تعذّر تأكيد بدء التشغيل. أعد فتح الإضافة من تبويب مدرستي وتحقق من تحديثها؛ لم يُفترض بدء الجمع.':'افتح حساب ركيز المسجّل دخوله في تبويب واحد، ثم ابدأ من مدرستي. لم يبدأ الجمع.');
}

function renderBackground(v){
 if(!v)return;backgroundRevision++;backgroundView=v;
 const done=['complete','stopped','cancelled'].includes(v.phase);
 $('run-counts').hidden=false;
 $('one-start').disabled=popupStartPending||!done;$('run-cancel').disabled=done;
 $('run-counts').textContent=`مؤكد محليًا لهذا التشغيل: ${v.confirmedRows} صفًا${v.confirmedReceipts===null?'؛ عدد الإيصالات غير محفوظ لهذا التشغيل السابق':` في ${v.confirmedReceipts} إيصال`}
جديد: ${v.added} — موجود: ${v.existing} — معلق: ${v.pendingRows}.`;$('run-missing').textContent='';$('run-missing').hidden=!v.setupPartial;
 $('run-status').textContent=v.phase==='binding'?'جار التحقق من حساب ركيز…':v.phase==='complete'?'حُفظ المتاح محليًا في ركيز؛ المزامنة السحابية تُتابع من التطبيق.':v.phase==='cancelled'?'أُوقف التشغيل ومُسحت بيانات الإضافة المؤقتة. ما حُفظ في ركيز يبقى محفوظًا.':v.phase==='stopped'?'توقف النقل. تحقق من بقاء صفحتي مدرستي وركيز مفتوحتين بالحساب نفسه، ثم ابدأ عند جاهزيتهما.':'جار نقل البيانات المتاحة… يمكنك إغلاق نافذة الإضافة. أبقِ تبويبي مدرستي وركيز مفتوحين.';
 const codes={APP_ACADEMIC_SELECTION_REQUIRED:'اختر السنة والفصل الدراسي صراحةً في ركيز؛ لم يبدأ جمع البيانات.',APP_BATCH_UNRESOLVED:'توجد دفعة غير محسومة؛ اقرأ التقدم المحلي في حساب ركيز نفسه دون جمع جديد.',SCHOOL_CONTEXT_UNCONFIRMED:'تعذّر تأكيد اسم المدرسة من بيانات المصدر الصريحة. لم تُنقل الأسماء؛ افتح بيانات المدرسة وتحقق منها ثم ابدأ.',SCHOOL_CONTEXT_CHANGED:'تعارضت بيانات المدرسة أثناء القراءة. توقف النقل لحماية سياق المدرسة.',SOURCE_CONTEXT_CHANGED:'لم يطابق مسار مستند مدرستي المصدر المرتبط بالتشغيل أو وجهة التنقل المخططة. أُوقف التشغيل لحماية سياق المصدر؛ لم يُفترض اكتمال الجمع.',SOURCE_BINDING_CHANGED:'لم يعد مستند مدرستي مطابقًا للمستند المرتبط بالتشغيل. أُوقف التشغيل لحماية سياق المصدر.',HANDOFF_DOCUMENT_OR_ROUTE:'تغيّر مسار الاستلام في ركيز. توقف النقل؛ لم يُفترض حفظ هذه الدفعة. راجع حساب ركيز نفسه.',HANDOFF_SENDER:'تعذّر التحقق من صفحة الاستلام. توقف النقل دون افتراض الحفظ.',APP_UPDATE_REQUIRED:'حدّث ركيز من زر التحديث داخل التطبيق ثم ابدأ؛ لم تُحدّث الصفحة تلقائيًا.',APP_FINISH_CURRENT_EDIT:'أكمل التعديل المفتوح في ركيز ثم ابدأ.',SCHOOL_CHOICE_REQUIRED:'افتح صفحة المدرسة المطلوبة ودور المعلم في مدرستي، ثم ابدأ.',RECEIPT_UNKNOWN:'نتيجة الحفظ غير محسومة. اقرأ التقدم المحلي من حساب ركيز نفسه دون جمع أو كتابة جديدين؛ لم يُفترض الحفظ.',REVIEW_EXPIRED:'انتهت مهلة التشغيل ومُسحت البيانات المؤقتة. ما حُفظ في ركيز يبقى محفوظًا.'};
 if(v.phase==='complete'&&v.needsReview)$('run-status').textContent='حُفظت الأسماء محليًا؛ بعض حقول الإعداد تحتاج مراجعة في التفاصيل. المزامنة تُتابع من ركيز.';
 if(v.phase==='complete'&&v.coverage!=='complete')$('run-status').textContent+=' '+(v.coverage==='partial'?'التغطية جزئية؛ قد تنقص أسماء.':'اكتمال الكشف غير معلوم؛ راجع الأسماء المتاحة في ركيز.');
 const coverageReasons={'excluded-rows':'صفوف مستبعدة','ambiguous-rows':'صفوف أو هوية فصل ملتبسة','missing-pages':'صفحات كشف غير مكتملة','page-gap':'تكرار أو تغيّر تسلسل الصفحات','terminal-unverified':'لم تثبت نهاية الكشف','pending-pages':'صفحات باقية ضمن ميزانية القراءة','student-data-unverified':'بيانات كشف غير محسومة'};
 if(v.phase==='complete'&&v.coverage!=='complete')$('run-status').textContent+=' '+(v.coverageReasons??[]).map(k=>coverageReasons[k]).filter(Boolean).join('، ')+`. صفحات مثبتة: ${v.processedPages??0}؛ صفوف مستبعدة: ${v.excluded??0}.`;
 if(v.setupPartial){
  const labels={metadata:'البيانات الشخصية الإضافية',classes:'بيانات الفصول والمواد',timetable:'الجدول الدراسي'};
  $('run-missing').textContent='حقول الإعداد جزئية؛ تعذّرت قراءة: '+(v.setupUnavailable??[]).map(k=>labels[k]).filter(Boolean).join('، ')+'. تغطية الطلاب تُحدّد من صفحات كشف الطلاب، بصورة مستقلة عن حقول الإعداد.';
  if(v.setupRejectReason==='response-school-absent')$('run-missing').textContent+=' لم تتضمن استجابة الجدول إثباتًا صريحًا للمدرسة؛ لم يُستورد الجدول أو ارتباط مواده بالفصول منها.';
 }
 if(v.phase==='receipt'&&v.code)$('run-status').textContent=codes.RECEIPT_UNKNOWN;
 if(v.phase==='stopped'&&v.code==='HANDOFF_LIMIT_OR_EXPIRED')$('run-status').textContent='توقف النقل عند حد حجم الدفعة أو صلاحيتها. استكمل من الحساب نفسه؛ لم يُفترض اكتمال النقل.';
 if(v.code&&codes[v.code])$('run-status').textContent=codes[v.code];
 if(v.phase==='stopped'&&(v.added||v.existing))$('run-status').textContent+=' تم تأكيد '+v.added+' جديد و'+v.existing+' موجود محليًا قبل التوقف؛ المزامنة تُتابع من ركيز.';
 const labels={teacher:'اسم المعلم',school:'اسم المدرسة',principal:'اسم المدير',department:'إدارة التعليم',classes:'الفصول',timetable:'الجدول'},reasons={saved:'حُدث',current:'مطابق',missing:'غير متاح',conflict:'تعارض',unsupported:'غير مدعوم',ambiguous:'غير محسوم',unrecognized:'تسمية غير معروفة'};
 $('automatic-field-details').textContent=(v.fields??[]).map(d=>labels[d.field]+': '+reasons[d.reason]).join(' — ');
 window.n36Diagnostics?.publish({terminal:v.terminal,hasNext:v.hasNext,coverageReasons:v.coverageReasons,processedPages:v.processedPages,excluded:v.excluded,classes:v.classes,receiverCheckpoint:v.receiverCheckpoint,receiverRelation:v.receiverRelation,confirmedRows:v.confirmedRows,confirmedReceipts:v.confirmedReceipts,pendingRows:v.pendingRows,pendingSavedRows:v.pendingSavedRows,setupKind:v.setupKind??'none',setupRejectReason:v.setupRejectReason??'none',timings:v.timings,schoolBindingState:v.schoolBindingState??'none',schoolBadgePresent:v.schoolBadgePresent,schoolIdPresent:v.schoolIdPresent,readProofPresent:v.readProofPresent,entryKind:v.entryKind??'none',roleProofKind:v.roleProofKind??'none',proofNavMarkers:v.proofNavMarkers,proofActionMarkers:v.proofActionMarkers,proofReadLinks:v.proofReadLinks,navigationPlannedKind:v.navigationPlannedKind??'none',navigationPlannedRoute:v.navigationPlannedRoute??'none',navigationObservedRoute:v.navigationObservedRoute??'none',navigationRelation:v.navigationRelation??'none',navigationQuery:v.navigationQuery??'none',navigationDocument:v.navigationDocument??'none',navigationStatus:v.navigationStatus??'none',jobPhase:v.phase,startPhase:v.startPhase??'none',failureStep:v.failureStep??'none',failureJobPhase:v.failureJobPhase??'none',failurePhase:v.failurePhase??(v.failureStep?.startsWith('source-')?'source':'none'),transfer:done?(v.phase==='complete'?'idle':'error'):v.phase==='receipt'?'pending':'sending',staged:v.staged,observed:v.observed,stage:v.phase==='binding'?'checking':v.phase==='complete'?'saved':v.phase==='cancelled'?'cancelled':v.phase==='stopped'?'error':'collecting',receipt:v.phase==='receipt'?'pending':v.phase==='complete'?'saved':'not-available',coverage:v.coverage,receiverCapability:v.receiverCapability??'unknown',setupPhase:v.fields?.length?'receipt':'none',failure:v.code??'none',fieldResults:v.fields??[]});
}
 const launch=async()=>{
  if(popupStartPending)return;const previousJobId=backgroundView?.id;popupStartPending=true;$('one-start').disabled=true;
  {backgroundRevision++;announce('جار التحقق من صفحة مدرستي وحساب ركيز…');window.n36Diagnostics?.publish({setupKind:'none',setupRejectReason:'none',navigationPlannedKind:'none',navigationPlannedRoute:'none',navigationObservedRoute:'none',navigationRelation:'none',navigationQuery:'none',navigationDocument:'none',navigationStatus:'none',stage:'checking',startPhase:'source-context',failure:'none',failureStep:'none',failurePhase:'none',failureJobPhase:'none',receiverCapability:'unknown'});}
  try{
   const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});const tab=tabs[0];if(tabs.length!==1||!Number.isInteger(tab?.id))throw Error('NO_ACTIVE_TAB');
   startOrigin(tab.url??'');
   {
    window.n36Diagnostics?.publish({startPhase:'worker-ack'});
    const result=await chrome.runtime.sendMessage({type:'n36-job-start',sourceTabId:tab.id});
    if(!result?.ok)throw Error(result?.code??'BACKGROUND_UNAVAILABLE');
    if(!/^[a-f0-9]{64}$/.test(result.view?.id)||!['collect','navigation','transfer','prepare','deliver','receipt'].includes(result.view?.phase))throw Error('JOB_ACK_INVALID');
    window.n36Diagnostics?.publish({startPhase:'accepted'});if(backgroundView?.id!==result.view.id||backgroundView.phase==='binding')renderBackground(result.view);return;
   }
  }catch(e){
   // A failed Start may already have a precise durable source failure. Keep it
   // when the popup stays open; reopening reads the same safe aggregate.
   let failed;try{failed=(await chrome.runtime.sendMessage({type:'n36-job-status'}))?.view;}catch{}
   if(failed?.id!==previousJobId&&failed?.phase==='stopped'&&failed.code===e.message)renderBackground(failed);else showStartDenial(e);
  }
  finally{popupStartPending=false;$('one-start').disabled=!!backgroundView&&!['complete','stopped','cancelled'].includes(backgroundView.phase);}
 };

$('one-start').addEventListener('click',()=>launch());
$('run-cancel').addEventListener('click',async()=>{if(backgroundView?.id&&!['complete','stopped','cancelled'].includes(backgroundView.phase)){await chrome.runtime.sendMessage({type:'n36-job-cancel',jobId:backgroundView.id});await refreshBackground();}});
async function refreshBackground(){const revision=backgroundRevision;const r=await chrome.runtime.sendMessage({type:'n36-job-status'});if(r?.ok&&revision===backgroundRevision&&!popupStartPending)renderBackground(r.view);}
{refreshBackground().catch(()=>{});chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes['n36:background-view'])renderBackground(changes['n36:background-view'].newValue);});}

$('one-start').disabled=false;
window.n36Diagnostics?.moduleReady('run-controller.js');
