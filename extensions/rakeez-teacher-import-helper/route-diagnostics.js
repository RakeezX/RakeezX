// Plain script: shared by the extension page and its explicit ISOLATED-world reader.
// Only fixed vocabulary survives. No origin, query value, name or arbitrary path segment.
(() => {
 const segments=new Set('teacher student students school schools home profile info personal classes class roster schedule timetable edit logout login delete save admin manager readonly view index schoolmanagment actions dashboards teachersreports statistics myinfo teacherschedule schoolmanagmentreports studentinfo classstudentinfo changeusertypetoteacherfromparent mystudents schoolschedule'.split(' '));
 const stages=new Set(['start-path','role-selection','auxiliary-link','navigation-redirect','link-discovery']);
 const reasons=new Set(['UNSAFE_ROUTE','UNSAFE_LINK','ORIGIN_CHANGED']);
 const kinds=new Set(['start','role','metadata','classes','students','timetable']);
 const allowedKeys=new Set(['page','pagenumber','classid','sectionid','id','name','schoolid']);
 const safeKeys=new Set(['token','accessToken','returnUrl','redirect','redirectUrl','redirectUri','session','code','auth','schoolId','studentId','view','mode','action','filter','sort','term','tab','type','lang','role','route','source']);
 // One route contract used by the extension controller and injected visible-page reader.
 globalThis.rakeezRoutePolicy=(origin,value,context=null)=>{
  const fail=detail=>{const e=Error(detail==='origin'?'ORIGIN_CHANGED':'UNSAFE_ROUTE');e.routeDetail=detail;throw e;};
  const u=new URL(value,origin);if(u.origin!==origin||u.username||u.password)fail('origin');
  const entries=[...u.searchParams],seen=new Set();for(const [key] of entries){const k=key.toLowerCase();if(seen.has(k))fail('duplicate-key');seen.add(k);}
  const transition=/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\/([a-f0-9]{32})\/?$/i.exec(u.pathname);
  const schoolRead=/^\/(?:SchoolManagment\/Actions\/MyStudents|SchoolSchedule\/Schedule\/TeacherSchedule)\/?$/i.test(u.pathname);
  if(transition){
   if(context?.kind!=='selected-teacher-card'||context.href!==u.pathname+u.search||context.roleTargetId?.toLowerCase()!==transition[1].toLowerCase())fail('unexpected-path');
   if(entries.length!==1||entries[0][0]!=='Name')fail('unknown-key');
   if(!entries[0][1])fail('empty-allowed-value');
   if(entries[0][1].length>120||!/[\p{L}]/u.test(entries[0][1])||/[\u0000-\u001f\u007f@<>]|https?:/i.test(entries[0][1]))fail('invalid-allowed-value');
  }else{
   if(/(?:login|signin|signout|logout|oauth|auth|save|delete|remove|create|update|edit|invite|grade|mark|attendance|admin|manager|send|changeusertype)/i.test(u.pathname))fail('unexpected-path');
   if(schoolRead){
    if(entries.length!==1||entries[0][0]!=='SchoolId')fail('unknown-key');
    if(!/^[a-f0-9]{32}$/i.test(entries[0][1]))fail(entries[0][1]?'invalid-allowed-value':'empty-allowed-value');
    if(!context?.schoolId||context.schoolId.toLowerCase()!==entries[0][1].toLowerCase())fail('school-context');
   }else for(const [key,value] of entries){if(!/^(?:page|pagenumber|classid|sectionid|id)$/i.test(key))fail('unknown-key');if(!value)fail('empty-allowed-value');if(!/^[A-Za-z0-9_-]{1,80}$/.test(value))fail('invalid-allowed-value');}
  }
  u.hash='';return u.href;
 };
 globalThis.rakeezRouteDiagnostic=(stage,reason,category,value,detail='')=>{
  let template='/:redacted',keys=[],unknownKeys=0;
  const details=new Set(['unknown-key','empty-allowed-value','invalid-allowed-value','duplicate-key','unexpected-path','disabled','download','form','non-get','empty-href','javascript-href','origin','ambiguous-home','school-context']);
  if(!details.has(detail))detail='unexpected-path';
  try{
   const u=new URL(value,'https://diagnostic.invalid');
   template='/'+u.pathname.split('/').filter(Boolean).slice(0,8).map(p=>segments.has(p.toLowerCase())?p.toLowerCase():':id').join('/');
   if(u.pathname.split('/').filter(Boolean).length>8)template+='/:more';
   const entries=[...u.searchParams],seen=new Set();
   keys=[...new Set(entries.map(([k])=>k).filter(k=>allowedKeys.has(k.toLowerCase())||safeKeys.has(k)).map(k=>allowedKeys.has(k.toLowerCase())?k.toLowerCase():k))].sort().slice(0,8);
   unknownKeys=Math.min(new Set(entries.map(([k])=>k).filter(k=>!allowedKeys.has(k.toLowerCase())&&!safeKeys.has(k))).size,20);
   for(const [key,value] of entries){const k=key.toLowerCase();if(seen.has(k)){detail='duplicate-key';break;}seen.add(k);if(!allowedKeys.has(k)){detail='unknown-key';continue;}if(!value)detail='empty-allowed-value';else if(k!=='name'&&!/^[A-Za-z0-9_-]{1,80}$/.test(value))detail='invalid-allowed-value';}

  }catch{}
  return {version:'0.4.5',stage:stages.has(stage)?stage:'navigation-redirect',reason:reasons.has(reason)?reason:'UNSAFE_ROUTE',category:kinds.has(category)?category:'start',template,keys,unknownKeys,detail};
 };
})();
