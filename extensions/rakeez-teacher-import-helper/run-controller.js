import {readSourceReportPage} from './source-adapter.js';
import {readAutomaticTeacherPage,readSelectedNameColumn} from './selection.js';
import {reviewNames} from './core.js';
import {CATEGORIES,parseCategoryTable,validateCategory,bundle} from './categories.js';
import {RUN_LIMITS,startOrigin,safeRoute,mergePage} from './navigation.js';
import './route-diagnostics.js';
const $=id=>document.getElementById(id),runToken=new URL(location.href).searchParams.get('run');
const channel=new BroadcastChannel('rakeez-private-one-start');
let generation=0,job=null,review=null,reviewTimer=null,reviewClock=null,guardBusy=false,choiceReject=null;
const kindLabel=kind=>({start:'صفحة البداية',role:'دور المعلم',gateway:'مدخل المدرسة',metadata:'بيانات المعلم',classes:'الفصول',students:'أسماء الطلاب',timetable:'الجدول الأسبوعي'}[kind]??'الفئة');
const stageLabel=stage=>({'start-path':'مسار البداية','role-selection':'اختيار دور المعلم','auxiliary-link':'رابط اختياري','navigation-redirect':'التنقل أو التحويل','source-schema':'بنية صفحة البيانات','link-discovery':'اكتشاف روابط القراءة'}[stage]??'التحقق');
let diagnosticLines=[];
const entryText=e=>`pageKind=${e.pageKind} | readyState=${e.readyState} | sourceTabMatch=${(e.sourceTabMatch===true?'true':e.sourceTabMatch===false?'false':'unknown')} | roleMarkers=${e.roleMarkers} | schoolOptions=${e.schoolOptions} | navMarkers=${e.navMarkers} | actionMarkers=${e.actionMarkers} | safeReadLinks=${e.safeReadLinks} | iframeCount=${e.iframeCount}${e.linkStats?' | '+Object.entries(e.linkStats).map(([key,value])=>key+'='+value).join(' | '):''}`;
function showDiagnostic(d){
 if(!d)return;
 let line=d.run?`N36 ${chrome.runtime.getManifest().version} | stage=run-summary | staged=${d.run.staged} | observedRowsLowerBound=${d.run.observed} | complete=${d.run.complete} | committed=0 | excluded=${d.run.excluded||'none'}`:d.entry?`N36 ${chrome.runtime.getManifest().version} | stage=${d.stage} | reason=${d.reason} | ${entryText(d.entry)}`:d.schema?`N36 ${chrome.runtime.getManifest().version} | stage=source-schema | reason=${d.reason} | category=${d.category} | tables=${d.schema.tables} | expectedCategory=${d.schema.expectedCategory} | unresolved=${d.schema.unresolved}`:d.structure?`N36 ${chrome.runtime.getManifest().version} | stage=role-selection | reason=${d.reason} | teacherGreeting=${d.structure.teacherGreeting} | greetingAmbiguous=${d.structure.greetingAmbiguous} | safeTeacherReports=${d.structure.safeTeacherReports} | explicitRoleDestinations=${d.structure.explicitRoles} | explicitAmbiguous=${d.structure.explicitAmbiguous} | activeTeacher=${d.structure.activeTeacher} | dashboard=${d.structure.dashboard??false} | teacherCards=${d.structure.teacherCards??0} | gatewayRejected=${d.structure.gatewayRejected??0}`:`N36 ${chrome.runtime.getManifest().version} | stage=${d.stage} | reason=${d.reason} | category=${d.category}`;
 if(d.roster)line+=` | cause=${d.roster.cause} | relevant=${d.roster.relevant} | unsupported=${d.roster.unsupported} | iframeCount=${d.roster.iframes} | frameReport=unconfirmed`;
 if(d.sourceTabMatch===true)line+=' | sourceTabMatch=true';
 if(d.template)line+=` | route=${d.template} | queryKeys=${d.keys?.join(',')||'-'} | unknownKeys=${d.unknownKeys??0} | routeReason=${d.detail??'unexpected-path'}`;
 if(!diagnosticLines.includes(line)&&diagnosticLines.length<8)diagnosticLines.push(line);
 $('route-diagnostic').value=diagnosticLines.join('\n');$('route-diagnostic').hidden=false;$('copy-route-diagnostic').hidden=false;
 for(const related of d.related??[])showDiagnostic(related);
}
function routeError(e,stage,kind,path){if(!e.diagnostic&&['UNSAFE_ROUTE','UNSAFE_LINK','ORIGIN_CHANGED'].includes(e.message))e.diagnostic=globalThis.rakeezRouteDiagnostic(stage,e.message,kind,path);return e;}
channel.addEventListener('message',({data})=>{const active=job??review;if(data?.type==='probe'&&active?.tabId===data.tabId)channel.postMessage({type:'busy',token:data.token});});
function announce(text){$('run-status').textContent=text;}
function armReview(){
 const tick=()=>{$('review-remaining').textContent=review?`الوقت المتبقي للمعاينة: ${Math.max(0,Math.ceil((review.expires-Date.now())/1000))} ثانية (5 دقائق؛ النقل له مهلة مستقلة مدتها دقيقتان).`:'';};
 tick();reviewClock=setInterval(tick,1000);reviewTimer=setTimeout(()=>stop('REVIEW_EXPIRED'),Math.max(0,review.expires-Date.now()));
}
function clearPreview(){clearInterval(reviewClock);$('review-remaining').textContent='';window.dispatchEvent(new Event('n36:clear'));review=null;clearTimeout(reviewTimer);$('direct-handoff').hidden=true;}
function stop(code='CANCELLED',diagnostic=null,context=null){
 generation++;if(choiceReject){choiceReject(Error('CANCELLED'));choiceReject=null;}$('school-choices').replaceChildren();$('school-choices').hidden=true;if(job){clearTimeout(job.timer);job.routes.length=0;job.categories.length=0;job=null;}clearPreview();
 showDiagnostic(diagnostic);$('run-cancel').disabled=true;
 if(code==='REVIEW_EXPIRED'){$('run-counts').textContent='';$('run-missing').textContent='';$('run-skipped').textContent='';$('run-reopen').hidden=false;announce('انتهت مهلة معاينة البيانات ومسحت لحمايتك؛ لا توجد أسماء محفوظة. لبدء معاينة جديدة افتح تبويب المصدر ثم اضغط زر الإضافة طوعًا.');return;}
 announce(diagnostic?.stage==='link-discovery'&&code==='READ_LINKS_UNAVAILABLE'?`عُرفت معالم صفحة المعلم، لكن لم توجد روابط قراءة مسموحة (${code}). مُسحت المعاينة؛ انسخ التشخيص المحدود لاكتشاف الروابط، وليس طلب اختيار دور جديد.`:diagnostic?`توقف ${stageLabel(diagnostic.stage)} (${code}). لم تُجمع ${kindLabel(diagnostic.category)} ومُسحت المعاينة. انسخ التشخيص الآمن لتحديد ${diagnostic.structure?'بنية الدور الظاهرة دون أسماء أو روابط':'المسار المطلوب'}؛ تكرار المحاولة نفسها لن يغيّر الرفض.`:context?`توقف ${stageLabel(context.stage)} (${code}). لم تُجمع ${kindLabel(context.kind)} ومُسحت المعاينة؛ لا نجاح لهذه الفئة.`:`توقف التشغيل (${code}). مُسحت البيانات المؤقتة. لم تُضف بيانات إلى ركيز.`);
}
function current(ticket){if(ticket!==generation||!job)throw Error('CANCELLED');if(Date.now()>=job.deadline)throw Error('TIME_LIMIT');}
async function inspect(tabId,origin,mode,alive=()=>true,school=null,entryDeadline=job?.gatewaySettleUntil??Date.now()+6000){
 const tab=await chrome.tabs.get(tabId);if(!tab.url||new URL(tab.url).origin!==origin)throw Error('ORIGIN_CHANGED');
 if(!alive())throw Error('CANCELLED');
 if(/(?:login|signin|signout|logout|oauth)/i.test(new URL(tab.url).pathname))throw Error('LOGIN_OR_LOGOUT');
 try{const u=new URL(tab.url);safeRoute(origin,u.pathname+u.search,(job??review)?.context);}catch(e){throw routeError(e,'navigation-redirect',mode==='home'?'role':mode,new URL(tab.url).pathname+new URL(tab.url).search);}
 if(['students','timetable'].includes(mode)){
  const until=Date.now()+6000;
  while(true){
   await inspect(tabId,origin,'guard',alive);if(!alive())throw Error('CANCELLED');
   const values=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:readSourceReportPage,args:[mode,(job??review)?.context??null]});
   if(!alive())throw Error('CANCELLED');const value=values[0]?.result;
   if(tab.id!==tabId||values.length!==1||values[0].frameId!==0)throw Error('SOURCE_BINDING_CHANGED');
   if(value?.diagnostic)value.diagnostic.sourceTabMatch=true;
   if(value?.ok)return value;
   if(value?.retry&&Date.now()<until){announce(`انتظار محتوى ${kindLabel(mode)} الظاهر؛ القراءة مؤقتة ومحدودة، ويمكن الإلغاء.`);await new Promise(r=>setTimeout(r,200));continue;}
   const e=Error(value?.retry?(value.code==='ROSTER_LINKS_PENDING'?'ROSTER_LINKS_UNAVAILABLE':'SOURCE_TIMEOUT'):value?.code??'PAGE_UNAVAILABLE');e.incomplete=value?.incomplete;e.diagnostic=value?.diagnostic;if(e.diagnostic)e.diagnostic.reason=e.message;throw e;
  }
 }
 await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',files:['route-diagnostics.js']});
 if(!alive())throw Error('CANCELLED');
 const result=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:readAutomaticTeacherPage,args:[mode,school,(job??review)?.context??null]});
 if(!alive())throw Error('CANCELLED');
 const sourceTabMatch=tab.id===tabId&&result.length===1&&result[0].frameId===0;
 if(!sourceTabMatch)throw Error('SOURCE_BINDING_CHANGED');
 if(result[0].result?.entry){result[0].result.entry.sourceTabMatch=sourceTabMatch;$('entry-state').textContent=entryText(result[0].result.entry);}
 const bind=d=>{if(d?.entry)d.entry.sourceTabMatch=sourceTabMatch;for(const related of d?.related??[])bind(related);};
 for(const skipped of result[0].result?.skipped??[])bind(skipped.diagnostic);bind(result[0].result?.diagnostic);
 if(result[0].result?.diagnostic?.entry)result[0].result.diagnostic.entry.sourceTabMatch=sourceTabMatch;
 const settling=mode==='gateway'&&job?.roleSwitchUsed&&job?.gatewaySettleUntil&&job.context?.kind==='selected-teacher-card'&&result[0].result?.code==='UNCONFIRMED_TEACHER_ROLE';
 if(mode==='gateway'&&(result[0].result?.retry||settling)&&Date.now()<entryDeadline){announce('انتظار اكتمال صفحة المعلم بعد انتقال الدور؛ لن يعاد إرسال الانتقال.');await new Promise(r=>setTimeout(r,200));return inspect(tabId,origin,mode,alive,school,entryDeadline);}
 if(settling){result[0].result.code='TEACHER_TRANSITION_UNRESOLVED';if(result[0].result.diagnostic)result[0].result.diagnostic.reason='TEACHER_TRANSITION_UNRESOLVED';}
 if(mode==='guard'&&result[0]?.result?.ok){
  const guard=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:readSourceReportPage,args:['guard']});
  if(!alive())throw Error('CANCELLED');
  if(guard.length!==1||guard[0].frameId!==0||!guard[0].result?.ok)throw Error(guard[0]?.result?.code??'SOURCE_BINDING_CHANGED');
 }
 if(result.length!==1||!result[0].result?.ok){const e=Error(result[0]?.result?.code??'PAGE_UNAVAILABLE');e.diagnostic=result[0]?.result?.diagnostic;throw e;}return result[0].result;
}
async function ready(tabId,origin,ticket){
 const until=Date.now()+10000;
 while(Date.now()<until){current(ticket);const tab=await chrome.tabs.get(tabId);if(!tab.url||new URL(tab.url).origin!==origin)throw Error('ORIGIN_CHANGED');if(tab.status==='complete'&&!/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(tab.url).pathname))return;await new Promise(r=>setTimeout(r,100));}
 current(ticket);throw Error('PAGE_TIMEOUT');
}
function routeIdentity(origin,path){const u=new URL(path,origin);let entries=[...u.searchParams];if(/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[^/]+\/?$/i.test(u.pathname)){const pages=entries.filter(([k])=>['page','pagenumber'].includes(k.toLowerCase()));if(pages.length===1&&/^(?:0*1)$/.test(pages[0][1]))entries=entries.filter(([k])=>!['page','pagenumber'].includes(k.toLowerCase()));}return u.pathname+'?'+JSON.stringify(entries.sort());}
async function start(tabId){
 if(job||review)stop('NEW_RUN');const ticket=++generation;
 clearPreview();$('legacy-names').hidden=true;$('structured-category').hidden=false;$('manual-controls').hidden=true;$('run-cancel').disabled=false;
 diagnosticLines=[];$('entry-state').textContent='';$('route-diagnostic').hidden=true;$('copy-route-diagnostic').hidden=true;$('run-skipped').textContent='';
 let stage='start-path',kind='start',path='';
 try{
  const tab=await chrome.tabs.get(tabId),origin=startOrigin(tab.url??'');
  path=new URL(tab.url).pathname+new URL(tab.url).search;
  safeRoute(origin,new URL(tab.url).pathname+new URL(tab.url).search);
  job={tabId,origin,deadline:Date.now()+RUN_LIMITS.milliseconds,routes:[],categories:[],visited:new Set(),warnings:[],skipped:[],pages:0,loops:0,series:new Map(),context:null,rosterSchools:new Set(),roleSwitchUsed:false,gatewaySettleUntil:null,pendingSchoolTables:[],studentRowsSeen:0};
  const timeout=setTimeout(()=>{if(ticket===generation&&job)stop('TIME_LIMIT');},RUN_LIMITS.milliseconds);job.timer=timeout;
  const alive=()=>ticket===generation&&!!job;
  stage='role-selection';kind='role';await ready(tabId,origin,ticket);let page=await inspect(tabId,origin,'home',alive);current(ticket);
  if(page.schoolChoices){
   announce('اختر مدرسة واحدة لهذا التشغيل؛ لن تُقرأ بيانات مدرسة قبل اختيارك.');
   const choice=await new Promise((resolve,reject)=>{choiceReject=reject;$('school-choices').hidden=false;for(const school of page.schoolChoices){const button=document.createElement('button');button.type='button';button.textContent=school.label;button.addEventListener('click',()=>resolve(school),{once:true});$('school-choices').append(button);}});
   current(ticket);choiceReject=null;$('school-choices').replaceChildren();$('school-choices').hidden=true;
   page=await inspect(tabId,origin,'home',alive,choice);current(ticket);if(page.schoolChoices)throw Error('SCHOOL_CHOICE_STALE');
  }
  job.visited.add(routeIdentity(origin,tab.url));
  let next={kind:'home',page};
  while(next){
   current(ticket);if(++job.pages>RUN_LIMITS.pages)throw Error('PAGE_LIMIT');
   if(!next.page){
    stage=next.kind==='role'?'role-selection':'navigation-redirect';kind=next.kind;path=next.path;
    const labels={role:'دور المعلم',gateway:'مدخل المدرسة',metadata:'بيانات المعلم',classes:'الفصول',students:'أسماء الطلاب',timetable:'الجدول الأسبوعي'};
    const target=safeRoute(origin,next.path,next.context??job.context);if(/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(target).pathname)){if(job.roleSwitchUsed)throw Error('ROLE_SWITCH_REPEATED');job.roleSwitchUsed=true;}announce(`التقدم: صفحة ${job.pages}، ${labels[next.kind]}. قراءة فقط داخل ${new URL(origin).hostname}.`);
    try{await chrome.tabs.update(tabId,{url:target});await ready(tabId,origin,ticket);if(next.kind==='gateway'&&next.context?.kind==='selected-teacher-card'&&job.roleSwitchUsed)job.gatewaySettleUntil=Date.now()+8000;next.page=await inspect(tabId,origin,next.kind,alive);current(ticket);}
    catch(e){if(!['students','timetable'].includes(next.kind)||!e.incomplete&&e.message!=='PAGE_TIMEOUT')throw e;current(ticket);showDiagnostic(e.diagnostic);next.page={tables:[],links:[],warnings:[{category:next.kind,code:e.message}],skipped:[]};}

   }
   page=next.page;if(page.runContext){if(job.context?.schoolId&&page.runContext.schoolId&&job.context.schoolId!==page.runContext.schoolId)throw Error('SCHOOL_CONTEXT_CHANGED');job.context={...job.context,...page.runContext};}
   for(const school of page.schoolNames??[]){if(job.context?.schoolName&&job.context.schoolName!==school)throw Error('SCHOOL_CONTEXT_CHANGED');job.rosterSchools.add(school);if(job.rosterSchools.size>1)throw Error('SCHOOL_CONTEXT_CHANGED');}
   if(next.kind==='home'&&page.links.some(l=>l.kind==='gateway'&&l.context?.kind==='selected-teacher-card')){job.pendingSchoolTables=page.tables;page={...page,tables:[]};}
   if(next.kind==='gateway'&&job.pendingSchoolTables.length){page={...page,tables:[...job.pendingSchoolTables,...page.tables]};job.pendingSchoolTables=[];job.gatewaySettleUntil=null;}
   job.warnings.push(...page.warnings);
   if(next.kind==='students'&&page.duplicates)job.warnings.push({category:'students',code:'DUPLICATE_STUDENT_IDENTITY'});
   if(page.pagination){
    const p=page.pagination;let series=job.series.get(p.series);if(!series){series={total:p.total,pages:new Set(),fingerprints:new Set(),terminal:false};job.series.set(p.series,series);}
    const fingerprint=page.tables.find(t=>t.category==='students')?.text;
    if(series.total!==null&&p.total!==null&&series.total!==p.total||series.pages.has(p.current)||series.fingerprints.has(fingerprint))job.warnings.push({category:'students',code:'PAGINATION_REPEAT_OR_CHANGED'});
    if(p.total!==null)series.total=p.total;
    if(p.terminal&&p.current===p.total)series.terminal=true;
    series.pages.add(p.current);series.fingerprints.add(fingerprint);
   }
   for(const skipped of page.skipped??[]){showDiagnostic(skipped.diagnostic);job.skipped.push(skipped.kind);}
   if(job.skipped.length)$('run-skipped').textContent=`لم تُجمع بيانات الروابط المستبعدة: ${[...new Set(job.skipped)].map(kindLabel).join('، ')}. عُرض فقط ما جُمع من روابط مستقلة مسموحة؛ سبب الاستبعاد موضح في التشخيص الآمن دون قيم خاصة.`;
   for(const table of page.tables){
    // Student data is admitted only through the safeguarded report/pager reader.
    if(table.category==='students'&&next.kind!=='students')continue;
    try{
     const rows=parseCategoryTable(table.category,table.text);
     if(table.category==='school'){
      if(job.context?.schoolName&&job.context.schoolName!==rows[0].name)throw Error('SCHOOL_CONTEXT_CHANGED');
      job.context={...job.context,schoolName:rows[0].name};
     }
     const merged=mergePage(job.categories,table.category,rows);
     if(table.category==='students'){
      const prior=job.categories.find(c=>c.category==='students')?.rows??[];
      if(rows.some(r=>prior.some(p=>JSON.stringify(p)===JSON.stringify(r))))job.warnings.push({category:'students',code:'DUPLICATE_STUDENT_IDENTITY'});
      // A bounded lower bound of observed rows, never an assertion of unique/complete students.
      // No rejected overflow names are retained in job.categories.
      job.studentRowsSeen=Math.max(job.studentRowsSeen,merged.find(c=>c.category==='students').rows.length);
     }
     for(const c of merged)validateCategory(c.category,c.rows);bundle(merged);job.categories=merged;
    }
    catch(e){if(e.message==='SCHOOL_CONTEXT_CHANGED')throw e;job.warnings.push({category:table.category,code:/^[A-Z_]+$/.test(e.message)?e.message:'UNRESOLVED_CATEGORY'});}
   }
   $('run-counts').textContent=`${job.pages} صفحات؛ ${job.categories.find(c=>c.category==='students')?.rows.length??0} طلاب؛ ${job.categories.reduce((n,c)=>n+c.rows.length,0)} صفًا إجمالًا من فئات مختلفة. لا تصدير ولا إضافة إلى ركيز.`;
   for(const link of page.links){
    try{safeRoute(origin,link.path,link.context??job.context);}catch(e){throw routeError(e,link.kind==='role'?'role-selection':'navigation-redirect',link.kind,link.path);}
    if(job.visited.has(routeIdentity(origin,link.path))||job.routes.some(r=>routeIdentity(origin,r.path)===routeIdentity(origin,link.path))){if(link.pagination)job.loops++;continue;}
    job.routes.push(link);
   }
   next=job.routes.shift();if(next)job.visited.add(routeIdentity(origin,next.path));
  }
  current(ticket);await inspect(tabId,origin,'guard',alive);current(ticket);
  for(const series of job.series.values())if(!series.terminal||series.total===null||series.pages.size!==series.total||!Array.from({length:series.total},(_,i)=>i+1).every(n=>series.pages.has(n)))job.warnings.push({category:'students',code:'PAGINATION_INCOMPLETE'});
  const categories=job.categories,warnings=job.warnings,pages=job.pages,loops=job.loops;
  const stagedStudents=categories.find(c=>c.category==='students')?.rows.length??0,observedStudents=job.studentRowsSeen;
  // An ambiguous category is unresolved as a whole, never silently keep its first value.
  const unresolved=new Set(warnings.map(w=>w.category));let valid=categories.filter(c=>!unresolved.has(c.category));
  const completeStudents=valid.find(c=>c.category==='students');
  if(completeStudents){
   if(!valid.some(c=>c.category==='classes')&&!unresolved.has('classes'))valid=mergePage(valid,'classes',validateCategory('classes',[...new Set(completeStudents.rows.map(r=>r.classroom))].map(classroom=>({classroom}))));
   if(!valid.some(c=>c.category==='school')&&job.rosterSchools.size===1&&!unresolved.has('school'))valid=mergePage(valid,'school',validateCategory('school',[{name:[...job.rosterSchools][0]}]));
  }
  if(valid.length)bundle(valid);
  const completeCount=valid.find(c=>c.category==='students')?.rows.length??0;
  const studentWarnings=[...new Set(warnings.filter(w=>w.category==='students').map(w=>w.code))];
  showDiagnostic({run:{staged:stagedStudents,observed:observedStudents,complete:completeCount,excluded:studentWarnings.filter(c=>/^[A-Z_]+$/.test(c)).join(',')}});
  const contextSnapshot=job.context;clearTimeout(job.timer);job.routes.length=0;job.categories=[];job=null;
  review={tabId,origin,context:contextSnapshot,expires:Date.now()+RUN_LIMITS.reviewMilliseconds};
  $('direct-handoff').hidden=!valid.length;
  const displayWarnings=warnings;
  if(displayWarnings.length)$('run-skipped').textContent='فئات غير مكتملة ومستبعدة من التصدير: '+[...new Set(displayWarnings.map(w=>kindLabel(w.category)))].join('، ')+'. راجع الفئات المكتملة فقط؛ لا ادعاء باكتمال الفئة المستبعدة.';
  const missing=['teacher','school','principal','classes','students','timetable'].filter(c=>!valid.some(v=>v.category===c));
  const studentCause=!missing.includes('students')?'':diagnosticLines.some(l=>l.includes('RELEVANT_LINK_UNSUPPORTED'))?'ظهر رابط ذو تسمية طلاب، لكن مساره غير مدعوم؛ لم يُفتح.':diagnosticLines.some(l=>l.includes('MAIN_FRAME_READ_LINK_ABSENT'))?'لم يظهر رابط كشف طلاب مسموح في الإطار الرئيسي. وجود إطارات لا يثبت أنها تحتوي الكشف.':missing.includes('students')?'لم يثبت اكتمال كشف الطلاب من المصدر الظاهر.':'';
  const rosterExplanation=studentWarnings.includes('CATEGORY_ROW_LIMIT')?`جمعت ${stagedStudents} اسمًا، لكن الكشف أكبر من الحد المسموح للنقل (300)؛ رُصد ما لا يقل عن ${observedStudents} صفًا، وليس عددًا مؤكدًا لطلاب فريدين. لا نقل جزئي ولا اقتطاع للأسماء.`:studentCause?`جمعت ${stagedStudents} اسمًا، لكن الكشف غير مكتمل؛ تعذر التحقق من كل صفحات المصدر. نقل الطلاب معطّل.`:'';
  $('handoff-status').textContent=rosterExplanation;
  if(studentCause)$('run-skipped').textContent+=' '+rosterExplanation+' '+studentCause+' نقل الطلاب معطّل. بعد التحديث يمكنك تشغيل الإضافة مرة واحدة طوعًا ومشاركة التشخيص الآمن فقط؛ لا ترسل أسماء أو روابط.';
  $('run-missing').textContent=missing.length?`غير ظاهر أو غير محسوم: ${missing.map(c=>CATEGORIES[c].label).join('، ')}. لم تُخمن قيم ناقصة.`:'ظهرت الفئات الست للمراجعة.';
  $('run-counts').textContent=`${pages} صفحات؛ ${stagedStudents} اسمًا مجمّعًا؛ ${completeCount} مكتملًا للمراجعة؛ 0 أُضيف إلى ركيز؛ ${valid.reduce((n,c)=>n+c.rows.length,0)} صفًا إجمالًا في معاينة الفئات (ليست عدد الطلاب)؛ ${loops} روابط صفحات مكررة جرى تجاوزها.`;
  if(valid.length)window.dispatchEvent(new CustomEvent('n36:preview',{detail:valid}));
  else {clearPreview();$('run-cancel').disabled=true;announce(rosterExplanation||'لم يثبت اكتمال البيانات؛ لا نقل إلى ركيز.');return;}
  announce(warnings.length?`جمع جزئي غير مكتمل؛ استُبعدت الفئات غير المكتملة من التصدير. راجع الفئات المكتملة فقط. لا إضافة إلى ركيز.`:`${diagnosticLines.some(l=>!l.includes('stage=run-summary'))?'الجمع جزئي؛ بعض الروابط لم تُجمع بياناتها. ':''}اكتمل الجمع من ${pages} صفحات للبيانات المسموحة فقط. عدّل واستبعد ثم راجع المعاينة النهائية. لا إضافة إلى ركيز.`);
  armReview();
 }catch(e){if(ticket===generation){routeError(e,stage,kind,path);stop(/^[A-Z_]+$/.test(e.message)?e.message:'ACCESS_OR_PAGE_UNAVAILABLE',e.diagnostic,{stage,kind});}}
}
async function noorRead(tabId) {
 const tab=await chrome.tabs.get(tabId),u=new URL(tab.url??'');
 if(u.origin!=='https://noor.moe.gov.sa'||!u.pathname.startsWith('/Noor/')||/(?:login|signin|logout|oauth)/i.test(u.pathname))throw Error('UNSUPPORTED_NOOR_PAGE');
 const results=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:readSelectedNameColumn});
 if(results.length!==1||results[0].frameId!==0||!results[0].result?.ok)throw Error(results[0]?.result?.code??'NO_VISIBLE_SELECTION');
 return {url:tab.url,names:reviewNames(results[0].result.values).names};
}
async function startNoor(tabId,classroom,role) {
 const ticket=++generation;clearPreview();$('run-cancel').disabled=false;
 try {
  if(role!==true)throw Error('TEACHER_CONFIRMATION_REQUIRED');
  validateCategory('classes',[{classroom}]);
  const selected=await noorRead(tabId);if(ticket!==generation)return;
  review={tabId,origin:'https://noor.moe.gov.sa',source:'noor',url:selected.url,names:JSON.stringify(selected.names),expires:Date.now()+RUN_LIMITS.reviewMilliseconds};
  $('direct-handoff').hidden=false;
  window.dispatchEvent(new CustomEvent('n36:preview',{detail:[{category:'students',provenance:['selected-visible'],rows:selected.names.map(name=>({name,classroom}))}]}));
  announce('نور: عمود ظاهر مختار فقط — كشف جزئي. لم تُجمع صفحات أخرى أو أعمدة أخرى، ولم يُتحقق من اكتمال قائمة الفصل. راجع ثم انقل الأسماء بتأكيدك.');
  armReview();
 }catch(e){if(ticket===generation)stop(/^[A-Z_]+$/.test(e.message)?e.message:'NOOR_READ_FAILED');}
}
// Progress lives only in this explicit extension run page; transport alone uses short-lived session storage.
if(runToken){
 $('noor-controls').hidden=true;
 document.body.classList.add('run-page');$('manual-controls').hidden=true;$('one-start').hidden=true;
 $('category').hidden=true;announce('بانتظار طلب البدء الصريح؛ فتح هذه الصفحة وحده لا يبدأ قراءة.');
 channel.onmessage=async({data})=>{
  if(data?.type!=='launch'||data.token!==runToken||!Number.isInteger(data.tabId))return;
  channel.onmessage=null;channel.postMessage({type:'launched',token:runToken});if(data.mode==='noor')await startNoor(data.tabId,data.classroom,data.role);else await start(data.tabId);
 };
 channel.postMessage({type:'ready',token:runToken});
}else{
 const launch=async(mode='madrasati')=>{
  $('one-start').disabled=true;
  try{
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error('NO_ACTIVE_TAB');
   const classroom=$('noor-class').value.normalize('NFC').trim().replace(/\s+/g,' '),role=$('noor-role').checked;
   if(mode==='noor'){if(!role)throw Error('TEACHER_CONFIRMATION_REQUIRED');validateCategory('classes',[{classroom}]);const u=new URL(tab.url??'');if(u.origin!=='https://noor.moe.gov.sa'||!u.pathname.startsWith('/Noor/'))throw Error('UNSUPPORTED_NOOR_PAGE');}else startOrigin(tab.url??'');
   const sourceTabId=tab.id; // Captured before creating/activating the extension run page.
   const token=crypto.randomUUID();let busy=false;
   channel.onmessage=({data})=>{if(data?.type==='busy'&&data.token===token)busy=true;};
   channel.postMessage({type:'probe',token,tabId:tab.id});await new Promise(r=>setTimeout(r,250));if(busy)throw Error('RUN_ALREADY_ACTIVE');
   let resolveReady,rejectReady;
   const readyPromise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
   const timer=setTimeout(()=>rejectReady(Error('RUN_PAGE_TIMEOUT')),5000);
   channel.onmessage=({data})=>{if(data?.token===token&&data.type==='ready'){channel.postMessage({type:'launch',token,tabId:sourceTabId,mode,classroom,role});}if(data?.token===token&&data.type==='launched')resolveReady();};
   const runner=await chrome.tabs.create({url:chrome.runtime.getURL('popup.html')+'?run='+token,active:false});
   try{await readyPromise;await chrome.tabs.update(runner.id,{active:true});}finally{clearTimeout(timer);channel.onmessage=null;}
  }catch(e){announce(`تعذّر البدء (${/^[A-Z_]+$/.test(e.message)?e.message:'ACCESS_OR_PAGE_UNAVAILABLE'}). لا بيانات مقروءة. افتح زر الإضافة من تبويب البداية المصرّح.`);}
  finally{$('one-start').disabled=false;}
 };
 $('one-start').addEventListener('click',()=>launch());
 $('noor-start').addEventListener('click',()=>launch('noor'));
}
$('run-reopen').addEventListener('click',()=>{announce('افتح بنفسك تبويب مدرستي المصرّح ثم اضغط زر الإضافة وابدأ؛ لا قراءة قبل اختيارك.');$('run-reopen').hidden=true;});
$('run-cancel').addEventListener('click',()=>stop());
window.addEventListener('n36:discard',()=>{if(runToken)stop();});
window.addEventListener('n36:exported',()=>{if(!runToken)return;generation++;clearPreview();$('run-cancel').disabled=true;announce('اكتمل التصدير الصريح ومُسحت المعاينة المؤقتة. لم تُضف بيانات إلى ركيز.');});
window.n36BeforeExport=async()=>{
 if(!runToken)return;const snapshot=review;if(!snapshot||Date.now()>=snapshot.expires){stop('REVIEW_EXPIRED');throw Error('REVIEW_EXPIRED');}
 try{if(snapshot.source==='noor'){const fresh=await noorRead(snapshot.tabId);if(fresh.url!==snapshot.url||JSON.stringify(fresh.names)!==snapshot.names)throw Error('SOURCE_CHANGED');}else await inspect(snapshot.tabId,snapshot.origin,'guard',()=>review===snapshot);if(review!==snapshot)throw Error('SOURCE_CHANGED');}catch(e){stop('SOURCE_CHANGED');throw e;}
};
window.n36HandoffSource=()=>review&&Date.now()<review.expires?{source:review.source==='noor'?'noor':'madrasati',scope:review.source==='noor'?'selected-visible-partial':'reviewed-run'}:null;
window.addEventListener('pagehide',()=>{clearTimeout(reviewTimer);clearInterval(reviewClock);if(job){clearTimeout(job.timer);job.routes.length=0;job.categories.length=0;}channel.close();});
// Only the explicit run's source is monitored; no all-tab discovery or startup read.
chrome.tabs.onRemoved.addListener(id=>{if(id===job?.tabId||id===review?.tabId)stop('SOURCE_CLOSED');});
chrome.tabs.onUpdated.addListener((id,change)=>{
 const target=job??review;if(id!==target?.tabId||!change.url)return;
 if(new URL(change.url).origin!==target.origin||/(?:login|signin|signout|logout|oauth)/i.test(new URL(change.url).pathname))stop('ORIGIN_OR_LOGIN_CHANGED');
});
setInterval(async()=>{
 if(!review||guardBusy)return;if(Date.now()>=review.expires){stop('REVIEW_EXPIRED');return;}guardBusy=true;
 const snapshot=review;try{if(snapshot.source==='noor'){const fresh=await noorRead(snapshot.tabId);if(fresh.url!==snapshot.url||JSON.stringify(fresh.names)!==snapshot.names)throw Error('SOURCE_CHANGED');}else await inspect(snapshot.tabId,snapshot.origin,'guard',()=>review===snapshot);}catch{if(review===snapshot)stop('ORIGIN_OR_LOGIN_CHANGED');}finally{guardBusy=false;}
},3000);
if(!runToken)$('one-start').disabled=false;
$('copy-route-diagnostic').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('route-diagnostic').value);$('route-copy-status').textContent='نُسخ التشخيص الآمن فقط. لم يُرسل إلى أي جهة.';}catch{$('route-copy-status').textContent='حدّد سطر التشخيص الآمن وانسخه يدويًا؛ لم يُرسل شيء.';}});
