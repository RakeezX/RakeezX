import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupRejectedSyncErrors, sanitizeSupportDiagnostics } from '../src/lib/support.js';
import { supportWhatsAppMessage } from '../src/lib/support-whatsapp.js';
import { buildNotificationEmail, validateSupportRequest } from '../supabase/functions/support-notification-worker/core.mjs';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const workspace = { type: 'account', ownershipState: 'claimed', syncEligible: true, authUserId: ownerId };

test('safe WhatsApp text and local Edge email use the same bounded owner-safe diagnostic group', () => {
  const row = (owner, code, message) => ({ protocol: 'v2', state: 'rejected', ownerId: owner,
    store: 'sessions', lastError: { code, message }, patch: { studentName: 'PRIVATE_STUDENT' } });
  const rows = [row(ownerId, '22023', 'N58_SESSION_CONTEXT_REQUIRED SQL PRIVATE_SQL'),
    row(otherId, '22023', 'N58_SESSION_CONTEXT_REQUIRED PRIVATE_OTHER')];
  const diagnostics = sanitizeSupportDiagnostics({
    buildSha: 'a'.repeat(40), buildShaKind: 'content', environment: 'preview',
    rejectedGroups: groupRejectedSyncErrors(rows, { workspace, ownerId }),
    studentName: 'PRIVATE_STUDENT', ownerId,
  });
  const whatsapp = supportWhatsAppMessage({ type: 'technical', message: 'Sync failed', diagnostics });
  const record = { id: 'support:test', type: 'technical', message: 'Sync failed',
    created_at: '2026-10-11T00:00:00Z', diagnostics };
  const edge = validateSupportRequest(record).request.diagnostics;
  const email = buildNotificationEmail(record, { to: 'support@example.test' }).payload.text;
  assert.deepEqual(edge.rejectedGroups, diagnostics.rejectedGroups);
  for (const text of [whatsapp, email]) {
    assert.match(text, /N58_SESSION_CONTEXT_REQUIRED\) × 1/);
    assert.match(text, /بصمة المحتوى: a{12}/);
    assert.match(text, /البيئة: المعاينة/);
    assert.doesNotMatch(text, /PRIVATE_STUDENT|PRIVATE_SQL|PRIVATE_OTHER|11111111|22222222|إصدار Git/);
  }
  assert.deepEqual(groupRejectedSyncErrors(rows, { workspace: { ...workspace, authUserId: otherId }, ownerId }), []);
});

test('Support direct handoff remains independent of in-app submission', async () => {
  const source = await readFile(new URL('../src/views/support.js', import.meta.url), 'utf8');
  const open = source.split("'support-whatsapp-open'()")[1]?.replace(/\/\/[^\n]*/g, '');
  assert.ok(open);
  assert.match(source, /currentRejectedSyncGroups\(\)/);
  assert.match(open, /supportWhatsAppMessage/);
  assert.match(open, /currentWhatsAppDiagnostics\(\)/);
  assert.doesNotMatch(open, /await |draft\.message|submitSupportRequest|mailto:|cloud\.request/);
});
