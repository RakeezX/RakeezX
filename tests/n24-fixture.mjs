/** Shared synthetic print fixture, extracted from print-reports.e2e.mjs. No copied calculations. */
const maleNames = ['أحمد محمد','محمد خالد','عبدالله سعد','عمر فهد','يوسف علي','خالد عبدالرحمن','سلمان ناصر','عبدالعزيز ماجد','تركي وليد','فهد عادل','ناصر إبراهيم','سعد راشد','ماجد حسن','راكان بدر','زياد طارق','أنس سامي','بدر منصور','وليد صالح','ياسر عوض','فيصل حمد','ريان عبدالمجيد','حسن جابر','علي ناصر','معتز فؤاد','سامي يوسف','طارق مازن','إبراهيم سالم','خليل سلطان','جابر عمر','منصور فهد'];

export async function seed(page, { count = 30, long = false, sessions = 1, distinct = false } = {}) {
  await page.evaluate(async ({ names, sessions, distinct }) => {
    const store = await import('/src/store.js');
    const { repaint } = await import('/src/repaint.js');
    const students = names.map((name, index) => ({ id: `print-student-${index}`, name, status: 'active' }));
    const enrollments = students.map((student, index) => ({ id: `print-enrollment-${index}`, studentId: student.id, sectionId: 'print-section', status: 'active', rollNo: index + 1 }));
    const attendance = students.map((student, index) => ({ id: `print-attendance-${index}`, studentId: student.id, sessionId: 'print-session', teachingId: 'print-teaching', date: '2026-08-20', status: index % 5 === 0 ? 'absent' : index % 3 === 0 ? 'late' : 'present' }));
    await store.save({
      profile: [{ id: 'profile', teacherName: 'معلمة تجريبية', teacherForm: 'feminine', schoolName: 'مدرسة تجريبية' }],
      years: [{ id: 'print-year', label: '1448-1449' }], terms: [{ id: 'print-term', yearId: 'print-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'print-subject', name: 'الرياضيات' }], sections: [{ id: 'print-section', yearId: 'print-year', grade: 5, label: '1', name: 'الخامس / 1' }],
      teachings: [{ id: 'print-teaching', sectionId: 'print-section', subjectId: 'print-subject', termId: 'print-term' }],
      students, enrollments,
      items: [{ id: 'print-item', teachingId: 'print-teaching', name: 'اختبار قصير', max: 10 }, { id: 'print-participation', teachingId: 'print-teaching', name: 'المشاركة', max: 5, auto: 'participation', perPoint: 1 }],
      scores: [{ id: 'print-score', studentId: 'print-student-0', itemId: 'print-item', value: 8 }],
      logs: [{ id: 'print-log', studentId: 'print-student-0', teachingId: 'print-teaching', kind: 'participation', delta: 2, date: '2026-08-20' }],
      slots: [{ id: 'print-slot', teachingId: 'print-teaching', weekday: 0, period: 1 }],
      sessions: [{ id: 'print-session', teachingId: 'print-teaching', slotId: 'print-slot', date: '2026-08-20', weekday: 0, period: 1, startTime: '07:00', endTime: '07:45' }], attendance,
    });
    if (sessions > 1 || distinct) {
      const dated = Array.from({length:sessions}, (_,i) => ({id:`print-session-${i}`, teachingId:'print-teaching', slotId:'print-slot', date:new Date(Date.UTC(2026,7,i+1)).toISOString().slice(0,10), weekday:i%7, period:1, startTime:'07:00', endTime:'07:45'}));
      await store.save({
        sessions: dated,
        attendance: dated.flatMap((session,j) => students.map((student,i) => ({id:`print-att-${j}-${i}`,studentId:student.id,sessionId:session.id,teachingId:'print-teaching',date:session.date,status:['present','late','absent','excused'][(i+j)%4]}))),
        scores: distinct ? students.map((student,i) => ({id:`print-score-${i}`,studentId:student.id,itemId:'print-item',value:i%11})) : [],
        profile:[{id:'profile',teacherName:'معلمة تجريبية',teacherForm:'feminine',schoolName:'مدرسة تجريبية',reportPrincipalName:'مديرة تجريبية'}],
        subjects:[{id:'print-subject',name:'الرياضيات وتطبيقاتها في الحياة اليومية'}],
        items:[{id:'print-item',teachingId:'print-teaching',name:'التقويم المستمر والمهارات الأساسية والتطبيقات العملية',max:10}],
      });
    }
    await store.patchDevice({ activeYearId: 'print-year', activeTermId: 'print-term', reportPrincipalName: '' });
    repaint();
  }, { names: Array.from({length: count}, (_, i) => `${maleNames[i % maleNames.length]}${long ? ' عبدالعزيز عبدالرحمن آل عبدالله الطويل ' + (i + 1) : ''}`), sessions, distinct });
}
