// N36 v1 validated consumer. Only names may reach the existing confirmed store path.
import { normalizeDateTimeDigits, validDateTimeValue } from './rakeez-datetime-values.js';

export const CATEGORIES = Object.freeze({
  teacher: { label: 'اسم المعلم', fields: { name: 'اسم المعلم' } },
  school: { label: 'اسم المدرسة', fields: { name: 'اسم المدرسة' } },
  principal: { label: 'اسم المدير', fields: { name: 'اسم المدير' } },
  classes: { label: 'الفصول', fields: { classroom: 'الفصل' } },
  students: { label: 'أسماء الطلاب وفصولهم', fields: { name: 'اسم الطالب', classroom: 'الفصل' } },
  timetable: { label: 'الجدول الأسبوعي', fields: { weekday: 'اليوم', period: 'الحصة', time: 'الوقت', classroom: 'الفصل', subject: 'المادة' } },
});
export const MAX_BYTES = 100000;
const provenance = new Set(['pasted-visible', 'selected-visible', 'teacher-readonly-run']);
const days = new Set(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']);
const fail = code => { throw new Error(code); };
export const matchingKey = value => String(value).replace(/[\s\u0640\u064B-\u065F\u0670]/g, '').toLowerCase();
const object = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, allowed) => {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('UNKNOWN_FIELD');
};
function fieldValue(field, value, category) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') fail('INVALID_FIELD');
  let v = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!v) return '';
  if (v.length > 80) fail('INVALID_FIELD');
  if (field === 'weekday') { if (!days.has(v)) fail('UNRESOLVED_WEEKDAY'); }
  else if (field === 'period') { if (!/^(?:[1-9]|1[0-9]|20)$/.test(v)) fail('INVALID_PERIOD'); }
  else if (field === 'time') {
    v = normalizeDateTimeDigits(v);
    if (!/^\d{2}:\d{2}(?:-\d{2}:\d{2})?$/.test(v)) fail('INVALID_TIME');
    const parts = v.split('-');
    if (parts.some(part => !validDateTimeValue(part, 'time')) || parts.length === 2 && parts[1] <= parts[0]) fail('INVALID_TIME');
  } else if (field === 'name' && category !== 'school') {
    if (v.length < 2 || !/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(v)) fail('INVALID_NAME');
  } else if (v.length < 2 || !/[\p{L}]/u.test(v) || !/^[\p{L}\p{M}0-9 ()-]+$/u.test(v)) fail('INVALID_TEXT');
  return v;
}
export function validateBundle(value) {
  keys(value, ['schema', 'version', 'categories']);
  if (value.schema !== 'rakeez-private-teacher-setup' || value.version !== 1) fail('UNSUPPORTED_SCHEMA');
  if (!Array.isArray(value.categories) || !value.categories.length || value.categories.length > 6) fail('EMPTY_OR_LIMIT');
  const seen = new Set(); let count = 0;
  const categories = value.categories.map(c => {
    keys(c, ['category', 'provenance', 'rows']);
    if (!Object.hasOwn(CATEGORIES, c.category) || seen.has(c.category)) fail('INVALID_CATEGORY');
    seen.add(c.category);
    if (!Array.isArray(c.provenance) || !c.provenance.length || c.provenance.length > 3 || c.provenance.some(p => !provenance.has(p))) fail('INVALID_PROVENANCE');
    if (!Array.isArray(c.rows) || !c.rows.length || c.rows.length > 300) fail('EMPTY_OR_LIMIT');
    if (['teacher', 'school', 'principal'].includes(c.category) && c.rows.length !== 1) fail('AMBIGUOUS_ROLE');
    count += c.rows.length; if (count > 600) fail('BUNDLE_LIMIT');
    const identities = new Set(), slots = new Set();
    const rows = c.rows.map(row => {
      const fields = Object.keys(CATEGORIES[c.category].fields); keys(row, fields);
      const out = Object.fromEntries(fields.map(field => [field, fieldValue(field, row[field], c.category)]));
      const identity = fields.map(field => matchingKey(out[field])).join('|');
      if (identities.has(identity)) fail('DUPLICATE'); identities.add(identity);
      if (c.category === 'timetable') for (const field of ['period', 'time']) {
        if (!out.weekday || !out[field]) continue;
        const slot = out.weekday + '|' + field + '|' + out[field];
        if (slots.has(slot)) fail('DUPLICATE_SLOT'); slots.add(slot);
      }
      return out;
    });
    return { category: c.category, provenance: [...new Set(c.provenance)], rows };
  });
  const result = { schema: value.schema, version: 1, categories };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BYTES) fail('BUNDLE_LIMIT');
  return result;
}
export function parseBundle(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) fail('BUNDLE_LIMIT');
  return validateBundle(JSON.parse(text.replace(/^\uFEFF/, ''), (key, value) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('PROTOTYPE_KEY');
    return value;
  }));
}
// Only unique, explicitly selected current identities are valid mapping targets.
export function uniqueOptions(rows) {
  return rows.filter(row => row.name && rows.filter(other => matchingKey(other.name) === matchingKey(row.name)).length === 1);
}
export function reviewPlan(bundle, selected, context, mappings) {
  const validated = validateBundle(bundle);
  const categories = validated.categories.filter(c => selected.has(c.category));
  const issues = [];
  if (!categories.length) issues.push('اختر فئة واحدة على الأقل.');
  if (!context.years?.some(y => y.id === context.yearId && y.status === 'active') ||
      !context.terms?.some(t => t.id === context.termId && t.yearId === context.yearId && t.status === 'active')) issues.push('اختر السنة والفصل الدراسي الحاليين.');
  const classes = uniqueOptions(context.classes), subjects = uniqueOptions(context.subjects);
  const mapped = categories.map(c => ({ ...c, rows: c.rows.map((row, index) => {
    const refs = {}; const label = `${CATEGORIES[c.category].label} — ${index + 1}`;
    for (const field of Object.keys(CATEGORIES[c.category].fields)) {
      if (!row[field]) issues.push(`${label}: ${CATEGORIES[c.category].fields[field]} غير متوفر.`);
    }
    if (Object.hasOwn(row, 'classroom')) {
      const section = classes.find(s => s.id === mappings.classes[row.classroom]);
      if (!section) issues.push(`${label}: مطابقة الفصل غير محسومة أو ملتبسة.`);
      else refs.sectionId = section.id;
    }
    if (Object.hasOwn(row, 'subject')) {
      const subject = subjects.find(s => s.id === mappings.subjects[row.subject]);
      const teachings = context.teachings.filter(t => t.termId === context.termId && t.sectionId === refs.sectionId && t.subjectId === subject?.id);
      if (!subject || teachings.length !== 1) issues.push(`${label}: مطابقة المادة والإسناد غير محسومة أو ملتبسة.`);
      else { refs.subjectId = subject.id; refs.teachingId = teachings[0].id; }
    }
    if (c.category === 'students' && refs.sectionId && row.name) {
      const existing = context.students.filter(s => matchingKey(s.name) === matchingKey(row.name) && context.enrollments.some(e => e.studentId === s.id && e.sectionId === refs.sectionId));
      refs.studentMatch = existing.length ? 'manual-review-existing-name' : 'new-name';
      // A same name is a review hint, never identity or an automatic addition.
      if (existing.length > 1) issues.push(`${label}: أكثر من طالب بالاسم نفسه؛ راجع المطابقة.`);
    }
    return { proposed: row, references: refs };
  }) }));
  return { issues, categories: mapped };
}
export async function stateDigest(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// A validated bundle supplies names only; target identities always come from
// the existing, explicitly mapped current workspace, never from source names.
export function bundleNamesTargets(bundle, selected, context, mappings) {
  if (!selected.has('students')) return [];
  const plan = reviewPlan(bundle, selected, context, mappings);
  // Existing-name ambiguity must be visible in the store preview, then block
  // confirmation. It is not an unresolved source/category mapping.
  if (plan.issues.some(issue => !issue.includes('أكثر من طالب بالاسم نفسه'))) return [];
  const students = plan.categories.find(c => c.category === 'students');
  const sources = [...new Set(students.rows.map(r => r.proposed.classroom))];
  const sections = sources.map(source => mappings.classes[source]);
  if (new Set(sections).size !== sections.length) return [];
  return sources.flatMap((source, index) => context.teachings.filter(t =>
    !t.deleted && t.status !== 'archived' && t.termId === context.termId && t.sectionId === sections[index]
  ).map(t => ({ id: t.id, sectionId: t.sectionId, source,
    name: `${source} · ${context.subjects.find(s => s.id === t.subjectId)?.name || 'مادة غير متوفرة'}`,
    rows: students.rows.filter(r => r.proposed.classroom === source).map(r => [r.proposed.name]) })));
}
