import {appendSourceRows,reportsComplete,sourceCoverage,coverageMessage} from './source-roster.js';
import {readSourceReportPage} from './source-adapter.js';
import {readAutomaticTeacherPage,readSelectedNameColumn} from './selection.js';
import {reviewNames} from './core.js';
import {CATEGORIES,parseCategoryTable,validateCategory,bundle} from './categories.js';
import {RUN_LIMITS,startOrigin,safeRoute,mergePage} from './navigation.js';
import './route-diagnostics.js';
const $=id=>document.getElementById(id);let runToken=new URL(location.href).searchParams.get('run');
const channel=new BroadcastChannel('rakeez-private-one-start');
let generation=0,job=null,review=null,reviewTimer=null,reviewClock=null,guardBusy=false,choiceReject=null,continueReject=null;
const kindLabel=kind=>({start:'صفحة البداية',role:'دور المعلم',gateway:'مدخل المدرسة',metadata:'بيانات المعلم',classes:'الفصول',students:'أسماء الطلاب',timetable:'الجدول الأسبوعي'}[kind]??'الفئة');
const stageLabel=stage=>({'start-path':'مسار البداية','role-selection':'اختيار دور المعلم','auxiliary-link':'رابط اختياري','navigation-redirect':'التنقل أو التحويل','source-schema':'بنية صفحة البيانات','link-discovery':'اكتشاف روابط القراءة'}[stage]??'التحقق');
let diagnosticLines=[];
const entryText=e=>`pageKind=${e.pageKind} | readyState=${e.readyState} | sourceTabMatch=${(e.sourceTabMatch===true?'true':e.sourceTabMatch===false?'false':'unknown')} | roleMarkers=${e.roleMarkers} | schoolOptions=${e.schoolOptions} | navMarkers=${e.navMarkers} | actionMarkers=${e.actionMarkers} | safeReadLinks=${e.safeReadLinks} | iframeCount=${e.iframeCount}${e.linkStats?' | '+Object.entries(e.linkStats).map(([key,value])=>key+'='+value).join(' | '):''}`;
function showDiagnostic(d){
 if(!d)return;
 if(d.pager)window.n36Diagnostics?.publish({terminal:d.pager.terminalEvidence,endpoint:d.pager.endpointKind,currentPage:d.pager.currentPage,disabledNext:d.pager.disabledNext});
 if(d.run)window.n36Diagnostics?.publish({stage:d.run.coverage==='partial'?'partial':'review',valid:d.run.staged,staged:d.run.staged,observed:d.run.observed,coverage:d.run.coverage,hasNext:d.run.hasNextReport,processedPages:d.run.processedReportPages});
 let line=d.run?`N36 ${chrome.runtime.getManifest().version} | stage=run-summary | staged=${d.run.staged} | observedRowsLowerBound=${d.run.observed} | complete=${d.run.complete} | commitEvidence=receiver-only | excluded=${d.run.excluded||'none'} | coverage=${d.run.coverage} | hasNextReport=${d.run.hasNextReport} | processedReportPages=${d.run.processedReportPages} | reviewWindow=${d.run.reviewWindow}`:d.entry?`N36 ${chrome.runtime.getManifest().version} | stage=${d.stage} | reason=${d.reason} | ${entryText(d.entry)}`:d.schema?`N36 ${chrome.runtime.getManifest().version} | stage=source-schema | reason=${d.reason} | category=${d.category} | tables=${d.schema.tables} | expectedCategory=${d.schema.expectedCategory} | unresolved=${d.schema.unresolved}`:d.structure?`N36 ${chrome.runtime.getManifest().version} | stage=role-selection | reason=${d.reason} | teacherGreeting=${d.structure.teacherGreeting} | greetingAmbiguous=${d.structure.greetingAmbiguous} | safeTeacherReports=${d.structure.safeTeacherReports} | explicitRoleDestinations=${d.structure.explicitRoles} | explicitAmbiguous=${d.structure.explicitAmbiguous} | activeTeacher=${d.structure.activeTeacher} | dashboard=${d.structure.dashboard??false} | teacherCards=${d.structure.teacherCards??0} | gatewayRejected=${d.structure.gatewayRejected??0}`:`N36 ${chrome.runtime.getManifest().version} | stage=${d.stage} | reason=${d.reason} | category=${d.category}`;
 if(d.pager)line+=' | '+['pagerCount','currentPage','endpointKind','disabledNext','terminalEvidence'].map(k=>k+'='+d.pager[k]).join(' | ');
 if(d.roster)line+=` | cause=${d.roster.cause} | relevant=${d.roster.relevant} | unsupported=${d.roster.unsupported} | iframeCount=${d.roster.iframes} | frameReport=unconfirmed`;
 if(d.sourceTabMatch===true)line+=' | sourceTabMatch=true';
 if(d.template)line+=` | route=${d.template} | queryKeys=${d.keys?.join(',')||'-'} | unknownKeys=${d.unknownKeys??0} | routeReason=${d.detail??'unexpected-path'}`;
 if(d.run&&diagnosticLines.length>=8)diagnosticLines.shift();
 if(!diagnosticLines.includes(line)&&diagnosticLines.length<8)diagnosticLines.push(line);
 $('route-diagnostic').value=diagnosticLines.join('\n');$('route-diagnostic').hidden=false;$('copy-route-diagnostic').hidden=false;
 for(const related of d.related??[])showDiagnostic(related);
}
function routeError(e,stage,kind,path){if(!e.diagnostic&&['UNSAFE_ROUTE','UNSAFE_LINK','ORIGIN_CHANGED'].includes(e.message))e.diagnostic=globalThis.rakeezRouteDiagnostic(stage,e.message,kind,path);return e;}
channel.addEventListener('message',({data})=>{const active=job??review;if(data?.type==='probe'&&active?.tabId===data.tabId)channel.postMessage({type:'busy',token:data.token});});
function announce(text){$('run-status').textContent=text;}
function armReview(){
 const tick=()=>{$('review-remaining').textContent=review?`المعاينة: ${Math.max(0,Math.ceil((review.expires-Date.now())/1000))} ثانية متبقية من 5 دقائق.`:'';};
 tick();reviewClock=setInterval(tick,1000);reviewTimer=setTimeout(()=>stop('REVIEW_EXPIRED'),Math.max(0,review.expires-Date.now()));
}
function clearPreview(continuing=false,finished=false){clearInterval(reviewClock);$('review-remaining').textContent='';window.dispatchEvent(new CustomEvent('n36:clear',{detail:{continuing,finished}}));review=null;clearTimeout(reviewTimer);$('direct-handoff').hidden=true;$('collection-continue').hidden=true;}
function stop(code='CANCELLED',diagnostic=null,context=null){
 chrome.runtime.sendMessage({type:'n36-cancel'}).catch(()=>{});
 cancelReports(job??review);generation++;if(continueReject){continueReject(Error('CANCELLED'));continueReject=null;}if(choiceReject){choiceReject(Error('CANCELLED'));choiceReject=null;}$('school-choices').replaceChildren();$('school-choices').hidden=true;if(job){clearTimeout(job.timer);clearTimeout(job.expiryTimer);job.sourceRows.length=0;job.fetches.clear();job.routes.length=0;job.categories.length=0;job=null;}clearPreview();window.n36AutomaticBatch=null;
 window.n36Diagnostics?.publish({stage:code==='CANCELLED'?'cancelled':code==='REVIEW_EXPIRED'?'expired':'error'});
 showDiagnostic(diagnostic);$('run-cancel').disabled=true;
 if(['UNVERIFIED_START_ORIGIN','UNSAFE_ROUTE','UNSUPPORTED_SOURCE_SCHEMA'].includes(code)){announce('افتح مدرستي، ثم شغّل الإضافة من واجهة المعلم. هذه الصفحة غير مدعومة؛ لم يُفترض حفظ شيء.');return;}
 if(code==='SOURCE_NOT_AVAILABLE'){announce('لم يُعثر على كشف طلاب مدعوم قابل للنقل. راجع واجهة المعلم ثم أعد البدء؛ لم يُفترض اكتمال المصدر.');return;}
 if(code==='APP_FINISH_CURRENT_EDIT'){window.n36Diagnostics?.publish({failure:'APP_FINISH_CURRENT_EDIT'});announce('أكمل التعديل أو أغلق النافذة المفتوحة في ركيز ثم ابدأ مجددًا. لم تبدأ قراءة المصدر أو نقل البيانات.');return;}
 if(code==='APP_UPDATE_REQUIRED'){window.n36Diagnostics?.publish({failure:'APP_UPDATE_REQUIRED',setupPhase:'receiver-update'});announce('حدّث ركيز من زر التحديث داخل التطبيق ثم ابدأ مجددًا. لم تبدأ قراءة المصدر أو نقل البيانات؛ لن تُحدّث الصفحة تلقائيًا.');return;}
 if(code==='OPEN_ONE_AUTHENTICATED_RAKEEZ_TAB'){announce('افتح حساب ركيز المسجّل دخوله في تبويب واحد في هذه النافذة وحدّث التطبيق، ثم ابدأ من مدرستي. لم تبدأ قراءة الأسماء.');return;}
 if(code==='REVIEW_EXPIRED'){$('run-counts').textContent='';$('run-missing').textContent='';$('run-skipped').textContent='';$('run-reopen').hidden=false;announce('انتهت مهلة التشغيل ومُسحت الأسماء المؤقتة في الإضافة. ما حُفظ محليًا في ركيز يبقى محفوظًا، والدفعات المعلّقة فيه يمكن استكمالها من الحساب نفسه. لبدء جمع جديد افتح المصدر ثم ابدأ طوعًا.');return;}
 showDiagnostic(diagnostic??{stage:context?.stage??'run',reason:code,category:context?.kind??'students'});
 announce(code==='CANCELLED'?'أُوقف التشغيل ومُسحت الأسماء المؤقتة في الإضافة. ما حُفظ محليًا في ركيز يبقى محفوظًا.':code==='SOURCE_CHANGED'||/CONTEXT|ORIGIN|LOGIN|CLOSED/.test(code)?'تغيّرت الصفحة أو جلسة الدخول. افتح واجهة المعلم في مدرستي ثم ابدأ من جديد.':'تعذّرت قراءة هذه الصفحة. افتح واجهة المعلم في مدرستي ثم ابدأ؛ لم يُفترض حفظ شيء.');
}
// AI: cancel only this run's source-context requests; never navigate to recover a fetch.
function cancelReports(active){
 if(!active?.tabId)return;
 chrome.scripting.executeScript({target:{tabId:active.tabId,frameIds:[0]},world:'ISOLATED',func:()=>{for(const c of globalThis.rakeezReportRequests?.values()??[])c.abort();}}).catch(()=>{});
 active.fetches?.clear();
}
async function readReport(next,ticket,alive){
 const active=job;await inspect(active.tabId,active.origin,'guard',alive);current(ticket);
 const source=await chrome.tabs.get(active.tabId),sourceURL=source.url;
 const reportPath=new URL(next.path,active.origin).pathname;
 if(active.reportPath&&active.reportPath!==reportPath)throw Error('REPORT_CONTEXT_CHANGED');
 active.reportPath=reportPath;
 const pending=[next,...active.routes.filter(r=>r.kind==='students'&&new URL(r.path,active.origin).pathname===reportPath)];
 for(const r of pending){
  const key=r.path+'|'+(r.rowOffset??0);if(active.fetches.has(key))continue;
  if(active.fetches.size>=3)break;
  safeRoute(active.origin,r.path,active.context);
  const promise=chrome.scripting.executeScript({target:{tabId:active.tabId,frameIds:[0]},world:'ISOLATED',func:readSourceReportPage,args:['fetch',{...active.context,path:r.path,sourceURL,rowOffset:r.rowOffset??0,requestId:ticket+'|'+key,remainingMs:active.deadline-Date.now()}]})
   .then(results=>results.length===1&&results[0].frameId===0?results[0].result:{ok:false,code:'SOURCE_BINDING_CHANGED'})
   .catch(()=>({ok:false,code:'REPORT_FETCH_FAILED'}));
  active.fetches.set(key,promise);
 }
 const key=next.path+'|'+(next.rowOffset??0),value=await active.fetches.get(key);active.fetches.delete(key);
 current(ticket);await inspect(active.tabId,active.origin,'guard',alive);current(ticket);
 if((await chrome.tabs.get(active.tabId)).url!==sourceURL)throw Error('SOURCE_CONTEXT_CHANGED');
 if(!value?.ok){const e=Error(value?.code??'REPORT_FETCH_FAILED');e.incomplete=!/CONTEXT|BINDING|ORIGIN|LOGIN|ROLE|UNSAFE|SCHOOL|SESSION/.test(e.message);throw e;}
 return value;
}
function current(ticket){if(ticket!==generation||!job)throw Error('CANCELLED');if(job.expires&&Date.now()>=job.expires)throw Error('REVIEW_EXPIRED');}
async function inspect(tabId,origin,mode,alive=()=>true,school=null,entryDeadline=job?.gatewaySettleUntil??Date.now()+20000){
 const tab=await chrome.tabs.get(tabId);if(!tab.url||new URL(tab.url).origin!==origin)throw Error('ORIGIN_CHANGED');
 if(!alive())throw Error('CANCELLED');
 if(/(?:login|signin|signout|logout|oauth)/i.test(new URL(tab.url).pathname))throw Error('LOGIN_OR_LOGOUT');
 try{const u=new URL(tab.url);safeRoute(origin,u.pathname+u.search,(job??review)?.context);}catch(e){throw routeError(e,'navigation-redirect',mode==='home'?'role':mode,new URL(tab.url).pathname+new URL(tab.url).search);}
 if(['students','timetable'].includes(mode)){
  const until=Date.now()+20000;
  while(true){
   await inspect(tabId,origin,'guard',alive);if(!alive())throw Error('CANCELLED');
   const values=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:readSourceReportPage,args:[mode,{...((job??review)?.context??{}),rowOffset:job?.readOffset??0}]});
   if(!alive())throw Error('CANCELLED');const value=values[0]?.result;
   if(tab.id!==tabId||values.length!==1||values[0].frameId!==0)throw Error('SOURCE_BINDING_CHANGED');
   if(value?.diagnostic)value.diagnostic.sourceTabMatch=true;
   if(value?.ok)return value;
   if(value?.retry&&Date.now()<until){announce(`انتظار محتوى ${kindLabel(mode)} الظاهر؛ القراءة مؤقتة ومحدودة، ويمكن الإلغاء.`);await new Promise(r=>setTimeout(r,200));continue;}
   const e=Error(value?.retry?(value.code==='ROSTER_LINKS_PENDING'?'ROSTER_LINKS_UNAVAILABLE':'SOURCE_TIMEOUT'):value?.code??'PAGE_UNAVAILABLE');e.observedRows=value?.observedRows;e.incomplete=value?.incomplete;e.diagnostic=value?.diagnostic;if(e.diagnostic)e.diagnostic.reason=e.message;throw e;
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
 const until=Date.now()+30000;
 while(Date.now()<until){current(ticket);const tab=await chrome.tabs.get(tabId);if(!tab.url||new URL(tab.url).origin!==origin)throw Error('ORIGIN_CHANGED');if(tab.status==='complete'&&!/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(tab.url).pathname))return;await new Promise(r=>setTimeout(r,100));}
 current(ticket);throw Error('PAGE_TIMEOUT');
}
function routeIdentity(origin,path){const u=new URL(path,origin);let entries=[...u.searchParams];if(/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[^/]+\/?$/i.test(u.pathname)){const pages=entries.filter(([k])=>['page','pagenumber'].includes(k.toLowerCase()));if(pages.length===1&&/^(?:0*1)$/.test(pages[0][1]))entries=entries.filter(([k])=>!['page','pagenumber'].includes(k.toLowerCase()));}return u.pathname+'?'+JSON.stringify(entries.sort());}
function sourcePageSeen(origin,path){
 const u=new URL(path,origin),keys=['page','pagenumber'];
 const series=job.series.get(u.pathname+'?'+JSON.stringify([...u.searchParams].filter(([k])=>!keys.includes(k.toLowerCase())).sort()));
 const page=Number([...u.searchParams].find(([k])=>keys.includes(k.toLowerCase()))?.[1]??1);
 return !!series&&Number.isSafeInteger(page)&&series.pages.has(page);
}
async function start(tabId){
 if(job||review)stop('NEW_RUN');const ticket=++generation;
 clearPreview();$('legacy-names').hidden=true;$('structured-category').hidden=false;$('manual-controls').hidden=true;$('run-cancel').disabled=false;
 diagnosticLines=[];$('entry-state').textContent='';$('route-diagnostic').hidden=true;$('copy-route-diagnostic').hidden=true;$('run-skipped').textContent='';
 window.n36Diagnostics?.publish({stage:'collecting'});
 let stage='start-path',kind='start',path='';
 try{
  const tab=await chrome.tabs.get(tabId),origin=startOrigin(tab.url??'');
  const beginResult=await chrome.runtime.sendMessage({type:'n36-begin'});if(!beginResult?.ok)throw Error(['APP_UPDATE_REQUIRED','APP_FINISH_CURRENT_EDIT'].includes(beginResult?.code)?beginResult.code:'OPEN_ONE_AUTHENTICATED_RAKEEZ_TAB');window.n36Diagnostics?.publish({receiverCapability:beginResult.receiverCapability});window.n36AutomaticBatch=beginResult.batchId;window.n36CollectionFinished=false;
  path=new URL(tab.url).pathname+new URL(tab.url).search;
  safeRoute(origin,new URL(tab.url).pathname+new URL(tab.url).search);
  job={tabId,origin,batchExpires:Date.now()+1800000,deadline:Date.now()+RUN_LIMITS.milliseconds,routes:[],categories:[],visited:new Set(),warnings:[],skipped:[],pages:0,loops:0,series:new Map(),fetches:new Map(),context:null,rosterSchools:new Set(),roleSwitchUsed:false,gatewaySettleUntil:null,pendingSchoolTables:[],studentRowsSeen:0,sourceRows:[],reportPages:0,excluded:0,windowPages:0,sourceBytes:0,expires:null,expiryTimer:null};
  job.timer=setTimeout(()=>{if(job?.sourceRows.length===0&&ticket===generation)stop('TIME_LIMIT');},RUN_LIMITS.milliseconds); // No names held indefinitely during entry/choice.
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
   current(ticket);
   // A proved report end is independent of optional metadata/MyStudents discovery.
   if(job.windowPages&&(job.windowPages>=RUN_LIMITS.pages||Date.now()>=job.deadline))await pauseCollection(ticket);current(ticket);job.pages++;job.windowPages++;
   if(!next.page){
    stage=next.kind==='role'?'role-selection':'navigation-redirect';kind=next.kind;path=next.path;
    const labels={role:'دور المعلم',gateway:'مدخل المدرسة',metadata:'بيانات المعلم',classes:'الفصول',students:'أسماء الطلاب',timetable:'الجدول الأسبوعي'};
    const target=safeRoute(origin,next.path,next.context??job.context);if(/\/ChangeUserTypeToTeacherFromParent\//i.test(new URL(target).pathname)){if(job.roleSwitchUsed)throw Error('ROLE_SWITCH_REPEATED');job.roleSwitchUsed=true;}announce('جار قراءة البيانات المتاحة…');
    job.readOffset=next.rowOffset??0;
    try{
     if(next.kind==='students'&&/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(new URL(target).pathname))next.page=await readReport(next,ticket,alive);
     else {await chrome.tabs.update(tabId,{url:target});await ready(tabId,origin,ticket);if(next.kind==='gateway'&&next.context?.kind==='selected-teacher-card'&&job.roleSwitchUsed)job.gatewaySettleUntil=Date.now()+30000;next.page=await inspect(tabId,origin,next.kind,alive);}current(ticket);
    }
    catch(e){if(!['students','timetable'].includes(next.kind)||!e.incomplete&&e.message!=='PAGE_TIMEOUT')throw e;current(ticket);
     const optional=e.message==='ROSTER_LINKS_UNAVAILABLE'&&e.diagnostic?.roster?.cause==='MAIN_FRAME_READ_LINK_ABSENT'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(target).pathname);
     const redundant=e.message==='ROSTER_LINKS_UNAVAILABLE'&&e.diagnostic?.roster?.cause==='MAIN_FRAME_READ_LINK_ABSENT'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(new URL(target).pathname)&&reportsComplete(job.series)&&job.sourceRows.length>0&&!job.warnings.some(w=>w.category==='students')&&!job.routes.some(r=>r.kind==='students'&&/^\/SchoolManagmentReports\//i.test(r.path));
     if(e.observedRows)job.studentRowsSeen+=e.observedRows;
     if(!redundant)showDiagnostic(e.diagnostic);
     next.page={tables:[],links:[],warnings:redundant?[]:[{category:next.kind,code:e.message,optional}],skipped:[]};
    }

   }
   page=next.page;if(page.runContext){if(job.context?.schoolId&&page.runContext.schoolId&&job.context.schoolId!==page.runContext.schoolId)throw Error('SCHOOL_CONTEXT_CHANGED');job.context={...job.context,...page.runContext};}
   for(const school of page.schoolNames??[]){if(job.context?.schoolName&&job.context.schoolName!==school)throw Error('SCHOOL_CONTEXT_CHANGED');job.rosterSchools.add(school);job.context={...job.context,schoolName:school};if(job.rosterSchools.size>1)throw Error('SCHOOL_CONTEXT_CHANGED');}
   if(next.kind==='home'&&page.links.some(l=>l.kind==='gateway'&&l.context?.kind==='selected-teacher-card')){job.pendingSchoolTables=page.tables;page={...page,tables:[]};}
   if(next.kind==='gateway'&&job.pendingSchoolTables.length){page={...page,tables:[...job.pendingSchoolTables,...page.tables]};job.pendingSchoolTables=[];job.gatewaySettleUntil=null;}
   if(page.diagnostic&&(page.warnings.length||page.pagination?.terminal))showDiagnostic(page.diagnostic);
   job.warnings.push(...page.warnings);job.warnings=[...new Map(job.warnings.map(w=>[w.category+'|'+w.code,w])).values()];
   if(next.kind==='students'&&page.duplicates)job.warnings.push({category:'students',code:'DUPLICATE_STUDENT_IDENTITY'});
   job.excluded+=(page.excluded??0)+(page.duplicates??0);
   if(page.pagination){
    const p=page.pagination;let series=job.series.get(p.series);
    if(!series){series={total:p.total,last:0,pages:new Set(),gap:false,terminal:false};job.series.set(p.series,series);}
    if(series.total!==null&&p.total!==null&&series.total!==p.total||series.pages.has(p.current)){series.gap=true;job.warnings.push({category:'students',code:'PAGINATION_REPEAT_OR_CHANGED'});}
    if(p.total!==null)series.total=p.total;
    series.pages.add(p.current);series.last=Math.max(series.last,p.current);series.terminal ||= p.terminal&&p.current===p.total;
   }
   for(const skipped of page.skipped??[]){showDiagnostic(skipped.diagnostic);job.skipped.push(skipped.kind);}
   if(job.skipped.length)$('run-skipped').textContent=`لم تُجمع بيانات الروابط المستبعدة: ${[...new Set(job.skipped)].map(kindLabel).join('، ')}. عُرض فقط ما جُمع من روابط مستقلة مسموحة؛ سبب الاستبعاد موضح في التشخيص الآمن دون قيم خاصة.`;
   for(const table of page.tables){
    // Student data is admitted only through the safeguarded report/pager reader.
    if(table.category==='students'&&next.kind!=='students')continue;
    try{
     let rows;
     if(table.category==='students'){
      const [header,...lines]=table.text.split('\n');rows=[];
      for(const line of lines){try{rows.push(...parseCategoryTable('students',header+'\n'+line));}catch{job.excluded++;job.warnings.push({category:'students',code:'INVALID_ROWS_EXCLUDED'});}}
     }else rows=parseCategoryTable(table.category,table.text);
     if(table.category==='school'){
      if(job.context?.schoolName&&job.context.schoolName!==rows[0].name)throw Error('SCHOOL_CONTEXT_CHANGED');
      job.context={...job.context,schoolName:rows[0].name};
     }
     if(table.category==='students'){
      job.studentRowsSeen+=rows.length;
      for(const row of rows){
       const bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength+256;
       if(job.sourceBytes+bytes>RUN_LIMITS.sourceBytes){job.memoryFull=true;job.excluded++;job.warnings.push({category:'students',code:'SOURCE_MEMORY_BUDGET'});continue;}
       try{job.sourceRows=appendSourceRows(job.sourceRows,[row]);job.sourceBytes+=bytes;
        if(!job.expires){job.expires=Date.now()+RUN_LIMITS.reviewMilliseconds;job.expiryTimer=setTimeout(()=>{if(ticket===generation)stop('REVIEW_EXPIRED');},RUN_LIMITS.reviewMilliseconds);}
       }catch(e){job.excluded++;job.warnings.push({category:'students',code:e.message});}
      }
     }else{
      const merged=mergePage(job.categories,table.category,rows);
      for(const c of merged)validateCategory(c.category,c.rows);bundle(merged);job.categories=merged;
     }
    }
    catch(e){if(e.message==='SCHOOL_CONTEXT_CHANGED')throw e;job.warnings.push({category:table.category,code:/^[A-Z_]+$/.test(e.message)?e.message:'UNRESOLVED_CATEGORY'});}
   }
   window.n36Diagnostics?.publish({stage:'collecting',staged:job.sourceRows.length,observed:job.studentRowsSeen,excluded:job.excluded,processedPages:job.reportPages});
   $('run-counts').textContent=window.n36AutomaticBatch?'':`${job.pages} صفحات؛ ${job.sourceRows.length} طلاب؛ ${job.categories.reduce((n,c)=>n+c.rows.length,0)} صفًا إجمالًا من فئات مختلفة. لا تصدير ولا إضافة إلى ركيز.`;
   if(page.rowContinuation!==null&&page.rowContinuation!==undefined)job.routes.unshift({kind:'students',path:next.path,rowOffset:page.rowContinuation});
   for(const link of page.links){
    try{safeRoute(origin,link.path,link.context??job.context);}catch(e){throw routeError(e,link.kind==='role'?'role-selection':'navigation-redirect',link.kind,link.path);}
    if(sourcePageSeen(origin,link.path)||job.visited.has(routeIdentity(origin,link.path))||job.routes.some(r=>routeIdentity(origin,r.path)===routeIdentity(origin,link.path))){if(link.pagination)job.loops++;continue;}
    if(link.pagination)job.routes.unshift(link);else job.routes.push(link);
   }
   // Process actual report hrefs in page order even when responses settle out of order.
   job.routes.sort((a,b)=>{const page=r=>r.kind==='students'&&/^\/SchoolManagmentReports\//.test(r.path)?Number(new URL(r.path,origin).searchParams.get('page')??1):Infinity;return page(a)-page(b);});
   next=job.routes.shift();if(next)job.visited.add(routeIdentity(origin,next.path));
   if(job.memoryFull){job.remainingReportPages=[next,...job.routes].filter(r=>r?.kind==='students'&&/^\/SchoolManagmentReports\//i.test(r.path)).length;cancelReports(job);break;}

  }
  current(ticket);await inspect(tabId,origin,'guard',alive);current(ticket);
  if(job.sourceRows.length)await finishCollection(ticket);
  else stop('SOURCE_NOT_AVAILABLE');
 }catch(e){if(ticket===generation){routeError(e,stage,kind,path);stop(/^[A-Z_]+$/.test(e.message)?e.message:'ACCESS_OR_PAGE_UNAVAILABLE',e.diagnostic,{stage,kind});}}
}
// AI: completed rows belong to the run's original source, never the active run tab.
function completedSourceReview(active,url){
 return {tabId:active.tabId,origin:active.origin,context:active.context,expires:active.expires,sourceRoute:sourceReviewRoute(url,active.origin,active.context)};
}
function sourceReviewRoute(url,origin,context){
 const u=new URL(url);if(u.origin!==origin)throw Error('ORIGIN_CHANGED');
 safeRoute(origin,u.pathname+u.search,context);
 // Only pagination within the SAME authorized page is normal movement.
 for(const key of [...u.searchParams.keys()])if(['page','pagenumber'].includes(key.toLowerCase()))u.searchParams.delete(key);
 return u.pathname+'?'+JSON.stringify([...u.searchParams].sort());
}
// AI: resource-only read continuation, independent of all class receipts.
async function pauseCollection(ticket){
 const active=job;
 if(window.n36AutomaticBatch){await Promise.all(active.fetches.values());current(ticket);await inspect(active.tabId,active.origin,'guard',()=>job===active);active.windowPages=0;active.deadline=Date.now()+RUN_LIMITS.milliseconds;return;}
 window.n36Diagnostics?.publish({stage:'paused'});
 await Promise.all(active.fetches.values());current(ticket);
 review={tabId:active.tabId,origin:active.origin,context:active.context,expires:active.expires??Date.now()+RUN_LIMITS.reviewMilliseconds};
 // A pre-roster discovery pause still owns one fixed privacy lease.
 if(!active.expires){active.expires=review.expires;active.expiryTimer=setTimeout(()=>stop('REVIEW_EXPIRED'),Math.max(0,active.expires-Date.now()));}
 announce(`بلغت القراءة ميزانية الصفحات أو الوقت؛ جُمعت ${active.sourceRows.length} أسماء مؤقتًا. جمع المزيد للقراءة فقط، دون نقل أو حفظ. تبقى المهلة الأصلية.`);
 $('collection-continue').hidden=false;armReview();
 await new Promise((resolve,reject)=>{
  const button=$('collection-continue');
  const go=()=>{button.removeEventListener('click',go);continueReject=null;resolve();};
  button.addEventListener('click',go,{once:true});
  continueReject=e=>{button.removeEventListener('click',go);reject(e);};
 });
 current(ticket);await inspect(active.tabId,active.origin,'guard',()=>job===active);current(ticket);
 clearPreview();active.windowPages=0;active.deadline=Date.now()+RUN_LIMITS.milliseconds;
}
async function finishCollection(ticket){
 const active=job;clearTimeout(active.timer);await Promise.all(active.fetches.values());current(ticket);
 const coverage=sourceCoverage({series:active.series,warnings:active.warnings,pendingReportPages:active.remainingReportPages??0}),{complete}=coverage;
 const source=await chrome.tabs.get(active.tabId);current(ticket);
 clearTimeout(active.expiryTimer);
 const warnings=[...new Set(active.warnings.filter(w=>w.category==='students'&&!(w.optional&&complete)).map(w=>w.code))];
 showDiagnostic({run:{...coverage,staged:active.sourceRows.length,observed:active.studentRowsSeen,complete:complete?active.sourceRows.length:0,excluded:warnings.join(',')}});
 $('run-counts').textContent='';
 $('run-missing').textContent='';$('run-skipped').textContent=active.excluded?`استُبعد ${active.excluded} صفًا؛ التفاصيل في التشخيص.`:warnings.some(code=>!['PAGINATION_MISSING_NEXT','ROSTER_LINKS_UNAVAILABLE'].includes(code))?'بعض الصفحات غير محسومة؛ التفاصيل في التشخيص.':'';
 window.n36Diagnostics?.publish({excluded:active.excluded});
 cancelReports(active);job=null;
 presentCollectedSource({...active,sourceURL:source.url},coverage);
}
export function presentCollectedSource(active,coverage){
 // Install the complete review before publishing rows/starting asynchronous transfers.
 review=completedSourceReview(active,active.sourceURL);
 review.expires=window.n36AutomaticBatch?Math.min(active.batchExpires??Date.now()+1800000,Date.now()+1800000):active.expires;
 const rows=active.sourceRows.map(row=>Object.freeze({...row}));
 const setup=(active.categories??[]).filter(c=>c.category!=='students'&&!(active.warnings??[]).some(w=>w.category===c.category)).map(c=>({...c,provenance:['teacher-readonly-run']}));
 if(rows.length&&!setup.some(c=>c.category==='classes'))setup.push({category:'classes',provenance:['teacher-readonly-run'],rows:[...new Set(rows.map(r=>r.classroom))].map(classroom=>({classroom}))});
 if(active.context?.schoolName&&!(active.warnings??[]).some(w=>w.category==='school')&&!setup.some(c=>c.category==='school'))setup.push({category:'school',provenance:['teacher-readonly-run'],rows:[{name:active.context.schoolName}]});
 window.dispatchEvent(new CustomEvent('n36:source-roster',{detail:{rows,setup,...coverage,excluded:active.excluded,hasNext:false,sourceIssues:(active.warnings??[]).filter(w=>['teacher','principal','school','department','classes','timetable'].includes(w.category)).map(w=>({field:w.category,reason:/AMBIGUOUS/.test(w.code)?'ambiguous':'unsupported',count:1}))}}));
 window.n36Diagnostics?.publish({setupPhase:'source',setupFields:setup.map(c=>c.category)});announce('جار حفظ المتاح في ركيز…');
 if(!window.n36AutomaticBatch)armReview();else reviewTimer=setTimeout(()=>stop('REVIEW_EXPIRED'),Math.max(0,review.expires-Date.now()));
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
 document.body.classList.add('run-page','automatic-mode');$('manual-controls').hidden=true;$('one-start').hidden=true;
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
  }catch(e){showDiagnostic({stage:'start',reason:/^[A-Z_]+$/.test(e.message)?e.message:'ACCESS_OR_PAGE_UNAVAILABLE',category:'students'});announce('افتح مدرستي، ثم شغّل الإضافة من صفحتها. افتح حساب ركيز وسجّل الدخول في تبويب واحد قبل البدء.');}
  finally{$('one-start').disabled=false;}
 };
 $('one-start').addEventListener('click',()=>launch());
 $('noor-start').addEventListener('click',()=>launch('noor'));
}
$('run-reopen').addEventListener('click',()=>{announce('افتح مدرستي، ثم شغّل الإضافة من صفحتها.');$('run-reopen').hidden=true;});
$('run-cancel').addEventListener('click',()=>stop());
window.addEventListener('n36:discard',()=>{if(runToken)stop();});
window.addEventListener('n36:exported',()=>{if(!runToken||window.n36AutomaticBatch)return;if(review?.source!=='noor'&&window.n36HasSourceRoster?.()){announce('نُقل الفصل المختار للمراجعة فقط. يمكنك اختيار فصل آخر خلال المهلة الأصلية؛ لم تُضف أسماء تلقائيًا.');return;}generation++;clearPreview();$('run-cancel').disabled=true;announce('اكتمل التصدير الصريح ومُسحت المعاينة المؤقتة. لم تُضف بيانات إلى ركيز.');});
window.n36BeforeExport=async()=>{
 if(!runToken)return;const snapshot=review;if(!snapshot||Date.now()>=snapshot.expires){stop('REVIEW_EXPIRED');throw Error('REVIEW_EXPIRED');}
 try{if(snapshot.source==='noor'){const fresh=await noorRead(snapshot.tabId);if(fresh.url!==snapshot.url||JSON.stringify(fresh.names)!==snapshot.names)throw Error('SOURCE_CHANGED');}else {const tab=await chrome.tabs.get(snapshot.tabId);if(snapshot.sourceRoute&&sourceReviewRoute(tab.url,snapshot.origin,snapshot.context)!==snapshot.sourceRoute)throw Error('SOURCE_CHANGED');await inspect(snapshot.tabId,snapshot.origin,'guard',()=>review===snapshot);}if(review!==snapshot)throw Error('SOURCE_CHANGED');}catch(e){stop('SOURCE_CHANGED');throw e;}
};
window.n36HandoffSource=()=>!job&&review&&Date.now()<review.expires?{source:review.source==='noor'?'noor':'madrasati',scope:review.source==='noor'?'selected-visible-partial':'reviewed-run'}:null;
window.addEventListener('pagehide',()=>{cancelReports(job??review);clearTimeout(reviewTimer);clearInterval(reviewClock);if(job){clearTimeout(job.timer);clearTimeout(job.expiryTimer);job.sourceRows.length=0;job.routes.length=0;job.categories.length=0;}clearPreview();channel.close();});
// Only the explicit run's source is monitored; no all-tab discovery or startup read.
chrome.tabs.onRemoved.addListener(id=>{if(id===job?.tabId||id===review?.tabId)stop('SOURCE_CLOSED');});
chrome.tabs.onUpdated.addListener((id,change)=>{
 const target=job??review;if(id!==target?.tabId||!change.url)return;
 if(review?.sourceRoute){try{if(sourceReviewRoute(change.url,target.origin,target.context)!==review.sourceRoute)throw Error('SOURCE_CHANGED');}catch{stop('SOURCE_CONTEXT_CHANGED');}return;}
 if((review||target.fetches?.size)&&!target.expectedNavigation){stop('SOURCE_CONTEXT_CHANGED');return;}
 if(new URL(change.url).origin!==target.origin||/(?:login|signin|signout|logout|oauth)/i.test(new URL(change.url).pathname))stop('ORIGIN_OR_LOGIN_CHANGED');
});
setInterval(async()=>{
 if(!review||guardBusy||window.n36CollectionFinished)return;if(Date.now()>=review.expires){stop('REVIEW_EXPIRED');return;}guardBusy=true;
 const snapshot=review;try{if(snapshot.source==='noor'){const fresh=await noorRead(snapshot.tabId);if(fresh.url!==snapshot.url||JSON.stringify(fresh.names)!==snapshot.names)throw Error('SOURCE_CHANGED');}else await inspect(snapshot.tabId,snapshot.origin,'guard',()=>review===snapshot);}catch{if(review===snapshot)stop('ORIGIN_OR_LOGIN_CHANGED');}finally{guardBusy=false;}
},3000);
if(!runToken)$('one-start').disabled=false;
$('copy-route-diagnostic').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('route-diagnostic').value);$('route-copy-status').textContent='نُسخ التشخيص الآمن فقط. لم يُرسل إلى أي جهة.';}catch{$('route-copy-status').textContent='حدّد سطر التشخيص الآمن وانسخه يدويًا؛ لم يُرسل شيء.';}});

// AI: reached only after the actual ESM graph and entry handlers initialized.
window.n36Diagnostics?.moduleReady("run-controller.js");

// AI: successful completion stops source inspection and erases run-local names.
window.addEventListener('n36:automatic-finished',({detail})=>{
 window.n36CollectionFinished=true;
 if(detail.unresolved)return; // Explicit retry can still preflight the bounded original source.
 chrome.runtime.sendMessage({type:'n36-cancel'}).catch(()=>{});
 clearPreview(false,true);window.n36AutomaticBatch=null;$('run-cancel').disabled=true;$('run-counts').textContent='';
});
