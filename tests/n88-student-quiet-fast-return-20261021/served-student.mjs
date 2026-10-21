// src/lib/rakeez-datetime-values.js
var normalizeDateTimeDigits = (value) => String(value ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "\u0669" ? 1632 : 1776)));

// src/lib/student-portal-unified-client.js
var normalizeStudentCode = (value) => typeof value === "string" ? normalizeDateTimeDigits(value).replace(/ /g, "") : "";
var validStudentCode = (value) => typeof value === "string" && /^1[0-9]{5}$/.test(value);
var fail = (kind = "unavailable", retryAfter = 0) => Object.assign(new Error("Student access unavailable"), { kind, retryAfter });
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var text = (value) => typeof value === "string" && value.length <= 2e3;
var number = (value) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0;
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
  if (!object(data) || data.version !== "n88-student-v3") throw fail();
  const result = { version: data.version };
  if (Object.hasOwn(data, "profile")) result.profile = fields(data.profile, { name: text, classLabel: text });
  if (Object.hasOwn(data, "grades")) {
    if (!object(data.grades)) throw fail();
    result.grades = { items: list(data.grades.items, { id: text, label: text, value: number, max: number, status: text }, ["id", "label", "value", "max"]) };
    if (Object.hasOwn(data.grades, "total")) {
      result.grades.total = fields(data.grades.total, { earned: number, possible: number });
      if (!Object.hasOwn(result.grades.total, "earned") || !Object.hasOwn(result.grades.total, "possible")) throw fail();
    }
  }
  if (Object.hasOwn(data, "work")) {
    if (!object(data.work)) throw fail();
    result.work = {};
    for (const section of ["required", "completed", "scheduled"]) if (Object.hasOwn(data.work, section)) {
      result.work[section] = list(data.work[section], { id: text, title: text, instruction: text, executionInstructions: (v) => text(v) && v.length <= 400, deliveryInstructions: (v) => text(v) && v.length <= 400, deadline: text, status: text, startDate: (v) => v === null || text(v), dueDate: (v) => v === null || text(v), completionState: (v) => ["unrecorded", "regular", "late"].includes(v) }, ["id", "title"]);
    }
  }
  return result;
}
function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch, timeoutMs = 15e3 } = {}) {
  if (typeof send !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15e3) throw fail();
  let generation = 0, retirement = 0, controller, disposed = false, lastDiagnostic = null, retireDiagnostic;
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
    retirement++;
    cancelRequest(reasons.includes(reason) ? reason : "context");
  }
  async function call(action, body, phase = "manual") {
    if (disposed) throw fail();
    cancelRequest();
    const checkpoint = generation;
    const owned = controller = new AbortController(), started = performance.now();
    let timedOut = false, statusClass = "none", recorded = false;
    const record = (outcome, reason = "visible") => {
      if (recorded || !["read", "end"].includes(action)) return;
      recorded = true;
      lastDiagnostic = Object.freeze({
        action,
        phase: action === "end" ? "end" : ["initial", "return", "manual"].includes(phase) ? phase : "manual",
        outcome,
        httpStatusClass: statusClass,
        elapsedMs: Math.min(15e3, Math.max(0, Math.floor((performance.now() - started) / 250) * 250)),
        visibility: visibility(),
        retirementReason: reason
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
        const response = await send("/api/n88/student/" + action, {
          method: action === "read" ? "GET" : "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: owned.signal,
          headers: action === "read" ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json", "X-N88-CSRF": "1" },
          ...action === "read" ? {} : { body: JSON.stringify(body) }
        });
        body = null;
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        statusClass = response.status >= 200 && response.status < 300 ? "2xx" : response.status >= 400 && response.status < 500 ? "4xx" : response.status >= 500 && response.status < 600 ? "5xx" : "other";
        if (!response.ok || action === "read" && response.status !== 200) {
          const retry = Number(response.headers?.get("Retry-After"));
          throw fail(response.status === 429 ? "rate" : [401, 403, 410].includes(response.status) ? "session" : "unavailable", response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
        }
        if (action === "end" || action === "claim") {
          record("success");
          return null;
        }
        const data = await response.json();
        if (checkpoint !== generation) throw fail("stale");
        withinDeadline();
        const projected = projectUnifiedStudentData(data);
        record("success");
        return projected;
      })(), new Promise((_, reject) => {
        owned.signal.addEventListener("abort", () => reject(fail()), { once: true });
      })]);
    } catch (error) {
      const kind = checkpoint !== generation ? "stale" : timedOut ? "timeout" : ["rate", "session"].includes(error?.kind) ? error.kind : "unavailable";
      record(kind === "session" ? "denied" : kind, timedOut ? "deadline" : "visible");
      throw fail(kind, error?.retryAfter || 0);
    } finally {
      clearTimeout(timeout);
      body = null;
      if (checkpoint === generation) {
        controller = null;
        retireDiagnostic = null;
      }
    }
  }
  return Object.freeze({
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
    captureContext: () => retirement,
    isContextCurrent: (context) => !disposed && context === retirement,
    getDiagnostic: () => lastDiagnostic ? { ...lastDiagnostic } : null,
    read: ({ phase = "manual" } = {}) => call("read", void 0, phase),
    end: () => call("end", {}, "end"),
    invalidate,
    dispose() {
      disposed = true;
      invalidate("disposed");
    }
  });
}

// src/lib/dom.js
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
var APP_ICON_URL = new URL("/n88-private/assets/brand/icon-192.png", import.meta.url).href;
var HEADER_LIGHT_URL = new URL("/n88-private/assets/brand/header-light-standard.svg", import.meta.url).href;
var HEADER_LIGHT_COMPACT_URL = new URL("/n88-private/assets/brand/header-light-compact.svg", import.meta.url).href;
var HEADER_DARK_URL = new URL("/n88-private/assets/brand/header-dark-standard.svg", import.meta.url).href;
var HEADER_DARK_COMPACT_URL = new URL("/n88-private/assets/brand/header-dark-compact.svg", import.meta.url).href;
function brandLockup({ compact = false, prominent = false, caption = "" } = {}) {
  const width = compact ? 295 : 345;
  const height = compact ? 52 : 56;
  return html`<span class="brand-lockup ${prominent ? "brand-lockup--prominent" : ""}" role="img" aria-label="${BRAND_NAME}">
    <img class="brand-lockup__image brand-lockup__image--light" src="${compact ? HEADER_LIGHT_COMPACT_URL : HEADER_LIGHT_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    <img class="brand-lockup__image brand-lockup__image--dark" src="${compact ? HEADER_DARK_COMPACT_URL : HEADER_DARK_URL}" width="${width}" height="${height}" alt="" aria-hidden="true">
    ${caption ? html`<span class="brand-lockup__caption">${caption}</span>` : ""}
  </span>`;
}

// src/views/student-portal-login.js
var escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var displayNumber = (value) => value === null ? "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" : escape(value);
function mountUnifiedStudentPortal(root, { client, readiness: readiness2 = { enabled: false } } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let disposed = false, generation = 0, busy = false, timer, cooldownUntil = 0, codeDraft = "", pendingCompletion = null, pendingForm = false, pendingMessage = "";
  let returnRead = null, endingSession = false, retiredPage = false, screen = "pending";
  const previousDir = root.getAttribute("dir");
  root.classList.add("n88-unified");
  root.dir = "rtl";
  const style = doc.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("/n88-private/styles/student-portal-login.css", import.meta.url).href;
  doc.head.append(style);
  const enabled = readiness2?.enabled === true && !!client;
  const paint = (content) => {
    if (disposed) return;
    root.innerHTML = `<header>${brandLockup({ compact: true })}</header><main>${content}<details class="n88-student-support"><summary>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u064A\u0629</summary><p>\u064A\u0645\u0643\u0646\u0643 \u0646\u0633\u062E \u0646\u062A\u064A\u062C\u0629 \u0637\u0644\u0628 \u0648\u0627\u062D\u062F \u062F\u0648\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0627\u0644\u0628. \u0644\u0627 \u062A\u064F\u0631\u0633\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627.</p><button type="button" data-copy-diagnostic>\u0646\u0633\u062E \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642</button><p role="status" data-copy-status></p><textarea readonly hidden dir="ltr" aria-label="\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u0644\u0646\u0633\u062E \u0627\u0644\u064A\u062F\u0648\u064A" data-copy-text></textarea></details></main>`;
    root.querySelector("h1")?.focus();
  };
  function entry(message = "") {
    screen = "entry";
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry first-run-auth"><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p class="n88-unified-welcome">\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0630\u064A \u0632\u0648\u0651\u062F\u0643 \u0628\u0647 \u0645\u0639\u0644\u0651\u0645\u0643.</p><form data-claim novalidate><label class="field__label" for="n88-unified-code">\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644</label><p id="n88-code-help">6 \u0623\u0631\u0642\u0627\u0645 \u062A\u0628\u062F\u0623 \u0628\u06401</p><input id="n88-unified-code" class="input first-run-auth__otp" type="text" inputmode="numeric" minlength="6" pattern="1[0-9]{5}" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="n88-code-help n88-message" required ${!enabled || cooling ? "disabled" : ""}><p id="n88-message" role="status">${escape(!enabled ? "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0644\u0645 \u062A\u064F\u0641\u0639\u0651\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0639\u062F." : cooling ? "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : message)}</p><button class="btn btn--primary" type="submit" ${!enabled || cooling ? "disabled" : ""}>\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628</button></form>${enabled ? '<button type="button" class="btn btn--ghost n88-unified-resume" data-resume>\u0645\u062A\u0627\u0628\u0639\u0629 \u062C\u0644\u0633\u0629 \u0633\u0627\u0628\u0642\u0629</button>' : ""}</section>`);
    const field = root.querySelector("[data-claim] input");
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
  function show(raw2) {
    const data = projectUnifiedStudentData(raw2);
    screen = "private";
    const profile = data.profile;
    let content = `<div class="n88-unified-profile"><div><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u062A\u064A \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629</h1>${profile?.name !== void 0 ? `<p class="n88-unified-name">${escape(profile.name)}</p>` : ""}${profile?.classLabel !== void 0 ? `<p class="n88-unified-class">${escape(profile.classLabel)}</p>` : ""}</div><div class="n88-unified-actions"><button data-read>\u062A\u062D\u062F\u064A\u062B</button><button data-end>\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629</button></div></div><div class="n88-unified-sections">`;
    if (data.grades) {
      content += `<section class="n88-unified-grades"><h2>\u062F\u0631\u062C\u0627\u062A\u064A</h2><div class="n88-unified-table"><table><thead><tr><th scope="col">\u0627\u0644\u0628\u0646\u062F</th><th scope="col">\u0627\u0644\u062F\u0631\u062C\u0629</th><th scope="col">\u0645\u0646</th></tr></thead><tbody>${data.grades.items.map((item) => `<tr><th scope="row">${escape(item.label)}${item.status !== void 0 ? `<small>${escape({ recorded: "\u0645\u0631\u0635\u0648\u062F\u0629", unrecorded: "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" }[item.status] || "")}</small>` : ""}</th><td>${displayNumber(item.value)}</td><td>${displayNumber(item.max)}</td></tr>`).join("")}</tbody></table></div>${data.grades.total ? `<p class="n88-unified-total">\u0627\u0644\u0645\u062C\u0645\u0648\u0639: <b dir="ltr">${displayNumber(data.grades.total.earned)} / ${displayNumber(data.grades.total.possible)}</b></p>` : ""}</section>`;
    }
    for (const [key, label] of Object.entries({ required: "\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646\u064A", completed: "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629", scheduled: "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0642\u0627\u062F\u0645\u0629" })) {
      if (!Object.hasOwn(data.work || {}, key)) continue;
      content += `<section data-section="${key}"><h2>${label}<span class="n88-unified-count" aria-label="\u0639\u062F\u062F \u0627\u0644\u0623\u0639\u0645\u0627\u0644">${data.work[key].length}</span></h2>${data.work[key].length ? data.work[key].map((item) => {
        const detail = `${item.executionInstructions !== void 0 ? `<h3>\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630</h3><p class="n88-guidance-text">${escape(item.executionInstructions)}</p>` : ""}${item.deliveryInstructions !== void 0 ? `<h3>\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u0633\u0644\u064A\u0645</h3><p class="n88-guidance-text">${escape(item.deliveryInstructions)}</p>` : ""}${item.instruction !== void 0 ? `<p class="n88-unified-instruction">${escape(item.instruction)}</p>` : ""}${item.startDate ? `<p>\u064A\u0628\u062F\u0623: <span dir="ltr">${escape(item.startDate)}</span></p>` : ""}${item.dueDate ? `<p>\u0627\u0644\u062A\u0633\u0644\u064A\u0645: <span dir="ltr">${escape(item.dueDate)}</span></p>` : ""}${item.completionState !== void 0 ? `<p>${escape({ unrecorded: "\u0644\u0645 \u064A\u064F\u0631\u0635\u062F \u0625\u0646\u062C\u0627\u0632", regular: "\u0645\u0643\u062A\u0645\u0644", late: "\u0645\u0643\u062A\u0645\u0644 \u0645\u062A\u0623\u062E\u0631" }[item.completionState])}</p>` : ""}${item.deadline !== void 0 ? `<p>\u0627\u0644\u0645\u0648\u0639\u062F: <span dir="ltr">${escape(item.deadline)}</span></p>` : ""}${item.status !== void 0 ? `<p>${escape(item.status)}</p>` : ""}`;
        return detail ? `<details class="n88-unified-work"><summary><span>${escape(item.title)}</span><span class="n88-unified-detail-hint">\u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644</span></summary><div class="n88-unified-detail">${detail}</div></details>` : `<article class="n88-unified-work"><h3>${escape(item.title)}</h3></article>`;
      }).join("") : '<p class="n88-unified-empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0639\u0645\u0627\u0644 \u0645\u0646\u0634\u0648\u0631\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.</p>'}</section>`;
    }
    paint(content + "</div>");
  }
  function pending(ending = false) {
    screen = ending ? "end-pending" : "pending";
    paint(ending ? '<section class="n88-unified-entry" aria-busy="true"><h1 tabindex="-1">\u062C\u0627\u0631\u064D \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629\u2026</h1><p role="status" aria-live="polite">\u0623\u064F\u062E\u0641\u064A\u062A \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629. \u0646\u0646\u062A\u0638\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062E\u0627\u062F\u0645 \u0644\u0645\u062F\u0629 \u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 15 \u062B\u0627\u0646\u064A\u0629.</p></section>' : '<section class="n88-unified-entry n88-unified-pending"><h1 tabindex="-1">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p role="status" aria-live="polite">\u0644\u062D\u0638\u0627\u062A \u0648\u0646\u062C\u0647\u0651\u0632 \u0645\u0633\u0627\u062D\u062A\u0643\u2026</p><div class="n88-unified-progress" role="progressbar" aria-label="\u062C\u0627\u0631\u064D \u062A\u062C\u0647\u064A\u0632 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628" aria-busy="true"></div></section>');
  }
  function endUncertain() {
    recovery("\u062A\u0639\u0630\u0651\u0631 \u062A\u0623\u0643\u064A\u062F \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u062F\u0649 \u0627\u0644\u062E\u0627\u062F\u0645. \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0645\u062E\u0641\u064A\u0629 \u0647\u0646\u0627. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u062C\u062F\u062F\u064B\u0627 \u0642\u0628\u0644 \u0623\u064A \u0645\u062D\u0627\u0648\u0644\u0629 \u0625\u0646\u0647\u0627\u0621 \u0623\u062E\u0631\u0649.", true);
  }
  function diagnosticText() {
    const d = client?.getDiagnostic?.();
    if (!d || !["read", "end"].includes(d.action) || !["initial", "return", "manual", "end"].includes(d.phase) || !["success", "denied", "rate", "unavailable", "timeout", "stale"].includes(d.outcome) || !["none", "2xx", "4xx", "5xx", "other"].includes(d.httpStatusClass) || !["visible", "hidden"].includes(d.visibility) || !["visible", "hidden", "pagehide", "disposed", "context", "superseded", "deadline"].includes(d.retirementReason) || !Number.isFinite(d.elapsedMs)) return null;
    return JSON.stringify({
      action: d.action,
      phase: d.phase,
      outcome: d.outcome,
      httpStatusClass: d.httpStatusClass,
      elapsedMs: Math.min(15e3, Math.max(0, Math.floor(d.elapsedMs / 250) * 250)),
      visibility: d.visibility,
      retirementReason: d.retirementReason
    });
  }
  async function copyDiagnostic(button) {
    const text2 = diagnosticText(), checkpoint = generation;
    const status = root.querySelector("[data-copy-status]"), fallback = root.querySelector("[data-copy-text]");
    const current = () => !disposed && doc.visibilityState !== "hidden" && checkpoint === generation && root.contains(button) && diagnosticText() === text2;
    if (!current()) return;
    fallback.hidden = true;
    fallback.value = "";
    status.textContent = "";
    if (!text2) {
      status.textContent = "\u0644\u0627 \u062A\u062A\u0648\u0641\u0631 \u0646\u062A\u064A\u062C\u0629 \u0645\u0643\u062A\u0645\u0644\u0629 \u0644\u0644\u0646\u0633\u062E \u0628\u0639\u062F.";
      return;
    }
    button.disabled = true;
    try {
      await win.navigator.clipboard.writeText(text2);
      if (current()) status.textContent = "\u062A\u0645 \u0646\u0633\u062E \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642.";
    } catch {
      if (current()) {
        fallback.hidden = false;
        fallback.value = text2;
        status.textContent = "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A. \u064A\u0645\u0643\u0646\u0643 \u0646\u0633\u062E \u0627\u0644\u0646\u0635 \u064A\u062F\u0648\u064A\u064B\u0627.";
      }
    } finally {
      if (!disposed && root.contains(button)) button.disabled = false;
    }
  }
  function inlineEntry(message = "", invalid = false) {
    const form = root.querySelector("[data-claim]");
    if (!form) return;
    const cooling = Date.now() < cooldownUntil, field = form.querySelector("input");
    form.setAttribute("aria-busy", String(busy));
    field.disabled = !enabled || busy || cooling;
    field.setAttribute("aria-invalid", String(invalid));
    form.querySelector("[type=submit]").disabled = !enabled || busy || cooling;
    form.querySelector("[type=submit]").textContent = busy ? "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642\u2026" : "\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628";
    root.querySelector("[data-resume]").disabled = busy || cooling;
    form.querySelector("[role=status]").textContent = cooling ? "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : message;
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => inlineEntry("\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627."), Math.max(1, cooldownUntil - Date.now()));
  }
  async function run(action, ending = false, sameForm = false, resuming = false) {
    if (disposed || busy || !enabled || doc.visibilityState === "hidden" || Date.now() < cooldownUntil) return;
    returnRead = null;
    endingSession = ending;
    busy = true;
    const checkpoint = ++generation, context = client.captureContext?.();
    pendingForm = sameForm;
    pendingMessage = resuming ? "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629\u2026" : "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632\u2026";
    if (sameForm) inlineEntry(pendingMessage);
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
        const field = root.querySelector("[data-claim] input");
        if (field) field.value = "";
      }
      pendingCompletion = { checkpoint, context, data, ending, sameForm, resuming };
      adoptCompletion();
    } catch (error) {
      if (disposed || checkpoint !== generation) return;
      if (error?.kind === "rate") cooldownUntil = Date.now() + Math.min(300, Math.max(1, error.retryAfter || 30)) * 1e3;
      if (client.isContextCurrent && !client.isContextCurrent(context)) {
        clear();
        return;
      }
      if (error?.viewDeadline) client.invalidate?.("deadline");
      pendingCompletion = { checkpoint, context: error?.viewDeadline ? client.captureContext?.() : context, errorKind: error?.kind || "unavailable", claimState: error?.claimState, ending, sameForm, resuming };
      adoptCompletion();
    } finally {
      if (checkpoint === generation && !pendingCompletion) {
        busy = false;
        pendingForm = false;
        if (sameForm && root.querySelector("[data-claim]")) {
          const m = root.querySelector("#n88-message").textContent;
          inlineEntry(m, root.querySelector("input").getAttribute("aria-invalid") === "true");
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
    busy = false;
    pendingForm = false;
    endingSession = false;
    if (result.errorKind) {
      const rejected = !result.resuming && result.claimState === "rejected" && result.errorKind === "session";
      const message = rejected ? "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632. \u062A\u062D\u0642\u0642 \u0645\u0646\u0647 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0651\u0645\u0643." : result.errorKind === "session" ? "\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0623\u0648 \u0627\u0646\u062A\u0647\u062A. \u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0645\u0643." : result.claimState === "accepted" ? "\u0642\u064F\u0628\u0644 \u0627\u0644\u0631\u0645\u0632\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0651\u0631 \u0639\u0631\u0636 \u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u0627\u0636\u063A\u0637 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0644\u0625\u0639\u0627\u062F\u0629 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062C\u0644\u0633\u0629." : result.claimState === "uncertain" ? "\u062A\u0639\u0630\u0651\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062F\u062E\u0648\u0644. \u0627\u0636\u063A\u0637 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0642\u0628\u0644 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 \u0645\u062C\u062F\u062F\u064B\u0627." : "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u064A\u0645\u0643\u0646\u0643 \u0645\u062A\u0627\u0628\u0639\u0629 \u062C\u0644\u0633\u0629 \u0633\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627.";
      if (result.ending) endUncertain();
      else if ((result.resuming || !result.sameForm) && result.errorKind !== "session") recovery("\u062A\u0639\u0630\u0651\u0631 \u0641\u062A\u062D \u0645\u0633\u0627\u062D\u062A\u0643 \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.");
      else if (["accepted", "uncertain"].includes(result.claimState) && result.errorKind !== "session") recovery(message);
      else if (result.sameForm && root.querySelector("[data-claim]")) inlineEntry(message, rejected);
      else if (result.sameForm && result.claimState !== "rejected" && result.errorKind !== "session") recovery(message);
      else entry(message);
    } else {
      codeDraft = "";
      if (result.ending) {
        entry("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629.");
        screen = "end-ack";
      } else show(result.data);
    }
  }
  const submit = (event) => {
    if (!event.target.matches("[data-claim]")) return;
    event.preventDefault();
    if (busy || !enabled) return;
    const input2 = root.querySelector("input");
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
    if (event.target.closest("[data-resume]")) void run(() => client.read({ phase: "manual" }), false, false, true);
    if (event.target.closest("[data-read]")) void run(() => client.read({ phase: "manual" }), false, false, true);
    if (event.target.closest("[data-end]")) void run(() => client.end(), true);
  };
  function clear(preserveDraft = false, reason = "context") {
    returnRead = null;
    if (preserveDraft) {
      const field = root.querySelector("[data-claim] input");
      if (field) codeDraft = normalizeStudentCode(field.value);
    } else codeDraft = "";
    generation++;
    busy = false;
    endingSession = false;
    pendingForm = false;
    pendingCompletion = null;
    pendingMessage = "";
    clearTimeout(timer);
    client?.invalidate?.(reason);
    if (preserveDraft && root.querySelector("[data-claim]")) inlineEntry();
    else recovery("\u0644\u0645 \u062A\u064F\u062D\u0633\u0645 \u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u0644\u0633\u0629. \u062A\u062D\u0642\u0651\u0642 \u0645\u062C\u062F\u062F\u064B\u0627 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.");
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
    if (doc.visibilityState === "hidden") {
      const fallback = root.querySelector("[data-copy-text]");
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
      if (returnRead) return;
      const shouldRead = !endingSession && (root.querySelector("[data-end]") || busy);
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
      } else adoptCompletion();
    }
  };
  const pageshow = () => {
    if (retiredPage && doc.visibilityState !== "hidden") {
      retiredPage = false;
      void run(() => client.read({ phase: "return" }), false, false, true);
    }
  };
  root.addEventListener("beforeinput", beforeInput);
  root.addEventListener("paste", paste);
  root.addEventListener("submit", submit);
  root.addEventListener("input", input);
  root.addEventListener("click", click);
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
  return { ready, clear, refresh: () => run(() => client.read({ phase: "manual" }), false, false, true), dispose() {
    if (disposed) return;
    clear(false, "disposed");
    disposed = true;
    clearTimeout(timer);
    client?.dispose?.();
    root.replaceChildren();
    style.remove();
    root.classList.remove("n88-unified");
    if (previousDir === null) root.removeAttribute("dir");
    else root.setAttribute("dir", previousDir);
    root.removeEventListener("beforeinput", beforeInput);
    root.removeEventListener("paste", paste);
    root.removeEventListener("submit", submit);
    root.removeEventListener("input", input);
    root.removeEventListener("click", click);
    win.removeEventListener("pagehide", hide);
    win.removeEventListener("pageshow", pageshow);
    doc.removeEventListener("visibilitychange", visible);
  } };
}

// drafts/n88-student-portal/client/student-entry.js
var readiness = Object.freeze({ enabled: true, mode: "pilot" });
mountUnifiedStudentPortal(document.getElementById("student-portal"), { client: createUnifiedStudentPortalClient(), readiness });
