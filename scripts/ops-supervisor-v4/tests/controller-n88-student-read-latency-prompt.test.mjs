import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { workerPublicationInstruction } from '../controller.mjs';

const card = JSON.parse(fs.readFileSync(new URL('../n88-student-read-phase-latency-20261021.json', import.meta.url), 'utf8')).tasks[0];

test('exact N88 measured latency card permits only conditional original-custodian prerequisites', () => {
  const allowed = workerPublicationInstruction(card);
  assert.match(allowed, /Only after red-first measured causal evidence or a finite safe successful-GET diagnostic/);
  assert.match(allowed, /at most one changed native service/);
  assert.match(allowed, /Only if the diagnostic changes the private student client/);
  assert.match(allowed, /separately upload at most one changed private static student carrier/);
  assert.match(allowed, /before LOCAL_READY/);
  assert.match(allowed, /Do not push Product main or publish frontend Production/);
  assert.match(allowed, /tool-denial bypass/);
  for (const altered of [
    { ...card, id: 'other' },
    { ...card, productId: 'N36' },
    { ...card, liveAuthorizationRef: 'other' },
    { ...card, preparationAuthority: { ...card.preparationAuthority, kind: 'other' } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, maxChangedNativeFunctionUploads: 2 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, maxPublicSourcePinUpdates: 2 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, maxChangedPrivateStaticUploads: 2 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, maxChangedStudentCarrierUploads: 2 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, diagnosticOnlyOnSuccessfulGet: false } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, realAccountReads: 1 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, regionChanges: 1 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, officialCloudflareConnection: { ...card.preparationAuthority.officialCloudflareConnection, serverName: 'other' } } },
  ]) assert.match(workerPublicationInstruction(altered), /Do not push or deploy/);
});
