/**
 * Evidence suggestions are read-only. They reflect existing records, and are
 * not an official evaluation, confirmation of classroom execution or delivery
 * receipt from Madrasati/Noor. The caller scopes records to a specific year.
 */
export const F09_EVIDENCE_GUIDE = Object.freeze([
  ['01','أداء الواجبات الوظيفية','الجدول الدراسي وأعمال المعلم','الجدول والتكليفات والأعمال المؤرخة','الجدول والإسنادات والحصص في ركيز','إسنادات وجدول من نور عند استيراد موثوق','جدول ومهام مدرستي عند التكامل','مراجعة الجدول وإرفاق التكليف عند الحاجة'],
  ['02','التفاعل مع المجتمع المهني','الدورات والزيارات المهنية','اسم البرنامج وتاريخه وجهة التنفيذ وشهادة حضور أو محضر','صور وشهادات يضيفها المعلم','لا مصدر مباشر مؤكد','أنشطة معتمدة عند توفرها','إضافة شهادة أو محضر'],
  ['03','التفاعل مع أولياء الأمور','التواصل التربوي مع أولياء الأمور','القناة والفترة وموضوع التواصل وإثبات الإرسال','لا توجد إيصالات إرسال مؤكدة حاليًا','إشعارات موثقة إذا أتيح التكامل','رسائل وسجلات تواصل موثقة إذا توفرت','إرفاق إثبات مع إخفاء بيانات الأسر'],
  ['04','التنوع في استراتيجيات التدريس','استراتيجية صفية مطبقة','الاستراتيجية والدرس والتاريخ وصورة الاستخدام','خطة الدرس وحدها ليست إثبات تطبيق','لا مصدر مباشر مؤكد','الأنشطة ليست إثبات تنفيذ بمفردها','صورة أو تأكيد المعلم لتنفيذ الاستراتيجية'],
  ['05','تحسين نتائج المتعلمين','مقارنة القياس القبلي والبعدي','نتائج متكافئة قبل وبعد التدخل، وطبيعة التدخل','درجات قابلة للمقارنة بعد الربط والمراجعة','نتائج معتمدة إذا توفرت','اختبارات قابلة للمقارنة عند التكامل','تحديد القياسين والإجراء التعليمي'],
  ['06','إعداد وتنفيذ خطة التعلم','خطة الدروس ومتابعة تنفيذها','الخطة الزمنية والدروس والمتابعة بتواريخها','حصص محفوظة مرتبطة بدروس','الجدول يدعم نطاق الخطة','خطط وتحاضير بعد التكامل','تأكيد ما نفذ فعليًا وإضافة نموذج تحضير'],
  ['07','توظيف تقنيات ووسائل التعلم','نشاط تقني داخل الحصة','الأداة التعليمية والغرض وصورة النشاط الفعلي','المهام الرقمية قد تدعم التوثيق بعد إثبات استخدامها','لا مصدر مباشر مؤكد','الأنشطة والواجبات الرقمية عند التكامل','إضافة صورة من تطبيق الأداة'],
  ['08','تهيئة البيئة التعليمية','قواعد الفصل وأدوات التحفيز','القواعد والتنظيمات وصور التهيئة','قواعد الفصل المحفوظة في ركيز','لا مصدر مباشر مؤكد','نشاط داعم موثق إن وجد','صورة أو تأكيد تفعيل القواعد'],
  ['09','الإدارة الصفية','متابعة رصد حضور الطلاب','الحصص المؤرخة التي رُصد فيها الحضور والفصول المشمولة','السجلات الفعلية لرصد الحضور','سجلات نظامية بعد استيرادها','بيانات حضور موثوقة عند التكامل','مراجعة الشاهد وإضافة صورة اختيارية'],
  ['10','تحليل نتائج المتعلمين','تحليل نتائج التقويمات','بنود لها نتائج وإحصاءات مجمعة دون أسماء','درجات رصدت فعلًا على بنود مباشرة','نتائج معتمدة عند التكامل','نتائج اختبارات وواجبات عند الاستيراد','مراجعة الأرقام وإضافة توصية إن لزم'],
  ['11','تنويع أساليب التقويم','بنود تقييم ومهام لها نتائج','أدوات تقويم لها رصد أو مهام لها تسليمات','بنود تقييم ودرجات وتسليمات محفوظة','درجات معتمدة عند استيراد موثوق','واجبات واختبارات وتسليمات عند التكامل','مراجعة التصنيف وإرفاق نموذج سؤال أو مهمة'],
].map(([criterion,title,evidence,content,rakeez,noor,madrasati,minimum]) =>
  Object.freeze({criterion,title,evidence,content,rakeez,noor,madrasati,minimum})));

const validDate = value => {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split('-').map(Number),calendar=new Date(Date.UTC(y,m-1,d));
  return calendar.getUTCFullYear()===y && calendar.getUTCMonth()+1===m && calendar.getUTCDate()===d;
};
const positive = x => Number.isInteger(Number(x)) && Number(x)>0;
const numeric = v => v!==null && v!==undefined && v!=='' && Number.isFinite(Number(v));
const short = value => String(value ?? '').trim().slice(0,120);
const unique = (array,key) => [...new Map(array.map(x=>[key(x),x])).values()];
const references = (type,items) => ({type,ids:items.map(x=>x.id).filter(Boolean).slice(0,150)});
const summary = (criterion,yearId,key,title,description,metrics,records,kind,other={}) =>
  Object.freeze(Object.defineProperty({id:'rakeez:'+key+':'+yearId,criterion,title,description,metrics,sourceKind:kind,
    requiresReview:kind==='review',source:'ركيز المعلم',...other},
    'references',{value:records,enumerable:false}));

/** Input arrays are caller-filtered year-wide product snapshots; no writes. */
export function buildPortfolioEvidenceSuggestions({
  yearId,teachingIds=[],attendance=null,slots=[],sessions=[],classRules=[],
  items=[],scores=[],assignments=[],submissions=[],asOf='9999-12-31',
  recordedScope=null,groupArrangements=[],classGoals=[],logs=[],
}={}) {
  const ids=new Set(teachingIds.filter(Boolean));
  if(!yearId||!ids.size)return [];
  const suggestions=[];
  if(attendance?.recordedSessions>0) {
    suggestions.push(summary('09',yearId,'attendance','متابعة رصد حضور الطلاب',
      'متابعة حضور الطلاب مسجلة في '+attendance.recordedSessions+' حصة عبر فصول ومواد المعلم.',
      [['حصص مرصودة',attendance.recordedSessions],['رصد مكتمل',attendance.fullSessions],
       ['فصول شملها الرصد',new Set(attendance.rows.map(r=>r.section).filter(Boolean)).size]],
      references('sessions',attendance.rows),'automatic',
      {tableHeaders:['التاريخ','الفصل','المادة','الحصة'],
       table:attendance.rows.slice(0,4).map(r=>[r.date,r.section,r.subject,String(r.period)])}));
  }
  const planned=unique(slots.filter(x=>!x.deleted&&ids.has(x.teachingId) &&
    (!x.kind||x.kind==='teaching')&&positive(x.period)&&
    Number.isInteger(Number(x.weekday))&&Number(x.weekday)>=0&&Number(x.weekday)<=6),x=>x.id);
  if(planned.length) suggestions.push(summary('01',yearId,'timetable','الجدول الدراسي الأسبوعي',
    'يوثق الجدول '+planned.length+' حصة أسبوعية ضمن إسنادات المعلم المسجلة.',
    [['الحصص الأسبوعية',planned.length]],references('slots',planned),'review'));
  const lessonSessions=unique(sessions.filter(x=>!x.deleted&&ids.has(x.teachingId)&&
    x.lessonId&&x.status==='held'&&validDate(x.date)&&x.date<=asOf),x=>x.id);
  if(lessonSessions.length) suggestions.push(summary('06',yearId,'lessons','متابعة الدروس المرتبطة بالحصص',
    'تتضمن سجلات ركيز '+lessonSessions.length+' حصة منعقدة مرتبطة بدروس تم اختيارها.',
    [['حصص مرتبطة بدروس',lessonSessions.length]],references('sessions',lessonSessions),'review'));
  const rules=unique(classRules.filter(x=>!x.deleted&&ids.has(x.teachingId)&&short(x.text)),x=>x.id);
  if(rules.length) suggestions.push(summary('08',yearId,'rules','إعداد قواعد وتنظيمات الفصل',
    'أعدّ المعلم '+rules.length+' قاعدة أو توجيهًا صفيًا محفوظًا في ركيز.',
    [['قواعد محفوظة',rules.length]],references('classRules',rules),'review'));

  const validItems=unique(items.filter(x=>!x.deleted&&ids.has(x.teachingId)&&x.auto==null&&
    x.scoreMode!=='subitems'&&Number(x.max)>0&&short(x.name)),x=>x.id);
  const itemById=new Map(validItems.map(x=>[x.id,x]));
  const matched=new Map();
  for(const row of scores){
    if(row?.deleted||!row?.studentId||!itemById.has(row.itemId)||!numeric(row.value))continue;
    const item=itemById.get(row.itemId),value=Number(row.value),max=Number(item.max);
    if(value<0||value>max)continue;
    const key=String(row.studentId)+':'+row.itemId;
    if(!matched.has(key)) matched.set(key,{itemId:row.itemId,value,max});
  }
  const graded=[...matched.values()];
  const gradedItems=validItems.filter(item=>graded.some(score=>score.itemId===item.id));
  if(graded.length) {
    suggestions.push(summary('11',yearId,'graded-items','تنفيذ بنود التقويم ورصد نتائجها',
      'رُصدت نتائج فعلية في '+gradedItems.length+' بنود تقييم عبر إسنادات المعلم.',
      [['بنود لها نتائج',gradedItems.length],['درجات مرصودة',graded.length]],
      references('items',gradedItems),'automatic',
      {tableHeaders:['بند التقويم','درجات مرصودة'],
       table:gradedItems.slice(0,4).map(item=>[short(item.name),String(graded.filter(s=>s.itemId===item.id).length)])}));
  }
  if(graded.length>=3) {
    const ratios=graded.map(s=>Math.round(s.value/s.max*100));
    const mean=Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length);
    suggestions.push(summary('10',yearId,'score-analysis','تحليل نتائج بنود التقويم',
      'أُعدّ ملخص إحصائي لمجموعة من '+graded.length+' درجات مسجلة في ركيز دون إظهار بيانات فردية.',
      [['نتائج مرصودة',graded.length],['بنود تحليل',gradedItems.length],['متوسط نسب الدرجات المرصودة',mean+'٪']],
      references('items',gradedItems),'automatic'));
  }
  const tasks=unique(assignments.filter(x=>!x.deleted&&ids.has(x.teachingId)&&short(x.title)&&
    validDate(x.assignedDate)&&x.assignedDate<=asOf),x=>x.id);
  const tasksById=new Map(tasks.map(x=>[x.id,x]));
  const handed=unique(submissions.filter(x=>!x.deleted&&tasksById.has(x.assignmentId)&&
    x.studentId&&(x.status==='submitted'||x.status==='late')),x=>String(x.studentId)+':'+x.assignmentId);
  if(tasks.length&&handed.length) suggestions.push(summary('11',yearId,'assignments',
    'متابعة المهام التعليمية وتسليماتها',
    'توجد '+tasks.length+' مهمة موثقة و'+handed.length+' حالة تسليم مسجلة.',
    [['مهام محفوظة',tasks.length],['حالات تسليم',handed.length]],
    references('assignments',tasks),'automatic',
    {tableHeaders:['المهمة','تاريخ الإسناد'],
     table:tasks.slice(0,4).map(x=>[short(x.title),x.assignedDate])}));
  appendRecordedWork(suggestions,{yearId,ids,sessions,asOf,recordedScope,groupArrangements,classGoals,logs});
  return Object.freeze(suggestions.sort((a,b)=>Number(a.criterion)-Number(b.criterion)||
    a.title.localeCompare(b.title,'ar')));
}
export const guideForCriterion = id => F09_EVIDENCE_GUIDE.find(x=>x.criterion===id)||null;

// AI N126: only the existing derived source types, never arbitrary rakeez IDs.
const UNFILED_SOURCE_TYPES = Object.freeze([
  ['attendance','09','automatic','متابعة رصد حضور الطلاب'],
  ['timetable','01','review','الجدول الدراسي الأسبوعي'],
  ['lessons','06','review','متابعة الدروس المرتبطة بالحصص'],
  ['rules','08','review','إعداد قواعد وتنظيمات الفصل'],
  ['graded-items','11','automatic','تنفيذ بنود التقويم ورصد نتائجها'],
  ['score-analysis','10','automatic','تحليل نتائج بنود التقويم'],
  ['assignments','11','automatic','متابعة المهام التعليمية وتسليماتها'],
  ['group-arrangements','09','review','تنظيم المجموعات المحفوظ'],
  ['completed-goals','08','review','سجل الأهداف الصفية المكتملة'],
  ['participation-logs','09','automatic','متابعة سجلات المشاركة المؤرخة'],
].map(x=>Object.freeze(x)));

/**
 * Pure preparation for the future inbox; does not add or persist evidence.
 * Caller MUST supply validated owner/year-scoped suggestions and entries from
 * the current buildAnnualPortfolioPlan (including all automatically active sources).
 * This projection cannot establish ownership from raw teacher/student records.
 * title is the fixed source title; displayTitle honors the local title override.
 * Never inspect/copy/enumerate references, metrics, records or attachments.
 */
export function selectUnfiledPortfolioEvidence({
  yearId,sources,annualEntries,criteria,
  hiddenCriteria=new Set(),hiddenWitnesses=new Set(),
  excludedWitnesses=new Set(),includedWitnesses=new Set(),titles=new Map(),
}={}) {
  const empty=()=>Object.freeze([]);
  if(typeof yearId!=='string'||!yearId.trim()||yearId!==yearId.trim()||
    !Array.isArray(sources)||!Array.isArray(annualEntries)||!Array.isArray(criteria)||!criteria.length||
    ![hiddenCriteria,hiddenWitnesses,excludedWitnesses,includedWitnesses].every(x=>x instanceof Set)||
    !(titles instanceof Map)||annualEntries.some(e=>typeof e?.proposal?.id!=='string'||!e.proposal.id))return empty();
  const labels=new Map(),ambiguousCriteria=new Set();
  for(const c of criteria){
    if(!F09_EVIDENCE_GUIDE.some(x=>x.criterion===c?.number)||typeof c.title!=='string'||!c.title.trim())continue;
    if(labels.has(c.number))ambiguousCriteria.add(c.number);
    labels.set(c.number,c.title.trim().slice(0,120));
  }
  // Count IDs before validation: an invalid/tombstoned duplicate must also deny
  // its apparently valid counterpart. No serialization or source spreading.
  const seen=new Set(),duplicates=new Set();
  for(const s of sources){
    if(typeof s?.id!=='string')continue;
    if(seen.has(s.id))duplicates.add(s.id);
    seen.add(s.id);
  }
  const filed=new Set(annualEntries.map(e=>e?.proposal?.id));
  const result=[];
  for(const s of sources){
    if(!s||duplicates.has(s.id)||s.deleted||s.source!=='ركيز المعلم')continue;
    const type=UNFILED_SOURCE_TYPES.find(([key,criterion,kind,title])=>
      s.id==='rakeez:'+key+':'+yearId&&s.criterion===criterion&&s.sourceKind===kind&&s.title===title);
    if(!type||!labels.has(s.criterion)||ambiguousCriteria.has(s.criterion)||hiddenCriteria.has(s.criterion)||
      filed.has(s.id)||hiddenWitnesses.has(s.id)||excludedWitnesses.has(s.id)||includedWitnesses.has(s.id))continue;
    const renamed=titles.get(s.id);
    result.push(Object.freeze({
      id:s.id,criterion:s.criterion,criterionTitle:labels.get(s.criterion),title:type[3],
      displayTitle:typeof renamed==='string'&&renamed.trim()?renamed.trim().slice(0,120):type[3],
      sourceKind:s.sourceKind,
      provenanceState:s.sourceKind==='review'?'مصدر محفوظ في ركيز يحتاج مراجعة؛ لا يثبت التطبيق.':
        'مصدر تلقائي من سجلات ركيز؛ لا يثبت تحقق التعلم.',
    }));
  }
  return Object.freeze(result.sort((a,b)=>Number(a.criterion)-Number(b.criterion)||
    a.title.localeCompare(b.title,'ar')||a.id.localeCompare(b.id,'en')));
}

/** AI N126: deny uncertain ancestry rather than treating a supplied teaching ID
 * or a current roster projection as proof. Account rows must have explicit
 * ownership; ownerless legacy/local rows are deliberately omitted here.
 * Demo provenance is confined to its mounted disposable database.
 */
function appendRecordedWork(out,{yearId,ids,sessions,asOf,recordedScope:scope,groupArrangements,classGoals,logs}) {
  if(!scope || !validDate(asOf) || asOf==='9999-12-31')return;
  const w=scope.workspace;
  const demo=w?.type==='demo' && w.id==='demo' && w.databaseName==='rakeezx-demo';
  const account=w?.type==='account' && w.ownershipState==='claimed' && w.authUserId && w.databaseName;
  if(!demo&&!account)return;
  const owned=x=>!!x?.id && !x.deleted && (demo ? x.ownerId==null : x.ownerId===w.authUserId);
  // Conflicting duplicates (including tombstones) fail closed. Identical copies
  // can be counted once, with no mutation or dependence on input order.
  const clean=rows=>{
    const byId=new Map(),denied=new Set();
    for(const x of rows??[]){
      if(!x?.id)continue;
      if(!owned(x)||byId.has(x.id)&&JSON.stringify(byId.get(x.id))!==JSON.stringify(x))denied.add(x.id);
      else byId.set(x.id,x);
    }
    return [...byId.values()].filter(x=>!denied.has(x.id));
  };
  const year=clean(scope.years).find(x=>x.id===yearId);
  if(!year)return;
  const terms=new Map(clean(scope.terms).filter(x=>x.yearId===yearId).map(x=>[x.id,x]));
  const sections=new Map(clean(scope.sections).filter(x=>x.yearId===yearId).map(x=>[x.id,x]));
  const subjects=new Set(clean(scope.subjects).map(x=>x.id));
  const teachings=new Map(clean(scope.teachings).filter(x=>ids.has(x.id)&&terms.has(x.termId)&&
    sections.has(x.sectionId)&&subjects.has(x.subjectId)).map(x=>[x.id,x]));
  const dated=(x)=>{
    const t=teachings.get(x.teachingId),term=terms.get(t?.termId),section=sections.get(t?.sectionId);
    return !!t&&validDate(x.date)&&x.date<=asOf&&validDate(term.startDate)&&validDate(term.endDate)&&
      term.startDate<=x.date&&x.date<=term.endDate&&
      (section.status!=='archived'||validDate(section.archiveDate)&&x.date<=section.archiveDate);
  };
  const held=new Map(clean(sessions).filter(x=>x.status==='held'&&dated(x)).map(x=>[x.id,x]));
  const sessionBound=x=>dated(x)&&held.has(x.sessionId)&&held.get(x.sessionId).teachingId===x.teachingId&&
    held.get(x.sessionId).date===x.date;
  const studentIds=new Set(clean(scope.students).map(x=>x.id));
  const enrollments=clean(scope.enrollments);
  const member=(studentId,teachingId,date,current=false)=>studentIds.has(studentId)&&enrollments.some(e=>
    e.studentId===studentId&&e.sectionId===teachings.get(teachingId)?.sectionId&&
    validDate(e.startDate)&&e.startDate<=date&&
    (e.endDate==null||validDate(e.endDate)&&date<=e.endDate)&&(!current||e.status==='active'));
  const arrangements=clean(groupArrangements).filter(x=>{
    const t=teachings.get(x.teachingId),term=terms.get(t?.termId),section=sections.get(t?.sectionId);
    if(!t||x.id!=='group-arrangement:'+t.id||section.status==='archived'||term.status==='closed'||
      !validDate(term.startDate)||term.startDate>asOf||
      !Number.isSafeInteger(x.updatedAt)||x.updatedAt<=0||x.updatedAt>=Date.parse(asOf+'T00:00:00Z')+86400000||!Array.isArray(x.groups)||!x.groups.length)return false;
    const seen=new Set();
    return x.groups.every(g=>Array.isArray(g)&&g.every(id=>typeof id==='string'&&member(id,t.id,asOf,true)&&
      !seen.has(id)&&seen.add(id)))&&seen.size>0;
  });
  if(arrangements.length)out.push(summary('09',yearId,'group-arrangements','تنظيم المجموعات المحفوظ',
    'ترتيبات مجموعات محفوظة في ركيز تحتاج مراجعة؛ لا تثبت استخدامها داخل الحصة.',
    [['ترتيبات محفوظة',arrangements.length],['مجموعات غير فارغة',arrangements.reduce((n,x)=>n+x.groups.filter(g=>g.length).length,0)]],
    references('groupArrangements',arrangements),'review',
    {provenanceNotice:'مصدر يحتاج مراجعة: ترتيب تنظيمي محفوظ، وليس إثبات استخدام داخل الحصة.'}));
  const goals=clean(classGoals).filter(x=>x.id==='class-goal:'+x.teachingId&&x.state==='completed'&&
    x.runId&&sessionBound(x)&&Number.isSafeInteger(x.startedAt)&&Number.isSafeInteger(x.completedAt)&&
    x.startedAt>0&&x.completedAt>=x.startedAt&&x.completedAt<Date.parse(asOf+'T00:00:00Z')+86400000&&
    x.completedAt>=Date.parse(x.date+'T00:00:00Z'));
  if(goals.length)out.push(summary('08',yearId,'completed-goals','سجل الأهداف الصفية المكتملة',
    'أهداف صفية حالتها مكتملة في السجل وتحتاج مراجعة؛ لا يعني ذلك تحقق التعلم لدى جميع الطلاب.',
    [['سجلات أهداف مكتملة',goals.length]],references('classGoals',goals),'review',
    {provenanceNotice:'مصدر يحتاج مراجعة: سجل هدف مكتمل، وليس إثبات تحقق تعلم جميع الطلاب.'}));
  const participation=clean(logs).filter(x=>x.kind==='participation'&&sessionBound(x)&&member(x.studentId,x.teachingId,x.date)&&
    typeof x.delta==='number'&&Number.isFinite(x.delta)&&x.delta!==0);
  if(participation.length)out.push(summary('09',yearId,'participation-logs','متابعة سجلات المشاركة المؤرخة',
    'عدد سجلات المشاركة المؤرخة المرتبطة بحصص منعقدة، دون بيانات فردية أو استنتاج تحسن أو تحقق تعلم.',
    [['سجلات مشاركة',participation.length],['حصص لها سجلات',new Set(participation.map(x=>x.sessionId)).size]],
    references('logs',participation),'automatic',
    {provenanceNotice:'مصدر تلقائي: أعداد من سجلات مشاركة فعلية مؤرخة، دون استنتاج نتائج التعلم.'}));
}
