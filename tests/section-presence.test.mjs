import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../src/lib/cloud.js';

const owner = { id: 'owner 1' };
const id = 'sec:123e4567-e89b-12d3-a456-426614174000';

test('targeted section presence is owner-scoped, encoded, and preserves tombstones', async () => {
  cloud.setMockBackend(null);
  cloud.setMockAuth(owner, { access_token: 'test' });
  const originalFetch = globalThis.fetch;
  let url = '';
  globalThis.fetch = async (value) => { url = String(value); return new Response(JSON.stringify([{ id, owner_id: owner.id, deleted_at: '2026-01-01T00:00:00Z' }]), { status: 200 }); };
  const result = await cloud.fetchSectionPresence(id);
  globalThis.fetch = originalFetch;
  assert.equal(result.authoritative, true); assert.equal(result.status, 'present'); assert.ok(result.row.deleted_at);
  assert.match(url, /owner_id=eq.owner%201/); assert.match(url, /id=eq.sec%3A123e4567/);
});

test('targeted section presence distinguishes absence and failure', async () => {
  cloud.setMockBackend(null); cloud.setMockAuth(owner, { access_token: 'test' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { status: 200 });
  assert.deepEqual(await cloud.fetchSectionPresence(id), { authoritative: true, status: 'absent', row: null });
  globalThis.fetch = async () => { throw new Error('offline'); };
  const failed = await cloud.fetchSectionPresence(id);
  globalThis.fetch = originalFetch;
  assert.equal(failed.authoritative, false); assert.equal(failed.status, 'unknown'); assert.equal(failed.row, null);
});
