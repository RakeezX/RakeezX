/** AI: finite IANA wall-time resolution for the local Publisher preparation.
 * Refuse skipped/repeated wall times; never silently pick one DST occurrence.
 * Existing teacher reminder projection continues to use its canonical PG path.
 */
import { validDateTimeValue, dateControlBounds, normalizeDateTimeDigits } from './rakeez-datetime-values.js';
export function resolveNotificationSchedule({date,time,timezone}, now=Date.now()) {
  date=normalizeDateTimeDigits(date);time=normalizeDateTimeDigits(time);
  if(!Number.isSafeInteger(now)||typeof timezone!=='string'||timezone.length>80)return {status:'invalid'};
  const bounds=dateControlBounds('planning','','',new Date(now));
  if(!date||!time||!validDateTimeValue(date,'date',bounds.min,bounds.max)||!validDateTimeValue(time,'time'))return {status:'invalid'};
  let format;
  try { format=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); }
  catch { return {status:'invalid_timezone'}; }
  const target=date+'T'+time, rough=Date.parse(target+':00Z'), matches=[];
  // Explicit finite search, including half/quarter-hour zones and both DST folds.
  for(let offset=-14*60;offset<=14*60;offset++) {
    const epoch=rough+offset*60000, p=Object.fromEntries(format.formatToParts(epoch).map(v=>[v.type,v.value]));
    if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===target)matches.push(epoch);
  }
  return matches.length===1?{status:'resolved',epochMs:matches[0],timezone:format.resolvedOptions().timeZone}:
    {status:matches.length?'ambiguous_time':'nonexistent_time'};
}
