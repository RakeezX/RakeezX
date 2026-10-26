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
  Object.freeze({id:'rakeez:'+key+':'+yearId,criterion,title,description,metrics,sourceKind:kind,
    requiresReview:kind==='review',source:'ركيز المعلم',references:records,...other});

/** Input arrays are caller-filtered year-wide product snapshots; no writes. */
export function buildPortfolioEvidenceSuggestions({
  yearId,teachingIds=[],attendance=null,slots=[],sessions=[],classRules=[],
  items=[],scores=[],assignments=[],submissions=[],asOf='9999-12-31',
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
  return Object.freeze(suggestions.sort((a,b)=>Number(a.criterion)-Number(b.criterion)||
    a.title.localeCompare(b.title,'ar')));
}
export const guideForCriterion = id => F09_EVIDENCE_GUIDE.find(x=>x.criterion===id)||null;
