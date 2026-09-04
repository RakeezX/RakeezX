import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  commitEnrollmentTransfer, renumberEnrollmentRoster, setMockAuth, setMockBackend,
} from '../src/lib/cloud.js';

const originalFetch = global.fetch;

test('enrollment operation RPCs use the current rakeezx REST/RPC path and payload contract', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  setMockBackend(null);
  setMockAuth({ id: 'owner-1' }, { access_token: 'token' });

  await commitEnrollmentTransfer({
    source: { id: 'en:student:X', student_id: 'student', section_id: 'X', status: 'transferred', client_updated_at: 10 },
    destination: { id: 'en:student:Y', student_id: 'student', section_id: 'Y', status: 'active', roll_no: 2, client_updated_at: 10 },
  });
  await renumberEnrollmentRoster({
    sectionId: 'Y',
    roster: [{ id: 'en:student:Y', roll_no: 1, client_updated_at: 11 }],
  });

  assert.equal(calls[0].url.endsWith('/rest/v1/rpc/commit_enrollment_transfer'), true);
  assert.deepEqual(JSON.parse(calls[0].options.body).p_destination.roll_no, 2);
  assert.equal(calls[1].url.endsWith('/rest/v1/rpc/renumber_enrollment_roster'), true);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    p_section_id: 'Y', p_roster: [{ id: 'en:student:Y', roll_no: 1, client_updated_at: 11 }],
  });
  assert.equal(calls.every((call) => call.options.headers['Content-Profile'] === 'rakeezx'), true);
});

after(() => {
  global.fetch = originalFetch;
  setMockBackend(null);
  setMockAuth(null, null);
});
