import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { workerPublicationInstruction } from '../controller.mjs';

const card = JSON.parse(fs.readFileSync(new URL('../n88-student-pending-return-finite-diagnostic-20261021.json', import.meta.url), 'utf8')).tasks[0];
test('only exact N88 private-static prerequisite escapes generic no-deploy prompt', () => {
  const allowed = workerPublicationInstruction(card);
  assert.match(allowed, /one changed private static student carrier upload/);
  assert.match(allowed, /must precede LOCAL_READY/);
  assert.match(allowed, /Do not push Product main/);
  for (const changed of [
    { ...card, id: 'another-task' },
    { ...card, liveAuthorizationRef: 'other' },
    { ...card, preparationAuthority: { ...card.preparationAuthority, maxChangedPrivateStaticUploads: 2 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, nativeDeployments: 1 } },
    { ...card, preparationAuthority: { ...card.preparationAuthority, publicPinChanges: 1 } }
  ]) assert.match(workerPublicationInstruction(changed), /Do not push or deploy/);
  assert.match(workerPublicationInstruction({ id: 'other', productId: 'N36' }), /Do not push or deploy/);
});
