/** AI-authored. Pure source proposal; no fetching, opening or persistence. */
import { dateControlBounds, normalizeDateTimeDigits, validDateTimeValue } from './rakeez-datetime-values.js';

export function safeTeacherLink(value) {
  if (value === '' || value == null) return null;
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)
      || /%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(value)) throw Error('الرابط غير صالح؛ استخدم رابط HTTPS دون بيانات دخول.');
  let url;
  try { url = new URL(value); } catch { throw Error('أدخل رابط HTTPS كاملًا.'); }
  if (!/^https:\/\//i.test(value) || url.protocol !== 'https:' || !url.hostname || url.username || url.password
      || value.slice(8).split(/[/?#]/, 1)[0].includes('@')) throw Error('يسمح بروابط HTTPS دون بيانات دخول فقط.');
  if (url.href.length > 2048) throw Error('الرابط طويل جدًا.');
  return url.href;
}

export function manualTaskDraft(input, now = new Date()) {
  if (!input || typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.id)) throw Error('هوية المهمة مطلوبة.');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = input.description ?? '';
  if (!title || title.length > 200 || typeof description !== 'string' || description.length > 2000) throw Error('تحقق من عنوان المهمة ووصفها.');
  const bounds = dateControlBounds('planning', '', '', now);
  const date = value => {
    const normalized = normalizeDateTimeDigits(value);
    if (!validDateTimeValue(normalized, 'date', bounds.min, bounds.max)) throw Error('التاريخ خارج النطاق المعتمد.');
    return normalized || null;
  };
  const startDate = date(input.startDate), dueDate = date(input.dueDate);
  if (startDate && dueDate && dueDate < startDate) throw Error('التسليم يسبق البداية.');
  return { id: input.id, title, description, startDate, dueDate, link: safeTeacherLink(input.link) };
}
