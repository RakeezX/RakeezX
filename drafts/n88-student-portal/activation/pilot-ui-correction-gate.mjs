/** AI: metadata-only admission for the once-authorized existing pilot restoration. */
export function pilotCorrectionRestoreReady(input) {
  if(!input||input.alreadyRestored!==false||typeof input.source!=='string'||!/^[a-f0-9]{64}$/.test(input.source))return false;
  if(!['enabledOff','modePilot','bindingMatches','sourceMatches','localUiPass','localPackagePass','historicalFailureMatches','stageAuthorized'].every(k=>input[k]===true))return false;
  const r=input.readiness;
  return !!r&&r.httpStatus===200&&r.status==='ready'&&r.source===input.source&&r.expectedSource===input.source&&r.enabled===false&&r.rolloutMode==='pilot'&&
    ['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','configurationReady','rolloutConfigured','sourceMatches'].every(k=>r[k]===true);
}
