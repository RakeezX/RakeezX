/** Fixed illustrative content. No identity lookup, authentication or persistence. */
export const DEMO_CODE = 'DEMO-ONLY';
export const demoWorkspaceOnly = workspace => workspace?.type === 'demo';
export const acceptsIllustrativeCode = value => String(value ?? '').trim().toUpperCase() === DEMO_CODE;
export const EXAMPLE = Object.freeze({
  name: 'طالب افتراضي',
  tasks: Object.freeze(['قراءة قصة قصيرة — لم يبدأ', 'مشروع الأشكال — قيد العمل', 'تدريب الجمع — مكتمل']),
  progress: '1 من 3 أنشطة مكتمل',
  grade: 'مثال درجة مصطنعة: 8 من 10',
});
