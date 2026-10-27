// Locally qualified with the unchanged compiled Native178 module and aligned
// synthetic SDK/backend clock. Historical 400 remains evidence; no live wiring.
/** AI: prospective target from an observed due-event identity, not an invented UI expiry receipt. */
import assert from 'node:assert/strict';
import {resolveNotificationSchedule} from '../../../src/lib/notification-schedule.js';
import {normalizePushPayload} from '../../../src/lib/notification-push-core.js';
export function mobileTargetFromObservedSource(value, timezone, now) {
  assert(typeof timezone==='string'&&timezone.length>0,'n44_ui_saved_timezone_required');
  assert(value.target?.kind==='due'&&value.childIds?.length===1,'n44_ui_due_target_required');
  const prefix='due:'+encodeURIComponent(value.childIds[0])+':';
  assert(value.target.id.startsWith(prefix),'n44_ui_event_source_mismatch');
  const dates=value.target.id.slice(prefix.length).split(':');
  assert(dates.length===2&&dates.every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d),'n44_ui_event_dates_invalid');
  const teaching=value.teachingId;
  assert(typeof teaching==='string'&&/^[a-zA-Z0-9:_-]{1,180}$/.test(teaching),'n44_ui_teaching_identity_invalid');
  const actionPath='/teaching/'+encodeURIComponent(teaching)+'/items';
  assert([actionPath,'/teaching/'+teaching+'/items'].includes(value.target.actionPath),'n44_ui_target_destination_mismatch');
  // The unchanged canonical due projector uses midnight after the event's
  // occurrence date in the saved notification timezone. No current clock/date,
  // window end, guessed timezone or caller-supplied expiry replaces that rule.
  const next=new Date(Date.parse(dates[1]+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const resolved=resolveNotificationSchedule({date:next,time:'00:00',timezone},now);
  assert.equal(resolved.status,'resolved','n44_ui_expiry_unresolved');
  if(Object.hasOwn(value.target,'expiresAt'))assert.equal(value.target.expiresAt,resolved.epochMs,'n44_ui_expiry_mismatch');
  const target={id:value.target.id,kind:'due',expiresAt:resolved.epochMs,actionPath};
  assert.deepEqual(normalizePushPayload(target,now),target,'n44_ui_target_invalid');
  return target;
}
