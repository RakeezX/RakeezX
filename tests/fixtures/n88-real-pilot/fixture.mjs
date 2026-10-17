/** AI: fabricated identities/source data only. Not an auth/provider adapter. */
import { createMemoryRepository } from '../../../drafts/n88-student-portal/memory-repository.mjs';
import { createPortalService } from '../../../drafts/n88-student-portal/service.mjs';
import { randomBytes } from 'node:crypto';
export function createFixture(origin = 'https://pilot.invalid', options = {}) {
  let time = Date.UTC(2026, 9, 17, 12);
  const auth = new Map([['fabricated-teacher-a', { ownerId: 'owner-a', sessionId: 'auth-a', current: true }],
    ['fabricated-teacher-b', { ownerId: 'owner-b', sessionId: 'auth-b', current: true }]]);
  const member = { ownerId: 'owner-a', classId: 'class-a', studentId: 'student-a', enrollmentId: 'enrollment-a',
    revision: 7, status: 'active', endDate: null, studentActive: true, classActive: true, label: 'طالب افتراضي أ · الصف السادس' };
  const other = { ...member, studentId: 'student-b', enrollmentId: 'enrollment-b', label: 'طالب افتراضي ب · الصف السادس' };
  const foreign = { ...member, ownerId: 'owner-b', studentId: 'foreign-student', classId: 'foreign-class', enrollmentId: 'foreign-enrollment', label: 'FOREIGN' };
  const task = { ...member, id: 'published-a', title: 'تصميم عرض عن الأمان الرقمي', instruction: 'أضف شريحة لحماية كلمة المرور.',
    deadline: '2026-10-20', status: 'working', published: true, resultPublished: false,
    result: { value: 8, max: 10 }, teacherNote: 'PRIVATE_NOTE', attendance: 'PRIVATE_ATTENDANCE', source: { teachingId: 'teaching-a', itemId: 'item-a' } };
  const namespace = randomBytes(24).toString('base64url'), foreignNamespace = randomBytes(24).toString('base64url');
  const repo = createMemoryRepository({ contexts: [{ namespace, ownerId: 'owner-a', active: true },
    { namespace: foreignNamespace, ownerId: 'owner-b', active: true }], memberships: [member, other, foreign], publications: [task,
    { ...task, id: 'done-a', title: 'تنسيق مستند نصي', deadline: '2026-10-18', status: 'done' },
    { ...task, ...other, id: 'other-student', title: 'OTHER_STUDENT' },
    { ...task, ...foreign, id: 'other-owner', title: 'OTHER_OWNER' },
    { ...task, id: 'unpublished-a', title: 'UNPUBLISHED', published: false }], credentials: [], sessions: [], rates: [] });
  const ingress = new WeakMap();
  const service = createPortalService({ repository: repo, origin, now: () => time, secretKey: options.secretKey || randomBytes(32),
    ...(options.newCode ? { newCode: options.newCode } : {}), verifyIngress: req => ingress.get(req),
    verifyTeacher: async req => auth.get(req.headers?.['x-fixture-teacher']) ?? null });
  const dispatch = (envelope, clientKey) => { ingress.set(envelope, { clientKey }); return service(envelope); };
  return { repo, service, auth, origin, namespace, foreignNamespace, advance: ms => { time += ms; }, now: () => time,
    handleHttp(req, envelope) { return dispatch(envelope, req.socket.remoteAddress); },
    member, other, foreign,
    request(path, { method = 'POST', body = {}, cookie = '', teacher = 'fabricated-teacher-a', sourceKey = 'fabricated-source', headers = {} } = {}) {
      return dispatch({ path, method, body, headers: { origin, 'x-n88-csrf': '1',
        'content-type': 'application/json', 'x-fixture-teacher': teacher, cookie, ...headers } }, sourceKey);
    } };
}
