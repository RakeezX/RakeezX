import { subjectId } from '../models.js';

export const CUSTOM_SUBJECT_NAME_MAX = 60;

const defineSubject = (key, name, aliases = [], legacySlugs = []) => Object.freeze({
  key,
  id: subjectId(key),
  slug: key,
  name,
  aliases: Object.freeze([name, ...aliases]),
  legacySlugs: Object.freeze(legacySlugs),
});

/**
 * The built-in catalog is presentation/configuration, not a second data store.
 * A subject row is created lazily only when the teacher actually uses it.
 */
export const BUILTIN_SUBJECTS = Object.freeze([
  defineSubject('quran-islamic', 'القرآن والإسلامية', [
    'القرآن الكريم والدراسات الإسلامية', 'الدراسات الإسلامية', 'التربية الإسلامية',
    'islamic studies', 'quran and islamic studies',
  ]),
  defineSubject('arabic', 'العربية', ['اللغة العربية', 'لغتي', 'arabic']),
  defineSubject('math', 'الرياضيات', ['رياضيات', 'math', 'mathematics']),
  defineSubject('science', 'العلوم', ['علوم', 'science']),
  defineSubject('english', 'الإنجليزية', ['اللغة الإنجليزية', 'انجليزي', 'english']),
  defineSubject('social-studies', 'الاجتماعيات', ['الدراسات الاجتماعية', 'اجتماعيات', 'social studies']),
  defineSubject('digital-skills', 'المهارات الرقمية', [
    'الحاسب الآلي', 'الحاسب', 'مهارات رقمية', 'digital skills', 'computer',
  ], ['computer']),
  defineSubject('art', 'الفنية', ['التربية الفنية', 'تربية فنية', 'art']),
  defineSubject('physical-education', 'البدنية', ['التربية البدنية', 'التربية البدنية والدفاع عن النفس', 'تربية بدنية', 'physical education', 'pe']),
  defineSubject('life-family-skills', 'الحياتية والأسرية', [
    'المهارات الحياتية والأسرية', 'التربية الأسرية', 'الأسرية', 'life and family skills',
  ]),
  defineSubject('critical-thinking', 'التفكير الناقد', ['تفكير ناقد', 'critical thinking']),
  defineSubject('digital-technology', 'التقنية الرقمية', ['تقنية رقمية', 'digital technology']),
]);

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Normalizes lookup/duplicate text without changing the stored teacher label. */
export function normalizeSubjectName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const aliasSet = (definition) => new Set(definition.aliases.map(normalizeSubjectName));
const BUILTIN_ALIASES = new Map(BUILTIN_SUBJECTS.map((definition) => [definition.key, aliasSet(definition)]));

export function builtinSubject(key) {
  return BUILTIN_SUBJECTS.find((definition) => definition.key === key) ?? null;
}

export function matchBuiltinSubject(value) {
  const normalized = normalizeSubjectName(value);
  if (!normalized) return null;
  return BUILTIN_SUBJECTS.find((definition) => BUILTIN_ALIASES.get(definition.key).has(normalized)) ?? null;
}

export function builtinForRecord(record) {
  if (!record) return null;
  return BUILTIN_SUBJECTS.find((definition) =>
    record.id === definition.id || record.slug === definition.slug ||
    definition.legacySlugs.includes(record.slug) ||
    BUILTIN_ALIASES.get(definition.key).has(normalizeSubjectName(record.name))) ?? null;
}

export function findPersistedBuiltin(records, definition) {
  if (!definition) return null;
  const live = records.filter((record) => record && !record.deleted);
  return live.find((record) => record.id === definition.id) ??
    live.find((record) => record.slug === definition.slug) ??
    live.find((record) => definition.legacySlugs.includes(record.slug)) ??
    live.find((record) => BUILTIN_ALIASES.get(definition.key).has(normalizeSubjectName(record.name))) ?? null;
}

export function validateCustomSubjectName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'اكتب اسم المادة المخصصة.' };
  if (name.length > CUSTOM_SUBJECT_NAME_MAX) {
    return { ok: false, error: `اسم المادة يجب ألا يتجاوز ${CUSTOM_SUBJECT_NAME_MAX} حرفًا.` };
  }
  if (!/[\p{L}\p{N}]/u.test(name)) return { ok: false, error: 'اسم المادة يجب أن يحتوي على حروف أو أرقام.' };
  return { ok: true, name, normalized: normalizeSubjectName(name) };
}

/** Collision-free for the normalized code-point sequence and stable across devices. */
export function customSubjectSlug(value) {
  const normalized = normalizeSubjectName(value);
  return `custom-${Array.from(normalized, (char) => char.codePointAt(0).toString(36)).join('-')}`;
}

export function subjectCatalogOptions(records, usedSubjectIds = []) {
  const live = records.filter((record) => record && !record.deleted);
  const used = new Set(usedSubjectIds);
  const claimed = new Set();
  const builtins = BUILTIN_SUBJECTS.map((definition) => {
    const persisted = findPersistedBuiltin(live, definition);
    if (persisted) claimed.add(persisted.id);
    return {
      token: persisted ? `subject:${persisted.id}` : `builtin:${definition.key}`,
      subjectId: persisted?.id ?? definition.id,
      name: definition.name,
      searchText: normalizeSubjectName(definition.aliases.join(' ')),
      used: !!persisted && used.has(persisted.id),
      builtin: true,
    };
  });
  const custom = live.filter((record) => !claimed.has(record.id)).map((record) => ({
    token: `subject:${record.id}`,
    subjectId: record.id,
    name: record.name,
    searchText: normalizeSubjectName(record.name),
    used: used.has(record.id),
    builtin: false,
  }));
  return [...builtins, ...custom];
}


/**
 * Presentation only: a short but recognizable name on narrow schedule/class
 * surfaces. The persisted Subject identity/name, search and exports stay full.
 *
 * Never abbreviate unknown teacher-defined subjects by arbitrary slicing.
 */
const SUBJECT_DISPLAY_SHORT_NAMES = new Map([
  ['المهارات الرقمية', 'رقمية'],
  ['الحاسب الآلي', 'حاسب'],
  ['اللغة العربية', 'عربية'],
  ['العربية', 'عربية'],
  ['اللغة الإنجليزية', 'إنجليزي'],
  ['الإنجليزية', 'إنجليزي'],
  ['الدراسات الاجتماعية', 'اجتماعيات'],
  ['الاجتماعيات', 'اجتماعيات'],
  ['التربية الفنية', 'فنية'],
  ['الفنية', 'فنية'],
  ['التربية البدنية والدفاع عن النفس', 'بدنية ودفاع'],
  ['التربية البدنية', 'بدنية'],
  ['البدنية', 'بدنية'],
  ['المهارات الحياتية والأسرية', 'حياتية وأسرية'],
  ['الحياتية والأسرية', 'حياتية وأسرية'],
  ['القرآن الكريم والدراسات الإسلامية', 'قرآن وإسلامية'],
  ['القرآن والإسلامية', 'قرآن وإسلامية'],
  ['الدراسات الإسلامية', 'إسلامية'],
  ['التقنية الرقمية', 'تقنية رقمية'],
  ['التفكير الناقد', 'تفكير ناقد'],
  ['الرياضيات', 'رياضيات'],
].map(([full, short]) => [normalizeSubjectName(full), short]));

function shortSubjectCandidate(value) {
  const full = typeof value === 'string' ? value : value?.name;
  const name = String(full ?? '').trim();
  return SUBJECT_DISPLAY_SHORT_NAMES.get(normalizeSubjectName(name)) ?? name;
}

/**
 * Repeated source names from different subject records must not collapse to
 * the same visible label. On collision, keep the original full teacher label.
 */
export function compactSubjectLabel(subject, nearbySubjects = []) {
  const original = typeof subject === 'string' ? subject : subject?.name;
  const full = String(original ?? '').trim();
  if (!full) return '';
  const candidate = shortSubjectCandidate(full);
  if (candidate === full) return full;
  const collides = nearbySubjects.some((other) => {
    if (!other || other === subject || other.deleted) return false;
    if (typeof other === 'object' && typeof subject === 'object' &&
        other.id && subject?.id && other.id === subject.id) return false;
    return shortSubjectCandidate(other) === candidate;
  });
  return collides ? full : candidate;
}
