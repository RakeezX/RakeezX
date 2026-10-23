// AI: retained actual rendered nesting/headers/label roles from the authorized
// source projection. IDs, CSS and the existing app/dashboard/roster are synthetic.
// Unobserved rows/columns are omitted, not claimed to be empty portal slots.
import {sourceHTML as previous,timetable} from '../n36-lesson-link-20261023/source.mjs';
export {dash,home,role,report,roster,timetable,classes,meta,department,displaySchool,school} from '../n36-lesson-link-20261023/source.mjs';
export function sourceHTML(u,options={}){
 if(u.pathname!==new URL(timetable,'http://localhost').pathname){let h=previous(u,options).replaceAll('خامس 1','خامس 5');if(options.crossClass)h=h.replaceAll('خامس 2','سادس 6');if(options.returnVariant&&u.pathname.startsWith('/SchoolManagment/Actions/Teacher/')){if(options.returnVariant==='teacher')h=h.replaceAll('معلم اصطناعي','معلم مختلف');if(options.returnVariant==='school')h=h.replace('class=school-name>'+options.schoolName,'class=school-name>مدرسة مختلفة');if(options.returnVariant==='role')h=h.replace('<p data-role>معلم</p>','<p data-role>مدير المدرسة</p>');if(options.returnVariant==='login')h='<input type=password>'+h;}if(options.returnDelay&&u.pathname.startsWith('/SchoolManagment/Actions/Teacher/'))h='<style>@keyframes source-ready{to{opacity:1}}.source-delay{opacity:0;animation:source-ready 1ms 650ms forwards}</style>'+h.replace('<button>سجلات متابعة الفصول</button>','<button class=source-delay>سجلات متابعة الفصول</button>');return h;}
 const A='a'.repeat(32),href='/SchoolSchedule/Schedule/ManageLecture?SchoolId='+A+'&lectureId=1&dateTicks=638900000000000000&subjectId=2&classroomId=3';
 let html='<meta charset=utf-8><style>.auxiliary{display:none}.schedule-card,.title{display:flex}</style><table class=auxiliary><tr><th>إسم الملف</th><th>تحميل</th><th>إختيار</th></tr></table><div class="hijriSchedule teacherSchedule table-responsive dga-table"><table class="table table-sm table-bordered"><tr><th></th><th>الحصة\nالأولى</th></tr><tr><th>الأحد</th><td class="day-cell text-center"><div class="cs-lesson-card "><a href="'+href+'"><div class="schedule-card done"><div class="title"><i class="fa-solid fa-circle-check"></i><h2>المهارات الرقمية</h2></div><small>خامس 5</small></div></a></div></td></tr></table></div>';
 if(options.crossClass){
  // Actual observed coordinates and labels for two records only. Other source
  // records are deliberately omitted; this is not a full portal capture.
  const card=(lecture,subject,classroom,label)=>'<div class="cs-lesson-card"><a href="/SchoolSchedule/Schedule/ManageLecture?SchoolId='+A+'&lectureId='+lecture+'&dateTicks=638900000000000000&subjectId='+subject+'&classroomId='+classroom+'"><div class="schedule-card done"><div class="title"><i class="fa-solid fa-circle-check"></i><h2>المهارات الرقمية</h2></div><small>'+label+'</small></div></a></div>';
  const headings=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة'],days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
  html='<meta charset=utf-8><style>.schedule-card,.title{display:flex}</style><div class="hijriSchedule teacherSchedule table-responsive dga-table"><table class="table table-sm table-bordered"><tr><th></th>'+headings.map(h=>'<th>الحصة '+h+'</th>').join('')+'</tr>'+days.map((day,i)=>'<tr><th>'+day+'</th>'+headings.map((_,j)=>'<td class="day-cell text-center">'+(i===0&&j===0?card(1,11,21,'خامس 5'):i===1&&j===1?card(2,12,22,'سادس 6'):'')+'</td>').join('')+'</tr>').join('')+'</table></div>';
 }
 const variant=options.variant;
 if(variant==='hidden')html='<style>.cs-lesson-card{display:none}</style>'+html;
 if(variant==='nav-only')html='<nav>'+html+'</nav>';
 if(variant==='foreign')html=html.replace('SchoolId='+A,'SchoolId='+'b'.repeat(32));
 if(variant==='mixed')html+='<nav><a href="/other?SchoolId='+('b'.repeat(32))+'">غير متعلق</a></nav>';
 if(variant==='duplicate-key')html=html.replace('&subjectId=2','&subjectId=2&subjectId=2');
 if(variant==='base')html='<base href="https://foreign.invalid/">'+html;
 if(variant==='login')html='<input type=password>'+html;
 if(variant==='role')html='<p data-role>الطالب</p>'+html;
 if(variant==='missing-day')html=html.replace('الأحد','غير معروف');
 if(variant==='missing-period')html=html.replace('الحصة\nالأولى','غير معروف');
 return html;
}
