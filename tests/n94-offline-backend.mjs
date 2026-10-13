// Synthetic command backend, NOT live SQL/RLS or provider evidence. The real
// command dispatcher and canonical reconciliation consume these receipts.
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import { projectSubitemScore } from '../src/lib/score-foundation.js';
import { scoreId, makeScoreSubitemCompletion, scoreSubitemCompletionId } from '../src/models.js';

export const capability = Object.freeze({ scoreDomainVersion: 1, restoreProtocol: 'CORE_V2',
  backupVersion: 5, copyDomainVersion: 1, n94SubitemVersion: 1 });
export function syntheticScoreBackend(snapshot) {
  const state = structuredClone(snapshot), receipts = new Map(), calls = [], applied = [];
  let dropNextReceipt = false;
  const canonical = (name, row) => ({ id: row.id, ...encodeSyncV2Patch(name, row),
    created_at: new Date(row.createdAt || Date.now()).toISOString(),
    revision: row.serverRevision || 1, deleted_at: null });
  const project = (item, studentId) => {
    const prior = state.scores.find(row => row.itemId === item.id && row.studentId === studentId);
    const score = { id: scoreId(studentId, item.id), itemId: item.id, studentId, ...prior,
      ...projectSubitemScore(item, state.scoreSubitems,
        state.scoreSubitemCompletions, prior?.manualValue ?? null, { studentId }),
      serverRevision: (prior?.serverRevision || 0) + 1 };
    state.scores = state.scores.filter(row => row.id !== score.id).concat(score);
    return score;
  };
  const respond = (envelope, apply) => {
    calls.push(structuredClone(envelope));
    if (!receipts.has(envelope.mutationId)) {
      receipts.set(envelope.mutationId, apply()); applied.push(envelope.mutationId);
    }
    if (dropNextReceipt) { dropNextReceipt = false; throw new TypeError('Synthetic lost acknowledgement'); }
    return structuredClone(receipts.get(envelope.mutationId));
  };
  return {
    state, calls, applied, loseNextAcknowledgement() { dropNextReceipt = true; },
    getScoreFoundationCapability: () => capability,
    async applyScoreConfigurationCommand(envelope) {
      return respond(envelope, () => {
        const item = state.items.find(row => row.id === envelope.itemId);
        if (item.distributionVersion !== envelope.expectedVersion) throw new Error('Synthetic configuration version conflict');
        Object.assign(item, envelope.payload, { distributionVersion: item.distributionVersion + 1,
          serverRevision: item.serverRevision + 1 }); delete item.subitems;
        const definitions = envelope.payload.subitems.map(row => ({
          ...state.scoreSubitems.find(prior => prior.id === row.id), ...row, itemId: item.id,
          createdAt: state.scoreSubitems.find(prior => prior.id === row.id)?.createdAt || Date.now(), serverRevision: 1,
        }));
        state.scoreSubitems = state.scoreSubitems.filter(row => row.itemId !== item.id).concat(definitions);
        const students = state.scores.filter(row => row.itemId === item.id).map(row => row.studentId);
        return { mutationId: envelope.mutationId, item: canonical('items', item),
          subitems: definitions.map(row => canonical('scoreSubitems', row)),
          scores: students.map(id => canonical('scores', project(item, id))) };
      });
    },
    async applyScoreSubitemCommand(envelope) {
      return respond(envelope, () => {
        const item = state.items.find(row => row.id === envelope.itemId);
        const id = scoreSubitemCompletionId(envelope.studentId, envelope.subitemId);
        const prior = state.scoreSubitemCompletions.find(row => row.id === id);
        const completion = { ...makeScoreSubitemCompletion({ id, studentId: envelope.studentId,
          subitemId: envelope.subitemId, checked: envelope.checked,
          completionState: envelope.completionState }), serverRevision: (prior?.serverRevision || 0) + 1 };
        state.scoreSubitemCompletions = state.scoreSubitemCompletions.filter(row => row.id !== id).concat(completion);
        return { mutationId: envelope.mutationId, completion: canonical('scoreSubitemCompletions', completion),
          score: canonical('scores', project(item, envelope.studentId)) };
      });
    },
  };
}
