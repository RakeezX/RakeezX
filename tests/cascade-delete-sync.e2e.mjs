import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';
const TABLES = ['years', 'calendars', 'calendar_days', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'time_profiles', 'slots', 'sessions', 'attendance', 'notes', 'logs'];
const TEACHING_DELETE_STORES = ['teachings', 'items', 'scores', 'slots', 'sessions', 'attendance', 'logs'];
const RECORD_KEY = { sections: 'section', teachings: 'teaching', students: 'student', enrollments: 'enrollment', notes: 'note', items: 'item', scores: 'score', slots: 'slot', sessions: 'session', attendance: 'attendance', logs: 'log' };
const CLASS_DELETE_STORES = ['sections', 'teachings', 'students', 'enrollments', 'notes', 'items', 'scores', 'slots', 'sessions', 'attendance', 'logs'];

function createCloud() {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  let profile = { teacher_name: '', school_name: '', phone: '', client_updated_at: Date.now() - 5_000 };
  return {
    async route(page) {
      await page.route(`${CLOUD_URL}*`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        if (table === 'profile') {
          if (request.method() === 'GET') return route.fulfill({ json: [profile] });
          profile = { ...profile, ...JSON.parse(request.postData() ?? '{}') };
          return route.fulfill({ json: [profile] });
        }
        if (request.method() === 'GET') return route.fulfill({ json: tables[table] ?? [] });
        if (request.method() === 'POST') {
          for (const record of JSON.parse(request.postData() ?? '[]')) {
            const list = tables[table] ??= [];
            const index = list.findIndex((item) => item.id === record.id);
            if (index < 0) list.push({ ...record }); else list[index] = { ...record };
          }
          return route.fulfill({ json: [] });
        }
        return route.fulfill({ json: [] });
      });
    },
    table: (name) => tables[name] ?? [],
  };
}

async function authenticated(page, cloud) {
  await page.addInitScript(() => localStorage.setItem('rakeezx-auth', JSON.stringify({
    access_token: 'cascade-delete-test-token', user: { id: 'cascade-delete-test-user' },
  })));
  await cloud.route(page);
}

async function seedTeaching(page, prefix) {
  return page.evaluate(async (prefix) => {
    const store = window.store;
    const stamp = Date.now();
    const section = { id: `${prefix}-section`, yearId: store.activeYear().id, grade: 5, label: prefix, name: `الخامس / ${prefix}`, color: '#0f766e', order: 50, updatedAt: stamp, deleted: false };
    const teaching = { id: `${prefix}-teaching`, sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id, order: 50, updatedAt: stamp, deleted: false };
    const student = { id: `${prefix}-student`, name: `طالب ${prefix}`, note: '', status: 'active', updatedAt: stamp, deleted: false };
    const enrollment = { id: `${prefix}-enrollment`, studentId: student.id, sectionId: section.id, rollNo: 1, status: 'active', startDate: '2026-08-30', endDate: null, transferNote: '', updatedAt: stamp, deleted: false };
    const item = { id: `${prefix}-item`, teachingId: teaching.id, name: 'بند اختبار', max: 10, order: 0, auto: null, perPoint: 1, penalty: 1, updatedAt: stamp, deleted: false };
    const profile = store.timeProfiles()[0];
    const slot = { id: `${prefix}-slot`, teachingId: teaching.id, weekday: 1, period: 1, updatedAt: stamp, deleted: false };
    const session = { id: `${prefix}-session`, teachingId: teaching.id, slotId: slot.id, timeProfileId: profile.id, date: '2026-09-01', period: 1, startTime: '07:00', endTime: '07:45', status: 'held', reason: '', updatedAt: stamp, deleted: false };
    const score = { id: `${prefix}-score`, studentId: student.id, itemId: item.id, value: 7, updatedAt: stamp, deleted: false };
    const attendance = { id: `${prefix}-attendance`, studentId: student.id, sessionId: session.id, teachingId: teaching.id, date: session.date, status: 'present', note: '', updatedAt: stamp, deleted: false };
    const log = { id: `${prefix}-log`, studentId: student.id, teachingId: teaching.id, sessionId: session.id, date: session.date, kind: 'participation', delta: 1, tag: '', note: '', updatedAt: stamp, deleted: false };
    const note = { id: `${prefix}-note`, studentId: student.id, teachingId: teaching.id, sessionId: session.id, text: 'ملاحظة مرتبطة بالفصل', createdAt: stamp, updatedAt: stamp, deleted: false };
    await store.save({ sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [item], slots: [slot], sessions: [session], scores: [score], attendance: [attendance], logs: [log], notes: [note] });
    return { section, teaching, student, enrollment, item, slot, session, score, attendance, log, note };
  }, prefix);
}

async function clearOutbox(page) {
  await page.evaluate(async () => (await import('/src/lib/db.js')).clearStore('outbox'));
}

async function queuedIds(page) {
  return page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).map((entry) => entry.id).sort());
}

test('cascade deletion queues syncable tombstones and automatic sync drains them online and after reconnect', async ({ browser }) => {
  test.setTimeout(90_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  const online = await seedTeaching(page, 'online-delete');
  await expect.poll(() => cloud.table('teachings').some((record) => record.id === online.teaching.id)).toBe(true);
  await clearOutbox(page);
  await page.evaluate((teachingId) => window.store.deleteTeaching(teachingId), online.teaching.id);
  expect(await queuedIds(page)).toEqual(TEACHING_DELETE_STORES.map((store) => `${store}:${online[RECORD_KEY[store]].id}`).sort());
  await expect.poll(() => TEACHING_DELETE_STORES.every((store) => cloud.table(store).some((record) => record.id === online[RECORD_KEY[store]].id && record.deleted_at))).toBe(true);
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  expect(await page.evaluate(({ studentId, enrollmentId }) => !window.store.getStudent(studentId)?.deleted && window.store.enrollmentsOf(studentId).some((entry) => entry.id === enrollmentId && !entry.deleted), { studentId: online.student.id, enrollmentId: online.enrollment.id })).toBe(true);

  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await authenticated(fresh, cloud);
  await fresh.goto('/#/classes');
  await fresh.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  expect(await fresh.evaluate((ids) => ids.every(({ store, id }) => window.store.state[store].some((record) => record.id === id && record.deleted)), TEACHING_DELETE_STORES.map((store) => ({ store, id: online[RECORD_KEY[store]].id })))).toBe(true);

  const offline = await seedTeaching(page, 'offline-delete');
  await expect.poll(() => cloud.table('teachings').some((record) => record.id === offline.teaching.id)).toBe(true);
  await clearOutbox(page);
  await context.setOffline(true);
  await page.evaluate((teachingId) => window.store.deleteTeaching(teachingId), offline.teaching.id);
  await page.waitForFunction(() => window.__syncModule?.state.status === 'offline');
  expect(await queuedIds(page)).toEqual(TEACHING_DELETE_STORES.map((store) => `${store}:${offline[RECORD_KEY[store]].id}`).sort());
  await context.setOffline(false);
  await expect.poll(() => TEACHING_DELETE_STORES.every((store) => cloud.table(store).some((record) => record.id === offline[RECORD_KEY[store]].id && record.deleted_at))).toBe(true);
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  expect(await queuedIds(page)).toEqual([]);

  const section = await seedTeaching(page, 'section-delete');
  await expect.poll(() => cloud.table('teachings').some((record) => record.id === section.teaching.id)).toBe(true);
  await clearOutbox(page);
  await page.evaluate((sectionId) => window.store.deleteSection(sectionId), section.section.id);
  const sectionQueue = await queuedIds(page);
  expect(sectionQueue).toEqual(expect.arrayContaining([
    `sections:${section.section.id}`,
    `teachings:${section.teaching.id}`,
    `enrollments:${section.enrollment.id}`,
  ]));
  expect(new Set(sectionQueue).size).toBe(sectionQueue.length);

  await freshContext.close();
  await context.close();
});

test('true class deletion is atomic, syncable, preserves shared students, and is idempotent', async ({ browser }) => {
  test.setTimeout(90_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  const orphan = await seedTeaching(page, 'true-orphan');
  await expect.poll(() => cloud.table('teachings').some((record) => record.id === orphan.teaching.id)).toBe(true);
  await clearOutbox(page);
  await page.evaluate((sectionId) => window.store.deleteClass(sectionId), orphan.section.id);
  expect(await queuedIds(page)).toEqual(CLASS_DELETE_STORES.map((store) => `${store}:${orphan[RECORD_KEY[store]].id}`).sort());
  await expect.poll(() => CLASS_DELETE_STORES.every((store) => cloud.table(store).some((record) => record.id === orphan[RECORD_KEY[store]].id && record.deleted_at))).toBe(true);
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  expect(await page.evaluate((records) => records.every(({ store, id }) => window.store.state[store].some((record) => record.id === id && record.deleted)), CLASS_DELETE_STORES.map((store) => ({ store, id: orphan[RECORD_KEY[store]].id })))).toBe(true);

  await clearOutbox(page);
  await page.evaluate((sectionId) => window.store.deleteClass(sectionId), orphan.section.id);
  expect(await queuedIds(page)).toEqual([]);

  const shared = await seedTeaching(page, 'true-shared-a');
  await page.evaluate(async (fixture) => {
    const store = window.store;
    const stamp = Date.now();
    const section = { id: 'true-shared-b-section', yearId: store.activeYear().id, grade: 5, label: 'ب', name: 'الخامس / ب', color: '#2563eb', order: 51, updatedAt: stamp, deleted: false };
    const teaching = { id: 'true-shared-b-teaching', sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id, order: 51, updatedAt: stamp, deleted: false };
    const enrollment = { id: 'true-shared-b-enrollment', studentId: fixture.student.id, sectionId: section.id, rollNo: 1, status: 'active', startDate: '2026-08-30', endDate: null, transferNote: '', updatedAt: stamp, deleted: false };
    const item = { id: 'true-shared-b-item', teachingId: teaching.id, name: 'بند ب', max: 10, order: 0, auto: null, perPoint: 1, penalty: 1, updatedAt: stamp, deleted: false };
    const slot = { id: 'true-shared-b-slot', teachingId: teaching.id, weekday: 2, period: 1, updatedAt: stamp, deleted: false };
    const session = { id: 'true-shared-b-session', teachingId: teaching.id, slotId: slot.id, timeProfileId: store.timeProfiles()[0].id, date: '2026-09-02', period: 1, startTime: '07:45', endTime: '08:30', status: 'held', reason: '', updatedAt: stamp, deleted: false };
    const score = { id: 'true-shared-b-score', studentId: fixture.student.id, itemId: item.id, value: 8, updatedAt: stamp, deleted: false };
    const attendance = { id: 'true-shared-b-attendance', studentId: fixture.student.id, sessionId: session.id, teachingId: teaching.id, date: session.date, status: 'present', note: '', updatedAt: stamp, deleted: false };
    const log = { id: 'true-shared-b-log', studentId: fixture.student.id, teachingId: teaching.id, sessionId: session.id, date: session.date, kind: 'participation', delta: 2, tag: '', note: '', updatedAt: stamp, deleted: false };
    const note = { id: 'true-shared-b-note', studentId: fixture.student.id, teachingId: teaching.id, sessionId: session.id, text: 'ملاحظة للشعبة ب', createdAt: stamp, updatedAt: stamp, deleted: false };
    const globalNote = { id: 'true-shared-global-note', studentId: fixture.student.id, teachingId: null, sessionId: null, text: 'ملاحظة عامة محفوظة', createdAt: stamp, updatedAt: stamp, deleted: false };
    await store.save({ sections: [section], teachings: [teaching], enrollments: [enrollment], items: [item], slots: [slot], sessions: [session], scores: [score], attendance: [attendance], logs: [log], notes: [note, globalNote] });
  }, shared);
  await expect.poll(() => cloud.table('teachings').some((record) => record.id === 'true-shared-b-teaching')).toBe(true);
  await page.evaluate((sectionId) => window.store.deleteClass(sectionId), shared.section.id);
  expect(await page.evaluate(() => {
    const s = window.store.state;
    const live = (store, id) => s[store].some((record) => record.id === id && !record.deleted);
    return live('students', 'true-shared-a-student')
      && live('enrollments', 'true-shared-b-enrollment')
      && live('scores', 'true-shared-b-score')
      && live('attendance', 'true-shared-b-attendance')
      && live('logs', 'true-shared-b-log')
      && live('notes', 'true-shared-b-note')
      && live('notes', 'true-shared-global-note')
      && !live('notes', 'true-shared-a-note');
  })).toBe(true);

  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await authenticated(fresh, cloud);
  await fresh.goto('/#/classes');
  await fresh.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  expect(await fresh.evaluate(() => window.store.state.sections.some((section) => section.id === 'true-orphan-section' && section.deleted))).toBe(true);

  await freshContext.close();
  await context.close();
});