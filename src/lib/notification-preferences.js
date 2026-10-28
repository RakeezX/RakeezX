/** AI: D107 category/channel preparation. Not an OS permission or send grant.
 * Operational lesson/due settings keep their existing schema and implementation.
 * This module has no startup import; the isolated Publisher Preview uses it.
 */
import { notificationScope } from './notification-center.js';
export const NOTIFICATION_CATEGORIES = Object.freeze(['operational','account','announcement','marketing']);
export const NOTIFICATION_CHANNELS = Object.freeze(['inApp','push','email']);
export const CHANNEL_PREFERENCE_PREFIX = 'rakeezx-notification-channels-v1:';
export function defaultChannelPreferences() {
  return { operational:{inApp:true,push:true,email:false}, account:{inApp:true,push:false,email:false},
    announcement:{inApp:true,push:false,email:false}, marketing:{inApp:false,push:false,email:false} };
}
const exact = (v,keys) => v && Object.getPrototypeOf(v)===Object.prototype && Reflect.ownKeys(v).length===keys.length && keys.every(k=>Object.getOwnPropertyDescriptor(v,k)?.enumerable && Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
export function validChannelPreferences(value) {
  return exact(value,NOTIFICATION_CATEGORIES) && NOTIFICATION_CATEGORIES.every(c=>exact(value[c],NOTIFICATION_CHANNELS) && NOTIFICATION_CHANNELS.every(k=>typeof value[c][k]==='boolean'));
}
export function readChannelPreferences(context, storage = globalThis.localStorage) {
  const scope=notificationScope(context); if(!scope)return defaultChannelPreferences();
  try { const raw=storage.getItem(CHANNEL_PREFERENCE_PREFIX+scope); if(!raw||raw.length>2048)return defaultChannelPreferences();
    const value=JSON.parse(raw); return validChannelPreferences(value)?value:defaultChannelPreferences();
  } catch { return defaultChannelPreferences(); }
}
export function writeChannelPreference(context,category,channel,enabled,storage=globalThis.localStorage) {
  const scope=notificationScope(context);
  if(!scope||!NOTIFICATION_CATEGORIES.includes(category)||!NOTIFICATION_CHANNELS.includes(channel)||typeof enabled!=='boolean')return false;
  try { const value=readChannelPreferences(context,storage);value[category][channel]=enabled;
    storage.setItem(CHANNEL_PREFERENCE_PREFIX+scope,JSON.stringify(value));return true;
  } catch { return false; }
}
/** Pure channel choice only. Server audience/owner authorization is separate.
 * Critical account protection can require in-app visibility, never OS or email
 * permission. No email fallback when Push is absent or rejected.
 */
export function notificationChannelDecision(notice, preferences, capabilities) {
  if(!notice||!NOTIFICATION_CATEGORIES.includes(notice.category)||typeof notice.critical!=='boolean'||
     notice.critical&&notice.category!=='account'||!exact(notice.channels,NOTIFICATION_CHANNELS)||
     !NOTIFICATION_CHANNELS.every(k=>typeof notice.channels[k]==='boolean')||!validChannelPreferences(preferences))return null;
  return Object.fromEntries(NOTIFICATION_CHANNELS.map(channel=>{
    const mandatory=notice.critical&&channel==='inApp';
    const requested=mandatory||notice.channels[channel]&&preferences[notice.category][channel];
    const capable=channel==='inApp'?capabilities?.verifiedAccount===true:
      channel==='push'?capabilities?.verifiedAccount===true&&capabilities.pushConsent===true&&capabilities.registrationCurrent===true&&capabilities.permission==='granted':
      capabilities?.verifiedAccount===true&&capabilities.emailVerified===true&&capabilities.emailConsent===true;
    return [channel,requested&&capable];
  }));
}
