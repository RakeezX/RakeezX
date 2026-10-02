import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT_ROUTE_CATEGORIES as CLIENT_TEMPLATES, safeSupportOrigin, captureSupportOriginBeforeNavigation, enterSupportVisit, supportVisitOrigin, clearSupportOrigin } from '../src/lib/support-origin.js';
import { sanitizeSupportDiagnostics } from '../src/lib/support.js';
import { SUPPORT_ROUTE_CATEGORIES as SERVER_TEMPLATES, validateSupportRequest, buildNotificationEmail } from '../supabase/functions/support-notification-worker/core.mjs';

test('known routes resolve to static Support templates without parameters or queries', () => {
  const cases = [
    ['/', 'home', '/'], ['/calendar', 'calendar', '/calendar'],
    ['/schedule/times', 'schedule', '/schedule/times'], ['/settings', 'settings', '/settings'],
    ['/teaching/demo%3A1/attendance?token=private', 'classes', '/teaching/:id/attendance'],
    ['/student/student-secret', 'students', '/student/:id'],
  ];
  for (const [path, routeCategory, routeTemplate] of cases) {
    assert.deepEqual(safeSupportOrigin(path), { routeCategory, routeTemplate });
    assert.doesNotMatch(JSON.stringify(safeSupportOrigin(path)), /demo|secret|token/);
  }
});

test('unknown, malformed, and encoded structural input does not produce a Support origin', () => {
  for (const path of ['/unknown/secret', '/teaching/%ZZ/attendance', '/student/a%2Fb',
    '/student/a%23b', '/student/a%5Cb', '/student/', 'https://private.example/student/a',
    '/calendar#private']) assert.equal(safeSupportOrigin(path), null, path);
  assert.doesNotThrow(() => captureSupportOriginBeforeNavigation({ path: '/student/private' }, 'account-a'));
});

test('origin is per visit and account, direct entry falls back honestly', () => {
  clearSupportOrigin();
  captureSupportOriginBeforeNavigation('/teaching/secret/grades', 'account-a');
  enterSupportVisit('account-a');
  assert.deepEqual(supportVisitOrigin('account-a'), { routeCategory: 'classes', routeTemplate: '/teaching/:id/grades' });
  assert.deepEqual(supportVisitOrigin('account-b'), { routeCategory: 'support' });
  enterSupportVisit('account-b');
  assert.deepEqual(supportVisitOrigin('account-b'), { routeCategory: 'support' });
  captureSupportOriginBeforeNavigation('/calendar', 'account-b');
  enterSupportVisit('account-b');
  assert.deepEqual(supportVisitOrigin('account-b'), { routeCategory: 'calendar', routeTemplate: '/calendar' });
  // A failed direct submission does not mutate this tab-local visit snapshot.
  assert.deepEqual(supportVisitOrigin('account-b'), { routeCategory: 'calendar', routeTemplate: '/calendar' });
  clearSupportOrigin();
  enterSupportVisit('account-b');
  assert.deepEqual(supportVisitOrigin('account-b'), { routeCategory: 'support' });
});

test('final sanitizer accepts only paired known category/template and strips raw context', () => {
  assert.deepEqual(sanitizeSupportDiagnostics({ routeCategory: 'students', routeTemplate: '/student/:id', rawUrl: '/student/private' }),
    { routeCategory: 'students', routeTemplate: '/student/:id' });
  assert.deepEqual(sanitizeSupportDiagnostics({ routeCategory: 'students', routeTemplate: '/teaching/:id/grades' }),
    { routeCategory: 'students' });
  assert.deepEqual(sanitizeSupportDiagnostics({ routeCategory: 'students', routeTemplate: '/student/private' }),
    { routeCategory: 'students' });
});

test('client, worker, and email retain the same exact safe origin for every approved route', () => {
  assert.deepEqual(SERVER_TEMPLATES, CLIENT_TEMPLATES);
  for (const [routeTemplate, routeCategory] of Object.entries(CLIENT_TEMPLATES)) {
    const diagnostics = sanitizeSupportDiagnostics({ routeCategory, routeTemplate, rawUrl: '/private/secret' });
    const record = {
      id: 'support:synthetic', type: 'technical', message: 'Synthetic only',
      created_at: '2026-10-02T12:00:00.000Z', diagnostics,
    };
    const validation = validateSupportRequest(record);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.request.diagnostics, { routeCategory, routeTemplate });
    const email = buildNotificationEmail(record, { to: 'internal@example.test' });
    assert.equal(email.ok, true);
    assert.match(email.payload.text, new RegExp(`المسار: ${routeTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.doesNotMatch(email.payload.text, /private\/secret/);
  }
});
