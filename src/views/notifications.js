import { html } from '../lib/dom.js';
import { notificationSnapshot } from '../lib/notification-center.js';
/** Escaped presentation, adapted from the manifest-verified prototype renderer. */
export function renderNotificationCenter(state, context, now) {
  const { items, unread } = notificationSnapshot(state, context, now);
  return html`<section class="n44-center" dir="rtl" aria-label="إشعارات حسابك">
    <header class="n44-heading"><span class="n44-count" role="status">غير المقروء: ${unread}</span></header>
    <p class="muted n44-note">من حصصك وبنودك الحالية. القراءة والإخفاء محفوظان على هذا الجهاز فقط.</p>
    ${items.length ? html`<ul class="n44-list">${items.map(item => html`<li class="n44-item ${item.read ? '' : 'n44-item--unread'}">
      <div class="n44-item-heading"><h2>${item.title}</h2><span class="muted">${item.read ? 'مقروء' : 'جديد'}</span></div>
      <p>${item.body}</p><div class="n44-actions">
        <button class="btn btn--quiet" type="button" data-act="n44-open" data-id="${item.id}">${item.action}</button>
        ${item.read ? '' : html`<button class="btn btn--quiet" type="button" data-act="n44-read" data-id="${item.id}">تمييز كمقروء</button>`}
        <button class="btn btn--quiet" type="button" data-act="n44-dismiss" data-id="${item.id}">إخفاء</button>
      </div></li>`)}</ul>` : html`<p class="n44-empty" role="status">لا توجد تنبيهات تستدعي انتباهك الآن.</p>`}
    <p class="muted n44-note">هذه تنبيهات داخل التطبيق أثناء استخدامه. تذكيرات الجهاز والتلقي أثناء إغلاق التطبيق لم تُفعّل بعد.</p>
  </section>`;
}
export function renderNotificationBell(unread) {
  return html`<button type="button" class="iconbtn n44-bell" data-act="n44-center" aria-label="الإشعارات، غير المقروء: ${unread}" title="الإشعارات">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
    ${unread ? html`<span class="n44-bell-count" aria-hidden="true">${unread}</span>` : ''}
  </button>`;
}
