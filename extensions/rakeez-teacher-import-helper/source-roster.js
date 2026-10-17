// AI: transient source review only. Never widen the category/receiver transport cap.
import {compareAcademicClasses} from './class-order.js';
import {validateCategory} from './categories.js';
// A window is bounded by the controller, not a product-wide roster maximum.
export const SOURCE_WINDOW_ROWS=300;
const identity=v=>v.replace(/[\s\u0640\u064B-\u065F\u0670]/g,'').toLowerCase();
export function appendSourceRows(prior, incoming){
 const seen=new Set(prior.map(r=>identity(r.classroom)+'|'+identity(r.name)));
 const classrooms=new Map(prior.map(r=>[identity(r.classroom),r.classroom]));
 const next=[...prior];
 for(const row of incoming){
  const clean=validateCategory('students',[row])[0],classKey=identity(clean.classroom),key=classKey+'|'+identity(clean.name);
  if(classrooms.has(classKey)&&classrooms.get(classKey)!==clean.classroom)throw Error('AMBIGUOUS_CLASSROOM');
  if(seen.has(key))throw Error('DUPLICATE_STUDENT_IDENTITY');
  classrooms.set(classKey,clean.classroom);seen.add(key);next.push(clean);
 }
 return next;
}
export function reportsComplete(series){
 return series.size>0&&[...series.values()].every(s=>s.terminal&&Number.isSafeInteger(s.total)&&s.total>0&&(s.pages?!s.gap&&s.pages.size===s.total&&[...s.pages].every(n=>n>=1&&n<=s.total):!s.gap&&s.last===s.total));
}
export function sourceClasses(rows){
 const groups=new Map();for(const r of rows){if(!groups.has(r.classroom))groups.set(r.classroom,[]);groups.get(r.classroom).push(r);}
 return [...groups].map(([classroom,items])=>({classroom,count:items.length,available:true})).sort(compareAcademicClasses);
}
export function selectedSourceClass(rows,classroom,offset=0){
 if(!Number.isSafeInteger(offset)||offset<0)throw Error('BATCH_OFFSET');
 const selected=rows.filter(r=>r.classroom===classroom).slice(offset,offset+300);
 return validateCategory('students',selected);
}

// AI: report coverage is independent of row counts and optional metadata routes.
export function sourceCoverage({series,warnings=[],pendingReportPages=0,reviewWindow=false}){
 const proved=pendingReportPages===0&&reportsComplete(series);
 const knownIncomplete=pendingReportPages===0&&[...series.values()].some(s=>Number.isSafeInteger(s.total)&&s.total>0&&(!s.terminal||(s.pages?s.pages.size!==s.total:s.last!==s.total)));
 const failed=warnings.some(w=>w.category==='students'&&!(w.optional&&proved))||[...series.values()].some(s=>s.gap)||knownIncomplete;
 const complete=proved&&!failed;
 const coverage=complete?'complete':failed?'partial':pendingReportPages>0&&reviewWindow?'paused':'unknown';
 return {complete,coverage,hasNextReport:pendingReportPages>0,pendingReportPages,
 processedReportPages:[...series.values()].reduce((n,s)=>n+(s.pages?.size??0),0),reviewWindow};
}
export function coverageMessage(info){
 if(info.complete)return 'ثبت اكتمال تسلسل صفحات الكشف ونهايته؛ راجع كل فصل ودفعة ثم أكّد داخل ركيز. قد تبقى بيانات اختيارية لا تضيف صفحات طلاب.';
 if(info.coverage==='paused')return 'توقف الجمع مؤقتًا لمراجعة النافذة الحالية؛ توجد صفحات كشف أخرى. راجع وانقل وأكّد جميع دفعات النافذة في ركيز وانتظر إيصالاتها، ثم اضغط متابعة. لا تُحذف الأسماء غير المنقولة للمتابعة.';
 if(info.coverage==='partial')return 'تغطية الكشف جزئية: فشلت قراءة صفحة أو لم يثبت تسلسل الصفحات ونهايتها. راجع التشخيص المتاح؛ يمكنك استيراد المتاح بتأكيد إضافي، وقد ينقص طلاب.';
 return 'اكتمال الكشف غير معلوم: لم يثبت تسلسل الصفحات ونهايتها. يمكنك مراجعة المتاح فقط بتأكيد إضافي؛ لا عدد إجمالي مفترض.';
}
