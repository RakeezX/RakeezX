// AI-authored: grounded .37 dashboard/card, report and labelled setup shapes.
export const school='ابن الجوزي الابتدائية بمكة المكرمة',displaySchool='ابن الجوزي الابتدائية';
export const department='الإدارة العامة للتعليم بمنطقة مكة المكرمة';
const A='a'.repeat(32),B='b'.repeat(32);
export const dash='/SchoolManagment/Actions/Teacher/'+B,home='/Dashboards/Schools';
export const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B;
export const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
export const roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
export const timetable='/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A;
export const classes='/TeachersReports/Statistics/Teacher/observed';
export const meta='/TeachersReports/Statistics/MyInfo/observed';
const word=i=>{let s='';do{s=String.fromCharCode(97+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
export const classrooms=Array.from({length:10},(_,i)=>'خامس '+(i+1));
export function originalSourceHTML(u,{count=302,multi=false,setup=true,event='onmouseover',label=false,pager='complete',excluded=false,ambiguous=false,subject=true,responseSchool='present',semantic=false}={}){
 const groups=count===302?classrooms:multi?classrooms.slice(0,2):[classrooms[0]];
 const rows=Array.from({length:count},(_,i)=>({name:'طالب اصطناعي '+word(ambiguous?0:i),classroom:groups[Math.min(groups.length-1,Math.floor(i/(multi?2:30)))]}));
 const identity='<p>اسم المدرسة: '+school+'</p>';
 if(u.pathname===home)return '<meta charset=utf-8><section><h3>'+school+'</h3><p>الدور: معلم</p><p>اسم المدير: مدير اصطناعي</p>'+(label?'<p>إدارة التعليم: '+department+'</p>':'')+'<a href="'+role+'?Name='+encodeURIComponent(school)+'">الصفحة الرئيسية</a></section>';
 if(u.pathname===meta)return '<meta charset=utf-8>'+identity+'<p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p>';
 if(u.pathname===classes)return '<meta charset=utf-8><table><tr><th>الفصل</th></tr>'+groups.map(c=>'<tr><td>'+c+'</td></tr>').join('')+'</table>';
 if(u.pathname===new URL(timetable,'http://localhost').pathname){
 const link='/SchoolSchedule/Schedule/ManageLecture?SchoolId='+A+'&lectureId=1&dateTicks=638900000000000000&subjectId=34212&classroomId=203793';
 return '<meta charset=utf-8><table><tr><th>اليوم</th><th>الحصة الأولى</th></tr><tr><th>الأحد</th><td><a href="'+link+'">المهارات الرقمية</a><br><a href="'+link+'">'+groups[0]+'</a></td></tr></table><script>window.executedResponse=true</script><img src=/forbidden-resource>';
 }
 if(u.pathname===report)return '<meta charset=utf-8>'+(pager==='unknown'?'':'<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من '+(pager==='gap'?2:1)+'</span><button '+(pager==='gap'?'':'disabled')+'>التالي</button></nav>')+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+rows.map((r,i)=>'<tr><td>'+(excluded&&i===0?'123':r.name)+'</td><td>مستمر</td><td>'+school+'</td><td>'+r.classroom+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';
 if(u.pathname===new URL(roster,'http://localhost').pathname)return '<meta charset=utf-8><a href="'+report+'">كشف الطلاب</a>';
 const dashboard='<meta charset=utf-8><p data-role>معلم</p><p class=school-name>'+school+'</p><p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p><nav><a href="'+meta+'">بياناتي</a>'+(setup?'<a href="'+classes+'">فصولي</a><a '+event+'="window.executedHandler=true" href="'+timetable+'">جدولي</a>':'')+'<a href="'+roster+'">قائمة الطلاب</a><a href="'+report+'">كشف الطلاب</a><button>سجلات المتابعة اليومية</button><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></nav>';
 return semantic?dashboard.replace('<p data-role>معلم</p>','').replace('<p class=school-name>'+school+'</p>','').replace('جدولي</a>','الجدول الدراسي</a>').replace(/ onmouseover="[^"]*"/,''):dashboard;
}

// AI: exact two-anchor seam; surrounding explicit grid is a synthetic supported
// layout, not evidence that the unknown live portal has these coordinates.
export function sourceHTML(u,options={}){
 let html=originalSourceHTML(u,options);
 if(options.schoolOverride)html=html.replaceAll(school,options.schoolOverride);
 if(options.explicitDepartment&&u.pathname===dash)html='<p>إدارة التعليم: '+options.explicitDepartment+'</p>'+html;
 if(u.pathname!==new URL(timetable,'http://localhost').pathname)return html;
 const v=options.variant??'pair',foreign='c'.repeat(32);
 const link='/SchoolSchedule/Schedule/ManageLecture?SchoolId='+A+'&lectureId=1&dateTicks=638900000000000000&subjectId=34212&classroomId=203793';
 if(v==='foreign')html=html.replaceAll('SchoolId='+A,'SchoolId='+foreign);
 if(v==='mixed')html=html.replace('SchoolId='+A,'SchoolId='+foreign);
 if(v==='duplicate-key')html=html.replaceAll('&subjectId=34212','&subjectId=34212&subjectId=34212');
 if(v==='case-duplicate')html=html.replaceAll('&subjectId=34212','&subjectId=34212&SubjectId=34212');
 if(v==='bad-id')html=html.replaceAll('classroomId=203793','classroomId=abc');
 if(v==='foreign-origin')html=html.replaceAll('href="/SchoolSchedule','href="https://evil.invalid/SchoolSchedule');
 if(v==='bad-path')html=html.replaceAll('/ManageLecture?','/EditLecture?');
 if(v==='fragment')html=html.replaceAll('classroomId=203793','classroomId=203793#injected');
 if(v==='tuple')html=html.replace('subjectId=34212','subjectId=34213');
 if(v==='hidden')html=html.replace('<td><a','<td hidden><a');
 if(v==='hidden-anchor')html=html.replace('<a href','<a hidden href');
 if(v==='event')html=html.replace('<a href','<a onclick="window.executedHandler=true" href');
 if(v==='download')html=html.replace('<a href','<a download href');
 if(v==='form')html=html.replace('<table>','<form><table>').replace('</table>','</table></form>');
 if(v==='nav-only')html=html.replace('<table>','<nav><table>').replace('</table>','</table></nav>');
 if(v==='extra-anchor')html=html.replace('</td>','<a href="'+link+'">حقن</a></td>');
 if(v==='inconsistent-class-id'||v==='inconsistent-subject-id'){
  const row=/<tr><th>الأحد<\/th>([\s\S]*?)<\/tr>/.exec(html)[0];
  const other=v==='inconsistent-class-id'?row.replace('خامس 1','خامس 2'):row.replaceAll('subjectId=34212','subjectId=34213');
  html=html.replace('</table>',other+'</table>');
 }
 if(v==='nav-decoy')html=html.replace(/<table>[\s\S]*?<\/table>/,'<nav><a href="'+link+'">المهارات الرقمية</a><a href="'+link+'">خامس 1</a></nav>');
 if(v==='school-name')html='<p>اسم المدرسة: مدرسة أخرى</p>'+html;
 if(v==='multiple-school')html='<p>اسم المدرسة: '+school+'</p><p>اسم المدرسة: مدرسة أخرى</p>'+html;
 if(v==='teacher')html='<p>اسم المعلم: معلم آخر</p>'+html;
 if(v==='login')html='<input type=password>'+html;
 if(v==='role')html='<p data-role>الطالب</p>'+html;
 if(v==='base')html='<base href="https://evil.invalid/">'+html;
 if(v==='css-hidden')html='<style>td{display:none}</style>'+html;
 if(v==='no-weekday')html=html.replace('<th>الأحد</th>','<th>غير معروف</th>');
 if(v==='no-period')html=html.replace('الحصة الأولى','غير معروف');
 if(v==='duplicate-period')html=html.replace('<th>الحصة الأولى</th>','<th>الحصة الأولى</th><th>الحصة الأولى</th>');
 if(v==='card')html=html.replace(/<td>[\s\S]*?<\/td>/,'<td><a href="'+link+'"><div class="schedule-card"><div class="title"><h2>المهارات الرقمية</h2></div><small>خامس 1</small></div></a></td>');
 return html;
}
