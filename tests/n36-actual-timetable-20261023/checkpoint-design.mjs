// AI: local-only design experiment. Not wired into the extension or certified for release.
// A response/rendered document need not repeat dashboard identity labels: rows
// remain quarantined until the exact canonical teacher proof is obtained again.
export async function qualifyCheckpointChain(io, expected) {
 const fail=code=>{throw Error(code);};
 const deadline=io.now()+1000;
 const app=async()=>{const a=await io.app();if(a.owner!==expected.owner||a.session!==expected.session)fail('APP_CONTEXT_CHANGED');};
 const bounded=()=>{if(io.now()>=deadline)fail('CHECKPOINT_TIMEOUT');};
 await app();const before=await io.canonical();bounded();
 if(!before.ok)fail(before.code);
 if(before.url!==expected.home||before.proof!==expected.proof||!before.document)fail('CANONICAL_CONTEXT_CHANGED');
 const target=new URL(expected.target),home=new URL(expected.home);
 if(target.origin!==home.origin||target.pathname!=='/SchoolSchedule/Schedule/TeacherSchedule'||target.hash||target.username||target.password||[...target.searchParams].length!==1||target.searchParams.get('SchoolId')!==expected.schoolId||!before.links.includes(target.href))fail('UNOBSERVED_SETUP_LINK');
 let entered=false;
 try{
  entered=true;const destination=await io.enter(target.href);bounded();await app();
  if(destination.url!==target.href||!destination.document||destination.document===before.document||destination.frameId!==0)fail('SOURCE_BINDING_CHANGED');
  const quarantined=await io.read();bounded();await app();
  const after=await io.descriptor();
  if(after.document!==destination.document||after.url!==target.href||after.frameId!==0)fail('SOURCE_BINDING_CHANGED');
  if(!quarantined.ok)fail(quarantined.code);
  await io.leave(home.href);entered=false;bounded();
  const canonical=await io.canonical();await app();bounded();
  if(!canonical.ok)fail(canonical.code);
  if(canonical.url!==home.href||!canonical.document||canonical.document===destination.document||canonical.proof!==before.proof)fail('CANONICAL_CONTEXT_CHANGED');
  // The first point at which rows can leave this experiment's quarantine.
  return quarantined.tables;
 }finally{if(entered)await io.leave(home.href);}
}

// Executed solely on a synthetic HTTP document. Retains actual central parser
// and role guard; adds a local candidate visibility/tuple envelope for this design.
export async function renderedEnvelope(context) {
 const {readSourceReportPage}=await import('/extensions/rakeez-teacher-import-helper/source-adapter.js');
 const fail=code=>({ok:false,code});
 if(document.querySelector('base[href]'))return fail('UNSAFE_SETUP_LINK');
 const guard=readSourceReportPage('guard');if(!guard.ok)return guard;
 const visible=n=>{for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.matches('[inert],.hidden,.d-none,.sr-only')||s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}return n.getClientRects().length>0;};
 const plain=n=>n.textContent.trim().replace(/\s+/g,' ');
 const labels=[...document.querySelectorAll('p,span,label,small')].filter(n=>visible(n)&&!n.children.length).map(plain);
 if(labels.some(v=>v.startsWith('اسم المدرسة: ')&&v.slice(13)!==context.schoolName))return fail('SCHOOL_CONTEXT_CHANGED');
 if(labels.some(v=>v.startsWith('اسم المعلم: ')&&!JSON.parse(context.readProof).teacher.includes(v.slice(12))))return fail('TEACHER_CONTEXT_CHANGED');
 const seen=new Set(),ids=new Map();let matched=0;
 for(const a of document.querySelectorAll('a[href]')){
  let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{return fail('UNSAFE_LESSON_LINK');}
  for(const [k,v] of u.searchParams)if(k.toLowerCase()==='schoolid'&&v.toLowerCase()!==context.schoolId)return fail('SCHOOL_CONTEXT_CHANGED');
  if(!u.pathname.includes('ManageLecture'))continue;
  const keys=['SchoolId','lectureId','dateTicks','subjectId','classroomId'];
  if(u.origin!==location.origin||u.pathname!=='/SchoolSchedule/Schedule/ManageLecture'||u.username||u.password||u.hash||[...u.searchParams].length!==5||keys.some(k=>u.searchParams.getAll(k).length!==1)||!['lectureId','subjectId','classroomId'].every(k=>/^[1-9][0-9]{0,9}$/.test(u.searchParams.get(k)))||! /^[1-9][0-9]{0,18}$/.test(u.searchParams.get('dateTicks')))return fail('UNSAFE_LESSON_LINK');
  if(!visible(a)||a.closest('nav,header,footer,form,[disabled],[aria-disabled=true],.disabled')||a.hasAttribute('download')||a.getAttributeNames().some(k=>/^on/i.test(k))||a.hasAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get')return fail('UNSAFE_LESSON_LINK');
  const card=a.querySelector(':scope > .schedule-card'),cell=a.closest('td'),table=cell?.closest('table');
  const subject=card?.querySelectorAll(':scope > .title > h2'),classroom=card?.querySelectorAll(':scope > small');
  if(!card||!cell||!table||table.closest('nav,header,footer,form')||table.querySelector('table')||cell.querySelectorAll('a[href]').length!==1||subject.length!==1||classroom.length!==1||!visible(subject[0])||!visible(classroom[0]))return fail('AMBIGUOUS_LESSON_LINKS');
  const tuple=JSON.stringify(keys.map(k=>u.searchParams.get(k)));if(seen.has(tuple))return fail('AMBIGUOUS_LESSON_LINKS');seen.add(tuple);
  for(const [kind,label] of [['subjectId',plain(subject[0])],['classroomId',plain(classroom[0])]]){
   const id=u.searchParams.get(kind);for(const [k,v] of [[kind+':'+id,label],[kind+'-label:'+label,id]]){if(ids.has(k)&&ids.get(k)!==v)return fail('AMBIGUOUS_LESSON_LINKS');ids.set(k,v);}
  }
  matched++;
 }
 if(!matched)return fail('SCHOOL_CONTEXT_UNCONFIRMED');
 const parsed=readSourceReportPage('timetable',context);if(!parsed.ok)return parsed;
 return {...parsed,links:[],tables:parsed.tables.filter(t=>t.category==='timetable')};
}
