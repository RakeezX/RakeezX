import * as db from './db.js';
import * as store from '../store.js';
import { uid, now, todayISO, shiftDate, weekday, isTeachingDay, makeSection, makeTeaching, makeStudent, makeEnrollment, makeSlot, makeSession, makeItem } from '../models.js';

const META_ID = 'demo:packages';
export const DEMO_STUDENT_NAMES = ['أحمد محمد','محمد خالد','عبدالله سعد','عمر فهد','يوسف علي','خالد عبدالرحمن','سلمان ناصر','عبدالعزيز ماجد','فيصل أحمد','تركي صالح','مازن عمر','راكان بدر','زياد حسن','بدر فهد','ناصر سالم','وليد طارق','سعود إبراهيم','فهد منصور','حسن ياسر','أنس رامي','إياد سامي','معاذ عادل','لؤي كريم','ريان محمود'];
const demoId = (packageId, type, index = '') => `demo:${packageId}:${type}${index === '' ? '' : `:${index}`}`;
const teachingDay = (yearId, from, direction) => { let date=from; for(let i=0;i<45;i++,date=shiftDate(date,direction)){ const day=store.calendarDayForYear(yearId,date); if(weekday(date) < 5 && (!day || isTeachingDay(day.kind))) return date; } return from; };

export async function demoPackages() { return (await db.get('meta', META_ID))?.packages?.filter((p) => !p.deleted) ?? []; }
export const isDemo = (record) => store.isLocalOnlyRecord(record);

export async function createDemoPackage() {
  const year = store.activeYear(); const term = store.activeTerm();
  if (!year || !term) throw new Error('تعذّر تجهيز السياق الدراسي التجريبي.');
  const packages = await demoPackages(); const number = packages.length + 1; const packageId = uid(); const stamp = now();
  const subject = store.subjects().find((s) => s.name === 'المهارات الرقمية') ?? store.subjects()[0];
  if (!subject) throw new Error('تعذّر تحديد المادة الدراسية.');
  const section = makeSection({ id: demoId(packageId,'section'), yearId:year.id, grade:5, label:`تجريبي ${number}`, name:'الخامس الابتدائي / تجريبي '+number, color:'#0f766e', order:store.sections().length, updatedAt:stamp });
  const teaching = makeTeaching({ id:demoId(packageId,'teaching'), sectionId:section.id, subjectId:subject.id, termId:term.id, updatedAt:stamp });
  const students=DEMO_STUDENT_NAMES.map((name,i)=>makeStudent({id:demoId(packageId,'student',i+1),name,updatedAt:stamp}));
  const enrollments=students.map((student,i)=>makeEnrollment({id:demoId(packageId,'enrollment',i+1),studentId:student.id,sectionId:section.id,rollNo:i+1,updatedAt:stamp}));
  const used=new Set(store.allSlots().map((s)=>`${s.weekday}:${s.period}`)); const slots=[]; for(const [day,period] of [[0,1],[2,2],[4,1]]) if(!used.has(`${day}:${period}`)) slots.push(makeSlot({id:demoId(packageId,'slot',slots.length+1),teachingId:teaching.id,weekday:day,period,updatedAt:stamp}));
  const today=todayISO(); const past=teachingDay(year.id,shiftDate(today,-7),-1); const pending=teachingDay(year.id,shiftDate(today,-3),-1); const future=teachingDay(year.id,shiftDate(today,7),1);
  const dates=[past,pending,future]; const sessions=dates.map((date,i)=>makeSession({id:demoId(packageId,'session',i+1),teachingId:teaching.id,date,period:slots[i%slots.length]?.period ?? 1,slotId:slots[i%slots.length]?.id ?? null,status:i===0?'held':'scheduled',updatedAt:stamp}));
  const attendance=students.map((student,i)=>({id:demoId(packageId,'attendance',i+1),studentId:student.id,sessionId:sessions[0].id,teachingId:teaching.id,date:past,status:['present','absent','late','excused'][i%4],note:'',deleted:false,updatedAt:stamp}));
  const items=[['واجب',10,null],['مشروع',20,null],['اختبار',20,null],['مشاركة',10,'participation']].map(([name,max,auto],i)=>makeItem({id:demoId(packageId,'item',i+1),teachingId:teaching.id,name,max,auto,order:i,updatedAt:stamp}));
  const scores=students.flatMap((student,i)=>items.map((item,j)=>({id:demoId(packageId,'score',`${i+1}:${j+1}`),studentId:student.id,itemId:item.id,value:item.auto==='participation'?0:Math.max(1,(i*3+j*4)%item.max),deleted:false,updatedAt:stamp})));
  const owned={sections:[section.id],teachings:[teaching.id],students:students.map(x=>x.id),enrollments:enrollments.map(x=>x.id),slots:slots.map(x=>x.id),sessions:sessions.map(x=>x.id),attendance:attendance.map(x=>x.id),items:items.map(x=>x.id),scores:scores.map(x=>x.id)};
  const manifest={id:META_ID,packages:[...packages,{packageId,number,createdAt:stamp,owned}],updatedAt:stamp};
  const ok=await store.save({sections:[section],teachings:[teaching],students,enrollments,slots,sessions,attendance,items,scores,meta:[manifest]});
  if(!ok) throw new Error('تعذّر إنشاء الفصل التجريبي.'); return {packageId,section,teaching};
}

export async function deleteDemoPackage(packageId) { const packages=await demoPackages(); const target=packages.find((p)=>p.packageId===packageId); if(!target) return false; const batch={}; for(const [name,ids] of Object.entries(target.owned)) batch[name]=ids.map((id)=>({...(store.state[name].find((r)=>r.id===id)??{id}),deleted:true,updatedAt:now()})); const manifest={id:META_ID,packages:packages.filter((p)=>p.packageId!==packageId),updatedAt:now()}; return store.save({...batch,meta:[manifest]}); }
