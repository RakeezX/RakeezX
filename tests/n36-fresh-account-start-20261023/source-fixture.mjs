// AI: reuse existing synthetic source DOM primitives, bounded to two fabricated rows.
let mode='normal-before',rejectKind='timetable',tiles=0;
const A='a'.repeat(32),B='b'.repeat(32),dash='/SchoolManagment/Actions/Teacher/'+B,home='/Dashboards/Schools';
const roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A,report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const meta='/TeachersReports/Statistics/MyInfo/observed',classes='/TeachersReports/Statistics/Teacher/observed',timetable='/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A;
const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const word=i=>{let s='';do{s=String.fromCharCode(97+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
const rows=Array.from({length:2},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:'خامس1'}));
const pendingNegative=()=>mode.startsWith('pending-')||mode==='timeout'||mode==='abort';

const rejectedPath=()=>rejectKind==='metadata'?meta:rejectKind==='classes'?classes:timetable;
const gate=()=>mode.split('-')[0];
const negative=()=>/drift|missing|conflict|unsafe-student|auth-loss|batch-loss|unknown-receipt|response-login|response-role/.test(mode);
const rejectionReason=()=>gate()==='route'?'route-shape':gate()==='absent'||gate()==='lateabsent'?'live-link-absent':gate()==='base'?'response-base':'live-link-unsafe';
const isCard=()=>mode.startsWith('card-'),hasInfo=()=>rejectKind==='metadata'||/empty-info|conflicting-info/.test(mode),isNegative=negative;
function html(u){
 const baseTag=gate()==='base'&&u.pathname===new URL(rejectedPath(),base).pathname?'<base href="https://untrusted.invalid/">':'';
 if(baseTag)return '<meta charset=utf-8>'+baseTag+(mode.includes('response-login')?'<input type=password>':mode.includes('response-role')?'<p data-role>الطالب</p>':'')+'<script>window.unexpectedScript=true</script><p>اسم المدرسة: مدرسة اصطناعية</p>';

 if(isCard()&&u.pathname===home)return '<meta charset=utf-8><section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><p>اسم المدير: مدير اصطناعي</p><a href="'+role+'">الصفحة الرئيسية</a></section>';
 if(u.pathname===meta)return '<meta charset=utf-8><dl><dt>اسم المدرسة</dt><dd>'+(mode.includes('conflicting-info')?'مدرسة أخرى':'')+'</dd></dl><p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p><script>window.unexpectedScript=true</script><img src=/unexpected-resource><iframe src=/unexpected-resource></iframe>';
 if(u.pathname===classes)return '<meta charset=utf-8><table><tr><th>الفصل</th><th>المادة</th></tr><tr><td>خامس1</td><td>الرياضيات</td></tr></table><img src=/unexpected-resource>';
 if(u.pathname==='/SchoolSchedule/Schedule/TeacherSchedule')return '<meta charset=utf-8><p>اسم المدرسة: مدرسة اصطناعية</p><table><tr><th>اليوم</th><th>الحصة</th><th>الفصل</th><th>المادة</th></tr><tr><td>الأحد</td><td>1</td><td>خامس1</td><td>الرياضيات</td></tr></table><script>window.unexpectedScript=true</script>';
 if(u.pathname===report)return '<meta charset=utf-8>'+(mode.includes('unknown-pages')?'':'<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav>')+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+rows.map((r,i)=>'<tr><td>'+r.name+'</td><td>مستمر</td><td>'+(mode.includes('missing')?'':mode.includes('conflict')&&i>=300?'مدرسة أخرى':'مدرسة اصطناعية')+'</td><td>'+r.classroom+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<meta charset=utf-8><a '+(mode.includes('unsafe-student')?'onclick="window.unexpectedClick=true" ':'')+'href="'+report+'">كشف الطلاب</a>';
 const setup='<a href="'+classes+'">فصولي</a><a href="'+timetable+'">الجدول الدراسي</a>',student='<a href="'+roster+'">قائمة الطلاب</a><a href="'+report+'">كشف الطلاب</a>';
 let documentHTML='<meta charset=utf-8>'+(rejectKind==='timetable'?'<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p>':'')+'<main>'+Array.from({length:tiles},()=>'<section><div><div><div><p><span>إعلان مدرسي اصطناعي</span></p><small>تفاصيل النشاط المدرسي</small></div></div></div></section>').join('')+'</main><p>اسم المعلم: معلم اصطناعي</p>'+(isCard()?'':'<p>اسم المدير: مدير اصطناعي</p>')+'<nav>'+(hasInfo()?'<a href="'+meta+'">بياناتي</a>':'')+(mode.endsWith('after')?student+setup:setup+student)+'<button>سجلات المتابعة اليومية</button><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></nav>';
 if(rejectKind==='timetable')documentHTML=documentHTML.replace('>الجدول الدراسي</a>','>جدولي</a>');
 if(gate()==='route')documentHTML=documentHTML.replaceAll(rejectedPath(),rejectedPath().replace('/observed','/observed.invalid'));
 if(gate()==='onclick')documentHTML=documentHTML.replace('href="'+rejectedPath()+'"','onclick="window.unexpectedClick=true" href="'+rejectedPath()+'"');
 return documentHTML;
}

export {html,dash,home,report,meta,classes,timetable,roster,rows};
