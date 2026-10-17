/** AI: exact-key canonical source projection. No student/score reads or source writes. */
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {resolveCalendarRuntime,resolveCalendarDate} from '../../src/lib/calendar-runtime.js';
import {isTeachingDay,isWeekend} from '../../src/models.js';
import {normalizePushPayload} from '../../src/lib/notification-push-core.js';
const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export async function readSource(query,owner,kind,id,preferences) {
  const result=await query('select n44_push_draft.read_source($1::uuid,$2::text,$3::text) as source',[owner,kind,id]);
  const s=result.rows[0]?.source;if(!s)return null;
  if(Buffer.byteLength(JSON.stringify(s))>262144)throw Error('n44_source_bound');
  const stamp=createHash('sha256').update(JSON.stringify(s)).digest('hex');
  const {year,terms,calendars,days,teaching,section,subject,source}=s;
  if([year,teaching,section,subject,source].some(r=>!r || r.deleted) || year.status!=='active' || section.status!=='active' || section.yearId!==year.id)return null;
  let term=terms.find(t=>t.id===teaching.termId);if(!term || term.deleted || term.status==='closed')return null;
  let calendar;
  if(year.calendarPresetId) {
    calendar=resolveCalendarRuntime({year,terms,presetId:year.calendarPresetId,customizations:calendars.filter(c=>c.source==='custom'&&c.presetId).map(c=>({yearId:year.id,presetId:c.presetId,deleted:c.deleted,
      termDateOverrides:Object.entries(c.termDateOverrides??{}).map(([termId,pair])=>({termId,...pair})),exceptions:days.filter(d=>d.calendarId===c.id)}))});
    if(!calendar.ok)return null;term=calendar.terms.find(t=>t.id===term.id);if(!term)return null;
  }
  if(!term.startDate || !term.endDate)return null;
  const inTerm=date=>date>=term.startDate && date<=term.endDate;
  const wall=async(date,time)=>Number((await query("select (extract(epoch from (($1::date+$2::time) at time zone $3))*1000)::bigint::text as ms",[date,time,preferences.timezone])).rows[0].ms);
  const events=[];const add=(payload,dueAt)=>{if(Number.isSafeInteger(dueAt)&&Number.isSafeInteger(payload.expiresAt)&&payload.expiresAt>dueAt)events.push({...payload,dueAt});};
  if(kind==='lesson') {
    const date=source.date,start=source.startTime?.slice(0,5),end=source.endTime?.slice(0,5);
    if(!inTerm(date) || !/^\d{2}:\d{2}$/.test(start??'') || !/^\d{2}:\d{2}$/.test(end??'') || ['cancelled','cancelled_holiday'].includes(source.status))return null;
    let day;
    if(calendar){day=resolveCalendarDate(calendar,date);if(!day.ok)return null;}
    else {const matches=calendars.filter(c=>!c.deleted).map(c=>({c,d:days.find(d=>!d.deleted&&d.calendarId===c.id&&d.date===date)})).filter(x=>x.d);day=(matches.find(x=>x.c.source==='custom')??matches[0])?.d;}
    if(day?!isTeachingDay(day.kind):isWeekend(date))return null;
    const at=await wall(date,start),expiresAt=await wall(date,end);
    if(expiresAt<=at)return null;
    add({id:`lesson:${encodeURIComponent(id)}:${date}:${start}:${end}`,kind,expiresAt,actionPath:`/teaching/${encodeURIComponent(teaching.id)}/attendance?session=${encodeURIComponent(id)}`},at-preferences.lessonMinutes*60000);
  } else {
    if(source.itemDeleted || source.scoreMode!=='subitems' || !source.dueDate || !inTerm(source.dueDate))return null;
    for(const stage of preferences.dueDays){const date=shift(source.dueDate,-stage);if(source.startDate && source.startDate>date || !inTerm(date))continue;
      add({id:`due:${encodeURIComponent(id)}:${source.dueDate}:${date}`,kind,expiresAt:await wall(shift(date,1),'00:00'),actionPath:`/teaching/${encodeURIComponent(teaching.id)}/items`},await wall(date,'00:00'));}
  }
  return {stamp,events};
}
export function sourcePayload(event,now) {
  if(!event || event.dueAt>now)return null;
  const {dueAt,...payload}=event;return normalizePushPayload(payload,now);
}
