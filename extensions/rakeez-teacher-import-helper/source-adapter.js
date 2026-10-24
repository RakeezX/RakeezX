// AI-authored closure-free reader: live visibility and inert report HTML share one schema/parser.
export function readSourceReportPage(mode,runContext=null,source=null) {
 // Transport executes ONLY inside the explicitly authorized source tab, never the extension page.
 if(mode==='fetch')return (async()=>{
  const binding=globalThis.location.href,u=new URL(runContext.path,binding);
  const fail=(code,setupRejectReason=null)=>{const e=Error(code);if(setupRejectReason){e.setupKind=runContext.setupKind;e.setupRejectReason=setupRejectReason;}throw e;};
  const setup=['metadata','classes','timetable'].includes(runContext.setupKind),kind=runContext.setupKind;
  const setupRoute=kind==='metadata'?/^\/TeachersReports\/(?:Statistics\/)?MyInfo\/[A-Za-z0-9_-]{1,80}\/?$/i:kind==='classes'?/^\/TeachersReports\/(?:Statistics\/)?Teacher\/[A-Za-z0-9_-]{1,80}\/?$/i:/^\/(?:TeachersReports\/(?:Statistics\/)?TeacherSchedule\/[A-Za-z0-9_-]{1,80}|SchoolSchedule\/Schedule\/TeacherSchedule)\/?$/i;
  const menu=/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(u.pathname);
  const check=()=>{
   // AI: the worker binds this exact document and permits only fragment drift.
   // Keep origin/path/query byte exact during the read, matching sourceRoute.
   const currentSource=new URL(globalThis.location.href),boundSource=new URL(runContext.sourceURL);
   currentSource.hash='';boundSource.hash='';
   if(currentSource.href!==boundSource.href)fail('SOURCE_CONTEXT_CHANGED');
   globalThis.rakeezRoutePolicy(globalThis.location.origin,u.href,runContext);
   const match=/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/([a-f0-9]{32})\/?$/i.exec(u.pathname);
   if(!runContext.schoolId||(!setup&&!menu&&(!match||match[1].toLowerCase()!==runContext.schoolId.toLowerCase())))fail('SCHOOL_CONTEXT_CHANGED');
   if(!runContext.readProof||typeof globalThis.rakeezTeacherReadGuard!=='function')fail('UNCONFIRMED_TEACHER_ROLE');
   if(globalThis.rakeezTeacherReadGuard.jobId!==runContext.requestId.split('|')[0])fail('TEACHER_CONTEXT_CHANGED');
   const teacher=globalThis.rakeezTeacherReadGuard();if(!teacher.ok)fail(teacher.code);if(teacher.proof!==runContext.readProof)fail('TEACHER_CONTEXT_CHANGED');
   if(setup&&(!setupRoute.test(u.pathname)||u.hash))fail('UNSAFE_SETUP_LINK','route-shape');
   if(runContext.schoolBinding!=='bound'&&setup&&kind!=='metadata')fail('SCHOOL_CONTEXT_UNCONFIRMED');
   if(menu||setup||!runContext.observedReport){
    const styles=new WeakMap();const style=n=>{if(!styles.has(n))styles.set(n,getComputedStyle(n));return styles.get(n);};
    const anchors=Array.from(globalThis.document.querySelectorAll('a[href]')).filter(a=>{for(let n=a;n;n=n.parentElement){const c=style(n);if(n.hidden||n.getAttribute('aria-hidden')==='true'||c.display==='none'||c.visibility!=='visible'||Number(c.opacity)===0)return false;}return a.getClientRects().length>0;}).filter(a=>{try{return new URL(a.getAttribute('href'),binding).href===u.href;}catch{return false;}});
    if(!anchors.length)fail(setup?'UNSAFE_SETUP_LINK':'UNSAFE_ROSTER_LINK',setup?'live-link-absent':null);
    // AI: only the one observed exact timetable GET may carry inert event names.
    // Never read its value, invoke a handler, click, or navigate. Every check is
    // repeated around the bounded fetch/stream; mixed duplicate anchors fail.
    const eventNames=a=>a.getAttributeNames().filter(k=>/^on/i.test(k));
    let reason=null;
    if(kind==='timetable'&&anchors.length>1&&anchors.some(a=>eventNames(a).length))reason='live-link-duplicate';
    else if(anchors.some(a=>eventNames(a).length&&!(kind==='timetable'&&/^\/SchoolSchedule\/Schedule\/TeacherSchedule\/?$/i.test(u.pathname)&&[...u.searchParams].length===1&&u.searchParams.get('SchoolId')?.toLowerCase()===runContext.schoolId.toLowerCase())))reason='live-link-event';
    else if(anchors.some(a=>a.closest('form,[inert],[disabled],[aria-disabled=true],.disabled')))reason='live-link-context';
    else if(anchors.some(a=>a.hasAttribute('download')))reason='live-link-download';
    else if(anchors.some(a=>a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get'))reason='live-link-method';
    if(reason)fail(setup?'UNSAFE_SETUP_LINK':'UNSAFE_ROSTER_LINK',setup?(kind==='timetable'?reason:'live-link-unsafe'):null);
   }
   const guard=readSourceReportPage('guard');if(!guard.ok)fail(guard.code);
  };
  try{check();}catch(e){return {ok:false,code:e.message,incomplete:true,...(e.setupRejectReason?{setupKind:e.setupKind,setupRejectReason:e.setupRejectReason}:{})};}
  const controllers=globalThis.rakeezReportRequests??=new Map();
  if(controllers.size>=3)fail('FETCH_CONCURRENCY');
  const controller=new AbortController();controllers.set(runContext.requestId,controller);
  const timer=setTimeout(()=>controller.abort(),Math.min(8000,Math.max(1,runContext.remainingMs??8000)));
  try{
   const response=await fetch(u.href,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal});
   check();
   if(!response.ok||response.redirected||new URL(response.url).href!==u.href)fail('REPORT_RESPONSE_REJECTED');
   if(!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??''))fail('REPORT_CONTENT_TYPE');
   // Bound decoded input before constructing an inert document, including chunked responses.
   if(Number(response.headers.get('content-length'))>2000000)fail('REPORT_SIZE');
   const reader=response.body.getReader(),decoder=new TextDecoder();let html='',bytes=0;
   try{while(true){const {done,value}=await reader.read();check();if(done)break;bytes+=value.byteLength;if(bytes>2000000)fail('REPORT_SIZE');html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   check();
   // Template contents stay inert, including images/frames/styles. Never insert
   // fetched nodes into a live document or execute fetched code/resources.
   const template=globalThis.document.createElement('template');template.innerHTML=html;
   const doc=template.content;
   if(doc.querySelector('input[type=password],form[action*="Login" i],meta[http-equiv=refresh i]'))fail('LOGIN_OR_LOGOUT');
   const guard=readSourceReportPage('guard',runContext,{document:doc,url:u.href});if(!guard.ok)fail(guard.code);
   // AI: auth/role stops retain priority; reject base before setup identity/field/link readers.
   if(setup&&doc.querySelector('base[href]'))fail('UNSAFE_SETUP_LINK','response-base');
   // AI: explicit fields only, from inert bounded HTML. Never a generic heading.
   const shown=n=>{for(let e=n;e;e=e.parentElement)if(e.hidden||e.matches('[inert],.hidden,.d-none,.sr-only,[aria-hidden=true]')||e.style.display==='none'||e.style.visibility==='hidden'||e.style.opacity==='0')return false;return true;};
   const field=n=>n&&shown(n)&&!n.querySelector('script,style,iframe,input,table,a,button')?n.textContent.trim().replace(/\s+/g,' '):'';
   const labels=Array.from(doc.querySelectorAll('p,span,small,div,b,strong,label,dt')).map(field);
   const schools=[...new Set([...Array.from(doc.querySelectorAll('.school-name')).map(field),...labels.flatMap(v=>/^اسم المدرسة: .{2,80}$/.test(v)?[v.slice(13)]:[]),...Array.from(doc.querySelectorAll('dt,p,span,label,th,td')).flatMap(n=>{if(!['اسم المدرسة','اسم المدرسة:'].includes(field(n)))return [];if(['TH','TD'].includes(n.tagName)&&!(n.parentElement?.tagName==='TR'&&n.parentElement.cells.length===2&&n.parentElement.cells[0]===n&&n.nextElementSibling?.tagName==='TD'))return [];return [field(n.nextElementSibling)];})]
    .filter(v=>v.length>1&&v.length<=80&&!/[\t\r\n@]|https?:/i.test(v)))];
   const teachers=labels.flatMap(v=>/^اسم المعلم(?:ة)?: .{2,80}$/.test(v)?[v.replace(/^اسم المعلم(?:ة)?: /,'')]:[]);
   const expected=JSON.parse(runContext.readProof).teacher;
   if(expected.length&&teachers.some(n=>!expected.includes(n)))fail('TEACHER_CONTEXT_CHANGED');
   if(schools.length>1||runContext.schoolName&&schools.some(n=>n!==runContext.schoolName))fail('SCHOOL_CONTEXT_CHANGED');
   for(const a of doc.querySelectorAll('a[href]')){const v=new URL(a.getAttribute('href'),u.href);for(const [key,id] of v.searchParams)if(key.toLowerCase()==='schoolid'&&id.toLowerCase()!==runContext.schoolId.toLowerCase())fail('SCHOOL_CONTEXT_CHANGED');}
   if(menu&&doc.querySelector('base[href]'))fail('UNSAFE_ROSTER_LINK');
   if(setup){
    const identity=globalThis.rakeezSetupPageReader?.('metadata',runContext,{document:doc,url:u.href});
    if(!identity)fail('SETUP_READER_UNAVAILABLE');if(!identity.ok)fail(identity.code);
    // AI: an explicitly empty metadata school field supplies no binding or
    // conflict. Keep the observed report queued to establish the school name.
    identity.tables=identity.tables.filter(t=>t.category!=='school'||t.text.split('\t')[1]?.trim());
    if(identity.warnings.some(w=>['teacher','school'].includes(w.category)))fail(identity.warnings.some(w=>w.category==='school')?'SCHOOL_CONTEXT_CHANGED':'TEACHER_CONTEXT_CHANGED');
    for(const t of identity.tables){if(t.category==='teacher'&&expected.length&&!expected.includes(t.text.split('\t')[1]))fail('TEACHER_CONTEXT_CHANGED');if(t.category==='school'){const name=t.text.split('\t')[1];if(runContext.schoolName&&name!==runContext.schoolName||schools.some(n=>n!==name))fail('SCHOOL_CONTEXT_CHANGED');if(!schools.includes(name))schools.push(name);}}
    // AI: classify only absent optional response proof, after every explicit
    // school/teacher/SchoolId check, including the established metadata reader.
    // No timetable is parsed or admitted without its own matching school.
    if(kind==='timetable'){
     const proof=schools.length===0?readSourceReportPage('lesson-school-proof',runContext,{document:doc,url:u.href}):{ok:true,bound:false};
     if(!proof.ok)fail(proof.code);
     if(!runContext.schoolName||schools.length!==1&&!proof.bound)fail('SCHOOL_CONTEXT_UNCONFIRMED',runContext.schoolName&&schools.length===0?'response-school-absent':null);
    }
    let value=kind==='metadata'?identity:kind==='timetable'?readSourceReportPage(kind,runContext,{document:doc,url:u.href}):globalThis.rakeezSetupPageReader?.(kind,runContext,{document:doc,url:u.href});
    if(!value)fail('SETUP_READER_UNAVAILABLE');
    if(!value.ok){if(['SOURCE_PENDING','EMPTY_SOURCE','UNSUPPORTED_SOURCE_SCHEMA',...(kind==='timetable'?['UNRESOLVED_DAY_HEADER','UNRESOLVED_PERIOD_HEADERS','UNRESOLVED_WEEKDAY','AMBIGUOUS_PERIOD','UNRESOLVED_TIMETABLE']:[])].includes(value.code))return {ok:true,tables:[],links:[],warnings:[{category:kind,code:'SETUP_FIELDS_UNAVAILABLE'}],skipped:[]};fail(value.code);}
    const accepted=kind==='metadata'?['teacher','school','principal','department']:[kind];
    value={...value,runContext:null,links:[],skipped:[],tables:value.tables.filter(t=>accepted.includes(t.category))};
    for(const t of value.tables){if(t.category==='teacher'&&expected.length&&!expected.includes(t.text.split('\t')[1]))fail('TEACHER_CONTEXT_CHANGED');if(t.category==='school'&&runContext.schoolName&&t.text.split('\t')[1]!==runContext.schoolName)fail('SCHOOL_CONTEXT_CHANGED');}
    if(!value.tables.length)value.warnings.push({category:kind,code:'SETUP_FIELDS_UNAVAILABLE'});
    check();return {...value,schoolNames:schools};
   }
   const value=readSourceReportPage('students',runContext,{document:doc,url:u.href});
   if(menu&&!value.ok&&value.code==='ROSTER_LINKS_PENDING'&&value.diagnostic?.roster?.cause==='MAIN_FRAME_READ_LINK_ABSENT')return {ok:true,tables:[],links:[],warnings:[{category:'students',code:'ROSTER_LINKS_UNAVAILABLE',optional:true}],skipped:[],pagination:null,schoolNames:schools};
   if(!value.ok)fail(value.code==='INVALID_SCHOOL_FIELD'?'SCHOOL_CONTEXT_UNCONFIRMED':value.code==='AMBIGUOUS_SCHOOL_COLUMN'?'SCHOOL_CONTEXT_CHANGED':value.code);
   const allSchools=[...new Set([...schools,...value.schoolNames??[]])];
   if(allSchools.length>1||runContext.schoolName&&allSchools.some(n=>n!==runContext.schoolName))fail('SCHOOL_CONTEXT_CHANGED');
   return {...value,schoolNames:allSchools,links:value.links.map(l=>({...l,readEvidence:'validated-response'}))};
  }catch(e){return {ok:false,code:controller.signal.aborted?'FETCH_CANCELLED_OR_TIMEOUT':(/^[A-Z_]+$/.test(e.message)?e.message:'REPORT_FETCH_FAILED'),incomplete:true,...(e.setupRejectReason?{setupKind:e.setupKind,setupRejectReason:e.setupRejectReason}:{})};}
  finally{clearTimeout(timer);controllers.delete(runContext.requestId);}
 })();
 const document=source?.document??globalThis.document,location=source?new URL(source.url):globalThis.location;
 // AI: fresh caches for each synchronous parser/guard invocation, including
 // inert HTML. Never share visibility or derived text across an await or read.
 const ancestry=new WeakMap(),visibility=new WeakMap(),rawText=new WeakMap(),texts=new WeakMap();
 const visible=n=>{
  if(visibility.has(n))return visibility.get(n);
  const path=[];let el=n;
  while(el&&!ancestry.has(el)){path.push(el);el=el.parentElement;}
  let shown=el?ancestry.get(el):true;
  for(const node of path.reverse()){
   if(shown){const s=source?node.style:getComputedStyle(node);shown=!(node.matches('[inert],.hidden,.d-none,.sr-only,[style*=\"display:none\"],[style*=\"display: none\"]')||node.hidden||node.getAttribute('aria-hidden')==='true'||s.display==='none'||(source?s.visibility==='hidden':s.visibility!=='visible')||(s.opacity!==''&&Number(s.opacity)===0));}
   ancestry.set(node,shown);
  }
  const result=shown&&(source?true:n.getClientRects().length>0);visibility.set(n,result);return result;
 };
 const raw=x=>{
  if(rawText.has(x))return rawText.get(x);
  let value='';if(x.nodeType===3)value=x.textContent;
  else if(x.nodeType===1&&visible(x)&&!['INPUT','TEXTAREA','SELECT','SCRIPT','STYLE','IFRAME','SVG','IMG'].includes(x.tagName))for(const c of x.childNodes)value+=raw(c);
  rawText.set(x,value);return value;
 };
 const text=n=>{if(!texts.has(n))texts.set(n,raw(n).trim().replace(/\s+/g,' '));return texts.get(n);};
 // AI: inert ManageLecture evidence only, never a route to fetch/click. Require
 // a complete tuple on each anchor inside one explicitly headed timetable cell.
 const lessonLink=a=>{
  if(!visible(a)||a.closest('nav,header,footer,form,[disabled],[aria-disabled=true],.disabled')||a.hasAttribute('download')||a.getAttributeNames().some(k=>/^on/i.test(k))||a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get')throw Error('UNSAFE_LESSON_LINK');
  let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{throw Error('UNSAFE_LESSON_LINK');}
  if(u.origin!==location.origin||u.username||u.password||u.hash||u.pathname!=='/SchoolSchedule/Schedule/ManageLecture')throw Error('UNSAFE_LESSON_LINK');
  const values={},allowed=['SchoolId','lectureId','dateTicks','subjectId','classroomId'];
  for(const [k,v] of u.searchParams){if(!allowed.includes(k)||Object.hasOwn(values,k))throw Error('UNSAFE_LESSON_LINK');values[k]=v;}
  if(Object.keys(values).length!==5||!/^[a-f0-9]{32}$/i.test(values.SchoolId)||!['lectureId','subjectId','classroomId'].every(k=>/^[1-9][0-9]{0,9}$/.test(values[k]))||! /^[1-9][0-9]{0,18}$/.test(values.dateTicks))throw Error('UNSAFE_LESSON_LINK');
  if(values.SchoolId.toLowerCase()!==runContext?.schoolId?.toLowerCase())throw Error('SCHOOL_CONTEXT_CHANGED');
  return JSON.stringify(allowed.map(k=>k==='SchoolId'?values[k].toLowerCase():values[k]));
 };
 const pairedLesson=cell=>{
  const anchors=Array.from(cell.querySelectorAll('a[href]'));
  if(anchors.length!==2||anchors.some(a=>a.querySelector('a,input,button,script,style,iframe,svg,img')))throw Error('AMBIGUOUS_LESSON_LINKS');
  const tuples=anchors.map(lessonLink);if(tuples[0]!==tuples[1])throw Error('AMBIGUOUS_LESSON_LINKS');
  // Supplied shape: subject then classroom, paired by their shared cell + tuple.
  // No classification of arbitrary adjacent links or inference from label spelling.
  const subject=text(anchors[0]),classroom=text(anchors[1]);
  if(!subject||!classroom||text(cell).replace(/\s/g,'')!==(subject+classroom).replace(/\s/g,''))throw Error('AMBIGUOUS_LESSON_LINKS');
  return {subject,classroom};
 };
 // AI: rendered transport is a separate, worker-owned checkpoint chain. It
 // never lends computed visibility to an inert GET response. Rows are held by
 // the worker until the canonical home teacher proof is obtained again.
 if(mode==='rendered-timetable'){
  const fail=code=>({ok:false,code});
  if(source||!runContext?.readProof||runContext.schoolBinding!=='bound'||!runContext.schoolName||location.href!==runContext.expectedScheduleURL)return fail('SOURCE_CONTEXT_CHANGED');
  let home,expected;try{home=new URL(runContext.sourceURL);expected=JSON.parse(runContext.readProof);}catch{return fail('TEACHER_CONTEXT_CHANGED');}
  const schedule=new URL(location.href);
  if(home.origin!==schedule.origin||schedule.pathname!=='/SchoolSchedule/Schedule/TeacherSchedule'||schedule.hash||[...schedule.searchParams].length!==1||schedule.searchParams.get('SchoolId')?.toLowerCase()!==runContext.schoolId?.toLowerCase())return fail('SCHOOL_CONTEXT_CHANGED');
  if(document.querySelector('base[href]'))return fail('UNSAFE_SETUP_LINK');
  const guard=readSourceReportPage('guard');if(!guard.ok)return guard;
  if(document.readyState!=='complete'||Array.from(document.querySelectorAll('[aria-busy=true],[role=progressbar]')).some(visible))return {ok:false,code:'SOURCE_PENDING',retry:true};
  const field=n=>n&&visible(n)&&!n.querySelector('script,style,iframe,input,table,a,button')?text(n):'';
  const labels=Array.from(document.querySelectorAll('p,span,small,div,b,strong,label,dt')).map(field);
  const schools=[...new Set([...Array.from(document.querySelectorAll('.school-name')).map(field),...labels.flatMap(v=>/^اسم المدرسة: .{2,80}$/.test(v)?[v.slice(13)]:[]),...Array.from(document.querySelectorAll('dt,p,span,label,th,td')).flatMap(n=>{if(!['اسم المدرسة','اسم المدرسة:'].includes(field(n)))return [];if(['TH','TD'].includes(n.tagName)&&!(n.parentElement?.tagName==='TR'&&n.parentElement.cells.length===2&&n.parentElement.cells[0]===n&&n.nextElementSibling?.tagName==='TD'))return [];return [field(n.nextElementSibling)];})].filter(Boolean))];
  if(schools.some(v=>v!==runContext.schoolName))return fail('SCHOOL_CONTEXT_CHANGED');
  const teachers=[...labels.flatMap(v=>/^اسم المعلم(?:ة)?: .{2,80}$/.test(v)?[v.replace(/^اسم المعلم(?:ة)?: /,'')]:[]),...Array.from(document.querySelectorAll('dt,p,span,label,th,td')).flatMap(n=>{if(!/^اسم المعلم(?:ة)?:?$/.test(field(n)))return [];if(['TH','TD'].includes(n.tagName)&&!(n.parentElement?.tagName==='TR'&&n.parentElement.cells.length===2&&n.parentElement.cells[0]===n&&n.nextElementSibling?.tagName==='TD'))return [];return [field(n.nextElementSibling)].filter(Boolean);})];
  if(teachers.some(v=>!Array.isArray(expected.teacher)||!expected.teacher.includes(v)))return fail('TEACHER_CONTEXT_CHANGED');
  for(const a of document.querySelectorAll('a[href]')){let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{return fail('UNSAFE_LESSON_LINK');}for(const [k,v] of u.searchParams)if(k.toLowerCase()==='schoolid'&&v.toLowerCase()!==runContext.schoolId.toLowerCase())return fail('SCHOOL_CONTEXT_CHANGED');}
  const proof=readSourceReportPage('lesson-school-proof',runContext);if(!proof.ok)return proof;if(!proof.bound)return fail('SCHOOL_CONTEXT_UNCONFIRMED');
  const parsed=readSourceReportPage('timetable',runContext);if(!parsed.ok)return parsed;
  return {...parsed,runContext:null,links:[],skipped:[],tables:parsed.tables.filter(t=>t.category==='timetable')};
 }
 if(mode==='lesson-school-proof'){
  let bound=false;const identities=new Map();
  const bind=(tuple,lesson)=>{
   const ids=JSON.parse(tuple);
   for(const [kind,id,label] of [['subject',ids[3],lesson.subject],['classroom',ids[4],lesson.classroom]]){
    // AI: Madrasati may assign different subject IDs to the same subject name
    // in different classrooms. Keep ID->label global; bind the reverse subject
    // relation within its explicit classroom tuple, never by name alone.
    const labelScope=kind==='subject'?'|classroom:'+ids[4]:'';
    for(const [key,value] of [[kind+'-id:'+id,label],[kind+'-label:'+label+labelScope,id]]){
     if(identities.has(key)&&identities.get(key)!==value)throw Error('AMBIGUOUS_LESSON_LINKS');identities.set(key,value);
    }
   }
  };
  // An inert response cannot prove stylesheet-defined visibility. Keep the old
  // explicit school-label requirement in that case rather than apply remote CSS.
  if(document.querySelector('base[href]')||source&&document.querySelector('style,link[rel=stylesheet]'))return {ok:true,bound:false};
  try{for(const table of document.querySelectorAll('table')){
   if(!visible(table)||table.closest('nav,header,footer,form')||table.parentElement?.closest('table')||table.querySelector('table'))continue;
   const rows=Array.from(table.rows),head=rows[0];if(!head)continue;
   const titles=Array.from(head.cells).map(text);
   if(!['','اليوم'].includes(titles[0])||!titles.slice(1).some(v=>v.startsWith('الحصة ')))continue;
   for(const row of rows.slice(1))for(const cell of Array.from(row.cells).slice(1)){
    const anchors=Array.from(cell.querySelectorAll('a[href]'));if(!anchors.length)continue;
    const cards=cell.querySelectorAll('.schedule-card');
    if(cards.length===1&&anchors.length===1&&cards[0].parentElement===anchors[0]){
     const titles=cards[0].querySelectorAll(':scope > .title > h2'),classes=cards[0].querySelectorAll(':scope > small');
     if(titles.length!==1||classes.length!==1||!visible(titles[0])||!visible(classes[0]))throw Error('AMBIGUOUS_LESSON_LINKS');
     bind(lessonLink(anchors[0]),{subject:text(titles[0]),classroom:text(classes[0])});
    }else bind(lessonLink(anchors[0]),pairedLesson(cell));
    bound=true;
   }
  }}catch(e){return {ok:false,code:e.message};}
  return {ok:true,bound};
 }
 // Negative active-role guard complements the existing origin/school/session guard, including at export.
 // Role badges only: a principal's metadata name never establishes the current user's role.
 if(mode==='guard'){
  if(document.querySelector('input[type=password],form[action*="Login" i],meta[http-equiv=refresh i]')||Array.from(document.querySelectorAll('h1,h2,[role=heading]')).filter(visible).some(n=>['تسجيل الدخول','انتهت الجلسة','رمز التحقق','تم تعطيل الحساب','تم حذف الحساب','الحساب غير نشط','Sign in','Login'].includes(text(n))))return {ok:false,code:'LOGIN_OR_LOGOUT'};
  const nonTeacher=new Set(['مدير المدرسة','قائد المدرسة','مديرة المدرسة','قائدة المدرسة','مسؤول النظام','المشرف','الإداري','المدير','ولي الأمر','ولي أمر','الطالب','الطالبة']);
  const active=Array.from(document.querySelectorAll('[aria-current]:not([aria-current=false]),[aria-selected=true],option:checked,[role=status],[data-role]')).filter(visible).map(n=>text(n).replace(/^الدور\s*:?\s*/,''));
  const labelled=Array.from(document.querySelectorAll('p,span,small,div,b,strong,label')).filter(n=>visible(n)&&!n.querySelector('table')).map(text).filter(v=>/^الدور\s*:?\s*/.test(v)).map(v=>v.replace(/^الدور\s*:?\s*/,''));
  return active.concat(labelled).some(v=>nonTeacher.has(v))?{ok:false,code:'NON_TEACHER_ROLE'}:{ok:true};
 }
 const all=Array.from(document.querySelectorAll('table')).filter(visible);
 const diagnostic=(code,ready=false)=>({ok:false,code,retry:ready,incomplete:true,diagnostic:{version:'0.5.1',stage:'source-schema',reason:code,category:mode,schema:{tables:Math.min(all.length,31),expectedCategory:false,unresolved:true}}});
 // A loading/empty table is unresolved, never an empty complete roster.
 const pending=()=>{const d=diagnostic('SOURCE_PENDING',true);if(mode==='students')d.diagnostic.roster={relevant:0,unsupported:0,iframes:Math.min(document.querySelectorAll('iframe').length,31),cause:'TABLE_AWAITING_DATA'};return d;};
 if(all.length>30)return diagnostic('TABLE_LIMIT');
 if(Array.from(document.querySelectorAll('[aria-busy=true],.loading,[role=progressbar]')).some(visible))return pending();
 const rosterLabels=new Set(['بيانات الطلاب','قائمة الطلاب','أسماء الطلاب','طلاب الفصل','قائمة طلاب الفصل','كشف الطلاب']);
 const visibleRoster=all.some(t=>Array.from(t.querySelectorAll('th')).filter(visible).some(n=>['اسم الطالب','اسم الطالبة','اسم الطالب/ة'].includes(text(n)))&&Array.from((t.closest('section,article,.report')??t).querySelectorAll('caption,h1,h2,h3')).filter(visible).some(n=>rosterLabels.has(text(n))));
 if(mode==='students'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(location.pathname)){
  try{globalThis.rakeezRoutePolicy(location.origin,location.href,runContext);}catch(e){return {ok:false,code:e.message};}
  let relevant=0,unsupported=0;
  const links=[];for(const a of Array.from(document.querySelectorAll('a[href]')).filter(visible)){
   if(!rosterLabels.has(text(a)))continue;relevant++;
   // Unknown relevant links are counted, never followed or exposed.
   try{const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&!/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(u.pathname)&&!/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(u.pathname)){unsupported++;continue;}}catch{}
   if(a.getAttributeNames().some(k=>/^on/i.test(k))||a.closest('form,[inert],[disabled],[aria-disabled=true],.disabled')||a.hasAttribute('download')||a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get')return diagnostic('UNSAFE_ROSTER_LINK');
   let u;try{u=new URL(a.getAttribute('href'),location.href);globalThis.rakeezRoutePolicy(location.origin,u.href,runContext);}catch(e){return {ok:false,code:e.message,diagnostic:globalThis.rakeezRouteDiagnostic('link-discovery',e.message,'students',u?.href??a.getAttribute('href'),e.routeDetail)};}
   // A validated menu/self GET is not a roster and is never navigated from this discovery phase.
   if(!/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(u.pathname))continue;
   const path=u.pathname+u.search;if(!links.some(l=>l.path===path))links.push({kind:'students',path});
  }
  if(unsupported)return diagnostic('UNSAFE_ROSTER_LINK');
  if(!visibleRoster){
  if(!links.length){const d=diagnostic('ROSTER_LINKS_PENDING',true);d.diagnostic.roster={relevant:Math.min(relevant,200),unsupported:Math.min(unsupported,200),iframes:Math.min(document.querySelectorAll('iframe').length,31),cause:unsupported?'RELEVANT_LINK_UNSUPPORTED':'MAIN_FRAME_READ_LINK_ABSENT'};return d;}if(links.length>20)return diagnostic('REPORT_LIMIT');
  return {ok:true,tables:[],links,warnings:[],skipped:[],pagination:null,schoolNames:[]};
  }
 }
 const field=v=>v.length>0&&v.length<=80&&!/[\t\r\n@]/.test(v);
 const names=new Set(['اسم الطالب','اسم الطالبة','اسم الطالب/ة']),classes=new Set(['الفصل','الصف والفصل']);
 const days=new Set(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']);
 const candidates=[];
 for(const table of all){
  if(table.parentElement?.closest('table')||table.querySelector('table'))continue;
  const rows=Array.from(table.rows).filter(visible);if(mode!=='students'&&rows.length>301)return diagnostic('ROW_LIMIT');if(rows.length<2)continue;
  const head=Array.from(rows[0].cells);if(head.length>50||!head.every(visible))continue;
  const titles=head.map(text),find=set=>titles.flatMap((v,i)=>set.has(v)?[i]:[]);
  if(source&&mode==='students'&&(head.length!==9||!titles.includes('حالة الطالب')||!titles.some(t=>['المدرسة','اسم المدرسة'].includes(t))))continue;
  if(mode==='students'){
   const ni=find(names),ci=find(classes),si=find(new Set(['المدرسة','اسم المدرسة'])),schoolNames=[];if(si.length>1)return diagnostic('AMBIGUOUS_SCHOOL_COLUMN');if(!ni.length){if(table.querySelector('td.project-title'))return diagnostic('UNRESOLVED_SOURCE_HEADERS');continue;}if(ni.length!==1||ci.length>1)return diagnostic('AMBIGUOUS_HEADER');
   let context='';if(!ci.length){const scope=table.closest('section,article,.report')??table;const values=Array.from(scope.querySelectorAll('caption,h1,h2,h3')).filter(visible).map(text).filter(v=>/^الفصل: .{2,80}$/.test(v)).map(v=>v.slice(7));if(new Set(values).size!==1)return diagnostic('UNRESOLVED_CLASSROOM');context=values[0];}
   const output=['اسم الطالب\tالفصل'];let excluded=0;const offset=runContext?.rowOffset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>=rows.length-1)return diagnostic('ROW_OFFSET');
   for(const row of rows.slice(1+offset,1+offset+300)){
    const cells=Array.from(row.cells);if(cells.length!==head.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1)){excluded++;continue;}
    const nameCell=cells[ni[0]],classCell=ci.length?cells[ci[0]]:null;
    if(!visible(nameCell)||classCell&&!visible(classCell)){excluded++;continue;}
    const name=text(nameCell),classroom=classCell?text(classCell):context;
    if(name.length<2||classroom.length<2||!field(name)||!field(classroom)||!/[\p{L}]/u.test(classroom)||!/^([\p{L}\p{M}]+)( [\p{L}\p{M}]+)*$/u.test(name)||!/^([\p{L}\p{M}0-9 ()-]+)$/u.test(classroom)){excluded++;continue;}
    if(si.length){const cell=cells[si[0]];if(!visible(cell)||!field(text(cell)))return diagnostic('INVALID_SCHOOL_FIELD');schoolNames.push(text(cell));}
    output.push(name+'\t'+classroom);
   }
   const unique=[...new Set(output)];if(unique.length<2&&rows.length<=offset+301)return {...diagnostic('NO_VALID_SOURCE_ROWS'),observedRows:rows.length-1};
   if(new Set(schoolNames).size>1)return {ok:false,code:'SCHOOL_CONTEXT_CHANGED'};
   candidates.push({table,text:unique.join('\n'),duplicates:output.length-unique.length,excluded,rowContinuation:offset+300<rows.length-1?offset+300:null,schoolNames:[...new Set(schoolNames)]});
  }else if(mode==='timetable'){
   const output=['اليوم\tالحصة\tالفصل\tالمادة'];
   const ordinals=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة'];
   const periodFor=title=>{const m=/^الحصة (.+)$/.exec(title);if(!m)return null;const token=m[1].replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));if(/^(?:[1-9]|1[0-9]|20)$/.test(token))return token;const i=ordinals.indexOf(token);return i<0?null:String(i+1);};
   if((titles.includes('الحصة')||titles.includes('الوقت'))&&titles.includes('الفصل')&&titles.includes('المادة')&&titles.includes('اليوم')){
    if(new Set(titles).size!==titles.length||head.some(c=>c.colSpan!==1||c.rowSpan!==1))return diagnostic('AMBIGUOUS_HEADER');
    const labels=['اليوم',...(titles.includes('الحصة')?['الحصة']:[]),...(titles.includes('الوقت')?['الوقت']:[]),'الفصل','المادة'];output[0]=labels.join('\t');
    for(const row of rows.slice(1)){const cells=Array.from(row.cells);if(cells.length!==head.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1))return diagnostic('IRREGULAR_TABLE');const values=labels.map(l=>text(cells[titles.indexOf(l)]));if(!values.every(field)||!days.has(values[0]))return diagnostic('UNRESOLVED_TIMETABLE');output.push(values.join('\t'));}
   }else if(titles.length>1&&titles.slice(1).some(v=>v.startsWith('الحصة '))){
    if(!['','اليوم'].includes(titles[0]))return diagnostic('UNRESOLVED_DAY_HEADER');
    const periods=titles.slice(1).map(periodFor);if(periods.some(v=>v===null))return diagnostic('UNRESOLVED_PERIOD_HEADERS');
    if(head.some(c=>c.colSpan!==1||c.rowSpan!==1)||new Set(periods).size!==periods.length)return diagnostic('AMBIGUOUS_PERIOD');
    // A blank corner is meaningful only with known weekday rows and explicit unique period headers.
    if(rows.slice(1).some(row=>!row.cells.length||!visible(row.cells[0])||!days.has(text(row.cells[0]))))return diagnostic('UNRESOLVED_WEEKDAY');
    for(const row of rows.slice(1)){
     const cells=Array.from(row.cells);if(!cells.length||!days.has(text(cells[0]))||cells[0].colSpan!==1||cells.some(c=>c.rowSpan!==1))return diagnostic('UNRESOLVED_WEEKDAY');
     const weekday=text(cells[0]);let column=1;
     for(const cell of cells.slice(1)){
      const span=cell.colSpan;if(span<1||span>20||column+span>head.length||!visible(cell))return diagnostic('UNSAFE_COLSPAN');
      const cards=Array.from(cell.querySelectorAll('.schedule-card')).filter(visible);
      if(!text(cell)&&!cards.length){column+=span;continue;} // Empty visible slots stay empty.
      let classroom,subject;
      if(cards.length){
       if(cards.length!==1)return diagnostic('AMBIGUOUS_LESSON_CARDS');
       const card=cards[0];if(card.parentElement?.tagName!=='A')return diagnostic('UNRESOLVED_LESSON_CARD');
       // Read data nodes only. The preparation anchor, done class and decorative icon are never used.
       const titleNodes=Array.from(card.querySelectorAll(':scope > .title > h2')).filter(visible),classNodes=Array.from(card.querySelectorAll(':scope > small')).filter(visible);
       if(titleNodes.length!==1)return diagnostic('AMBIGUOUS_LESSON_SUBJECT');if(classNodes.length!==1)return diagnostic('AMBIGUOUS_LESSON_CLASS');
       subject=text(titleNodes[0]);classroom=text(classNodes[0]);
      }else if(cell.querySelector('a[href]')){
       try{({classroom,subject}=pairedLesson(cell));}catch(e){return diagnostic(e.message);}
      }else{
       const lines=Array.from(cell.querySelectorAll('p,div,span')).filter(visible).map(text);
       const labelled=label=>[...new Set(lines.filter(v=>v.startsWith(label+': ')).map(v=>v.slice(label.length+2)))];
       const classes=labelled('الفصل'),subjects=labelled('المادة');if(classes.length!==1||subjects.length!==1)return diagnostic('UNRESOLVED_LESSON_LABELS');
       classroom=classes[0];subject=subjects[0];
      }
      if(!field(classroom)||!field(subject))return diagnostic('INVALID_LESSON_FIELD');
      for(let k=0;k<span;k++)output.push([weekday,periods[column+k-1],classroom,subject].join('\t'));
      column+=span;
     }
     if(column!==head.length)return diagnostic('IRREGULAR_TABLE');
    }
   }else continue;
   if(output.length<2)return diagnostic('EMPTY_SOURCE',true);candidates.push({table,text:[...new Set(output)].join('\n'),duplicates:output.length-new Set(output).size});
  }
 }
 if(candidates.length>1)return diagnostic('AMBIGUOUS_TABLE');
 if(!candidates.length)return pending();
 const {table,text:tsv,duplicates,excluded=0,rowContinuation=null,schoolNames=[]}=candidates[0],links=[],warnings=[];
 // Fixed structural allowlist only: no source strings, hrefs or row data.
 const pagerEvidence={pagerCount:0,currentPage:null,endpointKind:'none',disabledNext:false,terminalEvidence:'unproven'};
 const pagerDiagnostic=reason=>({stage:'report-pagination',reason,category:'students',pager:{...pagerEvidence}});
 const coverageError=code=>({ok:true,tables:tsv.includes('\n')?[{category:mode,text:tsv}]:[],links:[],warnings:[{category:mode,code}],skipped:[],pagination:null,diagnostic:pagerDiagnostic(code),duplicates,excluded,rowContinuation,schoolNames});
 let pagination=null;
 if(mode==='students'){
  const digits=v=>v.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const number=v=>/^[0-9]{1,15}$/.test(digits(v))?Number(digits(v)):null;
  const now=new URL(location.href),pkeys=['page','pagenumber'];
  const pageOf=u=>{const entries=[...u.searchParams].filter(([k])=>pkeys.includes(k.toLowerCase()));return entries.length===1?number(entries[0][1]):entries.length?NaN:null;};
  const stable=u=>JSON.stringify([...u.searchParams].filter(([k])=>!pkeys.includes(k.toLowerCase())).sort());
  const hrefs=Array.from(document.querySelectorAll('a[href]')).filter(visible);
  const isPage=a=>{try{const u=new URL(a.getAttribute('href'),location.href);if(u.pathname===now.pathname&&pageOf(u)!==null)return true;}catch{}return number(text(a))!==null||a.rel.split(/\s+/).some(r=>['next','last'].includes(r))||['التالي','الصفحة التالية'].includes(text(a));};
  const scopes=new Set(Array.from(document.querySelectorAll('.pagination,[aria-label="Pagination"],[aria-label="ترقيم الصفحات"]')).filter(visible).filter(n=>n.querySelector('[aria-current=page],.active,[role=status]')||Array.from(n.querySelectorAll('a[href]')).some(isPage)));
  // Neutral adjacent controls require a real same-report page href plus active/next/status evidence.
  // A generic nav or an unrelated numeric anchor is never pagination by its label alone.
  for(const a of hrefs){let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}
   if(u.pathname!==now.pathname||pageOf(u)===null||[...scopes].some(n=>n.contains(a)))continue;
   for(let n=a.parentElement,depth=0;n&&n!==document.body&&depth<4;n=n.parentElement,depth++)if(n.querySelector('[aria-current=page],[role=status],a[rel~=next],a[rel~=last]')){scopes.add(n);break;}
  }
  const pagers=[...scopes].filter(n=>![...scopes].some(c=>c!==n&&n.contains(c)));
  pagerEvidence.pagerCount=Math.min(pagers.length,5);
  if(pagers.length>4)return coverageError('AMBIGUOUS_PAGINATION');
  const models=[];
  for(const pager of pagers){
   const nodes=Array.from(pager.querySelectorAll('*')).filter(visible);if(nodes.length>150)return coverageError('PAGINATION_LIMIT');
   const active=[...new Set(nodes.filter(n=>n.matches('[aria-current=page],.active')).flatMap(n=>{
    if(n.matches('li.page-item.active')){const child=Array.from(n.children).filter(c=>c.matches('a.page-link,span.page-link')&&visible(c));return child.length===1?[number(text(child[0]))]:[null];}
    return [number(text(n))];
   }).filter(n=>n!==null))];
   // Observed Bootstrap endpoint ownership: first disabled arrow is Previous, final is Next.
   const items=Array.from(pager.children),observed=pager.matches('ul.pagination')&&items.length>=3&&items.every(n=>n.matches('li.page-item'))&&items[0].querySelector('svg')&&items.at(-1).querySelector('svg');
   const last=observed?items.at(-1):null;
   const controls=last?Array.from(last.children).filter(n=>n.matches('a.page-link,span.page-link')&&visible(n)):[];
   const lastAnchor=controls.length===1?controls[0]:null;
   const explicitNext=n=>n.rel?.split(/\s+/).includes('next')||['التالي','الصفحة التالية','Next','next'].includes(n.getAttribute('aria-label'))||['التالي','الصفحة التالية'].includes(text(n));
   pagerEvidence.endpointKind=lastAnchor?(lastAnchor.tagName==='A'?'anchor':'span'):observed?'ambiguous':'none';
   const statuses=[...new Set(nodes.map(text).map(digits).filter(v=>/^الصفحة \d+ من \d+$/.test(v)))];
   const status=statuses.length===1?/^الصفحة (\d+) من (\d+)$/.exec(statuses[0]):null;
   const totals=[...new Set([...(status?[Number(status[2])]:[]),...nodes.concat(pager).filter(n=>n.hasAttribute('data-total-pages')).map(n=>number(n.getAttribute('data-total-pages')))])];
   if(statuses.length>1||active.length>1||totals.some(n=>n===null))return coverageError('AMBIGUOUS_PAGINATION');
   const current=active[0]??(status?Number(status[1]):pageOf(now));
   if(!current||current<1||!Number.isSafeInteger(current)||pageOf(now)!==null&&pageOf(now)!==current)return coverageError('PAGINATION_MISMATCH');
   pagerEvidence.currentPage=current<=1000000?current:null;
   const actual=[],numbers=new Set([current]);let terminal=false;
   for(const n of nodes){
    const disabled=n.matches('[disabled],[aria-disabled=true],.disabled')||n.closest('[aria-disabled=true],.disabled');
    const observedNext=observed&&n===lastAnchor&&n.tagName==='A';
    const next=observedNext||explicitNext(n);
    if(next&&n.matches('a,span,button')&&pagerEvidence.endpointKind==='none')pagerEvidence.endpointKind=n.tagName==='A'?'anchor':n.tagName==='SPAN'?'span':'other';
    if(disabled&&next){terminal=true;pagerEvidence.disabledNext=true;pagerEvidence.terminalEvidence=observedNext?'observed-anchor':'explicit-next';}
    if(n.tagName!=='A'||!n.hasAttribute('href')||!isPage(n)||disabled)continue;
    let u;try{u=new URL(n.getAttribute('href'),location.href);}catch{return coverageError('UNSAFE_PAGINATION');}
    if(u.origin!==now.origin||u.username||u.password)return coverageError('UNSAFE_PAGINATION');
    if(n.closest('form')||n.hasAttribute('download')||n.getAttribute('data-method')&&n.getAttribute('data-method').toLowerCase()!=='get'||u.pathname!==now.pathname||/(?:delete|grade|admin|edit|attendance|changeusertype)/i.test(u.pathname))return coverageError('UNSAFE_PAGINATION');
    const keys=new Set();for(const [key,value] of u.searchParams){if(keys.has(key.toLowerCase())||!/^(?:page|pagenumber|classid|sectionid|id)$/i.test(key)||! /^[A-Za-z0-9_-]{1,80}$/.test(value))return coverageError('UNSAFE_PAGINATION');keys.add(key.toLowerCase());}
    const page=pageOf(u);
    if(!page||stable(u)!==stable(now))return coverageError('PAGINATION_MISMATCH');
    const label=number(text(n));if(label!==null&&label!==page||next&&page!==current+1)return coverageError('PAGINATION_MISMATCH');
    numbers.add(page);if(n.rel.split(/\s+/).includes('last'))totals.push(page);
    actual.push({page,path:u.pathname+u.search});
   }
   const distinctTotals=[...new Set(totals)];if(distinctTotals.length>1)return coverageError('PAGINATION_MISMATCH');
   const total=distinctTotals[0]??(terminal?current:null);
   if(total!==null&&!Number.isSafeInteger(total))return coverageError('PAGINATION_MISMATCH');
   if(total!==null&&(total<current||[...numbers].some(n=>n>total)))return coverageError('PAGINATION_MISMATCH');
   if(terminal&&total!==current)return coverageError('PAGINATION_MISMATCH');
   const next=[...new Set(actual.filter(a=>a.page===current+1).map(a=>a.path))];
   // Every candidate here has the same validated report/filter/page semantics. Retain an existing href.

   // Unknown end is not success: carry the series until an explicit terminal proves its end.
   const model={current,total,next:next[0]??null,terminal,numbers:[...numbers].sort((a,b)=>a-b),actual:[...new Set(actual.map(a=>a.path))].sort()};
   models.push(model);
  }
  if(models.length){
   const currents=new Set(models.map(m=>m.current)),totals=new Set(models.map(m=>m.total).filter(n=>n!==null));
   if(currents.size!==1||totals.size>1)return coverageError('AMBIGUOUS_PAGINATION');
   const nexts=models.flatMap(m=>m.next?[m.next]:[]),nextIdentities=new Set(nexts.map(p=>{const u=new URL(p,location.href);return u.pathname+'?'+stable(u)+'#'+pageOf(u);}));
   if(nextIdentities.size>1)return coverageError('AMBIGUOUS_PAGINATION');
   const current=[...currents][0],total=totals.size?[...totals][0]:null,terminal=models.some(m=>m.terminal),numbers=new Set(models.flatMap(m=>m.numbers));
   if(terminal&&nexts.length||total!==null&&(total<current||[...numbers].some(n=>n>total))||terminal&&total!==current)return coverageError('AMBIGUOUS_PAGINATION');
   const m={current,total,terminal,next:nexts[0]??null};pagination={current,total,terminal,series:now.pathname+'?'+stable(now)};

   if(m.total===m.current){if(!m.terminal)warnings.push({category:mode,code:'PAGINATION_TERMINAL_UNVERIFIED'});if(m.next)warnings.push({category:mode,code:'PAGINATION_AFTER_END'});}
   else if(!m.next)warnings.push({category:mode,code:'PAGINATION_MISSING_NEXT'});
   else links.push({kind:mode,path:m.next,pagination:true});
   // Preserve only actual validated hrefs, sorted by page identity (never manufacture missing URLs).
   for(const path of [...new Set(models.flatMap(m=>m.actual))].sort((a,b)=>pageOf(new URL(a,location.href))-pageOf(new URL(b,location.href))))if(!links.some(l=>l.path===path))links.push({kind:mode,path,pagination:true});
  }else if(mode==='students')warnings.push({category:mode,code:'PAGINATION_UNVERIFIED'});
 }
 if(excluded)warnings.push({category:mode,code:'INVALID_ROWS_EXCLUDED'});
 if(rowContinuation!==null){links.length=0;pagination=null;}
 return {ok:true,tables:tsv.includes('\n')?[{category:mode,text:tsv}]:[],links,warnings,skipped:[],pagination,diagnostic:mode==='students'?pagerDiagnostic(warnings[0]?.code??'PAGINATION_PARSED'):null,duplicates,excluded,rowContinuation,schoolNames};
}
