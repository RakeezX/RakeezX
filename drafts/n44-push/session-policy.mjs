/** AI: trusted, activation-bound readonly Auth policy approval. No Auth API/admin key.
 * Readback must be fresh AT activation. Cold starts and normal background work
 * do not need daily human renewal. Any Auth policy change must first disable N44,
 * drain its runtime, retire the approval and bindings, then requalify a NEW ID.
 */
export const N44_SERVICE_REVISION = 'n44-browser-service-v2';
export function supportedSessionPolicy(profile, now = Date.now(), sourceSha) {
  return !!(profile && Object.keys(profile).sort().join(',') ===
    'activatedAt,approvalId,approvalState,inactivityTimeoutSeconds,metadataSha256,observedAt,policyChangeRule,serviceRevision,serviceSourceSha,singleSessionPerUser,timeboxSeconds,v' &&
    profile.v === 2 && profile.approvalState === 'active' && /^[a-f0-9]{64}$/.test(profile.approvalId) &&
    profile.serviceRevision === N44_SERVICE_REVISION && /^[a-f0-9]{40}$/.test(sourceSha ?? '') && profile.serviceSourceSha === sourceSha &&
    profile.policyChangeRule === 'disable-retire-before-auth-policy-change' &&
    profile.timeboxSeconds === null && profile.inactivityTimeoutSeconds === null && profile.singleSessionPerUser === false &&
    /^[a-f0-9]{64}$/.test(profile.metadataSha256) && Number.isSafeInteger(profile.observedAt) && Number.isSafeInteger(profile.activatedAt) &&
    profile.observedAt > 0 && profile.activatedAt >= profile.observedAt && profile.activatedAt - profile.observedAt <= 86400000 &&
    profile.activatedAt <= now + 120000);
}
export const policySessionRevision = (sessionId, profile) => sessionId + ':' + profile.approvalId;
