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
export const classrooms=Array.from({length:10},(_,i)=>'خامس'+(i+1));
export function sourceHTML(u,{count=302,multi=false,setup=true,event='onmouseover',label=false,pager='complete',excluded=false,ambiguous=false,subject=true,responseSchool='present',semantic=false}={}){
 const groups=count===302?classrooms:multi?classrooms.slice(0,2):[classrooms[0]];
 const rows=Array.from({length:count},(_,i)=>({name:'طالب اصطناعي '+word(ambiguous?0:i),classroom:groups[Math.min(groups.length-1,Math.floor(i/(multi?2:30)))]}));
 const identity='<p>اسم المدرسة: '+school+'</p>';
 if(u.pathname===home)return '<meta charset=utf-8><section><h3>'+school+'</h3><p>الدور: معلم</p><p>اسم المدير: مدير اصطناعي</p>'+(label?'<p>إدارة التعليم: '+department+'</p>':'')+'<a href="'+role+'?Name='+encodeURIComponent(school)+'">الصفحة الرئيسية</a></section>';
 if(u.pathname===meta)return '<meta charset=utf-8>'+identity+'<p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p>';
 if(u.pathname===classes)return '<meta charset=utf-8><table><tr><th>الفصل</th></tr>'+groups.map(c=>'<tr><td>'+c+'</td></tr>').join('')+'</table>';
 if(u.pathname===new URL(timetable,'http://localhost').pathname)return '<meta charset=utf-8>'+(responseSchool==='missing'?'':responseSchool==='horizontal'?'<table><tr><th>اسم المدرسة</th><th>اسم المعلم</th><th>اسم المدير</th></tr><tr><td>'+school+'</td><td>معلم اصطناعي</td><td>مدير اصطناعي</td></tr></table>':responseSchool==='dl'?'<dl><dt>اسم المدرسة</dt><dd>'+school+'</dd></dl>':identity)+'<table><tr><th>اليوم</th><th>الحصة</th><th>الفصل</th><th>المادة</th></tr>'+(subject?groups.map((c,i)=>'<tr><td>الأحد</td><td>'+(i+1)+'</td><td>'+c+'</td><td>الرياضيات</td></tr>').join(''):'')+'</table><script>window.executedResponse=true</script><img src=/forbidden-resource>';
 if(u.pathname===report)return '<meta charset=utf-8>'+(pager==='unknown'?'':'<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من '+(pager==='gap'?2:1)+'</span><button '+(pager==='gap'?'':'disabled')+'>التالي</button></nav>')+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+rows.map((r,i)=>'<tr><td>'+(excluded&&i===0?'123':r.name)+'</td><td>مستمر</td><td>'+school+'</td><td>'+r.classroom+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';
 if(u.pathname===new URL(roster,'http://localhost').pathname)return '<meta charset=utf-8><a href="'+report+'">كشف الطلاب</a>';
 const dashboard='<meta charset=utf-8><p data-role>معلم</p><p class=school-name>'+school+'</p><p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p><nav><a href="'+meta+'">بياناتي</a>'+(setup?'<a href="'+classes+'">فصولي</a><a '+event+'="window.executedHandler=true" href="'+timetable+'">جدولي</a>':'')+'<a href="'+roster+'">قائمة الطلاب</a><a href="'+report+'">كشف الطلاب</a><button>سجلات المتابعة اليومية</button><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></nav>';
 return semantic?dashboard.replace('<p data-role>معلم</p>','').replace('<p class=school-name>'+school+'</p>','').replace('جدولي</a>','الجدول الدراسي</a>').replace(/ onmouseover="[^"]*"/,''):dashboard;
}
