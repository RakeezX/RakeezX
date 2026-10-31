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
function validDateTimeValue(value, kind, min = "", max = "") {
  if (!value) return true;
  if (kind === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && (!min || value >= min) && (!max || value <= max);
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date2 = new Date(Date.UTC(year, month - 1, day));
  return date2.getUTCFullYear() === year && date2.getUTCMonth() === month - 1 && date2.getUTCDate() === day && (!min || value >= min) && (!max || value <= max);
}
var normalizeDateTimeDigits;
var init_rakeez_datetime_values = __esm({
  "src/lib/rakeez-datetime-values.js"() {
    normalizeDateTimeDigits = (value) => String(value ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "\u0669" ? 1632 : 1776)));
  }
});

// src/lib/student-portal-unified-client.js
init_rakeez_datetime_values();

// src/lib/n88-manual-task-link-safety.js
init_rakeez_datetime_values();
function safeTeacherLink(value) {
  if (value === "" || value == null) return null;
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(value)) throw Error("\u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u061B \u0627\u0633\u062A\u062E\u062F\u0645 \u0631\u0627\u0628\u0637 HTTPS \u062F\u0648\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u062F\u062E\u0648\u0644.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("\u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637 HTTPS \u0643\u0627\u0645\u0644\u064B\u0627.");
  }
  if (!/^https:\/\//i.test(value) || url.protocol !== "https:" || !url.hostname || url.username || url.password || value.slice(8).split(/[/?#]/, 1)[0].includes("@")) throw Error("\u064A\u0633\u0645\u062D \u0628\u0631\u0648\u0627\u0628\u0637 HTTPS \u062F\u0648\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u062F\u062E\u0648\u0644 \u0641\u0642\u0637.");
  if (url.href.length > 2048) throw Error("\u0627\u0644\u0631\u0627\u0628\u0637 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627.");
  return url.href;
}

// src/lib/student-portal-publication-client.js
init_rakeez_datetime_values();

// src/lib/n88-item-publication-proposal.js
init_rakeez_datetime_values();

// src/lib/student-portal-publication-client.js
var PUBLICATION_V2_READINESS = Object.freeze({ enabled: false, serviceRevision: "n88-item-publication-v2" });
var publicationV2Ready = (value) => value?.enabled === true && value.serviceRevision === PUBLICATION_V2_READINESS.serviceRevision;
var PUBLICATION_FLAGS = Object.freeze(["required", "scheduled", "completed", "grade"]);
var exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));
var text = (v, max = 2e3) => typeof v === "string" && v.length <= max && !v.includes("\0");
var date = (v) => v === null || typeof v === "string" && !!v && validDateTimeValue(v, "date");
var failures = /* @__PURE__ */ new WeakMap();
var failure = (kind) => {
  const error = new Error("publication_unavailable");
  failures.set(error, kind);
  return error;
};
var deny = () => {
  throw failure("validation");
};
var safeLink = (v) => {
  try {
    return (v === null || typeof v === "string") && safeTeacherLink(v) === v;
  } catch {
    return false;
  }
};
function parsePublicationStudentData(value) {
  if (!exact(value, ["work", "grades"]) || !Array.isArray(value.work) || !Array.isArray(value.grades) || value.work.length > 2e3 || value.grades.length > 2e3) deny();
  const work = value.work.map((r) => {
    if (!exact(r, ["id", "title", "startDate", "dueDate", "categories", "description", "link"]) || !text(r.id, 1e3) || !text(r.title) || !date(r.startDate) || !date(r.dueDate) || r.startDate && r.dueDate && r.startDate > r.dueDate || !text(r.description) || !safeLink(r.link) || !Array.isArray(r.categories) || r.categories.length !== 1 || !["required", "scheduled", "completed"].includes(r.categories[0])) deny();
    return { ...r, categories: [...r.categories] };
  });
  const grades = value.grades.map((r) => {
    if (!exact(r, ["id", "title", "value"]) || !text(r.id, 1e3) || !text(r.title) || r.value !== null && (typeof r.value !== "number" || !Number.isFinite(r.value))) deny();
    return { ...r };
  });
  if (new Set(work.map((r) => r.id)).size !== work.length || new Set(grades.map((r) => r.id)).size !== grades.length) deny();
  return { version: "n88-publication-v2", work, grades };
}
function projectPublicationStudentData(data) {
  if (!exact(data, ["version", "work", "grades"]) || data.version !== "n88-publication-v2") deny();
  return parsePublicationStudentData({ work: data.work, grades: data.grades });
}

// src/lib/student-portal-unified-client.js
function parseStudentFailure(value) {
  try {
    if (typeof value !== "string" || value.length > 768) return null;
    const d = JSON.parse(value), keys = ["phase", "category", "sqlstate", "connection", "cancelled", "deadline", "rollback", "commit"];
    if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).filter((k) => !["site", "requirement", "exception"].includes(k)).sort().join(",") !== keys.sort().join(",")) return null;
    if (!["acquire", "guard", "begin", "snapshot", "operation", "synchronize-lock", "synchronize-memberships", "synchronize-sessions", "synchronize-sources", "synchronize-publications", "synchronize-validate", "projection-finalize", "projection-membership-flush", "projection-commitguards", "projection-commit", "unknown"].includes(d.phase) || !["acquire", "guard", "transaction", "projection", "commit", "unknown", "admission_denied", "session_required", "denied"].includes(d.category) || !["none", "55P03", "57014", "42501", "23503", "23505", "40001", "40P01", "08000", "08001", "08003", "08004", "08006", "08007", "08P01", "28P01", "28000", "53300", "53400", "57P01", "57P02", "57P03", "25P02", "22001", "22P02", "42703", "42883", "42P01"].includes(d.sqlstate) || !["none", "reset", "timeout", "refused", "dns"].includes(d.connection) || typeof d.cancelled !== "boolean" || typeof d.deadline !== "boolean" || !["not_needed", "acknowledged", "unknown"].includes(d.rollback) || !["not_started", "unknown", "acknowledged"].includes(d.commit)) return null;
    const tagged = ["site", "requirement", "exception"].some((k) => Object.hasOwn(d, k));
    if (tagged && (!["canonical-fetch", "canonical-decode", "term-selection", "visibility-fetch", "visibility-selection", "guidance-fetch", "guidance-decode", "student-scope", "visibility-validation", "visibility-scope", "grade-context", "grade-score", "work-projection", "guidance-projection"].includes(d.site) || !["unknown", "current-membership-and-policy", "canonical-revision", "canonical-row-identity", "unique-current-enrollment", "unique-student-item-score", "unique-student-subitem-completion", "canonical-atomic-subitem-score", "bounded-years", "bounded-terms", "bounded-sections", "bounded-students", "bounded-enrollments", "bounded-teachings", "bounded-items", "bounded-scores", "bounded-scoreSubitems", "bounded-scoreSubitemCompletions", "bounded-sessions", "bounded-attendance", "bounded-logs", "portable-grade-context", "unique-current-term", "canonical-source-bound", "canonical-read-mode", "guidance-contract", "visibility-policy", "score-decimals", "canonical-date", "subitem-date-order", "subitem-late-score", "subitem-count", "score-student-identity"].includes(d.requirement) || !["rejected", "type", "range", "syntax", "other"].includes(d.exception))) return null;
    return Object.freeze({ ...Object.fromEntries(["phase", "category", "sqlstate", "connection", "cancelled", "deadline", "rollback", "commit"].map((k) => [k, d[k]])), ...tagged ? { site: d.site, requirement: d.requirement, exception: d.exception } : {} });
  } catch {
    return null;
  }
}
var normalizeStudentCode = (value) => typeof value === "string" ? normalizeDateTimeDigits(value).replace(/ /g, "") : "";
var validStudentCode = (value) => typeof value === "string" && /^1[0-9]{5}$/.test(value);
var fail = (kind = "unavailable", retryAfter = 0) => Object.assign(new Error("Student access unavailable"), { kind, retryAfter });
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var text2 = (value) => typeof value === "string" && value.length <= 2e3;
var number = (value) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0;
function parseStudentReadPhases(value) {
  try {
    if (typeof value !== "string" || value.length > 512) return null;
    const p = JSON.parse(value), names = ["pool", "boundary", "snapshot", "sync", "canonical", "visibility", "guidance", "projection", "commit", "total"];
    if (!object(p) || Object.keys(p).length !== names.length || !names.every((k) => Object.hasOwn(p, k) && Number.isInteger(p[k]) && p[k] >= 0 && p[k] <= 2e4 && p[k] % 250 === 0)) return null;
    return Object.freeze(Object.fromEntries(names.map((k) => [k, p[k]])));
  } catch {
    return null;
  }
}
function fields(source, rules) {
  if (!object(source)) throw fail();
  const result = {};
  for (const [key, valid] of Object.entries(rules)) if (Object.hasOwn(source, key)) {
    if (!valid(source[key])) throw fail();
    result[key] = source[key];
  }
  return result;
}
function list(value, rules, required = []) {
  if (!Array.isArray(value) || value.length > 500) throw fail();
  return value.map((item) => {
    const result = fields(item, rules);
    if (required.some((key) => !Object.hasOwn(result, key))) throw fail();
    return result;
  });
}
function projectUnifiedStudentData(data) {
  if (data?.version === "n88-publication-v2") return projectPublicationStudentData(data);
  if (!object(data) || data.version !== "n88-student-v3") throw fail();
  const result = { version: data.version };
  if (Object.hasOwn(data, "profile")) result.profile = fields(data.profile, { name: text2, classLabel: text2 });
  if (Object.hasOwn(data, "grades")) {
    if (!object(data.grades)) throw fail();
    result.grades = { items: list(data.grades.items, { id: text2, label: text2, value: number, max: number, status: text2 }, ["id", "label", "value", "max"]) };
    if (Object.hasOwn(data.grades, "total")) {
      result.grades.total = fields(data.grades.total, { earned: number, possible: number });
      if (!Object.hasOwn(result.grades.total, "earned") || !Object.hasOwn(result.grades.total, "possible")) throw fail();
    }
  }
  if (Object.hasOwn(data, "work")) {
    if (!object(data.work)) throw fail();
    result.work = {};
    for (const section of ["required", "completed", "scheduled"]) if (Object.hasOwn(data.work, section)) {
      result.work[section] = list(data.work[section], { id: text2, title: text2, instruction: text2, executionInstructions: (v) => text2(v) && v.length <= 400, deliveryInstructions: (v) => text2(v) && v.length <= 400, deadline: text2, status: text2, startDate: (v) => v === null || text2(v), dueDate: (v) => v === null || text2(v), completionState: (v) => ["unrecorded", "regular", "late"].includes(v) }, ["id", "title"]);
    }
  }
  return result;
}
var isStudentPublicationReview = (data) => object(data) && Object.keys(data).sort().join(",") === "state,version" && data.version === "n88-student-domain-v1" && data.state === "publication-needs-review";
var RETIREMENT_KEY = "rakeez.n88.student-retirement.v1";
var validEpoch = (value) => typeof value === "string" && /^[psu]:[a-f0-9]{32}$/.test(value);
function createRetirementObserver(onPeerChange) {
  const win = globalThis.window;
  let storage, known = null, usable = false, closed = false, owned = null;
  const epoch = (phase) => phase + ":" + globalThis.crypto.randomUUID().replaceAll("-", "");
  try {
    if (win) {
      storage = win.localStorage;
      const initial = storage.getItem(RETIREMENT_KEY);
      if (initial === null) {
        known = epoch("s");
        storage.setItem(RETIREMENT_KEY, known);
      } else known = validEpoch(initial) ? initial : null;
      usable = validEpoch(known);
    }
  } catch {
  }
  const sync = () => {
    if (closed || !storage) return false;
    try {
      const raw2 = storage.getItem(RETIREMENT_KEY), current = validEpoch(raw2) ? raw2 : null, nextUsable = validEpoch(raw2);
      if (current === known && nextUsable === usable) return false;
      known = current;
      usable = nextUsable;
      onPeerChange();
      return true;
    } catch {
      const changed = usable;
      usable = false;
      if (changed) onPeerChange();
      return changed;
    }
  };
  const event = (e) => {
    if (e.key === RETIREMENT_KEY || e.key === null) {
      const changed = sync();
      if (!changed) onPeerChange();
    }
  };
  win?.addEventListener("storage", event);
  const publish = (phase) => {
    try {
      const next = epoch(phase);
      storage.setItem(RETIREMENT_KEY, next);
      known = next;
      usable = true;
      return next;
    } catch {
      usable = false;
      return null;
    }
  };
  return {
    sync,
    canRetain() {
      sync();
      return usable && known?.startsWith("s:");
    },
    begin() {
      sync();
      owned = storage ? publish("p") : null;
      return owned;
    },
    finish(token, acknowledged) {
      if (!storage || token !== owned) return;
      try {
        if (token && storage.getItem(RETIREMENT_KEY) === token) publish(acknowledged ? "s" : "u");
        else if (token) publish("u");
      } finally {
        owned = null;
      }
    },
    abandon() {
      if (owned) publish("u");
      owned = null;
    },
    dispose() {
      if (owned) publish("u");
      closed = true;
      win?.removeEventListener("storage", event);
      owned = null;
      storage = null;
      known = null;
      usable = false;
    }
  };
}
function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch, timeoutMs = 15e3, bindingProof: bindingProof2 = null, publicationReadiness = PUBLICATION_V2_READINESS } = {}) {
  if (typeof send !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15e3) throw fail();
  let generation = 0, retirement = 0, controller, disposed = false, lastDiagnostic = null, retireDiagnostic;
  const contextListeners = /* @__PURE__ */ new Set();
  const peer = createRetirementObserver(() => invalidate("context"));
  const reasons = ["visible", "hidden", "pagehide", "disposed", "context", "superseded", "deadline"];
  const visibility = () => globalThis.document?.visibilityState === "hidden" ? "hidden" : "visible";
  function cancelRequest(reason = "superseded") {
    retireDiagnostic?.(reason);
    retireDiagnostic = null;
    generation++;
    controller?.abort();
    controller = null;
  }
  function invalidate(reason = "context") {
    if (reason === "pagehide" || reason === "disposed") peer.abandon();
    retirement++;
    bindingProof2?.retire?.();
    cancelRequest(reasons.includes(reason) ? reason : "context");
    if (lastDiagnostic?.readPhases) lastDiagnostic = null;
    for (const listener of contextListeners) listener();
  }
  async function call(action, body, phase = "manual") {
    if (disposed) throw fail();
    peer.sync();
    let mutation = null, acknowledged = false;
    if (action === "claim" || action === "end") mutation = peer.begin();
    cancelRequest();
    lastDiagnostic = null;
    const checkpoint = generation;
    const owned = controller = new AbortController(), started = performance.now();
    let timedOut = false, statusClass = "none", recorded = false, readPhases = null;
    let clientStage = "call", responseKind = "none", http5xx, transportStage, serviceStage, readFailure;
    const record = (outcome, reason = "visible") => {
      if (recorded || checkpoint !== generation || !["read", "end"].includes(action)) return;
      recorded = true;
      lastDiagnostic = Object.freeze({
        action,
        phase: action === "end" ? "end" : ["initial", "return", "manual"].includes(phase) ? phase : "manual",
        outcome,
        httpStatusClass: statusClass,
        elapsedMs: Math.min(15e3, Math.max(0, Math.floor((performance.now() - started) / 250) * 250)),
        visibility: visibility(),
        retirementReason: reason,
        clientStage,
        responseKind,
        ...http5xx ? { http5xx } : {},
        ...transportStage ? { transportStage } : {},
        ...serviceStage ? { serviceStage } : {},
        ...readFailure ? { readFailure } : {},
        ...action === "read" && outcome === "success" && readPhases ? { readPhases } : {}
      });
    };
    retireDiagnostic = (reason) => record(reason === "deadline" ? "timeout" : "stale", reason);
    const timeout = setTimeout(() => {
      timedOut = true;
      owned.abort();
    }, timeoutMs);
    const withinDeadline = () => {
      if (owned.signal.aborted || performance.now() - started >= timeoutMs) {
        timedOut = true;
        owned.abort();
        throw fail("timeout");
      }
    };
    try {
      return await Promise.race([(async () => {
        const proof = action === "read" ? bindingProof2?.reserve() : null;
        clientStage = "request";
        const v2Read = action === "read" && publicationV2Ready(publicationReadiness);
        const responsePending = send("/api/n88/student/" + (v2Read ? "publication-v2/read" : action), {
          method: action === "read" ? "GET" : "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: owned.signal,
          headers: action === "read" ? { Accept: "application/json", ...v2Read ? { "X-N88-CSRF": "1" } : {}, ...proof?.headers } : { Accept: "application/json", "Content-Type": "application/json", "X-N88-CSRF": "1" },
          ...action === "read" ? {} : { body: JSON.stringify(body) }
        });
        clientStage = "transport";
        const response = await responsePending;
        clientStage = "response";
        body = null;
        peer.sync();
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        statusClass = response.status >= 200 && response.status < 300 ? "2xx" : response.status >= 400 && response.status < 500 ? "4xx" : response.status >= 500 && response.status < 600 ? "5xx" : "other";
        http5xx = statusClass === "5xx" ? response.status : void 0;
        if (action === "read" && statusClass === "5xx") {
          readFailure = parseStudentFailure(response.headers?.get("x-n88-student-failure"));
          const transport = response.headers?.get("x-n88-transport-stage"), service = response.headers?.get("x-n88-service-stage");
          if (["configuration", "upstream", "upstream-body", "upstream-http-5xx", "reply", "reply-shape"].includes(transport)) transportStage = transport;
          if (["acquire", "begin", "snapshot", "repository", "teacher", "source", "synchronize", "synchronize-lock", "synchronize-memberships", "synchronize-sessions", "synchronize-sources", "synchronize-publications", "synchronize-validate", "projection", "projection-finalize", "projection-membership-flush", "projection-commitguards", "projection-commit"].includes(service)) serviceStage = service;
        }
        const contentType = response.headers?.get("content-type") || "";
        responseKind = /^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(contentType) ? "json" : /^text\/html(?:;|$)/i.test(contentType) ? "html" : "other";
        await proof?.acceptFailure?.(response, () => checkpoint === generation && !owned.signal.aborted && !disposed);
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        if (action === "read" && response.status === 409 && responseKind === "json") {
          clientStage = "decode";
          const domain = await response.json();
          peer.sync();
          if (checkpoint !== generation) throw fail("stale");
          withinDeadline();
          if (isStudentPublicationReview(domain)) throw fail("publication");
          throw fail();
        }
        if (!response.ok || action === "read" && response.status !== 200) {
          const retry = Number(response.headers?.get("Retry-After"));
          throw fail(response.status === 429 ? "rate" : [401, 403, 410].includes(response.status) ? "session" : "unavailable", response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
        }
        if (action === "end" || action === "claim") {
          acknowledged = true;
          record("success");
          return null;
        }
        clientStage = "decode";
        const data = await response.json();
        peer.sync();
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        clientStage = "projection";
        const projected = v2Read ? parsePublicationStudentData(data) : projectUnifiedStudentData(data);
        await proof?.accept(response, () => checkpoint === generation && !owned.signal.aborted && !disposed);
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        readPhases = parseStudentReadPhases(response.headers?.get("x-n88-student-read-phases"));
        record("success");
        return projected;
      })(), new Promise((_, reject) => {
        owned.signal.addEventListener("abort", () => reject(fail()), { once: true });
      })]);
    } catch (error) {
      const kind = checkpoint !== generation ? "stale" : timedOut ? "timeout" : ["rate", "session", "publication"].includes(error?.kind) ? error.kind : "unavailable";
      record(kind === "session" ? "denied" : kind, timedOut ? "deadline" : "visible");
      throw fail(kind, error?.retryAfter || 0);
    } finally {
      if (action === "claim" || action === "end") peer.finish(mutation, acknowledged);
      clearTimeout(timeout);
      body = null;
      if (checkpoint === generation) {
        controller = null;
        retireDiagnostic = null;
      }
    }
  }
  return Object.freeze({
    publicationReadMode: () => publicationV2Ready(publicationReadiness),
    async claim(value) {
      let code = normalizeStudentCode(value);
      if (!validStudentCode(code)) throw fail("format");
      const context = retirement, pending = call("claim", { code }), checkpoint = generation;
      code = "";
      value = null;
      try {
        await pending;
      } catch (error) {
        if (error.kind === "stale") throw error;
        throw Object.assign(error, { claimState: ["session", "rate"].includes(error.kind) ? "rejected" : "uncertain" });
      }
      if (disposed || context !== retirement || checkpoint !== generation) throw fail("stale");
      try {
        return await call("read");
      } catch (error) {
        throw Object.assign(error, { claimState: "accepted" });
      }
    },
    synchronizeContext: () => peer.sync(),
    canRetainView: () => peer.canRetain(),
    captureContext: () => {
      peer.sync();
      return retirement;
    },
    isContextCurrent: (context) => {
      peer.sync();
      return !disposed && context === retirement;
    },
    subscribeContext(listener) {
      if (typeof listener !== "function") throw fail();
      contextListeners.add(listener);
      return () => contextListeners.delete(listener);
    },
    getDiagnostic: () => lastDiagnostic ? { ...lastDiagnostic } : null,
    read: ({ phase = "manual" } = {}) => call("read", void 0, phase),
    end: () => call("end", {}, "end"),
    invalidate,
    dispose() {
      disposed = true;
      invalidate("disposed");
      peer.dispose();
      contextListeners.clear();
    }
  });
}

// src/lib/dom.js
init_rakeez_datetime_values();
var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var esc = (v) => v === null || v === void 0 ? "" : String(v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
var RAW = /* @__PURE__ */ Symbol("raw");
var raw = (s) => ({
  [RAW]: true,
  value: String(s ?? ""),
  toString() {
    return this.value;
  }
});
var flatten = (v) => {
  if (v === null || v === void 0 || v === false) return "";
  if (v[RAW]) return v.value;
  if (Array.isArray(v)) return v.map(flatten).join("");
  return esc(v);
};
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += flatten(values[i]) + strings[i + 1];
  return raw(out);
}
var focusableSelector = [
  "[autofocus]",
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

// src/lib/brand.js
var BRAND_NAME = "\u0631\u064E\u0643\u064A\u0632 \u0627\u0644\u0645\u0639\u0644\u0645";
var APP_ICON_URL = new URL("../../assets/icon-192.png", import.meta.url).href;
var HEADER_LIGHT_URL = new URL("../../assets/header-light-standard.svg", import.meta.url).href;
var HEADER_LIGHT_COMPACT_URL = new URL("../../assets/header-light-compact.svg", import.meta.url).href;
var HEADER_DARK_URL = new URL("../../assets/header-dark-standard.svg", import.meta.url).href;
var HEADER_DARK_COMPACT_URL = new URL("../../assets/header-dark-compact.svg", import.meta.url).href;
function brandLockup({ compact = false, prominent = false, caption = "" } = {}) {
  const width = compact ? 295 : 345;
  const height = compact ? 52 : 56;
  return html`<span class="brand-lockup ${prominent ? "brand-lockup--prominent" : ""}" role="img" aria-label="${BRAND_NAME}">
    <img class="brand-lockup__image brand-lockup__image--light" src="${compact ? HEADER_LIGHT_COMPACT_URL : HEADER_LIGHT_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    <img class="brand-lockup__image brand-lockup__image--dark" src="${compact ? HEADER_DARK_COMPACT_URL : HEADER_DARK_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    ${caption ? html`<span class="brand-lockup__caption">${caption}</span>` : ""}
  </span>`;
}

// src/views/student-portal-publications.js
var esc2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var dates = (r) => `${r.startDate ? `<p>\u0627\u0644\u0628\u062F\u0627\u064A\u0629: <time dir="ltr">${esc2(r.startDate)}</time></p>` : ""}${r.dueDate ? `<p>\u0627\u0644\u062A\u0633\u0644\u064A\u0645: <time dir="ltr">${esc2(r.dueDate)}</time></p>` : ""}`;
var link = (r) => r.link ? `<a href="${esc2(r.link)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">\u0631\u0627\u0628\u0637 \u0627\u0644\u0634\u0631\u062D \u0623\u0648 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 <span aria-hidden="true">\u2197</span></a>` : "";
function renderStudentPublications(raw2) {
  const data = projectPublicationStudentData(raw2);
  const work = (category, title) => {
    const rows = data.work.filter((r) => r.categories.includes(category));
    return rows.length ? `<section data-section="${category}"><h2>${title}</h2>${rows.map((r) => `<article class="n88-unified-work" data-work-id="${esc2(r.id)}"><h3>${esc2(r.title)}</h3>${dates(r)}${r.description ? `<p class="n88-guidance-text">${esc2(r.description)}</p>` : ""}${link(r)}</article>`).join("")}</section>` : "";
  };
  return work("required", "\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646\u064A") + work("scheduled", "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0642\u0627\u062F\u0645\u0629") + (data.grades.length ? `<section class="n88-unified-grades"><h2>\u062F\u0631\u062C\u0627\u062A\u064A \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629</h2><dl class="n88-v2-grades">${data.grades.map((r) => `<div><dt>${esc2(r.title)}</dt><dd dir="ltr">${r.value === null ? "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" : esc2(r.value)}</dd></div>`).join("")}</dl></section>` : "") + work("completed", "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629") + (!data.work.length && !data.grades.length ? '<p class="n88-unified-empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0639\u0645\u0627\u0644 \u0623\u0648 \u062F\u0631\u062C\u0627\u062A \u0645\u0646\u0634\u0648\u0631\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.</p>' : "");
}

// src/views/student-portal-login.js
var escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var displayNumber = (value) => value === null ? "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" : escape(value);
var STUDENT_VIEW_FRESHNESS_MS = 5 * 60 * 1e3;
function mountUnifiedStudentPortal(root2, { client, readiness: readiness2 = { enabled: false } } = {}) {
  const doc = root2.ownerDocument, win = doc.defaultView;
  let disposed = false, generation = 0, busy = false, timer, cooldownUntil = 0, codeDraft = "", pendingCompletion = null, pendingForm = false, pendingMessage = "";
  let returnRead = null, endingSession = false, retiredPage = false, screen = "pending";
  let freshnessTimer, settledAt = 0, settledTick = 0, settledContext, settledProjection = null, clearing = false, viewDiagnostic = null;
  const previousDir = root2.getAttribute("dir");
  root2.classList.add("n88-unified");
  root2.dir = "rtl";
  const style = doc.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("../styles/student-portal-login.css", import.meta.url).href;
  doc.head.append(style);
  let publicationStyle = null;
  if (client?.publicationReadMode?.()) {
    publicationStyle = doc.createElement("link");
    publicationStyle.rel = "stylesheet";
    publicationStyle.href = new URL("../styles/student-portal.css", import.meta.url).href;
    doc.head.append(publicationStyle);
  }
  const enabled = readiness2?.enabled === true && !!client;
  const paint = (content, focus = true) => {
    if (disposed) return;
    root2.innerHTML = `<header>${brandLockup({ compact: true })}</header><main>${content}<details class="n88-student-support"><summary>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u064A\u0629</summary><p>\u064A\u0645\u0643\u0646\u0643 \u0646\u0633\u062E \u0646\u062A\u064A\u062C\u0629 \u0637\u0644\u0628 \u0648\u0627\u062D\u062F \u062F\u0648\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0627\u0644\u0628. \u0644\u0627 \u062A\u064F\u0631\u0633\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627.</p><button type="button" data-copy-diagnostic>\u0646\u0633\u062E \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642</button><p role="status" data-copy-status></p><textarea readonly hidden dir="ltr" aria-label="\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u0644\u0646\u0633\u062E \u0627\u0644\u064A\u062F\u0648\u064A" data-copy-text></textarea></details></main>`;
    const support = root2.querySelector(".n88-student-support");
    const result = doc.createElement("pre");
    result.dir = "ltr";
    result.className = "n88-guidance-text";
    result.setAttribute("data-support-diagnostic", "");
    result.textContent = diagnosticText() || "\u0644\u0627 \u062A\u062A\u0648\u0641\u0631 \u0646\u062A\u064A\u062C\u0629 \u0645\u0643\u062A\u0645\u0644\u0629 \u0628\u0639\u062F.";
    support.insertBefore(result, support.querySelector("[data-copy-diagnostic]"));
    if (focus) root2.querySelector("h1")?.focus();
  };
  function entry(message = "") {
    screen = "entry";
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry first-run-auth"><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p class="n88-unified-welcome">\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0630\u064A \u0632\u0648\u0651\u062F\u0643 \u0628\u0647 \u0645\u0639\u0644\u0651\u0645\u0643.</p><form data-claim novalidate><label class="field__label" for="n88-unified-code">\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644</label><p id="n88-code-help">6 \u0623\u0631\u0642\u0627\u0645 \u062A\u0628\u062F\u0623 \u0628\u06401</p><input id="n88-unified-code" class="input first-run-auth__otp" type="text" inputmode="numeric" minlength="6" pattern="1[0-9]{5}" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="n88-code-help n88-message" required ${!enabled || cooling ? "disabled" : ""}><p id="n88-message" role="status">${escape(!enabled ? "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0644\u0645 \u062A\u064F\u0641\u0639\u0651\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0639\u062F." : cooling ? "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : message)}</p><button class="btn btn--primary" type="submit" ${!enabled || cooling ? "disabled" : ""}>\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628</button></form></section>`);
    if (enabled && client.publicationReadMode?.()) {
      const check = doc.createElement("button");
      check.type = "button";
      check.dataset.sessionRetry = "";
      check.textContent = "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629";
      root2.querySelector("section").append(check);
    }
    const field = root2.querySelector("[data-claim] input");
    if (field) field.value = codeDraft;
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => entry("\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627."), Math.max(1, cooldownUntil - Date.now()));
  }
  function recovery(message, end = false) {
    screen = end ? "end-uncertain" : "recovery";
    clearTimeout(timer);
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry"><h1 tabindex="-1">${end ? "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629" : "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628"}</h1><p role="status" aria-live="polite">${escape(message)}${cooling ? " \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : ""}</p><button class="btn btn--primary" data-session-retry ${cooling ? "disabled" : ""}>${end ? "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627" : "\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627"}</button></section>`);
    if (cooling) timer = setTimeout(() => recovery(message, end), Math.max(1, cooldownUntil - Date.now()));
  }
  function publicationReview() {
    screen = "publication";
    clearTimeout(freshnessTimer);
    settledProjection = null;
    settledAt = 0;
    settledContext = void 0;
    paint('<section class="n88-unified-entry" data-publication-review><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p role="status">\u064A\u0644\u0632\u0645 \u0623\u0646 \u064A\u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0651\u0645\u0643 \u0627\u0644\u0646\u0634\u0631 \u0627\u0644\u062D\u0627\u0644\u064A \u0642\u0628\u0644 \u0639\u0631\u0636 \u0628\u064A\u0627\u0646\u0627\u062A\u0643. \u062C\u0644\u0633\u062A\u0643 \u0645\u0627 \u0632\u0627\u0644\u062A \u0645\u062A\u0627\u062D\u0629.</p><button type="button" data-read>\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u0634\u0631</button><button type="button" data-end>\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</button></section>');
  }
  function show(raw2, preserve = false) {
    const data = projectUnifiedStudentData(raw2);
    const completedOpen = preserve && root2.querySelector(".n88-completed-group")?.open;
    const scroll = preserve ? { x: win.scrollX, y: win.scrollY } : null;
    const focus = preserve && root2.contains(doc.activeElement) ? ["data-read", "data-end"].find((key) => doc.activeElement.hasAttribute(key)) : null;
    settledProjection = JSON.stringify(data);
    settledAt = Date.now();
    settledTick = win.performance.now();
    settledContext = client.captureContext?.();
    screen = "private";
    const profile = data.profile;
    let content = `<div class="n88-unified-profile"><div><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u062A\u064A \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629</h1>${profile?.name !== void 0 ? `<p class="n88-unified-name">${escape(profile.name)}</p>` : ""}${profile?.classLabel !== void 0 ? `<p class="n88-unified-class">${escape(profile.classLabel)}</p>` : ""}</div><div class="n88-unified-actions"><button data-read>\u062A\u062D\u062F\u064A\u062B</button><button data-end aria-label="\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628">\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C</button></div></div><div class="n88-unified-sections">`;
    if (data.version === "n88-publication-v2") content += renderStudentPublications(data);
    else {
      const workSection = (key, label) => {
        if (!data.work?.[key]?.length) return "";
        let content2 = "";
        content2 += `<section data-section="${key}" class="${key === "completed" ? "n88-completed" : ""}">${key === "completed" ? `<details class="n88-completed-group"><summary>\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629 <span class="n88-unified-count">${data.work[key].length}</span></summary>` : `<h2>${label}<span class="n88-unified-count" aria-label="\u0639\u062F\u062F \u0627\u0644\u0623\u0639\u0645\u0627\u0644">${data.work[key].length}</span></h2>`}${data.work[key].length ? data.work[key].map((item) => {
          const detail = `${item.executionInstructions !== void 0 ? `<h3>\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630</h3><p class="n88-guidance-text">${escape(item.executionInstructions)}</p>` : ""}${item.deliveryInstructions !== void 0 ? `<h3>\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u0633\u0644\u064A\u0645</h3><p class="n88-guidance-text">${escape(item.deliveryInstructions)}</p>` : ""}${item.instruction !== void 0 ? `<p class="n88-unified-instruction">${escape(item.instruction)}</p>` : ""}${item.startDate ? `<p>\u064A\u0628\u062F\u0623: <span dir="ltr">${escape(item.startDate)}</span></p>` : ""}${item.dueDate ? `<p>\u0627\u0644\u062A\u0633\u0644\u064A\u0645: <span dir="ltr">${escape(item.dueDate)}</span></p>` : ""}${item.completionState !== void 0 ? `<p>${escape({ unrecorded: "\u0644\u0645 \u064A\u064F\u0631\u0635\u062F \u0625\u0646\u062C\u0627\u0632", regular: "\u0645\u0643\u062A\u0645\u0644", late: "\u0645\u0643\u062A\u0645\u0644 \u0645\u062A\u0623\u062E\u0631" }[item.completionState])}</p>` : ""}${item.deadline !== void 0 ? `<p>\u0627\u0644\u0645\u0648\u0639\u062F: <span dir="ltr">${escape(item.deadline)}</span></p>` : ""}${item.status !== void 0 ? `<p>${escape(item.status)}</p>` : ""}`;
          return `<article class="n88-unified-work" data-work-id="${escape(key + ":" + item.id)}"><h3>${escape(item.title)}</h3>${detail ? `<div class="n88-unified-detail">${detail}</div>` : ""}</article>`;
        }).join("") : '<p class="n88-unified-empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0639\u0645\u0627\u0644 \u0645\u0646\u0634\u0648\u0631\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.</p>'}${key === "completed" ? "</details>" : ""}</section>`;
        return content2;
      };
      content += workSection("required", "\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646\u064A") + workSection("scheduled", "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0642\u0627\u062F\u0645\u0629");
      if (data.grades) {
        content += `<section class="n88-unified-grades"><h2>\u062F\u0631\u062C\u0627\u062A\u064A</h2><div class="n88-unified-table"><table><thead><tr><th scope="col">\u0627\u0644\u0628\u0646\u062F</th><th scope="col">\u0627\u0644\u062F\u0631\u062C\u0629</th><th scope="col">\u0645\u0646</th></tr></thead><tbody>${data.grades.items.map((item) => `<tr><th scope="row">${escape(item.label)}${item.status !== void 0 ? `<small>${escape({ recorded: "\u0645\u0631\u0635\u0648\u062F\u0629", unrecorded: "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" }[item.status] || "")}</small>` : ""}</th><td>${displayNumber(item.value)}</td><td>${displayNumber(item.max)}</td></tr>`).join("")}</tbody></table></div>${data.grades.total ? `<p class="n88-unified-total">\u0627\u0644\u0645\u062C\u0645\u0648\u0639: <b dir="ltr">${displayNumber(data.grades.total.earned)} / ${displayNumber(data.grades.total.possible)}</b></p>` : ""}</section>`;
      }
      content += workSection("completed", "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629");
      if (!Object.values(data.work || {}).some((items) => items.length) && !data.grades) content += '<p class="n88-unified-empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0639\u0645\u0627\u0644 \u0623\u0648 \u062F\u0631\u062C\u0627\u062A \u0645\u0646\u0634\u0648\u0631\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.</p>';
    }
    paint(content + '</div><p role="status" data-refresh-status>\u064A\u064F\u062D\u062F\u0651\u062B \u0627\u0644\u0639\u0631\u0636 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627 \u0643\u0644 \u062E\u0645\u0633 \u062F\u0642\u0627\u0626\u0642 \u0623\u062B\u0646\u0627\u0621 \u0641\u062A\u062D\u0647. \u064A\u0645\u0643\u0646\u0643 \u062A\u062D\u062F\u064A\u062B\u0647 \u0627\u0644\u0622\u0646.</p>', !preserve);
    if (preserve) {
      const completed = root2.querySelector(".n88-completed-group");
      if (completed) completed.open = !!completedOpen;
      if (focus) root2.querySelector("[" + focus + "]")?.focus({ preventScroll: true });
      win.scrollTo(scroll.x, scroll.y);
    }
    scheduleFreshness();
  }
  const displayAge = () => Math.max(Date.now() - settledAt, win.performance.now() - settledTick);
  function scheduleFreshness() {
    clearTimeout(freshnessTimer);
    if (disposed || screen !== "private") return;
    freshnessTimer = setTimeout(() => {
      if (doc.visibilityState === "hidden") {
        clear(false, "hidden");
        retiredPage = true;
        return;
      }
      void refresh("return");
    }, Math.max(1, STUDENT_VIEW_FRESHNESS_MS - displayAge()));
  }
  function currentView() {
    if (client.isContextCurrent && !client.isContextCurrent(settledContext)) {
      clear();
      return false;
    }
    return screen === "private";
  }
  async function refresh(phase = "manual") {
    if (disposed || busy || doc.visibilityState === "hidden") return;
    if (screen !== "private") return run(() => client.read({ phase }), false, false, true);
    if (!currentView()) return;
    return run(() => client.read({ phase }), false, false, true, true);
  }
  function pending(ending = false) {
    screen = ending ? "end-pending" : "pending";
    paint(ending ? '<section class="n88-unified-entry" aria-busy="true"><h1 tabindex="-1">\u062C\u0627\u0631\u064D \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629\u2026</h1><p role="status" aria-live="polite">\u0623\u064F\u062E\u0641\u064A\u062A \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629. \u0646\u0646\u062A\u0638\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062E\u0627\u062F\u0645 \u0644\u0645\u062F\u0629 \u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 15 \u062B\u0627\u0646\u064A\u0629.</p></section>' : '<section class="n88-unified-entry n88-unified-pending"><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p role="status" aria-live="polite">\u0644\u062D\u0638\u0627\u062A \u0648\u0646\u062C\u0647\u0651\u0632 \u0645\u0633\u0627\u062D\u062A\u0643\u2026</p><div class="n88-unified-progress" role="progressbar" aria-label="\u062C\u0627\u0631\u064D \u062A\u062C\u0647\u064A\u0632 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628" aria-busy="true"></div></section>');
  }
  function endUncertain() {
    recovery("\u062A\u0639\u0630\u0651\u0631 \u062A\u0623\u0643\u064A\u062F \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u062F\u0649 \u0627\u0644\u062E\u0627\u062F\u0645. \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0645\u062E\u0641\u064A\u0629 \u0647\u0646\u0627. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u062C\u062F\u062F\u064B\u0627 \u0642\u0628\u0644 \u0623\u064A \u0645\u062D\u0627\u0648\u0644\u0629 \u0625\u0646\u0647\u0627\u0621 \u0623\u062E\u0631\u0649.", true);
  }
  function diagnosticText() {
    let d;
    try {
      d = client?.getDiagnostic?.();
    } catch {
    }
    d = d || viewDiagnostic;
    if (!d || !["read", "end"].includes(d.action) || !["initial", "return", "manual", "end"].includes(d.phase) || !["success", "denied", "rate", "unavailable", "timeout", "stale", "publication"].includes(d.outcome) || !["none", "2xx", "4xx", "5xx", "other"].includes(d.httpStatusClass) || !["visible", "hidden"].includes(d.visibility) || !["visible", "hidden", "pagehide", "disposed", "context", "superseded", "deadline"].includes(d.retirementReason) || !Number.isFinite(d.elapsedMs)) return null;
    const readPhases = d.action === "read" && d.outcome === "success" && d.httpStatusClass === "2xx" ? parseStudentReadPhases(JSON.stringify(d.readPhases)) : null;
    return JSON.stringify({
      action: d.action,
      phase: d.phase,
      outcome: d.outcome,
      httpStatusClass: d.httpStatusClass,
      elapsedMs: Math.min(15e3, Math.max(0, Math.floor(d.elapsedMs / 250) * 250)),
      visibility: d.visibility,
      retirementReason: d.retirementReason,
      clientStage: ["call", "request", "response", "transport", "decode", "projection", "adopt", "unknown"].includes(d.clientStage) ? d.clientStage : "unknown",
      responseKind: ["json", "html", "other", "none"].includes(d.responseKind) ? d.responseKind : "none",
      ...d.httpStatusClass === "5xx" && Number.isInteger(d.http5xx) && d.http5xx >= 500 && d.http5xx <= 599 ? { http5xx: d.http5xx } : {},
      ...d.action === "read" && d.httpStatusClass === "5xx" && ["configuration", "upstream", "upstream-body", "upstream-http-5xx", "reply", "reply-shape"].includes(d.transportStage) ? { transportStage: d.transportStage } : {},
      ...d.action === "read" && d.httpStatusClass === "5xx" && ["acquire", "begin", "snapshot", "repository", "teacher", "source", "synchronize", "synchronize-lock", "synchronize-memberships", "synchronize-sessions", "synchronize-sources", "synchronize-publications", "synchronize-validate", "projection", "projection-finalize", "projection-membership-flush", "projection-commitguards", "projection-commit"].includes(d.serviceStage) ? { serviceStage: d.serviceStage } : {},
      ...d.action === "read" && d.httpStatusClass === "5xx" && parseStudentFailure(JSON.stringify(d.readFailure)) ? { readFailure: parseStudentFailure(JSON.stringify(d.readFailure)) } : {},
      ...readPhases ? { readPhases } : {}
    });
  }
  async function copyDiagnostic(button) {
    const text3 = diagnosticText(), checkpoint = generation;
    const status = root2.querySelector("[data-copy-status]"), fallback = root2.querySelector("[data-copy-text]");
    const current = () => !disposed && doc.visibilityState !== "hidden" && checkpoint === generation && root2.contains(button) && diagnosticText() === text3;
    if (!current()) return;
    fallback.hidden = true;
    fallback.value = "";
    status.textContent = "";
    if (!text3) {
      status.textContent = "\u0644\u0627 \u062A\u062A\u0648\u0641\u0631 \u0646\u062A\u064A\u062C\u0629 \u0645\u0643\u062A\u0645\u0644\u0629 \u0644\u0644\u0646\u0633\u062E \u0628\u0639\u062F.";
      return;
    }
    button.disabled = true;
    try {
      await win.navigator.clipboard.writeText(text3);
      if (current()) status.textContent = "\u062A\u0645 \u0646\u0633\u062E \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642.";
    } catch {
      if (current()) {
        fallback.hidden = false;
        fallback.value = text3;
        status.textContent = "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A. \u064A\u0645\u0643\u0646\u0643 \u0646\u0633\u062E \u0627\u0644\u0646\u0635 \u064A\u062F\u0648\u064A\u064B\u0627.";
      }
    } finally {
      if (!disposed && root2.contains(button)) button.disabled = false;
    }
  }
  function inlineEntry(message = "", invalid = false) {
    const form = root2.querySelector("[data-claim]");
    if (!form) return;
    const cooling = Date.now() < cooldownUntil, field = form.querySelector("input");
    form.setAttribute("aria-busy", String(busy));
    field.disabled = !enabled || busy || cooling;
    field.setAttribute("aria-invalid", String(invalid));
    form.querySelector("[type=submit]").disabled = !enabled || busy || cooling;
    form.querySelector("[type=submit]").textContent = busy ? "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642\u2026" : "\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628";
    form.querySelector("[role=status]").textContent = cooling ? "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : message;
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => inlineEntry("\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627."), Math.max(1, cooldownUntil - Date.now()));
  }
  async function run(action, ending = false, sameForm = false, resuming = false, quiet = false) {
    if (disposed || busy || !enabled || doc.visibilityState === "hidden" || Date.now() < cooldownUntil) return;
    const beforeContext = generation, context = client.captureContext?.();
    if (beforeContext !== generation) return;
    returnRead = null;
    endingSession = ending;
    busy = true;
    const checkpoint = ++generation;
    viewDiagnostic = null;
    const attemptStarted = win.performance.now();
    let attemptStage = "call";
    pendingForm = sameForm;
    pendingMessage = resuming ? "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629\u2026" : "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632\u2026";
    clearTimeout(freshnessTimer);
    if (!quiet) {
      settledProjection = null;
      settledAt = 0;
      settledContext = void 0;
    }
    if (quiet) {
      root2.querySelector("[data-refresh-status]").textContent = "\u062C\u0627\u0631\u064D \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0639\u0631\u0636\u2026";
      root2.querySelector("[data-read]").disabled = true;
      root2.querySelector("[data-end]").disabled = true;
    } else if (sameForm) inlineEntry(pendingMessage);
    else pending(ending);
    try {
      let deadline;
      const deadlineMs = sameForm && !resuming ? 31e3 : 15e3;
      const data = await Promise.race([Promise.resolve(action()), new Promise((_, reject) => {
        deadline = setTimeout(() => reject({ kind: "timeout", viewDeadline: true }), deadlineMs);
      })]).finally(() => clearTimeout(deadline));
      if (disposed || checkpoint !== generation) return;
      if (client.isContextCurrent && !client.isContextCurrent(context)) {
        clear();
        return;
      }
      codeDraft = "";
      if (doc.visibilityState === "hidden") {
        const field = root2.querySelector("[data-claim] input");
        if (field) field.value = "";
      }
      pendingCompletion = { checkpoint, context, data, ending, sameForm, resuming, quiet, completedAt: Date.now() };
      attemptStage = "adopt";
      adoptCompletion();
    } catch (error) {
      if (disposed || checkpoint !== generation) return;
      if (error?.kind === "rate") cooldownUntil = Date.now() + Math.min(300, Math.max(1, error.retryAfter || 30)) * 1e3;
      if (client.isContextCurrent && !client.isContextCurrent(context)) {
        clear();
        return;
      }
      viewDiagnostic = Object.freeze({ action: ending ? "end" : "read", phase: ending ? "end" : resuming ? "initial" : "manual", outcome: "unavailable", httpStatusClass: "none", elapsedMs: Math.min(15e3, Math.max(0, Math.floor((win.performance.now() - attemptStarted) / 250) * 250)), visibility: doc.visibilityState === "hidden" ? "hidden" : "visible", retirementReason: "visible", clientStage: attemptStage, responseKind: "none" });
      if (error?.viewDeadline) {
        clear(false, "deadline");
        if (ending) endUncertain();
        return;
      }
      pendingCompletion = { checkpoint, context, errorKind: error?.kind || "unavailable", claimState: error?.claimState, ending, sameForm, resuming, quiet };
      adoptCompletion();
    } finally {
      if (checkpoint === generation && !pendingCompletion) {
        busy = false;
        pendingForm = false;
        if (sameForm && root2.querySelector("[data-claim]")) {
          const m = root2.querySelector("#n88-message").textContent;
          inlineEntry(m, root2.querySelector("input").getAttribute("aria-invalid") === "true");
        }
      }
    }
  }
  function adoptCompletion() {
    const result = pendingCompletion;
    if (!result || disposed || doc.visibilityState === "hidden") return;
    pendingCompletion = null;
    if (result.checkpoint !== generation) return;
    if (client.isContextCurrent && !client.isContextCurrent(result.context)) {
      clear();
      return;
    }
    if (result.completedAt && Date.now() - result.completedAt >= STUDENT_VIEW_FRESHNESS_MS) {
      clear();
      return;
    }
    busy = false;
    pendingForm = false;
    endingSession = false;
    if (result.errorKind) {
      settledProjection = null;
      settledAt = 0;
      settledContext = void 0;
      if (result.errorKind === "publication" && !result.ending) {
        publicationReview();
        return;
      }
      if (result.quiet) {
        clear(false, result.errorKind === "timeout" ? "deadline" : "context");
        return;
      }
      if (result.resuming && !result.claimState && client.publicationReadMode?.()) {
        entry("\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632\u0643.");
        return;
      }
      const rejected = !result.resuming && result.claimState === "rejected" && result.errorKind === "session";
      const message = rejected ? "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632. \u062A\u062D\u0642\u0642 \u0645\u0646\u0647 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0651\u0645\u0643." : result.errorKind === "session" ? "\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0623\u0648 \u0627\u0646\u062A\u0647\u062A. \u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0645\u0643." : result.claimState === "accepted" ? "\u0642\u064F\u0628\u0644 \u0627\u0644\u0631\u0645\u0632\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0651\u0631 \u0639\u0631\u0636 \u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u0627\u0636\u063A\u0637 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0644\u0625\u0639\u0627\u062F\u0629 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062C\u0644\u0633\u0629." : result.claimState === "uncertain" ? "\u062A\u0639\u0630\u0651\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062F\u062E\u0648\u0644. \u0627\u0636\u063A\u0637 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0642\u0628\u0644 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 \u0645\u062C\u062F\u062F\u064B\u0627." : "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627 \u0639\u0646\u062F\u0645\u0627 \u064A\u062A\u0648\u0641\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644.";
      if (result.ending) endUncertain();
      else if ((result.resuming || !result.sameForm) && result.errorKind !== "session") recovery("\u062A\u0639\u0630\u0651\u0631 \u0641\u062A\u062D \u0645\u0633\u0627\u062D\u062A\u0643 \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.");
      else if (["accepted", "uncertain"].includes(result.claimState) && result.errorKind !== "session") recovery(message);
      else if (result.sameForm && root2.querySelector("[data-claim]")) inlineEntry(message, rejected);
      else if (result.sameForm && result.claimState !== "rejected" && result.errorKind !== "session") recovery(message);
      else entry(message);
    } else {
      codeDraft = "";
      if (result.ending) {
        entry("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629.");
        screen = "end-ack";
      } else if (result.quiet && screen === "private" && JSON.stringify(projectUnifiedStudentData(result.data)) === settledProjection) {
        settledAt = Date.now();
        settledTick = win.performance.now();
        settledContext = result.context;
        root2.querySelector("[data-read]").disabled = false;
        root2.querySelector("[data-end]").disabled = false;
        root2.querySelector("[data-refresh-status]").textContent = "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0639\u0631\u0636. \u064A\u064F\u0639\u0627\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u062E\u0644\u0627\u0644 \u062E\u0645\u0633 \u062F\u0642\u0627\u0626\u0642.";
        scheduleFreshness();
      } else show(result.data, result.quiet);
    }
  }
  const submit = (event) => {
    if (!event.target.matches("[data-claim]")) return;
    event.preventDefault();
    if (busy || !enabled) return;
    const input2 = root2.querySelector("input");
    let code = codeDraft = normalizeStudentCode(input2.value);
    if (!validStudentCode(code)) {
      code = "";
      inlineEntry("\u0623\u062F\u062E\u0644 6 \u0623\u0631\u0642\u0627\u0645 \u062A\u0628\u062F\u0623 \u0628\u0627\u0644\u0631\u0642\u0645 1.", true);
      return;
    }
    void run(() => {
      const pending2 = client.claim(code);
      code = "";
      codeDraft = "";
      input2.value = "";
      return pending2;
    }, false, true);
  };
  const input = (event) => {
    if (event.target.matches("[data-claim] input")) {
      event.target.setCustomValidity("");
      event.target.removeAttribute("aria-invalid");
      event.target.value = codeDraft = normalizeStudentCode(event.target.value);
    }
  };
  const rejectOverflow = (event, pasted = false) => {
    const field = event.target;
    if (!field.matches("[data-claim] input")) return;
    const added = pasted ? event.clipboardData?.getData("text") : event.data;
    if (typeof added !== "string") return;
    const proposed = field.value.slice(0, field.selectionStart ?? field.value.length) + added + field.value.slice(field.selectionEnd ?? field.value.length);
    if (normalizeStudentCode(proposed).length > 6) {
      event.preventDefault();
      inlineEntry("\u0623\u062F\u062E\u0644 6 \u0623\u0631\u0642\u0627\u0645 \u062A\u0628\u062F\u0623 \u0628\u0627\u0644\u0631\u0642\u0645 1.", true);
    } else if (pasted) {
      event.preventDefault();
      field.value = normalizeStudentCode(proposed);
      input({ target: field });
    }
  };
  const beforeInput = (event) => rejectOverflow(event);
  const paste = (event) => rejectOverflow(event, true);
  const click = (event) => {
    const copy = event.target.closest("[data-copy-diagnostic]");
    if (copy) {
      void copyDiagnostic(copy);
      return;
    }
    if (event.target.closest("[data-session-retry]")) void run(() => client.read({ phase: "manual" }), false, false, true);
    if (event.target.closest("[data-read]")) void refresh();
    if (event.target.closest("[data-end]")) void run(() => client.end(), true);
  };
  function clear(preserveDraft = false, reason = "context", invalidateClient = true) {
    if (clearing) return;
    clearing = true;
    clearTimeout(freshnessTimer);
    settledProjection = null;
    settledAt = 0;
    settledContext = void 0;
    returnRead = null;
    if (preserveDraft) {
      const field = root2.querySelector("[data-claim] input");
      if (field) codeDraft = normalizeStudentCode(field.value);
    } else codeDraft = "";
    generation++;
    viewDiagnostic = null;
    busy = false;
    endingSession = false;
    pendingForm = false;
    pendingCompletion = null;
    pendingMessage = "";
    clearTimeout(timer);
    if (invalidateClient) client?.invalidate?.(reason);
    if (preserveDraft && root2.querySelector("[data-claim]")) inlineEntry();
    else recovery("\u0644\u0645 \u062A\u064F\u062D\u0633\u0645 \u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u0644\u0633\u0629. \u062A\u062D\u0642\u0651\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.");
    clearing = false;
  }
  const hide = () => {
    const end = endingSession || screen === "end-pending" || screen === "end-uncertain", ack = screen === "end-ack";
    retiredPage = !end && !ack;
    clear(false, "pagehide");
    if (end) endUncertain();
    else if (ack) {
      entry("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629.");
      screen = "end-ack";
    } else pending();
  };
  const visible = () => {
    if (client.synchronizeContext?.()) return;
    if (doc.visibilityState === "hidden") {
      const fallback = root2.querySelector("[data-copy-text]");
      if (fallback) {
        fallback.hidden = true;
        fallback.value = "";
      }
      if (screen === "end-pending" || screen === "end-ack" || screen === "end-uncertain") return;
      if (busy && pendingForm) {
        codeDraft = "";
        pending();
        return;
      }
      if (screen === "entry" || screen === "publication") return;
      if (screen === "private" && !busy) {
        if (!currentView()) return;
        const retain = client.canRetainView?.() !== false;
        if (screen !== "private") return;
        if (retain && displayAge() < STUDENT_VIEW_FRESHNESS_MS) return;
        clear(false, "hidden");
        retiredPage = true;
        return;
      }
      if (returnRead) return;
      const shouldRead = !endingSession && (root2.querySelector("[data-end]") || busy);
      if (shouldRead) {
        clear(false, "hidden");
        pending();
        returnRead = { context: client?.captureContext?.() };
      }
    } else {
      const returning = returnRead;
      returnRead = null;
      if (retiredPage) {
        retiredPage = false;
        void run(() => client.read({ phase: "return" }), false, false, true);
        return;
      }
      if (returning) {
        if (client.isContextCurrent && !client.isContextCurrent(returning.context)) {
          clear();
          return;
        }
        void run(() => client.read({ phase: "return" }), false, false, true);
      } else {
        adoptCompletion();
        if (screen === "private" && currentView() && displayAge() >= STUDENT_VIEW_FRESHNESS_MS) void refresh("return");
      }
    }
  };
  const pageshow = () => visible();
  const blur = () => {
    if (screen !== "private") return;
    const retain = client.canRetainView?.() !== false;
    if (screen !== "private") return;
    if (!retain) {
      clear(false, "hidden");
      retiredPage = true;
    }
  };
  const unsubscribeContext = client?.subscribeContext?.(() => {
    if (!clearing && !disposed) {
      const wasEntry = screen === "entry";
      retiredPage = false;
      clear(false, "context", false);
      if (wasEntry) entry("\u062A\u063A\u064A\u0651\u0631\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0641\u064A \u0635\u0641\u062D\u0629 \u0623\u062E\u0631\u0649. \u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0645\u0632 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.");
    }
  });
  root2.addEventListener("beforeinput", beforeInput);
  root2.addEventListener("paste", paste);
  root2.addEventListener("submit", submit);
  root2.addEventListener("input", input);
  root2.addEventListener("click", click);
  win.addEventListener("focus", visible);
  win.addEventListener("blur", blur);
  win.addEventListener("pagehide", hide);
  win.addEventListener("pageshow", pageshow);
  doc.addEventListener("visibilitychange", visible);
  let ready;
  if (!enabled) {
    entry();
    ready = Promise.resolve();
  } else if (doc.visibilityState === "hidden") {
    retiredPage = true;
    recovery("\u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629.");
    ready = Promise.resolve();
  } else ready = run(() => client.read({ phase: "initial" }), false, false, true);
  return { ready, clear, refresh, dispose() {
    if (disposed) return;
    unsubscribeContext?.();
    clear(false, "disposed");
    disposed = true;
    clearTimeout(timer);
    clearTimeout(freshnessTimer);
    client?.dispose?.();
    root2.replaceChildren();
    style.remove();
    publicationStyle?.remove();
    root2.classList.remove("n88-unified");
    if (previousDir === null) root2.removeAttribute("dir");
    else root2.setAttribute("dir", previousDir);
    root2.removeEventListener("beforeinput", beforeInput);
    root2.removeEventListener("paste", paste);
    root2.removeEventListener("submit", submit);
    root2.removeEventListener("input", input);
    root2.removeEventListener("click", click);
    win.removeEventListener("focus", visible);
    win.removeEventListener("blur", blur);
    win.removeEventListener("pagehide", hide);
    win.removeEventListener("pageshow", pageshow);
    doc.removeEventListener("visibilitychange", visible);
  } };
}

// drafts/n88-student-portal/client/binding-proof.js
function createBindingProofObserver({ location, history, root: root2, now = Date.now }) {
  const match = /^#n88-binding=([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.([0-9]{13})$/.exec(location.hash || "");
  if (!match) return null;
  history.replaceState(null, "", location.pathname);
  const expiresAt = Number(match[2]);
  let challenge = match[1], reserved = false, retired = false;
  if (expiresAt <= now() || expiresAt > now() + 3e5) return null;
  return { reserve() {
    if (retired || reserved || !challenge || now() >= expiresAt) return null;
    reserved = true;
    const sent = challenge;
    challenge = "";
    return { headers: { "X-N88-Binding-Challenge": sent }, async acceptFailure(response, isCurrent) {
      if (retired || now() >= expiresAt || !isCurrent?.() || ![200, 401, 503].includes(response.status)) return;
      const raw2 = response.headers?.get("x-n88-failure-correlation");
      if (!raw2 || raw2.length > 850) return;
      let receipt;
      try {
        receipt = JSON.parse(raw2);
      } catch {
        return;
      }
      const expected = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sent))), (b) => b.toString(16).padStart(2, "0")).join("");
      const phases = ["none", "acquire", "guard", "begin", "snapshot", "operation", "synchronize-lock", "synchronize-memberships", "synchronize-sessions", "synchronize-sources", "synchronize-publications", "synchronize-validate", "projection-finalize", "projection-membership-flush", "projection-commitguards", "projection-commit"];
      const families = ["success", "auth_or_membership", "admission", "typed_operation", "database", "transaction", "commit_unknown", "projection", "unknown"];
      if (!receipt || Object.keys(receipt).sort().join(",") !== "challengeHash,family,mac,phase,sourcePin,status,version" || receipt.version !== 1 || receipt.challengeHash !== expected || receipt.status !== response.status || !phases.includes(receipt.phase) || !families.includes(receipt.family) || !/^[a-f0-9]{64}$/.test(receipt.sourcePin) || !/^[a-f0-9]{64}$/.test(receipt.mac) || (response.status === 200 ? receipt.family !== "success" || receipt.phase !== "none" : receipt.family === "success")) return;
      if (!retired && now() < expiresAt && isCurrent() && root2.isConnected) root2.setAttribute("data-n88-failure-correlation", JSON.stringify(receipt));
    }, async accept(response, isCurrent) {
      if (retired || now() >= expiresAt || !response.ok || !isCurrent?.()) return;
      const raw2 = response.headers?.get("x-n88-binding-proof");
      if (!raw2 || raw2.length > 1e3) return;
      let proof;
      try {
        proof = JSON.parse(raw2);
      } catch {
        return;
      }
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sent));
      const expected = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
      if (!proof || Object.keys(proof).sort().join(",") !== "challengeHash,sealed,version" || proof.version !== 1 || proof.challengeHash !== expected || !/^[A-Za-z0-9_-]{683}$/.test(proof.sealed)) return;
      if (!retired && now() < expiresAt && isCurrent() && root2.isConnected) root2.setAttribute("data-n88-binding-proof", JSON.stringify(proof));
    } };
  }, retire() {
    retired = true;
    challenge = "";
    reserved = true;
    root2.removeAttribute("data-n88-failure-correlation");
    root2.removeAttribute("data-n88-binding-proof");
  } };
}

// drafts/n88-student-portal/client/student-entry.js
var readiness = Object.freeze({ enabled: true, mode: "pilot" });
var root = document.getElementById("student-portal");
var bindingProof = createBindingProofObserver({ location: window.location, history: window.history, root });
mountUnifiedStudentPortal(root, { client: createUnifiedStudentPortalClient({ bindingProof }), readiness });
