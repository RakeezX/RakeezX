// Provider callbacks belong to the activated worker adapter. No SDK admin key here.
// This same deterministic finally is used for the actual run and same-run recovery.
export async function executeN77(adapter) {
  let cleanupReady = false;
  let provisionStarted = false;
  const result = { gate: 'NOT_RUN', disposition: 'NOT_RUN', disarmed: false };
  try {
    await adapter.deploy('cleanup-only');
    await adapter.probe('cleanup-only');
    cleanupReady = true;
    await adapter.deploy('provision');
    await adapter.probe('provision');
    await adapter.inspectAbsent();
    provisionStarted = true; // A lost create response still enters exact-pair recovery.
    await adapter.provision();
    await adapter.signIn();
    result.gate = await adapter.runGate();
  } catch (error) {
    result.error = error.safeCode ?? error.message;
  } finally {
    if (cleanupReady && provisionStarted) {
      try { result.disposition = await adapter.retire(); }
      catch (error) { result.recovery = error.safeCode ?? error.message; }
    } else if (!provisionStarted) result.disposition = 'NO_AUTH_CREATE';
    if (['RETAINED_BANNED', 'NO_AUTH_CREATE'].includes(result.disposition)) {
      try {
        await adapter.disarm('provision');
        await adapter.disarm('cleanup-only');
        result.disarmed = await adapter.verifyDisarm();
      } catch (error) { result.recovery = error.safeCode ?? error.message; }
    }
  }
  return result;
}
