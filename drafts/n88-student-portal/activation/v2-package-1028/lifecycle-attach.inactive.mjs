/** AI: INACTIVE genuine-writer attachment contract. No route/SQL/Sync edit.
 * Caller supplies the ORIGINAL owned transaction-bound command and receipt
 * capabilities, never callbacks decoded from an HTTP/Sync payload.
 */
const fail = () => { throw Error('n88_v2_lifecycle_unavailable'); };
export async function attachPublicationRetirement({ request, tx, ports, lifecycle }) {
  if (!lifecycle || !['validateOriginalCommand', 'findOriginalReceipt', 'applyOriginalMutation', 'writeOriginalReceipt'].every(k => typeof lifecycle[k] === 'function')) fail();
  const auth = await ports.authenticate(request, tx, 'teacher'); if (!auth?.current) fail();
  await tx.bindOwner(auth.ownerId);
  const command = await lifecycle.validateOriginalCommand({ tx, auth });
  if (!command || command.ownerId !== auth.ownerId || command.sessionId !== auth.sessionId || !command.requestId ||
      command.scope?.ownerId !== auth.ownerId || !['item', 'subitem'].includes(command.kind)) fail();
  const original = await lifecycle.findOriginalReceipt({ tx, auth, command });
  if (original !== null) return original; // UNKNOWN reconciles the ORIGINAL receipt; no reissue.
  const capture = await ports.captureRetirement(tx, command.scope, command.kind, command.sourceId, command.expectedRevision);
  await lifecycle.applyOriginalMutation({ tx, auth, command }); // genuine parent/child writer, SAME tx
  await ports.completeRetirement(tx, capture);
  return lifecycle.writeOriginalReceipt({ tx, auth, command }); // original command outcome, before COMMIT
}
