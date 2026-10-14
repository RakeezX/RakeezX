// Reuse the existing actual account/DB/ownership setup, with only synthetic names.
export { prepareAccount, owner, foreignOwner } from './n73-account-flow-fixture.mjs';
export const exportedBundle = {
  schema: 'rakeez-private-teacher-setup', version: 1,
  categories: [
    { category: 'teacher', provenance: ['pasted-visible'], rows: [{ name: 'معلم تجريبي' }] },
    { category: 'school', provenance: ['selected-visible'], rows: [{ name: 'مدرسة تجريبية' }] },
    { category: 'principal', provenance: ['teacher-readonly-run'], rows: [{ name: 'مدير تجريبي' }] },
    { category: 'classes', provenance: ['pasted-visible'], rows: [{ classroom: 'خامس ألف' }] },
    { category: 'students', provenance: ['pasted-visible'], rows: [{ name: 'طالب تجريبي', classroom: 'خامس ألف' }] },
    { category: 'timetable', provenance: ['selected-visible'], rows: [{ weekday: 'الأحد', period: '1', time: '09:00-09:45', classroom: 'خامس ألف', subject: 'علوم تجريبية' }] },
  ],
};
export async function checkpoint() {
  const db = await import('../src/lib/db.js');
  return Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
}
