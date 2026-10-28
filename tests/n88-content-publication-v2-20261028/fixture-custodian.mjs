/** AI-authored synthetic protocol model ONLY. Not a backend, database or provider implementation. */
import { samePublicationScope } from '../../src/lib/n88-item-publication-proposal.js';
export function fixtureCustodian(draft) {
  const records = new Map(), receipts = new Map();
  let source = structuredClone(draft), roster = 'roster-1';
  return {
    source(next) { source = structuredClone(next); },
    roster(next) { roster = next; },
    apply(command, authorized = true) {
      const bytes = JSON.stringify(command), saved = receipts.get(command.requestId);
      // Authorization is rechecked even on receipt reads/repeats.
      if (!authorized || !samePublicationScope(command.scope, source.scope) || command.binding.leaseId !== 'fake-lease') throw Error('not_authorized');
      if (saved) { if (saved.bytes !== bytes) throw Error('idempotency_conflict'); return structuredClone(saved.receipt); }
      const row = source.rows.find(r => r.id === command.rowId);
      const previous = records.get(command.rowId), revision = previous?.publicationRevision ?? 0;
      if (!row || row.sourceRevision !== command.expectedSourceRevision || command.expectedPublicationRevision !== revision
          || command.expectedMembershipRevision !== roster) throw Error('cas_conflict');
      const receipt = { version: 2, scope: { ...source.scope }, binding: { ...command.binding }, requestId: command.requestId, rowId: command.rowId,
        sourceRevision: row.sourceRevision, state: 'applied', publicationRevision: revision + 1 };
      const record = { ...receipt, fresh: true, membershipRevision: roster, decisions: { ...command.decisions } };
      records.set(row.id, record); receipts.set(command.requestId, { bytes, receipt });
      return structuredClone(receipt);
    },
    read(rowId) { return structuredClone(records.get(rowId) ?? null); },
  };
}
