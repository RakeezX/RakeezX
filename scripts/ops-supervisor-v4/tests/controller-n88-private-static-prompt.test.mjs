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


const serviceCard = JSON.parse(fs.readFileSync(new URL('../n88-mobile-class-source-503-20261021.json', import.meta.url), 'utf8')).tasks[0];
const quietCard = JSON.parse(fs.readFileSync(new URL('../n88-student-quiet-fast-return-20261021.json', import.meta.url), 'utf8')).tasks[0];

test('only exact N88 native source prerequisite escapes generic no-deploy prompt', () => {
  const allowed = workerPublicationInstruction(serviceCard);
  assert.match(allowed, /one changed native service upload/);
  assert.match(allowed, /must precede LOCAL_READY/);
  assert.match(allowed, /Do not push Product main/);
  for (const changed of [
    { ...serviceCard, id: 'another-task' },
    { ...serviceCard, productId: 'N36' },
    { ...serviceCard, liveAuthorizationRef: 'other' },
    { ...serviceCard, preparationAuthority: { ...serviceCard.preparationAuthority, kind: 'other' } },
    { ...serviceCard, preparationAuthority: { ...serviceCard.preparationAuthority, maxChangedNativeFunctionUploads: 2 } },
    { ...serviceCard, preparationAuthority: { ...serviceCard.preparationAuthority, maxPublicSourcePinUpdates: 2 } },
    { ...serviceCard, preparationAuthority: { ...serviceCard.preparationAuthority, maxChangedPrivateStaticUploads: 1 } },
    { ...serviceCard, preparationAuthority: { ...serviceCard.preparationAuthority, regionChanges: 1 } },
  ]) assert.match(workerPublicationInstruction(changed), /Do not push or deploy/);
});

test('only exact N88 quiet student private carrier prerequisite escapes generic no-deploy prompt', () => {
  const allowed = workerPublicationInstruction(quietCard);
  assert.match(allowed, /one changed private static student carrier upload/);
  assert.match(allowed, /must precede LOCAL_READY/);
  assert.match(allowed, /Do not push Product main/);
  for (const changed of [
    { ...quietCard, id: 'another-task' },
    { ...quietCard, productId: 'N36' },
    { ...quietCard, liveAuthorizationRef: 'other' },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, kind: 'other' } },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, maxChangedPrivateStaticUploads: 2 } },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, maxChangedStudentCarrierUploads: 2 } },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, nativeDeployments: 1 } },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, publicPinChanges: 1 } },
    { ...quietCard, preparationAuthority: { ...quietCard.preparationAuthority, regionChanges: 1 } },
  ]) assert.match(workerPublicationInstruction(changed), /Do not push or deploy/);
});