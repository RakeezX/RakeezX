/** Visible identity only; technical Product IDs remain unchanged. */
import { html } from './dom.js';

export const BRAND_NAME = 'رَكيز المعلم';
export const BRAND_SIGNATURE = 'RAKEEZ X';
export const APP_ICON_URL = new URL('../../assets/icon-192.png', import.meta.url).href;
const HEADER_LIGHT_URL = new URL('../../assets/header-light-standard.svg', import.meta.url).href;
const HEADER_LIGHT_COMPACT_URL = new URL('../../assets/header-light-compact.svg', import.meta.url).href;
const HEADER_DARK_URL = new URL('../../assets/header-dark-standard.svg', import.meta.url).href;
const HEADER_DARK_COMPACT_URL = new URL('../../assets/header-dark-compact.svg', import.meta.url).href;

export function brandLockup({ compact = false, prominent = false, caption = '' } = {}) {
  const width = compact ? 295 : 345;
  const height = compact ? 52 : 56;
  return html`<span class="brand-lockup ${prominent ? 'brand-lockup--prominent' : ''}" role="img" aria-label="${BRAND_NAME}">
    <img class="brand-lockup__image brand-lockup__image--light" src="${compact ? HEADER_LIGHT_COMPACT_URL : HEADER_LIGHT_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    <img class="brand-lockup__image brand-lockup__image--dark" src="${compact ? HEADER_DARK_COMPACT_URL : HEADER_DARK_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    ${caption ? html`<span class="brand-lockup__caption">${caption}</span>` : ''}
  </span>`;
}
