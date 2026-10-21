// Exact historical N88 mobile native-source proof. No network, credentials or provider writes.
import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ID = 'continuous-n88-mobile-class-source-503-20261021';
const RUN = '403b07e3-af18-40d5-befa-70fec488d5ce';
const SESSION = '01a15e11-4256-7e72-b37d-d95a2e0f47f5';
const CANDIDATE = '3903a5a2705026133b12c5fe0c5c18b5fe3f49c8';
const BASE = '0bca7554e60adca6b19ad804e4370874d9f5676b';
const PUBLISHED = 'c025280bbf807eae14f1a1e96ba0db428e029a8d';
const SOURCE_CANDIDATE = '7b470d779648b92c73f7d16f9df785ab3de1f771';
const OPERATION_CANDIDATE = 'ee399f57cebd144ea0dfb9a6ccddee435124533b';
const NATIVE_SOURCE = 'ec0efc049b20f7119b3b5eea8b55a93a52bdfd6981647bf97298383a9f37f507';
const PRIOR_SOURCE = 'a5ca44450359a938128a99f2fa2bac274e9f88cc77d9d665c8e31ffcc67a88fe';
const CARRIER_SOURCE = '6978352dfa73746a9c4a2cc85e822545483427d4834f172a04abb963f136068e';
const SERVED = Object.freeze({
  'drafts/n88-student-portal/integrated-service.mjs': '2faf3567ddf0f83b41ad811b2c586ae1cbacbe72ae60fc383b826d7372812734',
  'drafts/n88-student-portal/class-credentials.mjs': '6d5c32265bebb1b72de0ec028ce102bc162a8bdf8e4b46731f8252261a41019e',
  'src/lib/student-portal-runtime.js': 'a34d95fe9beeb77b19b633fea1fd0a3c2a08a030d98d0636d3c12d802e4359eb',
});
const ROOT = 'tests/n88-mobile-class-source-503-20261021/';
const PINS = Object.freeze({
  [ROOT + 'native-preflight.json']: '919a44389b291cfc4803a62a715b99ed876e3108cb6753b8e4eb706f846e8e7c',
  [ROOT + 'native-upload.json']: 'bb16fe0fc5f7caf5b84045c24977a6165d172928feb4fcdb76ea5e28111da827',
  [ROOT + 'native-pin.json']: '5f305c7912645a3a851994d80f55119cb39f9df35536682f5470f71b5e579fde',
  [ROOT + 'native-complete.json']: '6b1227973b2fc7dfba635a90d37e1d2d50398e1363d90b1ac1e42014dd1029e3',
  [ROOT + 'transport-before.json']: '76c772e7fa616972fc2e9a68f55fe42f4183c619eb4f1c23d321a0741d1646ea',
  [ROOT + 'transport-after.json']: '8e0e67b6865c05d2a9c11fa1fb0ddbf74ec6f69b4f721b81931fd5143c5f012f',
  [ROOT + 'native-delivery-qualification.json']: '5dccf74f533fcabe3556924a61001bd2ca1dfe5d9a9a3f95a36096123506ac03',
  'drafts/n88-student-portal/activation/manifest.json': '1add249c60baf079733bf4423e1c3f983699d32b94e6e9eafd755121dd14df9c',
  'drafts/n88-student-portal/activation/bundle/edge/index.mjs': NATIVE_SOURCE,
});
const SAME = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const n88MobileNativeTask = task => task?.id === ID && task.productId === 'N88'
  && task.scopeKey === 'n88-actual-mobile-class-source-503-20261021'
  && task.sessionId === SESSION && task.attempt?.runId === RUN
  && task.candidateSha === CANDIDATE && task.baseSha === BASE
  && task.executionMode === 'local' && task.liveMutation === true
  && task.liveAuthorizationRef === 'PO-20261021-N88-MOBILE-SOURCE-503-EXACT-CORRECTION'
  && task.preparationAuthority?.kind === 'PO-20261021-N88-actual-mobile-source-503'
  && task.preparationAuthority.publication === true
  && task.preparationAuthority.realAccountReads === 0
  && task.preparationAuthority.realStudentTeacherWrites === 0
  && task.preparationAuthority.maxChangedNativeFunctionUploads === 1
  && task.preparationAuthority.maxPublicSourcePinUpdates === 1
  && task.preparationAuthority.maxChangedPrivateStaticUploads === 0
  && task.preparationAuthority.newReadinessRequests === 0
  && task.preparationAuthority.sqlAuthSchemaChanges === 0
  && task.preparationAuthority.regionChanges === 0
  && task.preparationAuthority.appendOnlyAttemptHistory === true
  && task.preparationAuthority.resetConsumedMarkers === false;

export function buildN88MobileNativeEvidence(task, receipt, readCandidateFile) {
  if (!n88MobileNativeTask(task) || receipt?.publishedSha !== PUBLISHED) throw Error('N88 mobile native identity changed');
  const bytes = Object.fromEntries(Object.keys(PINS).map(file => [file, Buffer.from(readCandidateFile(file))]));
  const json = name => JSON.parse(bytes[ROOT + name + '.json'].toString('utf8'));
  const preflight = json('native-preflight'), upload = json('native-upload'), pin = json('native-pin');
  const complete = json('native-complete'), before = json('transport-before'), after = json('transport-after');
  const qualification = json('native-delivery-qualification');
  const manifest = JSON.parse(bytes['drafts/n88-student-portal/activation/manifest.json'].toString('utf8'));
  return {
    version: 1, kind: 'n88-mobile-native-source-publication-v1', taskId: task.id, runId: RUN,
    candidateSha: task.candidateSha, baseSha: task.baseSha, publishedSha: receipt.publishedSha,
    artifactHashes: Object.fromEntries(Object.entries(bytes).map(([file, value]) => [file, hash(value)])),
    native: {
      sourceCandidate: complete.sourceCandidate, operationCandidate: complete.candidateSha,
      sourceSha256: complete.source, priorSha256: complete.prior,
      preflightAt: preflight.observedAt, uploadAt: upload.observedAt, pinAt: pin.observedAt, completeAt: complete.observedAt,
      preflightSourceExact: preflight.provider?.sourceExact, preflightWrites: preflight.providerWrites,
      uploadSourceExact: upload.provider?.sourceExact, uploadSource: upload.provider?.source,
      uploadVersion: upload.provider?.version, uploads: upload.uploads,
      pinSourceExact: pin.provider?.sourceExact, pinSource: pin.provider?.source,
      pinVersion: pin.provider?.version, pinUpdates: pin.pinUpdates,
      completeStatus: complete.status, sourceExact: complete.sourceExact,
      publicPinMatches: complete.publicPinMatches, otherConfigurationUnchanged: complete.otherConfigurationUnchanged,
      importMapUnchanged: complete.importMapUnchanged, nativeVersion: complete.nativeVersion,
      uploadedVersion: complete.uploadedVersion, completeUploads: complete.uploads, completePinUpdates: complete.pinUpdates,
      accountRequests: complete.accountRequests, readinessRequests: complete.readinessRequests, carrierUploads: complete.carrierUploads,
      transportStatus: complete.transport?.httpStatus, transportAnonymousDenied: complete.transport?.safeAnonymousDenial,
      transportSource: complete.transport?.carrierSource, transportCarrierUnchanged: complete.transport?.carrierUnchanged,
      beforeSourceExact: before.sourceExact, afterSourceExact: after.sourceExact,
      beforeCarrierSource: before.provider?.sourceSha256, afterCarrierSource: after.provider?.sourceSha256,
      beforeReadOnly: before.readOnly, afterReadOnly: after.readOnly,
      beforeAt: before.observedAt, afterAt: after.observedAt,
      qualificationState: qualification.state, qualificationRunId: qualification.runId,
      qualificationBaseSha: qualification.baseSha, qualificationSourceCandidate: qualification.sourceCandidate,
      qualificationOperationCandidate: qualification.operationCandidate,
      qualificationSourceSha256: qualification.sourceSha256,
      qualificationChecksAllPass: qualification.checks?.length === 5 && qualification.checks.every(check => check.status === 'PASS'),
      historyAppended: qualification.originalCustodianHistoryAppended,
      consumedMarkersPreserved: qualification.consumedMarkersPreserved,
      actualTeacherRead: qualification.actualTeacherRead,
      wholeProductAcceptance: qualification.wholeProductAcceptance,
      frontendProduction: qualification.frontendProduction,
      leasesReleased: qualification.cleanup?.integrationLease === 'RELEASED' && qualification.cleanup?.liveMutationLease === 'RELEASED',
      manifest: manifest.mobileSource503NativePrerequisite,
    },
  };
}

export function verifiedN88MobileNativePublication(task, receipt) {
  try {
    if (!n88MobileNativeTask(task) || receipt?.status !== 'deployed' || receipt.state !== 'DEPLOYED_AWAITING_PO'
      || receipt.productionDeployed !== true || receipt.closed !== false || receipt.candidateSha !== CANDIDATE
      || receipt.baseSha !== BASE || receipt.publishedSha !== PUBLISHED || receipt.productSourceChangeObserved !== false
      || !Array.isArray(receipt.changedAssets) || receipt.changedAssets.length !== 0) return false;
    const evidence = task.servicePublicationEvidence, native = evidence?.native;
    if (evidence?.version !== 1 || evidence.kind !== 'n88-mobile-native-source-publication-v1'
      || evidence.taskId !== ID || evidence.runId !== RUN || evidence.candidateSha !== CANDIDATE
      || evidence.baseSha !== BASE || evidence.publishedSha !== PUBLISHED
      || !SAME(evidence.artifactHashes, PINS)
      || !Object.keys(PINS).every(file => receipt.sourceOnlyPaths?.includes(file))) return false;
    for (const part of [receipt.evidence?.immutable, receipt.evidence?.production]) {
      if (part?.passed !== true || !Object.entries(SERVED).every(([file, expected]) => part.assets?.some(asset =>
        asset.repoPath === file && asset.verified === true && asset.deleted === false
        && asset.expectedSha256 === expected && (asset.observedSha256 === expected || asset.normalizedSha256 === expected)))) return false;
    }
    if (native?.sourceCandidate !== SOURCE_CANDIDATE || native.operationCandidate !== OPERATION_CANDIDATE
      || native.sourceSha256 !== NATIVE_SOURCE || native.priorSha256 !== PRIOR_SOURCE
      || native.preflightSourceExact !== true || native.preflightWrites !== 0
      || native.uploadSourceExact !== true || native.uploadSource !== NATIVE_SOURCE || native.uploadVersion !== 60 || native.uploads !== 1
      || native.pinSourceExact !== true || native.pinSource !== NATIVE_SOURCE || native.pinVersion !== 61 || native.pinUpdates !== 1
      || native.completeStatus !== 'PASS' || native.sourceExact !== true || native.publicPinMatches !== true
      || native.otherConfigurationUnchanged !== true || native.importMapUnchanged !== true
      || native.nativeVersion !== 61 || native.uploadedVersion !== 60 || native.completeUploads !== 1 || native.completePinUpdates !== 1
      || native.accountRequests !== 0 || native.readinessRequests !== 0 || native.carrierUploads !== 0
      || native.transportStatus !== 401 || native.transportAnonymousDenied !== true
      || native.transportSource !== CARRIER_SOURCE || native.transportCarrierUnchanged !== true
      || native.beforeSourceExact !== true || native.afterSourceExact !== true
      || native.beforeCarrierSource !== CARRIER_SOURCE || native.afterCarrierSource !== CARRIER_SOURCE
      || native.beforeReadOnly !== true || native.afterReadOnly !== true
      || native.qualificationState !== 'LOCAL_READY' || native.qualificationRunId !== RUN
      || native.qualificationBaseSha !== BASE || native.qualificationSourceCandidate !== SOURCE_CANDIDATE
      || native.qualificationOperationCandidate !== OPERATION_CANDIDATE || native.qualificationSourceSha256 !== NATIVE_SOURCE
      || native.qualificationChecksAllPass !== true || native.historyAppended !== true || native.consumedMarkersPreserved !== true
      || native.actualTeacherRead !== 'NOT_RUN' || native.wholeProductAcceptance !== false
      || native.frontendProduction !== 'NOT_PUBLISHED_BY_WORKER' || native.leasesReleased !== true) return false;
    const manifest = native.manifest;
    if (manifest?.taskId !== ID || manifest.runId !== RUN || manifest.sourceCandidate !== SOURCE_CANDIDATE
      || manifest.operationCandidate !== OPERATION_CANDIDATE || manifest.sourceSha256 !== NATIVE_SOURCE
      || manifest.uploadedVersion !== 60 || manifest.currentVersion !== 61 || manifest.functionUploads !== 1
      || manifest.publicSourcePinUpdates !== 1 || manifest.otherConfigurationUnchanged !== true
      || manifest.importMapUnchanged !== true || manifest.originalCustodianHistoryAppended !== true
      || manifest.carrierUploads !== 0 || manifest.realAccountRequests !== 0 || manifest.newReadinessRequests !== 0
      || manifest.actualTeacherRead !== 'NOT_RUN' || manifest.frontendPublication !== 'SOLE_PUBLISHER_OWNED') return false;
    const times = [native.beforeAt, native.preflightAt, native.uploadAt, native.pinAt, native.afterAt, native.completeAt, receipt.verifiedAt].map(Date.parse);
    return times.every(Number.isFinite) && times.every((time, i) => i === 0 || times[i - 1] <= time);
  } catch { return false; }
}
