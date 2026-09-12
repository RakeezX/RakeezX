/** Visible identity only; technical Product IDs remain unchanged. */
import { html } from './dom.js';

export const BRAND_NAME = 'رَكيز المعلم';
export const BRAND_SIGNATURE = 'RAKEEZ X';
export const APP_ICON_URL = new URL('../../assets/icon-192.png', import.meta.url).href;
const SMALL_ICON_URL = new URL('../../assets/favicon-32.png', import.meta.url).href;

export function brandLockup({ signature = false, appIcon = false, prominent = false, caption = '' } = {}) {
  return html`<span class="brand-lockup ${prominent ? 'brand-lockup--prominent' : ''}" aria-label="${BRAND_NAME}">
    <img class="brand-lockup__icon ${appIcon ? 'brand-lockup__icon--app' : ''}" src="${appIcon ? APP_ICON_URL : SMALL_ICON_URL}" width="40" height="40" alt="" aria-hidden="true">
    <span class="brand-lockup__copy"><span class="brand-lockup__name"><strong>رَكيز</strong> <span>المعلم</span></span>${signature ? html`<small class="brand-lockup__signature" dir="ltr">${BRAND_SIGNATURE}</small>` : ''}${caption ? html`<span class="brand-lockup__caption">${caption}</span>` : ''}</span>
  </span>`;
}
