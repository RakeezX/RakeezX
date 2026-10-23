// AI: transient source review only. Never widen the category/receiver transport cap.
import {compareAcademicClasses} from './class-order.js';
import {validateCategory} from './categories.js';
// Source memory is bounded separately from the unchanged 300-row transport.
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
 // AI: structural reasons only; neither source content nor arbitrary warning text.
 const reasonFor={INVALID_ROWS_EXCLUDED:'excluded-rows',DUPLICATE_STUDENT_IDENTITY:'ambiguous-rows',AMBIGUOUS_CLASSROOM:'ambiguous-rows',PAGINATION_MISSING_NEXT:'missing-pages',PAGINATION_REPEAT_OR_CHANGED:'page-gap',PAGINATION_UNVERIFIED:'terminal-unverified',PAGINATION_TERMINAL_UNVERIFIED:'terminal-unverified',SOURCE_MEMORY_BUDGET:'pending-pages'};
 const reasons=new Set();
 for(const w of warnings)if(w.category==='students'&&!(w.optional&&proved))reasons.add(reasonFor[w.code]??'student-data-unverified');
 if([...series.values()].some(s=>s.gap))reasons.add('page-gap');
 if(knownIncomplete)reasons.add('missing-pages');
 if(pendingReportPages>0)reasons.add('pending-pages');
 if(!complete&&!reasons.size)reasons.add('terminal-unverified');
 const terminals=[...series.values()].map(s=>s.terminal?s.terminalEvidence:null);
 const terminal=terminals.length&&terminals.every(t=>['explicit-next','observed-anchor'].includes(t))?(terminals.every(t=>t==='observed-anchor')?'observed-anchor':'explicit-next'):'unproven';
 return {complete,coverage,terminal,hasNextReport:pendingReportPages>0,pendingReportPages,
 processedReportPages:[...series.values()].reduce((n,s)=>n+(s.pages?.size??0),0),reasons:[...reasons],reviewWindow};
}
export function coverageMessage(info){
 if(info.complete)return 'ثبت اكتمال تسلسل صفحات الكشف ونهايته؛ راجع كل فصل ودفعة ثم أكّد داخل ركيز. قد تبقى بيانات اختيارية لا تضيف صفحات طلاب.';
 if(info.coverage==='paused')return 'توقف الجمع لميزانية القراءة؛ توجد روابط كشف أخرى. جمع المزيد لا يتطلب نقلًا أو حفظًا، وتبقى الأسماء والمهلة الأصلية.';
 if(info.coverage==='partial')return 'التغطية جزئية؛ قد تنقص أسماء. يمكنك نقل المتاح بعد الإقرار أدناه.';
 return 'اكتمال الكشف غير معلوم؛ راجع المتاح وأقرّ بذلك أدناه.';
}
