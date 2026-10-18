// Exact historical N88 classification only; no Product success or live activation.
import { createHash } from 'node:crypto';
import { verifiedDeployment } from './controller.mjs';
export const HISTORICAL_RUNTIME_MODE = 'superseded_n88_runtime_by_verified_delivery';
const OLD = Object.freeze({ id: 'continuous-n88-complete-runtime-binding-20261018', productId: 'N88', scopeKey: 'n88-runtime-http-authoritative-binding',
  candidateSha: '51f2c62e53dd710cde755acba03b8d409794f43b', baseSha: 'f2395c4841db30fb29e5908fe30e6154a925116a',
  sessionId: '01a14beb-21c2-7cd0-b42d-ed8a4441c24f', runId: '3813f899-434f-4b6f-b989-dd20fdbdb698' });
const REPLACEMENT = 'continuous-n88-six-digit-unified-student-code-20261018';
const INTEGRATION = 'continuous-n88-integrated-class-student-journey-20261018';
const FAILURE = 'VERIFICATION_ASSET_MISSING: Required source asset is missing: drafts/n88-student-portal/runtime-http.mjs';
const SHA256 = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const receiptHash = value => hash(Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const insist = (value, message) => { if (!value) throw Error(message); };
function inactive(card) {
  const a = card?.preparationAuthority;
  return ['local', 'synthetic'].includes(card?.executionMode) && card?.liveMutation !== true && !card?.liveAuthorizationRef
    && a?.publication === true && /\b(?:inert|inactive)\b/i.test(a.publicationScope ?? '') && /source-only/i.test(card?.releaseAuthority ?? '')
    && ['realData', 'hostedSchemaChange', 'AuthRLSChange', 'realSend', 'liveStudentAccessActivation'].every(key => a[key] === false);
}
export function verifyHistoricalRuntimeSupersession(task, result, update, context) {
  const card = update.card, p = card.historicalSupersession, r = context?.replacement, integrated = context?.integration, d = r?.deliveryReceipt, c = context?.coverage;
  insist(card.completionMode === HISTORICAL_RUNTIME_MODE && task.id === OLD.id && task.productId === OLD.productId && task.scopeKey === OLD.scopeKey
    && task.candidateSha === OLD.candidateSha && task.baseSha === OLD.baseSha && task.sessionId === OLD.sessionId && task.attempt?.runId === OLD.runId,
  'Historical supersession is restricted to the exact original N88 attempt');
  insist(task.status === 'blocked' && update.expected.status === 'blocked' && update.expected.resultState === 'LOCAL_READY'
    && result.state === 'LOCAL_READY' && result.blockerType === 'none' && !result.blocker && task.lastFailure === FAILURE
    && task.deliveryReceipt?.errorCode === 'VERIFICATION_ASSET_MISSING' && task.deliveryReceipt.status === 'blocked'
    && task.deliveryReceipt.taskId === task.id && task.deliveryReceipt.ticketId === task.productId
    && task.deliveryReceipt.candidateSha === task.candidateSha && task.deliveryReceipt.baseSha === task.baseSha, 'Original source-verification failure changed');
  const errors = [task.lastFailure, task.lastModelError, task.deliveryReceipt?.message, result.blocker,
    ...(task.recoveryHistory ?? []).map(event => event.previousFailure), ...(task.sourceParityHistory ?? []).map(event => event.receipt?.message)];
  insist(!/blocked by policy|flagged for possible cybersecurity|daybreak|policy.{0,30}(?:denied|refus)|security.{0,30}(?:denied|refus)/i.test(errors.filter(Boolean).join('\n')),
    'Security or policy refusals cannot be historically superseded by this operation');
  insist(inactive(task) && inactive(card) && inactive(r) && inactive(integrated), 'Historical supersession cannot authorize live/Auth/RLS/schema access');
  insist(same(card.allowedPaths, task.allowedPaths) && same(card.requiredChecks, task.requiredChecks) && same(card.verificationPaths, task.verificationPaths)
    && Object.entries(card).every(([key, value]) => ['completionMode', 'supersededBy', 'supersedingPublishedSha', 'historicalSupersession'].includes(key) || same(value, task[key])),
  'Historical supersession cannot change the original Product scope or checks');
  insist(task.requiredChecks?.length > 0 && task.requiredChecks.every(name => result.checks?.some(check => check.name === name && check.status === 'PASS'))
    && result.checks.every(check => check.status === 'PASS' || check.status === 'NOT_RUN' && check.name === 'hosted_service_auth_tls_and_student_activation')
    && result.checks.some(check => check.name === 'hosted_service_auth_tls_and_student_activation' && check.status === 'NOT_RUN'), 'Original affected checks or inactive hosted gate changed');
  insist(p?.version === 1 && ['originalResultSha256', 'originalFailureSha256', 'originalReceiptSha256', 'replacementQueueSha256', 'replacementReceiptSha256', 'integrationReceiptSha256', 'coverageEvidenceSha256'].every(key => SHA256.test(p[key] ?? ''))
    && /^docs\/automation-evidence\/20261018\/[A-Z0-9_]+\.json$/.test(p.coverageEvidencePath ?? '') && p.reason?.length >= 50,
  'Exact reviewed historical coverage bindings are required');
  insist(p.originalResultSha256 === context?.resultSha256 && p.originalFailureSha256 === hash(Buffer.from(task.lastFailure))
    && p.originalReceiptSha256 === receiptHash(task.deliveryReceipt) && p.replacementQueueSha256 === context.replacementSha256
    && p.replacementReceiptSha256 === context.replacementReceiptSha256 && p.integrationReceiptSha256 === context.integrationReceiptSha256
    && p.coverageEvidenceSha256 === context.coverageSha256 && same(p.reviewedVerificationPaths, task.verificationPaths), 'Historical proof preimage changed');
  insist(card.supersededBy === REPLACEMENT && r?.id === REPLACEMENT && r.activationId === task.activationId && r.productId === task.productId
    && r.status === 'awaiting_po' && !r.runnerPid && !r.brokerPid && verifiedDeployment(r, d)
    && d.publishedSha === card.supersedingPublishedSha && d.binding?.checkHeadShaMatches === true
    && receiptHash(d) === p.replacementReceiptSha256, 'Replacement is not the exact current verified same-product awaiting-PO delivery');
  insist(integrated?.id === INTEGRATION && integrated.activationId === task.activationId && integrated.productId === task.productId
    && integrated.status === 'awaiting_po' && !integrated.runnerPid && !integrated.brokerPid && verifiedDeployment(integrated, integrated.deliveryReceipt)
    && integrated.deliveryReceipt.publishedSha === r.baseSha && receiptHash(integrated.deliveryReceipt) === p.integrationReceiptSha256,
  'Integrated journey coverage is not the verified predecessor of the replacement');
  insist(c?.version === 1 && c.kind === 'n88-historical-runtime-supersession-coverage'
    && same(c.original, { taskId: task.id, candidateSha: task.candidateSha, baseSha: task.baseSha, sessionId: task.sessionId, runId: task.attempt.runId,
      resultSha256: p.originalResultSha256, failure: task.lastFailure, verificationPaths: task.verificationPaths })
    && same(c.replacement, { taskId: r.id, candidateSha: r.candidateSha, baseSha: r.baseSha, publishedSha: d.publishedSha, receiptSha256: p.replacementReceiptSha256 })
    && same(c.integration, { taskId: integrated.id, publishedSha: integrated.deliveryReceipt.publishedSha, receiptSha256: p.integrationReceiptSha256 })
    && c.originalPublicationClaimed === false && c.productSuccessClaimed === false && c.liveActivationClaimed === false,
  'Reviewed coverage does not describe this exact historical relation');
  insist(typeof context.assertAncestor === 'function' && typeof context.readPublishedBlob === 'function', 'Actual Git ancestry and published-tree checks are required');
  context.assertAncestor(task.candidateSha, d.publishedSha);
  context.assertAncestor(r.baseSha, d.publishedSha);
  context.assertAncestor(r.candidateSha, d.publishedSha);
  insist(Array.isArray(c.inheritedPaths) && c.inheritedPaths.length === task.verificationPaths.length
    && task.verificationPaths.every(repoPath => c.inheritedPaths.filter(entry => entry.repoPath === repoPath).length === 1
      && c.inheritedPaths.find(entry => entry.repoPath === repoPath).blobSha === context.readPublishedBlob(d.publishedSha, repoPath)),
  'Historical runtime paths are absent or differ from the reviewed published tree');
  return true;
}
