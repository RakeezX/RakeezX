import test from 'node:test';
import assert from 'node:assert/strict';
import { homeGreeting, homeSummaryMetrics } from '../src/views/home.js';

test('Home greeting uses the centralized teacher form for morning and later periods', () => {
  const morning = new Date(2026, 8, 22, 9, 0, 0);
  const afternoon = new Date(2026, 8, 22, 13, 0, 0);
  assert.equal(homeGreeting({ teacherName: 'سالم', teacherForm: 'masculine' }, morning), 'صباح الخير، أستاذ سالم');
  assert.equal(homeGreeting({ teacherName: 'نورة', teacherForm: 'feminine' }, morning), 'صباح الخير، أستاذة نورة');
  assert.equal(homeGreeting({ teacherName: 'سالم', teacherForm: 'masculine' }, afternoon), 'أهلاً، أستاذ سالم');
  assert.equal(homeGreeting({ teacherName: 'نورة', teacherForm: 'feminine' }, afternoon), 'أهلاً، أستاذة نورة');
});

test('Home summary binds class, unique student, weekly attendance, and daily progress values', () => {
  const teachings = [{ id: 'class-a' }, { id: 'class-b' }];
  const students = {
    'class-a': [{ id: 'student-1' }, { id: 'student-2' }],
    'class-b': [{ id: 'student-2' }, { id: 'student-3' }],
  };
  const sessions = {
    '2026-09-20': [{ id: 'sunday', teachingId: 'class-a', status: 'held' }],
    '2026-09-21': [{ id: 'monday', teachingId: 'other-class', status: 'held' }],
    '2026-09-22': [
      { id: 'today-complete', teachingId: 'class-a', status: 'held' },
      { id: 'today-pending', teachingId: 'class-b', status: 'scheduled' },
      { id: 'today-cancelled', teachingId: 'class-b', status: 'cancelled' },
    ],
  };
  const attendance = {
    sunday: [{ status: 'present' }, { status: 'absent' }],
    'today-complete': [{ status: 'late' }, { status: 'excused' }],
    'today-pending': [],
  };
  assert.deepEqual(homeSummaryMetrics(teachings, {
    today: '2026-09-22',
    studentsFor: (id) => students[id],
    sessionsForDate: (date) => sessions[date] ?? [],
    attendanceFor: (id) => attendance[id] ?? [],
    completenessFor: (session) => ({ state: session.id === 'today-complete' ? 'completed' : 'future' }),
  }), {
    classes: 2,
    students: 3,
    weeklyAttendance: 50,
    completedToday: 1,
    totalToday: 2,
  });
});

test('Home daily progress follows non-teaching Calendar authority without changing weekly history', () => {
  const session = { id: 'existing-session', teachingId: 'class-a', status: 'scheduled' };
  const options = {
    today: '2026-10-01',
    studentsFor: () => [{ id: 'student-1' }],
    sessionsForDate: (date) => date === '2026-10-01' ? [session] : [],
    attendanceFor: () => [{ status: 'present' }],
    completenessFor: () => ({ state: 'completed' }),
  };
  for (const kind of ['suspension', 'holiday', 'national']) {
    const metrics = homeSummaryMetrics([{ id: 'class-a' }], { ...options, calendarDay: { kind } });
    assert.equal(metrics.totalToday, 0, kind);
    assert.equal(metrics.completedToday, 0, kind);
    assert.equal(metrics.weeklyAttendance, 100, kind);
    assert.equal(session.status, 'scheduled', kind);
  }
  for (const calendarDay of [null, { kind: 'remote' }]) {
    const metrics = homeSummaryMetrics([{ id: 'class-a' }], { ...options, calendarDay });
    assert.equal(metrics.totalToday, 1);
    assert.equal(metrics.completedToday, 1);
  }
});
