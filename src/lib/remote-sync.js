export const OWNER_SIGNAL_PROTOCOL = 'OWNER_SIGNAL_V1';
export const REMOTE_MARKER_CHECK_MS = 60_000;
const revisionOf = (value) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)
  ? BigInt(value) : null;

export function validOwnerMarker(marker, ownerId) {
  return marker?.protocol === OWNER_SIGNAL_PROTOCOL && marker.ownerId === ownerId
    && revisionOf(marker.revision) !== null;
}

// Advisory wake-ups only. No Product payload, persistence or merge occurs here.
export function createRemoteSync({ getContext, getMarker, openChannel, requestSync,
  timers = globalThis, debounceMs = 325, checkMs = REMOTE_MARKER_CHECK_MS, markerTimeoutMs = 5000,
  acquireLeadership = (_key, start) => { start(); return () => {}; } }) {
  let binding = null, generation = 0, closeChannel, releaseLeader, poll, wakeTimer;
  let seen = -1n, target = -1n, checking = null, requested = -1n;
  let leader = false;
  let coveredFullRevision = -1n;
  let abortCheck;
  let probeTimer;
  const watermarks = new Map();
  const stats = { signals: 0, duplicates: 0, wakes: 0, markerChecks: 0 };
  const current = (epoch) => binding && epoch === generation;
  function newer(revision, epoch, signal = false) {
    if (!current(epoch)) return;
    const next = revisionOf(revision);
    if (next === null) return;
    if (next <= seen || next <= target) { if (signal) stats.duplicates++; return; }
    target = next;
    timers.clearTimeout(wakeTimer);
    wakeTimer = timers.setTimeout(() => {
      wakeTimer = null;
      if (!current(epoch) || !leader || target <= seen || target <= requested
          || target <= coveredFullRevision) return;
      requested = target; stats.wakes++; requestSync();
    }, debounceMs);
  }
  async function check() {
    if (!binding) return null;
    if (checking) return checking;
    const epoch = generation, owner = binding.ownerId;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    abortCheck = cancel;
    let deadline;
    const task = Promise.race([(async () => {
      try {
        stats.markerChecks++;
        const marker = await getMarker({ signal: controller.signal });
        if (controller.signal.aborted || !current(epoch) || !validOwnerMarker(marker, owner)) return null;
        newer(marker.revision, epoch);
        return { epoch, revision: marker.revision };
      } catch { return null; } // Recovery retries; advisory failure never bypasses Sync guards.
    })(), new Promise((resolve) => {
      controller.signal.addEventListener('abort', () => resolve(null), { once: true });
      deadline = timers.setTimeout(cancel, markerTimeoutMs);
    })]);
    checking = task;
    try { return await task; } finally {
      timers.clearTimeout(deadline);
      if (abortCheck === cancel) abortCheck = null;
      if (checking === task) checking = null;
    }
  }
  function stop() {
    generation++; binding = null;
    abortCheck?.(); abortCheck = null;
    leader = false;
    closeChannel?.(); releaseLeader?.(); closeChannel = releaseLeader = null;
    timers.clearInterval(poll); timers.clearTimeout(wakeTimer);
    timers.clearTimeout(probeTimer); probeTimer = null;
    poll = wakeTimer = null; seen = target = requested = -1n; checking = null;
    coveredFullRevision = -1n;
  }
  async function refresh(retryProbe = false) {
    const context = getContext();
    if (!context?.ownerId || !context.workspace || !context.ready || !context.proven
        || !context.online || !context.visible || !context.token) { stop(); return; }
    const key = `${context.ownerId}:${context.workspace}:${context.token}`;
    if (binding?.key === key && !retryProbe) return;
    stop(); binding = { ...context, key };
    binding.watermarkKey = `${context.ownerId}:${context.workspace}`;
    seen = watermarks.get(binding.watermarkKey) ?? -1n;
    target = requested = seen;
    const epoch = generation;
    // A strict capability handshake prevents sockets against an unmigrated backend.
    const initial = await check();
    if (!current(epoch)) return;
    if (!initial) {
      // Transient capability failures must not permanently disable recovery.
      // Unsupported/foreign responses still cannot open a private socket.
      probeTimer = timers.setTimeout(() => { void refresh(true); }, checkMs);
      return;
    }
    releaseLeader = acquireLeadership(context.workspace, () => {
      if (!current(epoch)) return;
      leader = true;
      const pending = target; target = seen;
      newer(String(pending), epoch);
      closeChannel = openChannel({ ownerId: context.ownerId, accessToken: context.token,
        onRevision: (revision) => { stats.signals++; newer(revision, epoch, true); },
        onSubscribed: () => { void check(); } });
      poll = timers.setInterval(() => { void check(); }, checkMs);
    });
  }
  return { refresh, stop, check, stats,
    diagnostics: () => ({ ...stats, pending: !!binding && leader && target > seen }),
    // Capture BEFORE pulling. A later marker cannot acknowledge an earlier pull.
    async beforeFullSync() {
      const capture = await check();
      if (capture && current(capture.epoch)) coveredFullRevision = BigInt(capture.revision);
      return capture;
    },
    afterFullSync(capture, success) {
      if (!capture || !current(capture.epoch)) return;
      coveredFullRevision = -1n;
      if (success) {
        seen = seen > BigInt(capture.revision) ? seen : BigInt(capture.revision);
        watermarks.set(binding.watermarkKey, seen);
      }
      else { requested = seen; return; } // Existing coordinator owns retry/backoff.
      if (target > seen) {
        const pending = target; target = seen;
        newer(String(pending), generation);
      }
    },
  };
}

// One foreground receiver per shared browser workspace. Locks are released on
// hidden/offline/logout. Separate devices have independent lock managers.
export function browserRemoteLeadership(workspace, start) {
  const locks = globalThis.navigator?.locks;
  if (!locks) return () => {}; // Fail closed on browsers without tab coordination.
  const controller = new AbortController();
  let release;
  void locks.request(`rakeezx-remote:${workspace}`, { signal: controller.signal }, async () => {
    if (controller.signal.aborted) return;
    start();
    await new Promise((resolve) => { release = resolve; });
  }).catch(() => {});
  return () => { controller.abort(); release?.(); };
}
