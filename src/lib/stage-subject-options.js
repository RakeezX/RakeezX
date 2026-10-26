/**
 * Stage-aware course suggestions for the existing Grade 1–12 class picker.
 * Product-candidate only: V6 guide titles are useful reference names, but
 * year-1448 applicability and every title's editorial review are NOT certified.
 * No database writes, migrations, account access, or automatic grade changes.
 */
import { OFFICIAL_V6_ROWS, OFFICIAL_V6_GUIDE_URL } from './official-v6-subject-data.js';
import { matchBuiltinSubject, normalizeSubjectName } from './subject-catalog.js';

export const V6_PROGRAM_LABELS = Object.freeze({
  general: 'التعليم العام',
  tahfiz: 'مدارس تحفيظ القرآن الكريم',
  chinese_pilot: 'المدارس المطبقة للغة الصينية',
  arts_pilot: 'مدارس مبادرة الفنون',
  continuing: 'التعليم المستمر',
  continuing_intellectual_disability: 'التعليم المستمر - الإعاقة الفكرية',
  dar_al_hadith: 'دار الحديث المكية/المدنية',
  international_identity: 'مواد الهوية الوطنية (إضافية)',
  autism: 'برامج طيف التوحد',
  intellectual_disability: 'برامج التربية الفكرية',
  multiple_disabilities: 'برامج تعدد الإعاقات',
  gifted_care: 'برامج إثراء الموهوبين (إضافية)',
  cultural_schools: 'المدارس الثقافية المتخصصة',
  gifted_advanced_industries: 'مدارس الموهوبين للصناعات المتقدمة',
  gifted_technical: 'مدارس الموهوبين التقنية',
  early_childhood: 'الحضانة ورياض الأطفال (تحتاج دعم مستويات)',
});
export const V6_TRACK_LABELS = Object.freeze({
  common_year: 'السنة الأولى المشتركة',
  general: 'المسار العام',
  computer_engineering: 'علوم الحاسب والهندسة',
  health_life: 'الصحة والحياة',
  business: 'إدارة الأعمال',
  sharia: 'المسار الشرعي',
  music: 'الموسيقى',
  performing_arts: 'الفنون الأدائية',
  visual_arts: 'الفنون البصرية',
  advanced_industries: 'الصناعات المتقدمة',
  technology: 'الموهوبون التقنيون',
});
export const V6_SOURCE_URL = OFFICIAL_V6_GUIDE_URL;
export const V6_APPLICABILITY = 'edition_six_year_not_certified';

export function stageOfLegacyGrade(grade) {
  const n = Number(grade);
  if (!Number.isSafeInteger(n) || n < 1 || n > 12) return null;
  return n <= 6 ? { stage: 'primary', level: String(n) } :
    n <= 9 ? { stage: 'middle', level: String(n - 6) } :
      { stage: 'secondary', level: String(n - 9) };
}
const eligibleRows = (grade, program) => {
  const stage = stageOfLegacyGrade(grade);
  if (!stage) return [];
  return OFFICIAL_V6_ROWS.filter(row => row[0] === program &&
    row[1] === stage.stage && row[2] === stage.level &&
    ['course', 'learning_domain', 'enrichment', 'national_identity'].includes(row[5]));
};
export function v6ProgramsForGrade(grade) {
  const stage = stageOfLegacyGrade(grade);
  if (!stage) return [];
  const ids = new Set(OFFICIAL_V6_ROWS.filter(row => row[1] === stage.stage &&
    row[2] === stage.level).map(row => row[0]));
  return [...ids].sort((a,b) => (a === 'general' ? -1 : b === 'general' ? 1 :
    (V6_PROGRAM_LABELS[a] || a).localeCompare(V6_PROGRAM_LABELS[b] || b, 'ar')))
    .map(value => ({value, label: V6_PROGRAM_LABELS[value] || value,
      supplementaryOnly: ['gifted_care','international_identity'].includes(value)}));
}
export function v6TracksForGrade(grade, program = 'general') {
  const ids = new Set(eligibleRows(grade, program).map(row => row[3] || ''));
  return [...ids].sort((a,b) => (V6_TRACK_LABELS[a] || a).localeCompare(V6_TRACK_LABELS[b] || b, 'ar'))
    .map(value => ({value, label: V6_TRACK_LABELS[value] || value || 'بدون مسار'}));
}

/** Resolve one official guide name against the user's existing options without
 * silently rewriting existing builtin names, ids or ownership.
 * An unrecognized name uses the current explicit "custom" creation path,
 * and its official source provenance is not claimed as stored in Rakeez V1.
 */
function existingOptionForGuide(name, options) {
  const officialNameKey = normalizeSubjectName(name);
  const exact = options.filter(option => normalizeSubjectName(option.name) === officialNameKey);
  if (exact.length === 1) return exact[0];
  const def = matchBuiltinSubject(name);
  if (!def) return null;
  return options.find(option => option.token === 'builtin:' + def.key ||
    option.subjectId === def.id) || null;
}
export function stageSubjectOptions({grade, program = 'general', track = '', options = []} = {}) {
  const stage = stageOfLegacyGrade(grade);
  const progs = v6ProgramsForGrade(grade);
  const tracks = v6TracksForGrade(grade, program);
  const needsTrack = tracks.length > 1 || (stage?.stage === 'secondary' &&
    Number(stage.level) > 1 && program === 'general');
  const validTrack = tracks.some(t => t.value === track);
  const available = stage && progs.some(p => p.value === program) &&
    (!needsTrack || validTrack);
  const chosenTrack = needsTrack ? track : (validTrack ? track : tracks[0]?.value || '');
  const official = new Map();
  for (const row of available ? eligibleRows(grade,program) : []) {
    if ((row[3] || '') !== chosenTrack) continue;
    const [,,, ,name,kind,page] = row;
    const normalized = normalizeSubjectName(name);
    if (!normalized || official.has(normalized)) continue;
    const existing = existingOptionForGuide(name,options);
    const token = existing?.token || 'custom';
    official.set(normalized,{
      token, name, searchText:normalizeSubjectName(name + ' ' + (existing?.searchText || '')),
      used:!!existing?.used, builtin:!!existing?.builtin,
      officialGuide:true, sourcePage:page, sourceUrl:OFFICIAL_V6_GUIDE_URL + '#page=' + page,
      guideKind:kind, customName:token === 'custom' ? name : '',
      subjectId:existing?.subjectId || null
    });
  }
  const guide = [...official.values()].sort((a,b)=> Number(b.used)-Number(a.used) ||
    a.name.localeCompare(b.name,'ar'));
  // Preserve every current subject, including custom/legacy records that may
  // not appear in the current edition or at the user's particular stage.
  const knownTokens = new Set(guide.filter(g=>g.token !== 'custom').map(g=>g.token));
  const other = options.filter(option => !knownTokens.has(option.token));
  return {
    guide, other, programs:progs, tracks,
    scopeStatus: !stage ? 'unsupported_grade' : !available ?
      (needsTrack ? 'choose_track' : 'no_official_context') : 'reference_only',
    supplementaryOnly: ['gifted_care','international_identity'].includes(program),
    sourceStatus: V6_APPLICABILITY,
    sourceUrl: OFFICIAL_V6_GUIDE_URL,
    canAddManual: true
  };
}
