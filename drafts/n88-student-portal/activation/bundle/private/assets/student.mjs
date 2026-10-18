var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// src/lib/rakeez-datetime-values.js
var normalizeDateTimeDigits;
var init_rakeez_datetime_values = __esm({
  "src/lib/rakeez-datetime-values.js"() {
    normalizeDateTimeDigits = (value) => String(value ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "\u0669" ? 1632 : 1776)));
  }
});

// src/lib/student-portal-client.js
function createStudentPortalClient({ fetch: send, base = "/api/n88", authorize = () => null } = {}) {
  if (typeof send !== "function" || !/^\/api\/n88(?:\/s\/[A-Za-z0-9_-]{43})?$/.test(base)) throw Error("Scoped same-origin transport required");
  async function call(path, body) {
    const authorization = await authorize(!!body);
    const response = await send(base + path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { ...body ? { "Content-Type": "application/json", "X-N88-CSRF": "1" } : {}, ...authorization ? { Authorization: "Bearer " + authorization } : {} },
      ...body ? { body: JSON.stringify(body) } : {}
    });
    if (!response.ok) throw Error("unavailable");
    const data = await response.json();
    if (path === "/teacher/publish" && data?.updated !== true || path === "/teacher/revoke" && data?.revoked !== true || path === "/claim" && data?.claimed !== true || path === "/logout" && data?.loggedOut !== true) throw Error("unavailable");
    return data;
  }
  return Object.freeze({
    claim: (code) => call("/claim", { code: typeof code === "string" ? normalizeDateTimeDigits(code) : code }),
    read: () => call("/read"),
    logout: () => call("/logout", {}),
    students: () => call("/teacher/students"),
    issue: (member) => call("/teacher/issue", { enrollmentId: member.enrollmentId, revision: member.revision }),
    revoke: (member) => call("/teacher/revoke", { enrollmentId: member.enrollmentId, revision: member.revision }),
    publish: (member, update) => call("/teacher/publish", { ...update, enrollmentId: member.enrollmentId, revision: member.revision })
  });
}
function clearEntryUrl(location, history) {
  if (location.hash || location.search) history.replaceState(null, "", location.pathname);
}
var init_student_portal_client = __esm({
  "src/lib/student-portal-client.js"() {
    init_rakeez_datetime_values();
  }
});

// src/views/student-portal.js
function mountStudentPortal(root, { client, location = window.location, history = window.history } = {}) {
  let disposed = false, generation = 0, busy = false;
  clearEntryUrl(location, history);
  root.classList.add("n88-portal");
  root.dir = "rtl";
  function paint(content) {
    if (disposed) return;
    root.innerHTML = `<header><span class="n88-brand">\u0631\u064E\u0643\u064A\u0632 \u0627\u0644\u0645\u0639\u0644\u0645</span><span>\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</span></header><main>${content}</main>`;
    root.querySelector("h1")?.focus();
  }
  function entry(error = false, message = "") {
    paint(`<section class="n88-panel"><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u062A\u064A \u0645\u0639 \u0645\u0639\u0644\u0645\u064A</h1><p>\u0627\u062D\u0641\u0638 \u0631\u0627\u0628\u0637\u0643 \u0627\u0644\u062E\u0627\u0635 \u0644\u0644\u0639\u0648\u062F\u0629 \u0648\u0644\u0627 \u062A\u0634\u0627\u0631\u0643\u0647\u060C \u0648\u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0627\u0644\u0634\u062E\u0635\u064A \u0627\u0644\u0645\u0643\u0648\u0651\u0646 \u0645\u0646 4 \u0623\u0631\u0642\u0627\u0645\u060C \u0623\u0648\u0644\u0647\u0627 \u0645\u0646 1 \u0625\u0644\u0649 9. \u064A\u0628\u0642\u0649 \u0627\u0644\u0631\u0627\u0628\u0637 \u0648\u0627\u0644\u0631\u0645\u0632 \u0635\u0627\u0644\u062D\u064A\u0646 \u0639\u0646\u062F \u0627\u0646\u062A\u0642\u0627\u0644\u0643 \u0644\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u062A\u0627\u0644\u064A \u0645\u0627 \u062F\u0645\u062A \u0645\u0633\u062C\u0651\u0644\u064B\u0627 \u0644\u062F\u0649 \u0627\u0644\u0645\u0639\u0644\u0645 \u0646\u0641\u0633\u0647\u060C \u062D\u062A\u0649 \u064A\u063A\u064A\u0651\u0631\u0647\u0645\u0627 \u0627\u0644\u0645\u0639\u0644\u0645 \u0623\u0648 \u064A\u0644\u063A\u064A \u0627\u0644\u0648\u0635\u0648\u0644.</p><form data-claim><label for="n88-secret">\u0631\u0645\u0632\u064A \u0627\u0644\u0634\u062E\u0635\u064A</label><input id="n88-secret" name="code" type="password" inputmode="numeric" pattern="[1-9][0-9]{3}" minlength="4" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="n88-error"><p id="n88-error" role="status">${error ? "\u062A\u0639\u0630\u0651\u0631 \u0641\u062A\u062D \u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0648\u0627\u0644\u0631\u0645\u0632 \u0623\u0648 \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627 \u0645\u0639 \u0645\u0639\u0644\u0645\u0643." : escape(message)}</p><button type="submit">\u0641\u062A\u062D \u0645\u0633\u0627\u062D\u062A\u064A</button></form></section>`);
  }
  function show(data) {
    const next = data.tasks.find((t) => t.status !== "done");
    const task = (t) => `<article class="n88-task"><h3>${escape(t.title)}</h3><p>${escape(t.instruction)}</p><p><span>${status[t.status] || status.todo}</span> \xB7 ${t.deadline ? `\u0627\u0644\u0645\u0648\u0639\u062F: <time dir="ltr">${escape(t.deadline)}</time>` : "\u062F\u0648\u0646 \u0645\u0648\u0639\u062F \u0645\u062D\u062F\u062F"}</p></article>`;
    paint(`<h1 tabindex="-1">\u0645\u0627 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646\u064A\u061F</h1><div class="n88-columns"><section class="n88-panel"><h2>\u062E\u0637\u0648\u062A\u064A \u0627\u0644\u062A\u0627\u0644\u064A\u0629</h2>${next ? task(next) : "<p>\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0647\u0627\u0645 \u0645\u0639\u0644\u0651\u0642\u0629 \u0645\u0646\u0634\u0648\u0631\u0629 \u0627\u0644\u0622\u0646.</p>"}<h2>\u0623\u0646\u0634\u0637\u062A\u064A \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629</h2><div data-tasks>${data.tasks.length ? data.tasks.map(task).join("") : "<p>\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0646\u0634\u0637\u0629 \u0645\u0646\u0634\u0648\u0631\u0629 \u0627\u0644\u0622\u0646.</p>"}</div></section><aside class="n88-panel"><h2>\u062A\u0642\u062F\u0651\u0645\u064A</h2><p>${data.progress.completed} \u0645\u0646 ${data.progress.total} \u0623\u0646\u0634\u0637\u0629 \u0645\u0643\u062A\u0645\u0644\u0629</p><progress aria-label="\u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629" value="${data.progress.completed}" max="${Math.max(1, data.progress.total)}"></progress><button type="button" data-refresh>\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629</button><button type="button" data-logout>\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629</button><p role="status">\u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637</p></aside></div>`);
  }
  async function run(action, initial = false) {
    if (busy || disposed) return;
    busy = true;
    const checkpoint = ++generation;
    paint('<h1 tabindex="-1">\u062C\u0627\u0631\u064D \u0641\u062A\u062D \u0627\u0644\u0645\u0633\u0627\u062D\u0629\u2026</h1>');
    try {
      const data = await action();
      if (!disposed && checkpoint === generation) {
        if (data === null) entry(false, "\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 \u0631\u0645\u0632\u0643 \u0646\u0641\u0633\u0647 \u0644\u0644\u0639\u0648\u062F\u0629.");
        else show(data);
      }
    } catch {
      if (!disposed && checkpoint === generation) entry(!initial);
    } finally {
      if (checkpoint === generation) busy = false;
    }
  }
  const onSubmit = (e) => {
    if (!e.target.matches("[data-claim]")) return;
    e.preventDefault();
    let value = normalizeDateTimeDigits(root.querySelector("input").value);
    root.querySelector("input").value = "";
    void run(async () => {
      const pending = client.claim(value);
      value = "";
      await pending;
      return client.read();
    });
  };
  const onClick = (e) => {
    if (e.target.closest("[data-refresh]")) void run(() => client.read());
    if (e.target.closest("[data-logout]")) void run(async () => {
      await client.logout();
      return null;
    });
  };
  const onInput = (e) => {
    if (e.target.matches("[data-claim] input")) e.target.value = normalizeDateTimeDigits(e.target.value);
  };
  const clear = () => {
    generation++;
    busy = false;
    entry();
  };
  const onHashChange = () => {
    clearEntryUrl(location, history);
    clear();
  };
  const onPageShow = (e) => {
    if (e.persisted) void run(() => client.read());
  };
  const onVisible = () => {
    if (root.ownerDocument.visibilityState === "visible") void run(() => client.read());
  };
  root.addEventListener("submit", onSubmit);
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.ownerDocument.defaultView.addEventListener("pagehide", clear);
  root.ownerDocument.defaultView.addEventListener("hashchange", onHashChange);
  root.ownerDocument.defaultView.addEventListener("pageshow", onPageShow);
  root.ownerDocument.addEventListener("visibilitychange", onVisible);
  const ready2 = run(() => client.read(), true);
  return { ready: ready2, clear, dispose() {
    disposed = true;
    generation++;
    root.replaceChildren();
    root.removeEventListener("submit", onSubmit);
    root.removeEventListener("click", onClick);
    root.removeEventListener("input", onInput);
    root.ownerDocument.defaultView.removeEventListener("pagehide", clear);
    root.ownerDocument.defaultView.removeEventListener("hashchange", onHashChange);
    root.ownerDocument.defaultView.removeEventListener("pageshow", onPageShow);
    root.ownerDocument.removeEventListener("visibilitychange", onVisible);
  } };
}
var escape, status;
var init_student_portal = __esm({
  "src/views/student-portal.js"() {
    init_student_portal_client();
    init_rakeez_datetime_values();
    escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    status = { done: "\u0645\u0643\u062A\u0645\u0644", working: "\u0642\u064A\u062F \u0627\u0644\u0639\u0645\u0644", todo: "\u0644\u0645 \u064A\u0628\u062F\u0623" };
  }
});

// src/views/student-portal-teacher.js
var init_student_portal_teacher = __esm({
  "src/views/student-portal-teacher.js"() {
  }
});

// src/lib/db.js
var DB_NAME;
var init_db = __esm({
  "src/lib/db.js"() {
    DB_NAME = "rakeezx";
  }
});

// src/lib/workspaces.js
var LEGACY_WORKSPACE_DB_NAME;
var init_workspaces = __esm({
  "src/lib/workspaces.js"() {
    init_db();
    LEGACY_WORKSPACE_DB_NAME = DB_NAME;
  }
});

// src/lib/offline-lease.js
function leaseThresholds() {
  return import.meta.env?.MODE === "n49-test" && globalThis.location?.hostname === "127.0.0.1" ? { reminder: 12e4, limited: 3e5 } : production;
}
function workspaceLeaseBinding(workspace) {
  if (workspace?.type !== "account" || workspace.ownershipState !== "claimed" || !workspace.authUserId || !workspace.id || !workspace.databaseName || !workspace.leaseGeneration) return null;
  return JSON.stringify([workspace.authUserId, workspace.id, workspace.databaseName, workspace.leaseGeneration]);
}
function checksum(value) {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
function createOfflineLease({
  storage = globalThis.localStorage,
  now = () => Date.now(),
  monotonic = () => performance.now(),
  thresholds = production
} = {}) {
  let workspace = null, binding = null, identity = null, epoch = 0;
  let anchor = null, invalid = null, renewing = null;
  let invalidReason = null;
  const observerId = globalThis.crypto.randomUUID();
  const key = () => LEASE_STORAGE_PREFIX + workspace.id;
  function setContext(nextWorkspace, ownerId) {
    const nextBinding = workspaceLeaseBinding(nextWorkspace);
    if (nextBinding !== binding || ownerId !== identity || nextWorkspace !== workspace) {
      epoch++;
      anchor = null;
      invalid = null;
      invalidReason = null;
    }
    workspace = nextWorkspace;
    binding = nextBinding;
    identity = ownerId;
  }
  function observe() {
    if (workspace?.type !== "account") return { state: "NOT_APPLICABLE", editable: workspace?.type === "demo" || workspace?.type === "legacy" };
    if (!binding || identity !== workspace.authUserId) return limited("owner-workspace-mismatch");
    try {
      const raw = storage.getItem(key());
      if (!raw) return limited("receipt-missing");
      const { checksum: recorded, ...receipt } = JSON.parse(raw);
      if (receipt.version !== 1 || recorded !== checksum(receipt) || receipt.binding !== binding || typeof receipt.renewalId !== "string" || !receipt.renewalId || ![receipt.verifiedAt, receipt.highWater].every((time) => Number.isFinite(time) && time > 0) || receipt.highWater < receipt.verifiedAt || typeof receipt.invalid !== "boolean") return limited("receipt-invalid");
      const wall = now(), mono = monotonic();
      if (!Number.isFinite(wall) || !Number.isFinite(mono)) return limited("clock-invalid");
      const clockPrefix = key() + ":clock:" + receipt.renewalId + ":";
      let highWater = receipt.highWater, witnessedInvalid = receipt.invalid;
      let witnessedReason = null;
      for (let index = 0; index < storage.length; index++) {
        const clockKey2 = storage.key(index);
        if (!clockKey2?.startsWith(clockPrefix)) continue;
        const { checksum: witnessChecksum, ...witness } = JSON.parse(storage.getItem(clockKey2));
        if (witnessChecksum !== checksum(witness) || witness.binding !== binding || witness.renewalId !== receipt.renewalId || !Number.isFinite(witness.highWater) || witness.highWater < receipt.verifiedAt || typeof witness.invalid !== "boolean") return limited("clock-evidence-invalid");
        highWater = Math.max(highWater, witness.highWater);
        witnessedInvalid ||= witness.invalid;
        if (witness.invalid) witnessedReason ||= witness.reason || "lease-evidence-invalid";
      }
      if (!anchor || anchor.renewalId !== receipt.renewalId) {
        anchor = { renewalId: receipt.renewalId, highWater, mono };
        invalid = null;
        invalidReason = null;
      }
      const effective = Math.max(wall, highWater, anchor.highWater + Math.max(0, mono - anchor.mono));
      const rollback = wall + ROLLBACK_TOLERANCE < highWater || wall + ROLLBACK_TOLERANCE < effective;
      invalid ||= witnessedInvalid || rollback;
      if (invalid) invalidReason ||= witnessedReason || (rollback ? "clock-rollback" : "lease-evidence-invalid");
      const next = { binding, renewalId: receipt.renewalId, highWater: effective, invalid: Boolean(invalid), reason: invalidReason };
      const clockKey = clockPrefix + observerId;
      storage.setItem(clockKey, seal(next));
      if (storage.getItem(clockKey) !== seal(next) || storage.getItem(key()) !== raw) return limited("receipt-storage-unavailable");
      if (invalid) return limited(invalidReason);
      const age = effective - receipt.verifiedAt;
      return {
        state: age >= thresholds.limited ? "LIMITED" : age > thresholds.reminder ? "REMINDER" : "NORMAL",
        editable: age < thresholds.limited,
        reason: age >= thresholds.limited ? "expired" : null,
        age
      };
    } catch {
      return limited("receipt-storage-invalid");
    }
  }
  function assertWritable() {
    if (!observe().editable) throw leaseWriteError();
  }
  function invalidate(reason = "lease-evidence-invalid") {
    observe();
    invalid = true;
    invalidReason = reason;
    return observe();
  }
  async function renew(verify, { isCurrent = () => true, timeoutMs = 15e3 } = {}) {
    if (renewing) return renewing;
    const expected = binding, owner = identity, contextEpoch = epoch;
    if (!expected || owner !== workspace?.authUserId) throw leaseWriteError();
    const current = () => epoch === contextEpoch && binding === expected && identity === owner && isCurrent();
    renewing = (async () => {
      let timer;
      try {
        const verified = await Promise.race([verify(owner), new Promise((_, reject) => {
          timer = setTimeout(() => reject(Object.assign(new Error("Account verification timed out"), { code: "LEASE_VERIFY_TIMEOUT" })), timeoutMs);
        })]);
        if (!current() || verified?.id !== owner || verified?.source !== "supabase-auth-user" || !Number.isFinite(verified.verifiedAt) || verified.verifiedAt <= 0 || Math.abs(now() - verified.verifiedAt) > ROLLBACK_TOLERANCE) throw leaseWriteError();
        const body = {
          version: 1,
          binding: expected,
          renewalId: globalThis.crypto.randomUUID(),
          verifiedAt: verified.verifiedAt,
          highWater: verified.verifiedAt,
          invalid: false
        };
        storage.setItem(key(), seal(body));
        if (!current() || storage.getItem(key()) !== seal(body)) throw leaseWriteError();
        const clockPrefix = key() + ":clock:";
        for (let index = storage.length - 1; index >= 0; index--) {
          const clockKey = storage.key(index);
          if (clockKey?.startsWith(clockPrefix) && !clockKey.startsWith(clockPrefix + body.renewalId + ":")) storage.removeItem(clockKey);
        }
        anchor = null;
        invalid = null;
        invalidReason = null;
        const result = observe();
        if (!result.editable) throw leaseWriteError();
        return result;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => {
      renewing = null;
    });
    return renewing;
  }
  return Object.freeze({ setContext, observe, assertWritable, renew, invalidate });
}
var LEASE_STORAGE_PREFIX, OFFLINE_LEASE_LIMITED, DAY, ROLLBACK_TOLERANCE, production, seal, limited, leaseWriteError, runtime, runtimeOfflineLease;
var init_offline_lease = __esm({
  "src/lib/offline-lease.js"() {
    LEASE_STORAGE_PREFIX = "rakeezx-offline-lease-v1:";
    OFFLINE_LEASE_LIMITED = "OFFLINE_LEASE_LIMITED";
    DAY = 864e5;
    ROLLBACK_TOLERANCE = 12e4;
    production = Object.freeze({ reminder: 7 * DAY, limited: 14 * DAY });
    seal = (body) => JSON.stringify({ ...body, checksum: checksum(body) });
    limited = (reason) => ({ state: "LIMITED", editable: false, reason, age: null });
    leaseWriteError = () => Object.assign(new Error(
      "\u064A\u0644\u0632\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u062A\u0639\u062F\u064A\u0644. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0639\u0631\u0636 \u0648\u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u0648\u062A\u0646\u0632\u064A\u0644 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629."
    ), { code: OFFLINE_LEASE_LIMITED });
    runtimeOfflineLease = () => runtime ??= createOfflineLease({ thresholds: leaseThresholds() });
  }
});

// src/lib/sync-ownership.js
function normalizedOwnerId(value) {
  const ownerId = String(value ?? "").trim().toLowerCase();
  return AUTH_USER_ID_PATTERN.test(ownerId) ? ownerId : null;
}
function normalizeWorkspace(workspace) {
  if (workspace?.type === "account" && workspace?.ownershipState === "claimed" && workspace?.syncEligible === true) {
    const workspaceOwnerId = normalizedOwnerId(workspace.authUserId);
    if (workspaceOwnerId) {
      return Object.freeze({ ...workspace, authUserId: workspaceOwnerId, workspaceOwnerId });
    }
    return Object.freeze({ type: "unresolved", ownershipState: "unresolved", reason: "workspace-owner-missing" });
  }
  if (workspace?.type === "legacy" && workspace?.ownershipState === "unclaimed" && workspace?.databaseName === LEGACY_WORKSPACE_DB_NAME && workspace?.authUserId == null) {
    return LEGACY_UNCLAIMED_SYNC_WORKSPACE;
  }
  if (workspace?.type === "demo" && workspace?.ownershipState === "demo" && workspace?.syncEligible === false) {
    return Object.freeze({ ...workspace, authUserId: null, workspaceOwnerId: null });
  }
  return Object.freeze({
    type: "unresolved",
    ownershipState: "unresolved",
    reason: workspace?.reason || "workspace-unresolved"
  });
}
function blocked(reason, workspace, extra = {}) {
  return Object.freeze({
    allowed: false,
    code: SYNC_OWNERSHIP_BLOCKED,
    reason,
    retryable: false,
    workspaceType: workspace.type,
    workspaceOwnerId: workspace.workspaceOwnerId ?? null,
    ...extra
  });
}
function allowed(mode, workspace) {
  return Object.freeze({
    allowed: true,
    mode,
    workspaceType: workspace.type,
    workspaceOwnerId: workspace.workspaceOwnerId ?? null
  });
}
function createSyncOwnershipGuard({ workspace = LEGACY_UNCLAIMED_SYNC_WORKSPACE } = {}) {
  let activeWorkspace = normalizeWorkspace(workspace);
  function setWorkspace(nextWorkspace) {
    activeWorkspace = normalizeWorkspace(nextWorkspace);
    return activeWorkspace;
  }
  function getWorkspace() {
    return activeWorkspace;
  }
  function enqueueAccess() {
    if (activeWorkspace.type === "account" && activeWorkspace.ownershipState === "claimed") {
      return allowed("claimed-account", activeWorkspace);
    }
    if (activeWorkspace === LEGACY_UNCLAIMED_SYNC_WORKSPACE) {
      return allowed("legacy-unclaimed", activeWorkspace);
    }
    if (activeWorkspace.type === "demo") return blocked("demo-sync-disabled", activeWorkspace);
    return blocked(activeWorkspace.reason || "workspace-unresolved", activeWorkspace);
  }
  function bindNewCommand(command) {
    const access = enqueueAccess();
    if (!access.allowed) throw ownershipBlockedError(access);
    if (access.mode === "legacy-unclaimed") {
      if (command?.ownerId != null) {
        throw ownershipBlockedError(blocked("owned-command-in-legacy-workspace", activeWorkspace));
      }
      return command;
    }
    const ownerWasSupplied = command?.ownerId != null;
    const suppliedOwnerId = ownerWasSupplied ? normalizedOwnerId(command.ownerId) : null;
    if (ownerWasSupplied && suppliedOwnerId !== access.workspaceOwnerId) {
      throw ownershipBlockedError(blocked("command-owner-mismatch", activeWorkspace, {
        commandOwnerId: suppliedOwnerId
      }));
    }
    return { ...command, ownerId: access.workspaceOwnerId };
  }
  function cloudAccess({ operation, authenticatedUserId, command = null } = {}) {
    const cloudUserId = normalizedOwnerId(authenticatedUserId);
    if (activeWorkspace === LEGACY_UNCLAIMED_SYNC_WORKSPACE) {
      if (operation === "dispatch" && command?.ownerId != null) {
        return blocked("owned-command-in-legacy-workspace", activeWorkspace, {
          commandOwnerId: normalizedOwnerId(command.ownerId),
          cloudUserId
        });
      }
      return allowed("legacy-unclaimed", activeWorkspace);
    }
    if (activeWorkspace.type === "demo") return blocked("demo-sync-disabled", activeWorkspace, { cloudUserId });
    if (activeWorkspace.type !== "account" || activeWorkspace.ownershipState !== "claimed") {
      return blocked(activeWorkspace.reason || "workspace-unresolved", activeWorkspace, { cloudUserId });
    }
    if (!cloudUserId) return blocked("authenticated-user-missing", activeWorkspace, { cloudUserId: null });
    if (cloudUserId !== activeWorkspace.workspaceOwnerId) {
      return blocked("authenticated-user-owner-mismatch", activeWorkspace, { cloudUserId });
    }
    if (operation === "dispatch") {
      const commandOwnerId = normalizedOwnerId(command?.ownerId);
      if (!commandOwnerId) {
        return blocked("command-owner-missing", activeWorkspace, { cloudUserId, commandOwnerId: null });
      }
      if (commandOwnerId !== activeWorkspace.workspaceOwnerId) {
        return blocked("command-owner-mismatch", activeWorkspace, { cloudUserId, commandOwnerId });
      }
    }
    return allowed("claimed-account", activeWorkspace);
  }
  return Object.freeze({ setWorkspace, getWorkspace, enqueueAccess, bindNewCommand, cloudAccess });
}
function ownershipBlockedError(access) {
  return Object.assign(new Error(`Sync ownership blocked: ${access?.reason ?? "workspace-unresolved"}`), {
    code: SYNC_OWNERSHIP_BLOCKED,
    reason: access?.reason ?? "workspace-unresolved",
    retryable: false,
    ownershipAccess: access ?? null
  });
}
function assertNewProductWrite() {
  if (runtimeOwnerGuard.getWorkspace().type === "account") {
    leaseWriteGuard?.();
    runtimeOfflineLease().assertWritable();
  }
}
var SYNC_OWNERSHIP_BLOCKED, AUTH_USER_ID_PATTERN, LEGACY_UNCLAIMED_SYNC_WORKSPACE, runtimeOwnerGuard, leaseWriteGuard, runtimeSyncOwnershipGuard;
var init_sync_ownership = __esm({
  "src/lib/sync-ownership.js"() {
    init_workspaces();
    init_offline_lease();
    SYNC_OWNERSHIP_BLOCKED = "SYNC_OWNERSHIP_BLOCKED";
    AUTH_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    LEGACY_UNCLAIMED_SYNC_WORKSPACE = Object.freeze({
      id: "legacy",
      type: "legacy",
      authUserId: null,
      databaseName: LEGACY_WORKSPACE_DB_NAME,
      ownershipState: "unclaimed",
      syncEligible: false
    });
    runtimeOwnerGuard = createSyncOwnershipGuard();
    leaseWriteGuard = null;
    runtimeSyncOwnershipGuard = Object.freeze({
      ...runtimeOwnerGuard,
      bindNewCommand(command) {
        assertNewProductWrite();
        return runtimeOwnerGuard.bindNewCommand(command);
      }
    });
  }
});

// src/lib/student-portal-runtime.js
function unavailable(root) {
  root.replaceChildren();
  const message = root.ownerDocument.createElement("p");
  message.setAttribute("role", "status");
  message.textContent = "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0644\u0645 \u062A\u064F\u0641\u0639\u0651\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0639\u062F.";
  root.append(message);
}
function style(root) {
  const doc = root.ownerDocument;
  if (doc.querySelector("[data-n88-style]")) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.dataset.n88Style = "";
  link.href = new URL("../styles/student-portal.css", import.meta.url).href;
  doc.head.append(link);
}
function mountStudentService(root, { readiness = PORTAL_READINESS, fetch: send = globalThis.fetch, location = window.location, history = window.history } = {}) {
  style(root);
  const match = /^\/s\/([A-Za-z0-9_-]{43})$/.exec(location.pathname);
  if (!ready(readiness) || !match || location.search || location.hash) {
    unavailable(root);
    return { dispose() {
      root.replaceChildren();
    } };
  }
  const client = createStudentPortalClient({ fetch: send, base: "/api/n88/s/" + match[1] });
  return mountStudentPortal(root, { client, location, history });
}
var PORTAL_READINESS, ready;
var init_student_portal_runtime = __esm({
  "src/lib/student-portal-runtime.js"() {
    init_student_portal_client();
    init_student_portal();
    init_student_portal_teacher();
    init_sync_ownership();
    PORTAL_READINESS = Object.freeze({ enabled: false, serviceRevision: null });
    ready = (r) => r?.enabled === true && r.serviceRevision === "n88-existing-host-v1";
  }
});

// drafts/n88-student-portal/client/student-entry.js
init_student_portal_runtime();
mountStudentService(document.getElementById("student-portal"));
