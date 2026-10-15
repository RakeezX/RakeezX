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

const PACKAGE_STORES = ['sections','teachings','students','enrollments','slots','sessions','attendance','items','scores'];
const PACKAGE_TYPES = ['section','teaching','student','enrollment','slot','session','attendance','item','score'];
const packageWarning = () => new Error('تعذّر التحقق من ملكية الحزمة التجريبية أو تغيّرت بياناتها. حدّث قائمة الفصول وأعد التأكيد؛ لم تُحذف أي بيانات.');

function assertPackageContext(workspace) {
  if (!workspace || workspace !== store.getActiveWorkspace() || workspace.type !== 'account' ||
      workspace.ownershipState !== 'claimed' || !workspace.authUserId ||
      workspace.databaseName !== db.getActiveDatabaseName() || !store.state.ready) throw packageWarning();
  store.assertLeaseWritable();
}

// Only the exact rows recorded by Add demo class are eligible. Never infer a cascade
// from a demo reference: ordinary rows can refer to a demo student/class too.
function packageSnapshot(current, teachingId, workspace) {
  assertPackageContext(workspace);
  const manifest = current.meta.find(row => row.id === META_ID && !row.deleted);
  if (!Array.isArray(manifest?.packages) || manifest.packages.some(pkg =>
      !pkg || typeof pkg.owned !== 'object' || !pkg.owned || !Array.isArray(pkg.owned.teachings))) throw packageWarning();
  const matches = manifest.packages.filter(pkg => !pkg.deleted && pkg.owned.teachings.includes(teachingId));
  if (matches.length !== 1) throw packageWarning();
  const target = matches[0];
  if (typeof target.packageId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(target.packageId) ||
      manifest.packages.filter(pkg => pkg.packageId === target.packageId).length !== 1 ||
      (target.ownerId != null && target.ownerId !== workspace.authUserId) ||
      (manifest.ownerId != null && manifest.ownerId !== workspace.authUserId) ||
      Object.keys(target.owned).sort().join() !== [...PACKAGE_STORES].sort().join()) throw packageWarning();
  const owned = new Set(); const rows = {};
  for (const [index, name] of PACKAGE_STORES.entries()) {
    const ids = target.owned[name];
    const prefix = `demo:${target.packageId}:${PACKAGE_TYPES[index]}`;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length ||
        ids.some(id => typeof id !== 'string' || !(id === prefix || id.startsWith(prefix+':')))) throw packageWarning();
    rows[name] = ids.map(id => {
      const row = current[name].find(record => record.id === id);
      if (!row || row.deleted || (row.ownerId != null && row.ownerId !== workspace.authUserId)) throw packageWarning();
      owned.add(id); return row;
    });
  }
  if (rows.sections.length !== 1 || rows.teachings.length !== 1 || rows.teachings[0].id !== teachingId ||
      rows.teachings[0].sectionId !== rows.sections[0].id) throw packageWarning();
  for (const pkg of manifest.packages) {
    if (pkg === target || pkg.deleted) continue;
    if (Object.values(pkg.owned ?? {}).some(ids => !Array.isArray(ids) || ids.some(id => owned.has(id)))) throw packageWarning();
  }
  const references = { sectionId:'sections', teachingId:'teachings', studentId:'students', sessionId:'sessions', itemId:'items', slotId:'slots' };
  const referencesOwned = value => typeof value === 'string' ? owned.has(value)
    : !!value && typeof value === 'object' && Object.values(value).some(referencesOwned);
  for (const name of db.STORES) for (const row of current[name] ?? []) {
    if (name === 'meta') continue;
    const inPackage = rows[name]?.some(record => record.id === row.id);
    // Snapshots/reports and student arrays can retain nested references as well.
    if (!inPackage && referencesOwned(row)) throw packageWarning();
    for (const [key, parent] of Object.entries(references)) {
      if (inPackage && row[key] != null && !target.owned[parent].includes(row[key])) throw packageWarning();
      // A shared student or extra dependent record makes whole-package deletion unsafe.
      if (!inPackage && row[key] != null && owned.has(row[key])) throw packageWarning();
    }
  }
  const teaching = rows.teachings[0], section = rows.sections[0];
  const term = current.terms.find(row => row.id === teaching.termId && !row.deleted);
  const year = current.years.find(row => row.id === section.yearId && !row.deleted);
  if (!term || !year || section.status === 'archived' || term.status === 'closed' || year.status === 'archived') throw packageWarning();
  return { manifest, target, rows, signature: JSON.stringify([manifest, rows]) };
}

export async function previewDemoPackageDelete(teachingId) {
  const workspace = store.getActiveWorkspace();
  assertPackageContext(workspace);
  const current = Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
  const snapshot = packageSnapshot(current, teachingId, workspace);
  return { workspace, teachingId, packageId:snapshot.target.packageId, signature:snapshot.signature,
    scopeSignature:store.classDeleteScope(teachingId).signature };
}

export async function deleteDemoPackage(packageId, confirmed) {
  if (!confirmed || packageId !== confirmed.packageId) throw packageWarning();
  assertPackageContext(confirmed.workspace);
  const stamp = now();
  // save() updates memory before disk and cannot compare the manifest inside its
  // transaction. Use the existing guarded atomic adapter, then publish committed state.
  await db.applyBatch(Object.fromEntries(db.STORES.map(name => [name, {}])), {
    productWrite:true,
    prepare(current) {
      const snapshot = packageSnapshot(current, confirmed.teachingId, confirmed.workspace);
      if (snapshot.signature !== confirmed.signature ||
          store.classDeleteScope(confirmed.teachingId).signature !== confirmed.scopeSignature) throw packageWarning();
      return { ...Object.fromEntries(Object.entries(snapshot.rows).map(([name, rows]) =>
        [name, { put:rows.map(row => ({ ...row, deleted:true, updatedAt:stamp })) }])),
        meta:{ put:[{ ...snapshot.manifest, packages:snapshot.manifest.packages.filter(pkg => pkg !== snapshot.target), updatedAt:stamp }] } };
    },
  });
  if (store.getActiveWorkspace() === confirmed.workspace) await store.refreshSyncedState();
  return true;
}
