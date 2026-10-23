// AI: inert structural projection. A missing supported parser is a finite result,
// never permission to parse real input through another tool or execute its HTML.
export function projectPassiveResponse(value,{Parser,decodeBase64,targetURL,maxBytes=2000000}={}){
 const result={reason:'BODY_SHAPE',tables:0,nestedTables:0,candidates:0,styles:0,stylesheets:0,base:false,shape:null};
 if(!value||typeof value.body!=='string'||typeof value.base64Encoded!=='boolean')return result;
 let body=value.body;
 if(value.base64Encoded){try{body=decodeBase64(body);}catch{return {...result,reason:'ENCODING_INVALID'};}}
 if(typeof body!=='string')return {...result,reason:'ENCODING_INVALID'};
 if(new TextEncoder().encode(body).byteLength>maxBytes)return {...result,reason:'BODY_LIMIT'};
 if(typeof Parser!=='function')return {...result,reason:'PARSER_UNAVAILABLE'};
 let doc;try{doc=new Parser().parseFromString(body,'text/html');}catch{return {...result,reason:'PARSE_ERROR'};}
 try{
  const tables=[...doc.querySelectorAll('table')],bounded=n=>Math.min(n,100);
  result.tables=bounded(tables.length);result.nestedTables=bounded(tables.filter(t=>t.parentElement?.closest('table')).length);result.styles=bounded(doc.querySelectorAll('style').length);result.stylesheets=bounded(doc.querySelectorAll('link[rel~=stylesheet i]').length);result.base=!!doc.querySelector('base[href]');
  const text=n=>n.textContent.trim().replace(/\s+/g,' '),known=v=>v===''||v==='اليوم'||/^الحصة (?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|[1-9][0-9]?)$/.test(v);
  const candidates=tables.filter(t=>!t.parentElement?.closest('table')&&!t.querySelector('table')&&t.rows.length>1&&[...t.rows[0].cells].some(c=>/^الحصة /.test(text(c))));result.candidates=bounded(candidates.length);
  if(candidates.length!==1)return {...result,reason:candidates.length?'TARGET_AMBIGUOUS':'TARGET_ABSENT'};
  const table=candidates[0],head=[...table.rows[0].cells].map(text),rows=[...table.rows].slice(1),days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
  const row=rows.find(r=>r.cells.length&&days.includes(text(r.cells[0]))),cell=row&&[...row.cells].slice(1).find(c=>c.querySelector('.schedule-card'));
  const card=cell?.querySelector('.schedule-card'),subject=card?.querySelector(':scope > .title > h2'),classroom=card?.querySelector(':scope > small'),a=card?.parentElement;
  result.shape={headers:head.slice(0,21).map(v=>known(v)?v:'[other]'),rowCount:bounded(table.rows.length),weekday:row?text(row.cells[0]):null,column:cell?.cellIndex??null,navOnly:!!table.closest('nav,header,footer,form'),hiddenAttribute:!!(table.closest('[hidden],[aria-hidden=true]')||cell?.closest('[hidden],[aria-hidden=true]')),lesson:null};
  if(!cell||a?.tagName!=='A'||!subject||!classroom)return {...result,reason:'TARGET_UNRESOLVED'};
  const safeLabel=n=>{const v=text(n);return v.length>0&&v.length<=80&&!/[\t\r\n@]|https?:/i.test(v)?v:'[unresolved]';};
  const u=new URL(a.getAttribute('href'),targetURL),target=new URL(targetURL),keys=['SchoolId','lectureId','dateTicks','subjectId','classroomId'];
  const valid=u.origin===target.origin&&u.pathname==='/SchoolSchedule/Schedule/ManageLecture'&&!u.hash&&!u.username&&!u.password&&[...u.searchParams].length===5&&keys.every(k=>u.searchParams.getAll(k).length===1)&&/^[a-f0-9]{32}$/i.test(u.searchParams.get('SchoolId'))&&['lectureId','subjectId','classroomId','dateTicks'].every(k=>/^[1-9][0-9]{0,18}$/.test(u.searchParams.get(k)));
  const sameSchool=u.searchParams.get('SchoolId')===target.searchParams.get('SchoolId');
  result.shape.lesson={subject:safeLabel(subject),classroom:safeLabel(classroom),queryKeys:keys,validTuple:valid,schoolRelation:sameSchool?'SAME':'DIFFERENT',anchorCount:Math.min(cell.querySelectorAll('a[href]').length,10),redactedHref:valid?'/SchoolSchedule/Schedule/ManageLecture?SchoolId='+((sameSchool?'a':'b').repeat(32))+'&lectureId=1&dateTicks=638900000000000000&subjectId=2&classroomId=3':null};
  return {...result,reason:valid?'PROJECTED':'UNSAFE_TUPLE'};
 }catch{return {...result,reason:'PROJECTION_UNRESOLVED'};}
}

// Store only finite selected fields: no raw event, header or request export.
export async function waitForTimetableDocument({readEvents,cursor,targetURL,currentURL,now=Date.now,timeoutMs=8000}){
 let request=null,response=null,finished=false;const deadline=now()+timeoutMs;
 while(now()<deadline){
  const batch=await readEvents({afterSequence:cursor,methods:['Network.requestWillBeSent','Network.responseReceived','Network.loadingFinished'],limit:1000,timeoutMs:1000});cursor=batch.cursor;
  if(batch.truncated)return {reason:'EVENTS_TRUNCATED'};
  for(const e of batch.events){const p=e.params;
   if(e.method==='Network.requestWillBeSent'&&p?.type==='Document'&&p.request?.url===targetURL){if(request&&request.id!==p.requestId)return {reason:'DOCUMENT_AMBIGUOUS'};request={id:p.requestId,frame:p.frameId,loader:p.loaderId,method:p.request.method,redirect:!!p.redirectResponse};}
   if(e.method==='Network.responseReceived'&&p?.type==='Document'&&p.response?.url===targetURL){if(response&&response.id!==p.requestId)return {reason:'DOCUMENT_AMBIGUOUS'};response={id:p.requestId,frame:p.frameId,loader:p.loaderId,url:p.response.url,status:p.response.status};}
   if(e.method==='Network.loadingFinished'&&request?.id===p?.requestId)finished=true;
  }
  if(request&&response&&finished){if(request.id!==response.id||request.frame!==response.frame||request.loader!==response.loader||request.method!=='GET'||request.redirect||response.status!==200||await currentURL()!==targetURL)return {reason:'DOCUMENT_MISMATCH'};return {reason:'DOCUMENT_READY',requestId:request.id,cursor};}
 }
 return {reason:'DOCUMENT_TIMEOUT'};
}
