/** AI: fabricated v3 projection, using canonical zero/null and subitem completion vocabulary.
 * Optional instruction demonstrates presentation only; authoritative projector does not persist it yet.
 */
export const projection = {
  version: 'n88-student-v3',
  profile: { name: 'طالب اصطناعي', classLabel: 'الصف الرابع • أ — فصل تجريبي' },
  grades: { items: [
    { id: 'direct', label: 'المشاركة', value: 8, max: 10, status: 'recorded' },
    { id: 'zero', label: 'نشاط صفي', value: 0, max: 10, status: 'recorded' },
    { id: 'missing', label: 'المشروع', value: null, max: 10, status: 'unrecorded' }
  ] },
  work: {
    required: [{ id: 'overdue', title: 'مراجعة الدرس', dueDate: '2026-10-18', completionState: 'unrecorded', instruction: 'اقرأ ملخص الدرس، ثم أجب عن الأسئلة في دفترك. سلّم الدفتر للمعلم في الحصة القادمة.' }],
    completed: [{ id: 'regular', title: 'تطبيق الدرس السابق', dueDate: '2026-10-01', completionState: 'regular' }],
    scheduled: [{ id: 'future', title: 'نشاط الأسبوع القادم', startDate: '2026-10-20', dueDate: '2026-10-25', completionState: 'unrecorded' }]
  }
};
