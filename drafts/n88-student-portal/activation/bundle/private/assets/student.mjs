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
function createUnifiedStudentPortalClient({ fetch: send = globalThis.fetch } = {}) {
  if (typeof send !== "function") throw fail();
  let generation = 0, controller, disposed = false;
  function invalidate() {
    generation++;
    controller?.abort();
    controller = null;
  }
  async function call(action, body) {
    if (disposed) throw fail();
    invalidate();
    const checkpoint = generation;
    const owned = controller = new AbortController();
    const timeout = setTimeout(() => owned.abort(), 15e3);
    try {
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
      if (!response.ok) {
        const retry = Number(response.headers?.get("Retry-After"));
        throw fail(response.status === 429 ? "rate" : [401, 403, 410].includes(response.status) ? "session" : "unavailable", response.status === 429 ? Math.min(300, Math.max(1, Number.isFinite(retry) ? retry : 30)) : 0);
      }
      if (action === "end" || action === "claim") return null;
      const data = await response.json();
      if (checkpoint !== generation) throw fail("stale");
      return projectUnifiedStudentData(data);
    } catch (error) {
      throw fail(checkpoint !== generation ? "stale" : ["rate", "session"].includes(error?.kind) ? error.kind : "unavailable", error?.retryAfter || 0);
    } finally {
      clearTimeout(timeout);
      body = null;
      if (checkpoint === generation) controller = null;
    }
  }
  return Object.freeze({
    claim(value) {
      let code = normalizeStudentCode(value);
      if (!validStudentCode(code)) return Promise.reject(fail("format"));
      const pending = call("claim", { code }).then(() => call("read"));
      code = "";
      return pending;
    },
    read: () => call("read"),
    end: () => call("end", {}),
    invalidate,
    dispose() {
      disposed = true;
      invalidate();
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

// src/views/student-portal-login.js
var escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var displayNumber = (value) => value === null ? "\u0644\u0645 \u062A\u064F\u0631\u0635\u062F" : escape(value);
function mountUnifiedStudentPortal(root, { client, readiness: readiness2 = { enabled: false } } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let disposed = false, generation = 0, busy = false, timer, cooldownUntil = 0;
  const previousDir = root.getAttribute("dir");
  root.classList.add("n88-unified");
  root.dir = "rtl";
  const style = doc.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("../styles/student-portal-login.css", import.meta.url).href;
  doc.head.append(style);
  const enabled = readiness2?.enabled === true && !!client;
  const paint = (content) => {
    if (disposed) return;
    root.innerHTML = `<header>${brandLockup({ compact: true })}<span class="n88-unified-space">\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628</span></header><main>${content}</main>`;
    root.querySelector("h1")?.focus();
  };
  function entry(message = "") {
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry"><h1 tabindex="-1">\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628</h1><p id="n88-code-help">\u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0627\u0644\u0634\u062E\u0635\u064A: 6 \u0623\u0631\u0642\u0627\u0645 \u064A\u0628\u062F\u0623 \u0628\u0627\u0644\u0631\u0642\u0645 1. \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 0\u20139.</p><form data-claim><label for="n88-unified-code">\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644</label><input id="n88-unified-code" type="text" inputmode="numeric" minlength="6" maxlength="6" pattern="1[0-9]{5}" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="n88-code-help n88-message" required ${!enabled || cooling ? "disabled" : ""}><p id="n88-message" role="status">${escape(!enabled ? "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0644\u0645 \u062A\u064F\u0641\u0639\u0651\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0639\u062F." : cooling ? "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627." : message)}</p><button type="submit" ${!enabled || cooling ? "disabled" : ""}>\u062F\u062E\u0648\u0644 \u0627\u0644\u0637\u0627\u0644\u0628</button></form></section>`);
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => entry("\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627."), Math.max(1, cooldownUntil - Date.now()));
  }
  function show(raw2) {
    const data = projectUnifiedStudentData(raw2);
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
  async function run(action, ending = false) {
    if (disposed || busy || !enabled || Date.now() < cooldownUntil) return;
    busy = true;
    const checkpoint = ++generation;
    paint('<h1 tabindex="-1">\u062C\u0627\u0631\u064D \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u2026</h1><p role="status">\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631</p>');
    try {
      const data = await action();
      if (disposed || checkpoint !== generation) return;
      if (ending) entry("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629.");
      else show(data);
    } catch (error) {
      if (disposed || checkpoint !== generation) return;
      if (error?.kind === "rate") cooldownUntil = Date.now() + Math.min(300, Math.max(1, error.retryAfter || 30)) * 1e3;
      entry(error?.kind === "session" ? "\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0623\u0648 \u0627\u0646\u062A\u0647\u062A. \u0623\u062F\u062E\u0644 \u0631\u0645\u0632\u0643 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0645\u0639\u0644\u0645\u0643." : "\u062A\u0639\u0630\u0651\u0631 \u0641\u062A\u062D \u0627\u0644\u0645\u0633\u0627\u062D\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0623\u0648 \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627.");
    } finally {
      if (checkpoint === generation) busy = false;
    }
  }
  const submit = (event) => {
    if (!event.target.matches("[data-claim]")) return;
    event.preventDefault();
    if (busy || !enabled) return;
    const input2 = root.querySelector("input");
    let code = normalizeStudentCode(input2.value);
    input2.value = "";
    if (!validStudentCode(code)) {
      code = "";
      entry("\u0627\u0633\u062A\u062E\u062F\u0645 6 \u0623\u0631\u0642\u0627\u0645 \u064A\u0628\u062F\u0623 \u0628\u0627\u0644\u0631\u0642\u0645 1.");
      root.querySelector("input")?.setAttribute("aria-invalid", "true");
      return;
    }
    void run(() => {
      const pending = client.claim(code);
      code = "";
      return pending;
    });
  };
  const input = (event) => {
    if (event.target.matches("[data-claim] input")) {
      event.target.setCustomValidity("");
      event.target.removeAttribute("aria-invalid");
      event.target.value = normalizeStudentCode(event.target.value);
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
      field.value = "";
      field.setCustomValidity("\u0627\u0633\u062A\u062E\u062F\u0645 \u0631\u0645\u0632\u064B\u0627 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645 \u062F\u0648\u0646 \u0627\u062E\u062A\u0635\u0627\u0631.");
      field.setAttribute("aria-invalid", "true");
    } else if (pasted) {
      event.preventDefault();
      field.value = normalizeStudentCode(proposed);
      input({ target: field });
    }
  };
  const beforeInput = (event) => rejectOverflow(event);
  const paste = (event) => rejectOverflow(event, true);
  const click = (event) => {
    if (event.target.closest("[data-read]")) void run(() => client.read());
    if (event.target.closest("[data-end]")) void run(() => client.end(), true);
  };
  function clear() {
    generation++;
    busy = false;
    clearTimeout(timer);
    client?.invalidate?.();
    entry();
  }
  const hide = () => clear();
  const visible = () => {
    if (doc.visibilityState === "hidden") clear();
  };
  const pageshow = (event) => {
    if (event.persisted) {
      clear();
      if (enabled) void run(() => client.read());
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
  entry();
  const ready = enabled ? run(() => client.read()) : Promise.resolve();
  return { ready, clear, refresh: () => run(() => client.read()), dispose() {
    if (disposed) return;
    clear();
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
var readiness = Object.freeze({ enabled: false });
mountUnifiedStudentPortal(document.getElementById("student-portal"), { client: createUnifiedStudentPortalClient(), readiness });
