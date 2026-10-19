// drafts/n88-student-portal/activation/node-globals.mjs
import { Buffer as Buffer2 } from "node:buffer";
import process from "node:process";
if (!globalThis.Buffer) globalThis.Buffer = Buffer2;
if (!globalThis.process) globalThis.process = process;

// drafts/n88-student-portal/existing-host.mjs
import { Buffer as Buffer13 } from "node:buffer";
import { createHash as createHash9 } from "node:crypto";
import pg from "pg";

// drafts/n88-student-portal/deployment.inactive.json
var deployment_inactive_default = {
  aiAuthored: true,
  enabled: false,
  entry: "supabase/functions/n88-student-portal/index.ts",
  listener: "Deno.serve Web Request; disabled without N88_ENABLED=true",
  environmentNames: [
    "N88_ENABLED",
    "N88_PUBLIC_ORIGIN",
    "N88_DATABASE_URL",
    "N88_HMAC_KEY",
    "N88_AUTH_URL",
    "N88_AUTH_API_KEY",
    "N88_INGRESS_KEY",
    "N88_SERVICE_REVISION",
    "N88_NUMERIC_KEY",
    "N88_RESERVATION_KEY",
    "N88_ROLLOUT_MODE",
    "N88_PILOT_BINDING"
  ],
  requiredTrustedPorts: [],
  requiredReadbacks: [
    "private SQL/helper identities + ACL/FKs",
    "existing Auth issuer/JWKS/user/session",
    "Cloudflare external ingress + log custody + TLS",
    "task_guidance exact private metadata schema/RLS/role/constraints after separately authorized staged amendment"
  ],
  sourceOnly: true,
  routes: [
    "/api/n88/teacher/class/list",
    "/api/n88/teacher/class/issue-missing",
    "/api/n88/teacher/class/rotate",
    "/api/n88/teacher/class/revoke",
    "/api/n88/teacher/class/visibility",
    "/api/n88/student/claim",
    "/api/n88/student/read",
    "/api/n88/student/end",
    "/api/n88/teacher/class/guidance-list",
    "/api/n88/teacher/class/guidance-save"
  ],
  limits: {
    contexts: 10,
    memberships: 2e3,
    credentials: 1e4,
    sessions: 3e3,
    publications: 2e3,
    rates: 1e4,
    total: 3e4,
    bytes: 8388608,
    rowBytes: 4096
  },
  timing: {
    acquireMs: 1e3,
    transactionMs: 8e3,
    cleanupMs: 400,
    statementMs: 3e3,
    lockMs: 1e3
  },
  canonicalBounds: {
    maxRows: 2e3,
    maxBytes: 2097152
  },
  pool: {
    max: 2,
    connectionTimeoutMillis: 1e3,
    boundedAdmission: true
  },
  privateLogs: {
    accessLog: "disabled for private paths",
    requestBodies: false,
    headers: false,
    sqlParameters: false,
    sqlErrorDetail: false,
    metrics: "fixed operation/status counters only; no owner/student/path/token labels"
  },
  serviceRevision: "n88-integrated-class-v1",
  ingress: {
    entry: "drafts/n88-student-portal/cloudflare-entry.mjs",
    environmentNames: [
      "N88_ENABLED",
      "N88_PUBLIC_ORIGIN",
      "N88_EDGE_URL",
      "N88_INGRESS_KEY"
    ],
    trust: "Cloudflare external HTTPS cf metadata; deny CF-Worker; signed allowlist/body/source/time/nonce; durable replay receipt"
  },
  credentialContract: {
    format: "six-v1",
    pattern: "^1[0-9]{5}$",
    capacity: 1e5
  },
  stagedRollout: {
    phase: "pilot",
    defaultMode: "off",
    publicEnabled: false,
    maxOwners: 1,
    maxStudents: 2,
    privateBinding: "protected CLI env-file only",
    fullHostedAcceptance: "NOT_RUN",
    fullPublicRollout: "NOT_RUN"
  }
};

// drafts/n88-student-portal/web-entry.mjs
import { Buffer as Buffer12 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual3 } from "node:crypto";

// drafts/n88-student-portal/runtime.mjs
import { Buffer as Buffer11 } from "node:buffer";
import { isIP } from "node:net";

// drafts/n88-student-portal/task-guidance.mjs
import { createHash as createHash2 } from "node:crypto";

// src/lib/score-foundation.js
function scoreCents(value, { allowBlank = false } = {}) {
  if (allowBlank && (value === null || value === void 0 || value === "")) return null;
  const number2 = Number(value);
  if (!Number.isFinite(number2) || number2 < 0 || Math.abs(Math.round(number2 * 100) - number2 * 100) > 1e-7) {
    throw new RangeError("Score must be a non-negative number with at most two decimals");
  }
  return Math.round(number2 * 100);
}
var fromScoreCents = (cents) => cents === null ? null : cents / 100;
function normalizeSubitemDatesAndPoints(row) {
  scoreCents(row.value);
  const date3 = (input) => {
    if (input == null || input === "") return null;
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input) {
      throw new RangeError("\u0627\u0633\u062A\u062E\u062F\u0645 \u062A\u0627\u0631\u064A\u062E\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627");
    }
    return input;
  };
  const startDate = date3(row.startDate), dueDate = date3(row.dueDate);
  if (startDate && dueDate && dueDate < startDate) throw new RangeError("\u0645\u0648\u0639\u062F \u0627\u0644\u062A\u0633\u0644\u064A\u0645 \u0644\u0627 \u064A\u0633\u0628\u0642 \u0627\u0644\u0628\u062F\u0627\u064A\u0629");
  const latePoints = row.latePoints == null || row.latePoints === "" ? null : Number(row.latePoints);
  if (latePoints !== null && scoreCents(latePoints) > scoreCents(row.value)) {
    throw new RangeError("\u062F\u0631\u062C\u0629 \u0627\u0644\u062A\u0623\u062E\u0631 \u0644\u0627 \u062A\u0632\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u062F\u0631\u062C\u0629 \u0627\u0644\u0639\u0627\u062F\u064A\u0629");
  }
  return { startDate, dueDate, latePoints };
}
function subitemCompletionState(row) {
  if (!row || row.deleted || row.checked !== true) return "unrecorded";
  return row.completionState === "late" ? "late" : "regular";
}
function subitemSelectedPoints(definition, completion) {
  const state = subitemCompletionState(completion);
  if (state === "unrecorded") return null;
  return state === "late" ? definition.latePoints ?? definition.value : definition.value;
}
function projectSubitemScore(item, definitions, completions, manualInput, { studentId = null, ownerId = null } = {}) {
  if (!studentId && completions.some((row) => row.studentId)) {
    throw new Error("Student identity is required for score projection");
  }
  const maximum = scoreCents(item.max);
  const active5 = definitions.filter((row) => !row.deleted && (!item.id || row.itemId === item.id) && (!ownerId || !row.ownerId || row.ownerId === ownerId));
  const selected = new Map(completions.filter((row) => (!studentId || row.studentId === studentId) && (!ownerId || !row.ownerId || row.ownerId === ownerId) && !row.deleted && row.checked === true && active5.some((definition) => definition.id === row.subitemId)).map((row) => [row.subitemId, row]));
  const derivedCents = Math.min(maximum, active5.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + Math.min(scoreCents(row.value), scoreCents(subitemSelectedPoints(row, selected.get(row.id)))), 0));
  const requestedManual = scoreCents(manualInput, { allowBlank: true });
  const acceptedManual = requestedManual === null ? null : Math.min(requestedManual, Math.max(0, maximum - derivedCents));
  const recorded = selected.size > 0 || requestedManual !== null;
  return {
    derivedValue: fromScoreCents(derivedCents),
    manualValue: fromScoreCents(acceptedManual),
    value: recorded ? fromScoreCents(Math.min(maximum, derivedCents + (acceptedManual ?? 0))) : null,
    manualClamped: requestedManual !== null && acceptedManual !== requestedManual
  };
}

// src/models.js
var GRADES = [
  { v: 1, label: "\u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 2, label: "\u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 3, label: "\u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 4, label: "\u0627\u0644\u0631\u0627\u0628\u0639 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 5, label: "\u0627\u0644\u062E\u0627\u0645\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 6, label: "\u0627\u0644\u0633\u0627\u062F\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A", stage: "\u0627\u0628\u062A\u062F\u0627\u0626\u064A" },
  { v: 7, label: "\u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0645\u062A\u0648\u0633\u0637", stage: "\u0645\u062A\u0648\u0633\u0637" },
  { v: 8, label: "\u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0645\u062A\u0648\u0633\u0637", stage: "\u0645\u062A\u0648\u0633\u0637" },
  { v: 9, label: "\u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u0645\u062A\u0648\u0633\u0637", stage: "\u0645\u062A\u0648\u0633\u0637" },
  { v: 10, label: "\u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u062B\u0627\u0646\u0648\u064A", stage: "\u062B\u0627\u0646\u0648\u064A" },
  { v: 11, label: "\u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u062B\u0627\u0646\u0648\u064A", stage: "\u062B\u0627\u0646\u0648\u064A" },
  { v: 12, label: "\u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u062B\u0627\u0646\u0648\u064A", stage: "\u062B\u0627\u0646\u0648\u064A" }
];
var gradeLabel = (v) => GRADES.find((g) => g.v === Number(v))?.label ?? "";
var sectionLabel = (sec) => sec ? `${gradeLabel(sec.grade)} / ${sec.label}` : "";
function normalizeSectionLabel(label) {
  return String(label ?? "").trim().replace(/\s+/g, " ").replace(/[٠-٩]/g, (digit) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(digit))).replace(/[إأآٱ]/g, "\u0627");
}
function normalizeSearchText(text2) {
  return normalizeSectionLabel(text2).toLowerCase();
}
function isValidRecessPosition(afterPeriod, count) {
  const position = Number(afterPeriod);
  const periods = Number(count);
  return Number.isInteger(position) && Number.isInteger(periods) && position >= 1 && position < periods;
}
function generateAdvancedPeriods(config) {
  const parseTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmt = (mins) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  };
  const periods = [];
  const count = Number(config.count) || 0;
  const rules = config.recess?.enabled && config.recess?.rules?.length ? config.recess.rules.filter((rule) => isValidRecessPosition(rule.afterPeriod, count)) : [];
  const globalRecessAfter = isValidRecessPosition(config.recess?.afterPeriod, count) ? Number(config.recess.afterPeriod) : null;
  if (!rules.length) {
    let cursor = parseTime(config.firstPeriodStart);
    for (let i = 1; i <= count; i++) {
      const start = cursor;
      const end = start + config.periodDuration;
      periods.push({ period: i, start: fmt(start), end: fmt(end) });
      cursor = end;
      if (config.recess?.enabled && i === globalRecessAfter) {
        cursor += (config.recess.duration || 0) + (config.recess.transition || 0);
      } else {
        cursor += config.gap || 0;
      }
    }
    return periods;
  }
  const paths = [
    ...rules.map((r) => ({ grades: r.grades, afterPeriod: r.afterPeriod })),
    { grades: null, afterPeriod: Math.max(...rules.map((r) => r.afterPeriod)) }
    // Default follows the latest break
  ];
  for (let path of paths) {
    let cursor = parseTime(config.firstPeriodStart);
    for (let i = 1; i <= count; i++) {
      const start = cursor;
      const end = start + config.periodDuration;
      const p = { period: i, start: fmt(start), end: fmt(end) };
      if (path.grades) p.grades = path.grades;
      periods.push(p);
      cursor = end;
      if (config.recess?.enabled && i === path.afterPeriod) {
        cursor += (config.recess.duration || 0) + (config.recess.transition || 0);
      } else {
        cursor += config.gap || 0;
      }
    }
  }
  const unique = [];
  const sig = (p) => `${p.period}|${p.start}|${p.end}`;
  const grouped = {};
  for (let p of periods) {
    const s = sig(p);
    if (!grouped[s]) grouped[s] = [];
    if (p.grades) grouped[s].push(...p.grades);
    else grouped[s].isDefault = true;
  }
  for (let s in grouped) {
    const [periodStr, startStr, endStr] = s.split("|");
    const p = { period: Number(periodStr), start: startStr, end: endStr };
    if (!grouped[s].isDefault) {
      p.grades = Array.from(new Set(grouped[s])).sort((a, b) => a - b);
    }
    unique.push(p);
  }
  unique.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    if (a.grades && !b.grades) return -1;
    if (!a.grades && b.grades) return 1;
    return 0;
  });
  return unique;
}
var TIMING_PRESETS = {
  summer: {
    type: "summer",
    gap: 0,
    assembly: { enabled: true, start: "06:45", duration: 15 },
    firstPeriodStart: "07:00",
    periodDuration: 45,
    count: 7,
    recess: {
      enabled: true,
      duration: 20,
      transition: 5,
      rules: [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }]
    }
  },
  winter: {
    type: "winter",
    gap: 0,
    assembly: { enabled: true, start: "07:15", duration: 15 },
    firstPeriodStart: "07:30",
    periodDuration: 45,
    count: 7,
    recess: {
      enabled: true,
      duration: 20,
      transition: 0,
      rules: [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }]
    }
  },
  ramadan: {
    type: "ramadan",
    gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: "09:00",
    periodDuration: 35,
    count: 6,
    recess: { enabled: false }
  },
  remote: {
    type: "remote",
    gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: "07:00",
    periodDuration: 30,
    count: 8,
    recess: { enabled: false }
  },
  custom: {
    type: "custom",
    gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: "07:00",
    periodDuration: 40,
    count: 7,
    recess: { enabled: false }
  },
  hybrid: {
    type: "hybrid",
    gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: "07:00",
    periodDuration: 30,
    count: 8,
    recess: { enabled: false }
  }
};
var DEFAULT_TIME_PROFILE_IDS = Object.freeze({
  summer: "time-profile:default:summer",
  winter: "time-profile:default:winter",
  ramadan: "time-profile:default:ramadan",
  hybrid: "time-profile:default:hybrid"
});
var DEFAULT_TIME_PROFILES = [
  {
    id: DEFAULT_TIME_PROFILE_IDS.summer,
    name: "\u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0635\u064A\u0641\u064A",
    periods: generateAdvancedPeriods(TIMING_PRESETS.summer),
    overrides: { config: TIMING_PRESETS.summer }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.winter,
    name: "\u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0634\u062A\u0648\u064A",
    periods: generateAdvancedPeriods(TIMING_PRESETS.winter),
    overrides: { config: TIMING_PRESETS.winter }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.ramadan,
    name: "\u062A\u0648\u0642\u064A\u062A \u0631\u0645\u0636\u0627\u0646",
    periods: generateAdvancedPeriods(TIMING_PRESETS.ramadan),
    overrides: { config: TIMING_PRESETS.ramadan }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.hybrid,
    name: "\u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0645\u062F\u0645\u062C",
    periods: generateAdvancedPeriods(TIMING_PRESETS.hybrid),
    overrides: { config: TIMING_PRESETS.hybrid, remote: generateAdvancedPeriods(TIMING_PRESETS.remote) }
  }
];
var collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });
var sortByOrder = (arr) => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || collator.compare(a.name ?? "", b.name ?? ""));
function netPoints(logs, kind = null) {
  let n = 0;
  for (const l of logs) {
    if (l.deleted) continue;
    if (kind && l.kind !== kind) continue;
    n += l.delta;
  }
  return n;
}
var absenceCount = (records) => records.filter((a) => !a.deleted && a.status === "absent").length;
function itemScore(item, ctx) {
  const hasAutomaticProjection = Object.prototype.hasOwnProperty.call(ctx.automaticByItem ?? {}, item.id);
  const automatic = hasAutomaticProjection ? ctx.automaticByItem[item.id] : null;
  if (item.auto === "participation") {
    if (hasAutomaticProjection && !automatic) return null;
    if (!(hasAutomaticProjection ? automatic.classHasParticipation : ctx.classHasParticipation)) return null;
    const pts = Math.max(0, netPoints(hasAutomaticProjection ? automatic.logs : ctx.logs ?? [], "participation"));
    return Math.min(item.max, pts * (item.perPoint ?? 1));
  }
  if (item.auto === "attendance") {
    if (hasAutomaticProjection && !automatic) return null;
    const attendance = hasAutomaticProjection ? automatic.attendance : ctx.attendance;
    if (!attendance?.length) return null;
    const misses = absenceCount(attendance);
    return Math.max(0, item.max - misses * (item.penalty ?? 1));
  }
  const s = ctx.scoresByItem?.[item.id];
  if (!s || s.deleted || s.value === null || s.value === void 0) return null;
  const v = Number(s.value);
  if (!Number.isFinite(v)) return null;
  return Math.min(item.max, Math.max(0, v));
}
function studentTotal(items, ctx) {
  let earned = 0;
  let outOfGraded = 0;
  let outOfAll = 0;
  let missing = 0;
  for (const item of items) {
    if (item.deleted) continue;
    outOfAll += item.max;
    const v = itemScore(item, ctx);
    if (v === null) {
      missing++;
      continue;
    }
    earned += v;
    outOfGraded += item.max;
  }
  return {
    earned,
    outOfGraded,
    outOfAll,
    missing,
    pct: outOfGraded > 0 ? earned / outOfGraded * 100 : null,
    pctOfAll: outOfAll > 0 ? earned / outOfAll * 100 : null
  };
}
function indexScores(scores) {
  const out = /* @__PURE__ */ Object.create(null);
  for (const s of scores) {
    if (s.deleted) continue;
    out[s.itemId] = s;
  }
  return out;
}

// drafts/n88-student-portal/canonical-grade-context.mjs
function canonicalGradeContext(state, studentId, teachingId) {
  const live2 = (rows) => rows.filter((r) => !r.deleted);
  const getTeaching = (id4) => live2(state.teachings).find((r) => r.id === id4) ?? null;
  const getSection = (id4) => live2(state.sections).find((r) => r.id === id4) ?? null;
  const items = (id4) => sortByOrder(live2(state.items).filter((r) => r.teachingId === id4));
  const scoresOf = (id4) => live2(state.scores).filter((r) => r.studentId === id4);
  const enrollmentsOf = (id4) => live2(state.enrollments).filter((r) => r.studentId === id4);
  const logsOf = (id4) => live2(state.logs).filter((r) => r.studentId === id4);
  const attendanceOf = (id4) => live2(state.attendance).filter((r) => r.studentId === id4);
  function portableGroup(item) {
    return item && !item.deleted && item.scoreMode !== "subitems" && typeof item.portabilityGroupId === "string" && item.portabilityGroupId.trim() ? item.portabilityGroupId : null;
  }
  function scoreForItem(studentId2, itemId) {
    return scoresOf(studentId2).find((score) => score.itemId === itemId) ?? null;
  }
  function portableGradeScore(studentId2, item) {
    const direct = scoreForItem(studentId2, item?.id);
    if (direct) return direct;
    const group = portableGroup(item);
    const teaching = getTeaching(item?.teachingId);
    if (!group || !teaching || item.auto) return null;
    if (items(teaching.id).filter((candidate) => portableGroup(candidate) === group).length !== 1) return null;
    const targetSection = getSection(teaching.sectionId);
    const targetEnrollment = enrollmentsOf(studentId2).find((enrollment) => enrollment.sectionId === teaching.sectionId);
    if (!targetSection || !targetEnrollment) return null;
    const transferredSections = new Set(enrollmentsOf(studentId2).filter((enrollment) => enrollment.status === "transferred").map((enrollment) => enrollment.sectionId));
    const candidates = [];
    for (const sourceTeaching of live2(state.teachings)) {
      if (sourceTeaching.id === teaching.id || sourceTeaching.subjectId !== teaching.subjectId || sourceTeaching.termId !== teaching.termId || !transferredSections.has(sourceTeaching.sectionId) || getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId || getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
      const matches = items(sourceTeaching.id).filter((candidate) => !candidate.auto && portableGroup(candidate) === group);
      if (matches.length !== 1) continue;
      const score = scoreForItem(studentId2, matches[0].id);
      if (score) candidates.push(score);
    }
    return candidates.length === 1 ? candidates[0] : null;
  }
  function portableScoresByItem(studentId2, tchId) {
    const directScores = indexScores(scoresOf(studentId2));
    const out = /* @__PURE__ */ Object.create(null);
    for (const item of items(tchId)) {
      const score = directScores[item.id] ?? portableGradeScore(studentId2, item);
      if (score) out[item.id] = score;
    }
    return out;
  }
  function automaticItemIdentity(item) {
    if (!item?.auto) return null;
    const name = normalizeSearchText(item.name);
    if (!name) return null;
    return `${item.auto}\0${name}`;
  }
  function automaticItemKey(item) {
    const identity2 = automaticItemIdentity(item);
    const max = Number(item?.max);
    if (!identity2 || !Number.isFinite(max) || max <= 0) return null;
    const factor = item.auto === "participation" ? Number(item.perPoint ?? 1) : item.auto === "attendance" ? Number(item.penalty ?? 1) : null;
    if (!Number.isFinite(factor) || factor <= 0) return null;
    return `${identity2}\0${max}\0${factor}`;
  }
  function dedupeRecords(records) {
    return [...new Map(records.map((record) => [record.id, record])).values()];
  }
  function compatibleAutomaticTeachingIds(studentId2, item) {
    const teaching = getTeaching(item?.teachingId);
    const group = portableGroup(item);
    const key2 = automaticItemKey(item);
    if (!teaching || !key2) return null;
    if (!group) return /* @__PURE__ */ new Set([teaching.id]);
    const targetMatches = items(teaching.id).filter((candidate) => portableGroup(candidate) === group);
    if (targetMatches.length !== 1 || automaticItemKey(targetMatches[0]) !== key2) return null;
    const targetSection = getSection(teaching.sectionId);
    const targetEnrollment = enrollmentsOf(studentId2).find((enrollment) => enrollment.sectionId === teaching.sectionId);
    if (!targetSection || !targetEnrollment) return /* @__PURE__ */ new Set([teaching.id]);
    const transferredSections = new Set(enrollmentsOf(studentId2).filter((enrollment) => enrollment.status === "transferred").map((enrollment) => enrollment.sectionId));
    const teachingIds = /* @__PURE__ */ new Set([teaching.id]);
    for (const sourceTeaching of live2(state.teachings)) {
      if (sourceTeaching.id === teaching.id || sourceTeaching.subjectId !== teaching.subjectId || sourceTeaching.termId !== teaching.termId || !transferredSections.has(sourceTeaching.sectionId) || getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId || getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
      const sameItem = items(sourceTeaching.id).filter((candidate) => portableGroup(candidate) === group);
      if (!sameItem.length) continue;
      if (sameItem.length !== 1 || automaticItemKey(sameItem[0]) !== key2) return null;
      teachingIds.add(sourceTeaching.id);
    }
    return teachingIds;
  }
  function portableAutomaticByItem(studentId2, tchId) {
    const out = /* @__PURE__ */ Object.create(null);
    for (const item of items(tchId).filter((candidate) => candidate.auto)) {
      const teachingIds = compatibleAutomaticTeachingIds(studentId2, item);
      if (!teachingIds) {
        out[item.id] = null;
        continue;
      }
      if (item.auto === "participation") {
        out[item.id] = {
          logs: dedupeRecords(logsOf(studentId2).filter((log) => teachingIds.has(log.teachingId) && log.kind === "participation")),
          classHasParticipation: live2(state.logs).some((log) => teachingIds.has(log.teachingId) && log.kind === "participation")
        };
      } else if (item.auto === "attendance") {
        out[item.id] = {
          attendance: dedupeRecords(attendanceOf(studentId2).filter((record) => teachingIds.has(record.teachingId)))
        };
      }
    }
    return out;
  }
  return { scoresByItem: portableScoresByItem(studentId, teachingId), automaticByItem: portableAutomaticByItem(studentId, teachingId) };
}

// drafts/n88-student-portal/student-projection.mjs
import { createHash } from "node:crypto";

// drafts/n88-student-portal/visibility-policy.mjs
var VISIBILITY_FIELDS = Object.freeze(["name", "class", "grades", "required", "completed", "scheduled"]);
var VISIBILITY_VERSION = "n88-visibility-v1";
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var exact = (value, keys) => object(value) && Object.keys(value).every((key2) => keys.includes(key2));
var text = (value) => typeof value === "string" && value.length > 0 && value.length <= 300;
var hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
function validateVisibilityPolicy(policy) {
  const fail7 = () => {
    throw new TypeError("n88_visibility_invalid");
  };
  if (!exact(policy, ["version", "ownerId", "studentId", "enrollmentId", "classId", "termId", "scopeStamp", "fields", "sources"]) || policy.version !== VISIBILITY_VERSION || !hash(policy.scopeStamp) || !["ownerId", "studentId", "enrollmentId", "classId", "termId"].every((key2) => text(policy[key2])) || !exact(policy.fields, VISIBILITY_FIELDS) || Object.values(policy.fields).some((value) => typeof value !== "boolean") || !Array.isArray(policy.sources) || policy.sources.length > 2e3) fail7();
  const ids = /* @__PURE__ */ new Set(), sources = /* @__PURE__ */ new Set();
  for (const source of policy.sources) {
    if (!exact(source, ["kind", "sourceId", "publicationId", "stamp"]) || !["item", "subitem"].includes(source.kind) || !text(source.sourceId) || !uuid(source.publicationId) || !hash(source.stamp)) fail7();
    const key2 = JSON.stringify([source.kind, source.sourceId]);
    if (ids.has(source.publicationId) || sources.has(key2)) fail7();
    ids.add(source.publicationId);
    sources.add(key2);
  }
  return structuredClone(policy);
}

// drafts/n88-student-portal/student-projection.mjs
var STUDENT_PROJECTION_VERSION = "n88-student-v3";
var CANONICAL_PROJECTION_REQUIREMENTS = Object.freeze({
  version: "n88-canonical-projection-v1",
  tables: [
    "years",
    "terms",
    "sections",
    "students",
    "enrollments",
    "teachings",
    "items",
    "scores",
    "scoreSubitems",
    "scoreSubitemCompletions",
    "sessions",
    "attendance",
    "logs"
  ],
  unavailable: {
    assignments: "Deferred assignments/submissions have no active teacher completion workflow; do not substitute portal todo/done.",
    portableGrades: "Items with portabilityGroupId require the exact src/store.js portableScoresByItem/portableAutomaticByItem context resolver, not a first/union fallback."
  }
});
var deny = (requirement = "current_membership_and_policy") => {
  const error = new Error("n88_projection_unavailable");
  error.requirement = requirement;
  throw error;
};
var digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
var active = (row) => row && row.deleted === false && row.deletedAt == null && row.archivedAt == null && row.status !== "archived";
var revision = (row) => {
  if (!/^[1-9][0-9]*$/.test(String(row?.revision ?? ""))) deny("canonical_revision");
  return [row.id, String(row.revision)];
};
var date = (value) => {
  if (value == null) return null;
  return normalizeSubitemDatesAndPoints({ value: 0, startDate: value }).startDate;
};
var scopeKeys = ["ownerId", "studentId", "enrollmentId", "classId", "termId"];
function readScope(input) {
  const { canonical: c, ownerId, studentId, enrollmentId, classId, termId, now } = input;
  if (!scopeKeys.every((key2) => typeof input[key2] === "string" && input[key2]) || typeof now !== "string") deny();
  const today = date(now);
  if (!today || !c) deny();
  const rows = {};
  for (const table of CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    if (!Array.isArray(c[table]) || c[table].length > 1e4) deny(`complete_bounded_${table}`);
    rows[table] = c[table].filter((row) => row.ownerId === ownerId);
    const ids = /* @__PURE__ */ new Set();
    for (const row of rows[table]) {
      if (!row.id || ids.has(row.id) || typeof row.deleted !== "boolean") deny("canonical_row_identity");
      ids.add(row.id);
      revision(row);
    }
  }
  const one = (table, id4) => rows[table].find((row) => row.id === id4);
  const student = one("students", studentId), section = one("sections", classId), term = one("terms", termId);
  const year = one("years", section?.yearId), enrollment = one("enrollments", enrollmentId);
  if (![student, section, term, year, enrollment].every(active) || [student, section, term, year, enrollment].some((row) => row.status !== "active") || term.yearId !== section.yearId || enrollment.studentId !== studentId || enrollment.sectionId !== classId || enrollment.endDate != null || date(enrollment.startDate) && enrollment.startDate > today || date(term.startDate) && term.startDate > today || date(term.endDate) && term.endDate < today) deny();
  const current = rows.enrollments.filter((row) => active(row) && row.studentId === studentId && row.status === "active" && row.endDate == null && active(one("sections", row.sectionId)) && one("sections", row.sectionId).yearId === year.id);
  if (current.length !== 1 || current[0].id !== enrollmentId) deny("unique_current_enrollment");
  const teachings = rows.teachings.filter((row) => active(row) && row.sectionId === classId && row.termId === termId);
  const items = sortByOrder(rows.items.filter((row) => active(row) && teachings.some((t) => t.id === row.teachingId)));
  const definitions = sortByOrder(rows.scoreSubitems.filter((row) => active(row) && items.some((item) => item.id === row.itemId && item.scoreMode === "subitems")));
  const scopeStamp = digest([
    "n88-scope-v1",
    ...scopeKeys.map((key2) => input[key2]),
    ...[year, term, section, student, enrollment].map(revision),
    ...teachings.sort((a, b) => a.id.localeCompare(b.id)).map(revision)
  ]);
  const sourceStamp = (kind, row) => digest([
    "n88-source-v1",
    scopeStamp,
    kind,
    revision(row),
    ...kind === "subitem" ? [revision(items.find((item) => item.id === row.itemId))] : []
  ]);
  return { rows, today, student, section, items, definitions, teachings, scopeStamp, sourceStamp };
}
function studentPortalPublicationBindings(input) {
  const s = readScope(input);
  return { scopeStamp: s.scopeStamp, sources: [
    ...s.items.map((row) => ({ kind: "item", sourceId: row.id, stamp: s.sourceStamp("item", row) })),
    ...s.definitions.map((row) => ({ kind: "subitem", sourceId: row.id, stamp: s.sourceStamp("subitem", row) }))
  ] };
}
function projectStudentPortal(input) {
  const s = readScope(input), { studentId, ownerId } = input;
  const out = { version: STUDENT_PROJECTION_VERSION };
  if (input.visibility == null) return out;
  const policy = validateVisibilityPolicy(input.visibility);
  if (scopeKeys.some((key2) => policy[key2] !== input[key2]) || policy.scopeStamp !== s.scopeStamp) deny();
  const enabled = (key2) => policy.fields[key2] === true;
  const grant = (kind, row) => policy.sources.find((source) => source.kind === kind && source.sourceId === row.id && source.stamp === s.sourceStamp(kind, row));
  if (enabled("name")) out.profile = { name: s.student.name };
  if (enabled("class")) (out.profile ??= {}).classLabel = sectionLabel(s.section);
  if (enabled("grades")) {
    const published = s.items.filter((item) => grant("item", item));
    if (published.some((item) => item.portabilityGroupId) && input.teacherContextVersion !== "n88-canonical-teacher-context-v1") deny(CANONICAL_PROJECTION_REQUIREMENTS.unavailable.portableGrades);
    const contexts = /* @__PURE__ */ new Map();
    for (const teaching of s.teachings) {
      const logs = s.rows.logs.filter((row) => active(row) && row.teachingId === teaching.id);
      const sessions = s.rows.sessions.filter((row) => active(row) && row.teachingId === teaching.id);
      const ctx = {
        ...canonicalGradeContext(s.rows, studentId, teaching.id),
        logs: logs.filter((row) => row.studentId === studentId),
        classHasParticipation: logs.some((row) => row.kind === "participation"),
        attendance: s.rows.attendance.filter((row) => active(row) && row.studentId === studentId && row.teachingId === teaching.id && sessions.some((session) => session.id === row.sessionId))
      };
      for (const item of published.filter((item2) => item2.teachingId === teaching.id)) {
        const scores = s.rows.scores.filter((row) => active(row) && row.studentId === studentId && row.itemId === item.id);
        if (scores.length > 1) deny("unique_student_item_score");
        const score = scores[0];
        if (item.scoreMode === "subitems" && !item.auto) {
          const completions = s.rows.scoreSubitemCompletions.filter((row) => active(row) && row.studentId === studentId);
          if (new Set(completions.map((row) => row.subitemId)).size !== completions.length) deny("unique_student_subitem_completion");
          const projection = projectSubitemScore(
            item,
            s.definitions.filter((row) => row.itemId === item.id),
            completions,
            score?.manualValue ?? null,
            { studentId, ownerId }
          );
          if (itemScore(item, { scoresByItem: { [item.id]: score } }) !== projection.value) deny("canonical_atomic_subitem_score");
          ctx.scoresByItem[item.id] = projection;
        } else if (score) ctx.scoresByItem[item.id] = score;
      }
      contexts.set(teaching.id, ctx);
    }
    out.grades = { items: published.map((item) => {
      const value = itemScore(item, contexts.get(item.teachingId));
      return { id: grant("item", item).publicationId, label: item.name, value, max: item.max, status: value === null ? "unrecorded" : "recorded" };
    }) };
    if (published.length === s.items.length) {
      const totals = s.teachings.map((t) => studentTotal(published.filter((item) => item.teachingId === t.id), contexts.get(t.id)));
      out.grades.total = { earned: totals.reduce((n, t) => n + t.earned, 0), possible: totals.reduce((n, t) => n + t.outOfGraded, 0) };
    }
  }
  for (const family of ["required", "completed", "scheduled"]) if (enabled(family)) (out.work ??= {})[family] = [];
  if (out.work) for (const definition of s.definitions) {
    const publication = grant("subitem", definition);
    if (!publication) continue;
    const completions = s.rows.scoreSubitemCompletions.filter((row) => active(row) && row.studentId === studentId && row.subitemId === definition.id);
    if (completions.length > 1) deny("unique_student_subitem_completion");
    const completionState = subitemCompletionState(completions[0]);
    const { startDate, dueDate } = normalizeSubitemDatesAndPoints(definition);
    const family = completionState !== "unrecorded" ? "completed" : startDate && startDate > s.today ? "scheduled" : "required";
    if (enabled(family)) out.work[family].push({ id: publication.publicationId, title: definition.name, startDate, dueDate, completionState, ...guidanceForStudent(input, definition, publication) });
  }
  return out;
}

// drafts/n88-student-portal/task-guidance.mjs
var hash2 = (v) => createHash2("sha256").update(JSON.stringify(v)).digest("hex");
var exact2 = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));
var validGuidanceText = (v) => typeof v === "string" && v.length <= 400 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?[A-Za-z][^>]*>|<!--|javascript\s*:/i.test(v);
var validGuidanceInput = (v) => exact2(v, ["subitemId", "sourceStamp", "revision", "executionInstructions", "deliveryInstructions", "confirmClear"]) && typeof v.subitemId === "string" && v.subitemId.length > 0 && v.subitemId.length <= 200 && /^[a-f0-9]{64}$/.test(v.sourceStamp) && Number.isSafeInteger(v.revision) && v.revision >= 0 && validGuidanceText(v.executionInstructions) && validGuidanceText(v.deliveryInstructions) && typeof v.confirmClear === "boolean" && (v.executionInstructions.trim() || v.deliveryInstructions.trim() || v.confirmClear);
async function readTaskGuidance(ports, s) {
  const r = await ports.query("select subitem_id,teaching_id,case when sum(octet_length(payload::text)) over(order by teaching_id,subitem_id rows unbounded preceding)<=2097152 then payload::text else null end as bounded_payload from n88_private.task_guidance where owner_id=$1::uuid and class_id=$2 and term_id=$3 and ($4::text is null or teaching_id=$4) order by teaching_id,subitem_id limit 2001", [s.ownerId, s.classId, s.termId, s.teachingId || null]);
  if (r.rows.length > 2e3 || r.rows.some((r2) => typeof r2.bounded_payload !== "string")) throw Error("n88_guidance_unavailable");
  return r.rows.map((r2) => ({ subitem_id: r2.subitem_id, teaching_id: r2.teaching_id, payload: JSON.parse(r2.bounded_payload) }));
}
function authorizedGuidanceSources(s, members, policy, inputFor) {
  const sources = /* @__PURE__ */ new Map();
  for (const m of [...members].sort((a, b) => a.studentId.localeCompare(b.studentId))) {
    const input = inputFor(s, m), visibility = policy.members.find((p2) => p2.studentId === m.studentId && p2.enrollmentId === m.enrollmentId);
    if (!visibility) continue;
    let b, p;
    try {
      b = studentPortalPublicationBindings(input);
      p = projectStudentPortal({ ...input, visibility });
    } catch {
      continue;
    }
    for (const task of Object.values(p.work || {}).flat()) {
      const publication = visibility.sources.find((x) => x.kind === "subitem" && x.publicationId === task.id), src = b.sources.find((x) => x.kind === "subitem" && x.sourceId === publication?.sourceId && x.stamp === publication.stamp);
      const row = s.canonical.scoreSubitems.find((x) => x.id === src?.sourceId), item = s.canonical.items.find((x) => x.id === row?.itemId);
      if (!row || item?.teachingId !== s.teachingId) continue;
      const entry = sources.get(row.id) || { subitemId: row.id, title: row.name, bindings: [] };
      entry.bindings.push({ studentId: m.studentId, enrollmentId: m.enrollmentId, scopeStamp: b.scopeStamp, stamp: src.stamp, publicationId: task.id });
      sources.set(row.id, entry);
    }
  }
  return [...sources.values()].map((x) => ({ ...x, sourceStamp: hash2([s.ownerId, s.classId, s.termId, s.teachingId, policy.revision, x.subitemId, x.bindings]) }));
}
function guidanceTeacherList(sources, stored) {
  return sources.map((src) => {
    const p = stored.find((r) => r.subitem_id === src.subitemId)?.payload, valid = p?.sourceStamp === src.sourceStamp;
    return { subitemId: src.subitemId, title: src.title, sourceStamp: src.sourceStamp, revision: p?.revision || 0, executionInstructions: valid ? p.executionInstructions : "", deliveryInstructions: valid ? p.deliveryInstructions : "", needsRepublication: !!p && !valid };
  });
}
async function saveTaskGuidance(ports, s, source, stored, input) {
  if (!validGuidanceInput(input) || !source || input.sourceStamp !== source.sourceStamp) throw Error("n88_guidance_unavailable");
  const old = stored.find((r) => r.subitem_id === input.subitemId)?.payload;
  if ((old?.revision || 0) !== input.revision) throw Error("n88_guidance_unavailable");
  const payload = { revision: input.revision + 1, sourceStamp: source.sourceStamp, executionInstructions: input.executionInstructions, deliveryInstructions: input.deliveryInstructions, bindings: source.bindings };
  await ports.query("insert into n88_private.task_guidance(owner_id,class_id,term_id,teaching_id,subitem_id,payload) values($1::uuid,$2,$3,$4,$5,$6::jsonb) on conflict(owner_id,class_id,term_id,teaching_id,subitem_id) do update set payload=excluded.payload", [s.ownerId, s.classId, s.termId, s.teachingId, input.subitemId, JSON.stringify(payload)]);
  return { saved: true, subitemId: input.subitemId, revision: payload.revision, sourceStamp: source.sourceStamp };
}
function guidanceForStudent(input, definition, publication) {
  const item = input.canonical.items.find((x) => x.id === definition.itemId);
  const p = input.taskGuidance?.find((r) => r.subitem_id === definition.id && r.teaching_id === item?.teachingId)?.payload;
  if (!p || !validGuidanceText(p.executionInstructions) || !validGuidanceText(p.deliveryInstructions)) return {};
  const current = studentPortalPublicationBindings(input), src = current.sources.find((x) => x.kind === "subitem" && x.sourceId === definition.id);
  if (!p.bindings.some((b) => b.studentId === input.studentId && b.enrollmentId === input.enrollmentId && b.scopeStamp === current.scopeStamp && b.stamp === src?.stamp && b.publicationId === publication.publicationId)) return {};
  return { ...p.executionInstructions.trim() ? { executionInstructions: p.executionInstructions } : {}, ...p.deliveryInstructions.trim() ? { deliveryInstructions: p.deliveryInstructions } : {} };
}

// drafts/n88-student-portal/integrated-service.mjs
import { createHash as createHash6, randomUUID as randomUUID4 } from "node:crypto";

// drafts/n88-student-portal/class-credentials.mjs
import { Buffer as Buffer4 } from "node:buffer";
import { createHash as createHash4 } from "node:crypto";

// drafts/n88-student-portal/service.mjs
import { Buffer as Buffer3 } from "node:buffer";
import { randomBytes, randomUUID, randomInt, createHash as createHash3, createHmac, timingSafeEqual } from "node:crypto";
var POLICY = Object.freeze({
  sessionMs: 8 * 60 * 6e4,
  rateWindowMs: 15 * 6e4,
  sourceAttempts: 6,
  contextAttempts: 30,
  globalAttempts: 100,
  failureWindowMs: 864e5,
  contextFailures: 60,
  globalFailures: 500,
  maxRateKeys: 1e4
});
var PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie"
});

// drafts/n88-student-portal/rollout-guard.mjs
var uuid2 = (v) => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
var id = (v) => typeof v === "string" && v.length > 0 && v.length <= 240 && !v.includes("\0");
var exact3 = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var off = () => Object.freeze({ mode: "off", configured: false, allowsOwner: () => false, allowsMember: () => false, admitsTeacher: () => false, admitsStudent: () => false });
function createRolloutGuard(readEnv) {
  if (typeof readEnv !== "function") return off();
  let mode, binding, proof;
  try {
    mode = readEnv("N88_ROLLOUT_MODE");
    if (mode === "off" || mode == null) return off();
    if (mode === "public") {
      proof = readEnv("N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256");
      if (typeof proof !== "string" || !/^[a-f0-9]{64}$/.test(proof) || readEnv("N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED") !== "true") return off();
    } else if (mode === "pilot") {
      const text2 = readEnv("N88_PILOT_BINDING");
      if (typeof text2 !== "string" || text2.length > 2048) return off();
      binding = JSON.parse(text2);
      if (!exact3(binding, ["ownerId", "classId", "teachingId", "studentIds"]) || !uuid2(binding.ownerId) || !id(binding.classId) || !id(binding.teachingId) || !Array.isArray(binding.studentIds) || binding.studentIds.length !== 2 || binding.studentIds.some((v) => !id(v)) || new Set(binding.studentIds).size !== 2) return off();
      binding = { ...binding, studentIds: new Set(binding.studentIds) };
    } else return off();
  } catch {
    return off();
  }
  const allowsOwner = (ownerId) => uuid2(ownerId) && (mode === "public" || ownerId === binding.ownerId);
  const allowsMember = (m) => !!m && allowsOwner(m.ownerId) && id(m.studentId) && id(m.classId) && (mode === "public" || m.classId === binding.classId && binding.studentIds.has(m.studentId));
  return Object.freeze({
    mode,
    configured: true,
    allowsOwner,
    allowsMember,
    admitsTeacher: (auth, scope) => !!auth && auth.current === true && allowsOwner(auth.ownerId) && !!scope && scope.current === true && scope.ownerId === auth.ownerId && id(scope.classId) && id(scope.teachingId) && (mode === "public" || scope.classId === binding.classId && scope.teachingId === binding.teachingId),
    admitsStudent: (member) => allowsMember(member) && member.status === "active" && member.endDate === null && member.studentActive === true && member.classActive === true
  });
}

// drafts/n88-student-portal/class-credentials.mjs
var fail = () => {
  throw Error("n88_class_unavailable");
};
var hash3 = (value) => createHash4("sha256").update(JSON.stringify(value)).digest("hex");
var active2 = (m) => m.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var id2 = (value) => typeof value === "string" && value.length > 0 && value.length <= 240 && !value.includes("\0");
var requestId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(value);
var version = (db, m) => Math.max(0, ...db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId).map((c) => c.version));
var live = (db, m) => db.numericCredentials.some((c) => c.ownerId === m.ownerId && c.studentId === m.studentId && c.revokedAt === null);
var result = (status, body) => ({ status, body, headers: { ...PRIVATE_HEADERS } });
var denied = () => result(401, { error: "unavailable" });
var replay = (receipt) => receipt.results.map((r) => r.status === "created" ? { ...r, status: "uncertain", recovery: "refresh_current_roster" } : { ...r });
var summary = (rows) => Object.fromEntries(["created", "skipped", "failed", "uncertain"].map((s) => [s, rows.filter((r) => r.status === s).length]));
function createClassCredentialOperations({ repository, verifyTeacher, verifyIngress, origin, resolveClass, issueMember, rotateMember, revokeMember, rollout = createRolloutGuard() }) {
  if (!repository?.transaction || [verifyTeacher, verifyIngress, resolveClass, issueMember, rotateMember, revokeMember].some((f) => typeof f !== "function") || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail();
  return Object.freeze({ forRequest(request) {
    async function run(action, teachingId, input = {}) {
      try {
        return await repository.transaction(async (db, ports) => {
          const ingress = await verifyIngress(request, ports), headers = request.headers || {};
          if (!ingress?.clientKey || headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin" || action === "list" && request.method !== "GET" || action !== "list" && (request.method !== "POST" || headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true || !rollout.allowsOwner(auth.ownerId) || typeof ports?.synchronizeOwner !== "function") return denied();
          const scope = await resolveClass(db, ports, auth, teachingId, input);
          if (!scope || scope.ownerId !== auth.ownerId || scope.current !== true || !id2(scope.teachingId) || !id2(scope.classId) || !id2(scope.revision)) return denied();
          if (teachingId !== null && scope.teachingId !== teachingId) return denied();
          if (!rollout.admitsTeacher(auth, scope)) return denied();
          await ports.synchronizeOwner(auth.ownerId);
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === scope.classId && active2(m) && rollout.admitsStudent(m));
          if (members.length > 2e3 || new Set(members.map((m) => m.studentId)).size !== members.length) return denied();
          if (members.some((m) => db.memberships.filter((x) => x.ownerId === m.ownerId && x.studentId === m.studentId && active2(x)).length !== 1)) return denied();
          members.sort((a, b) => a.studentId.localeCompare(b.studentId));
          const rosterRevision = hash3([scope.teachingId, scope.revision, members.map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          if (action === "list") return result(200, { teachingId: scope.teachingId, rosterRevision, students: members.map((m) => ({
            studentId: m.studentId,
            enrollmentId: m.enrollmentId,
            revision: m.revision,
            label: m.label,
            credentialVersion: version(db, m),
            hasActiveCredential: live(db, m)
          })) });
          if (!requestId(input.requestId)) return denied();
          const binding = hash3([action, scope.teachingId, input.expectedRosterRevision ?? null, input.studentId ?? null, input.enrollmentId ?? null, input.revision ?? null, input.credentialVersion ?? null]);
          const prior = db.classReceipts.find((r) => r.ownerId === auth.ownerId && r.requestId === input.requestId);
          if (prior) {
            if (!prior.results.every((r) => members.some((m) => m.studentId === r.studentId && m.enrollmentId === r.enrollmentId))) return denied();
            if (prior.binding !== binding) return result(409, { error: "stale_request" });
            const rows2 = replay(prior);
            return result(200, { requestId: input.requestId, replayed: true, results: rows2, counts: summary(rows2) });
          }
          if (db.classReceipts.length >= 1e4) fail();
          if (action === "batch" && input.expectedRosterRevision !== rosterRevision) return result(409, { error: "roster_changed" });
          let selected = members;
          if (action !== "batch") {
            selected = members.filter((m) => m.studentId === input.studentId && m.enrollmentId === input.enrollmentId && m.revision === input.revision);
            if (selected.length !== 1 || !Number.isSafeInteger(input.credentialVersion) || input.credentialVersion < 0 || version(db, selected[0]) !== input.credentialVersion) return result(409, { error: "member_changed" });
          }
          const rows = [], secrets = [];
          for (const m of selected) {
            const expectedVersion = version(db, m);
            const base = { studentId: m.studentId, enrollmentId: m.enrollmentId, credentialVersion: expectedVersion };
            if (action === "batch" && expectedVersion > 0) {
              rows.push({ ...base, status: "skipped", reason: live(db, m) ? "existing" : "revoked_rotate_required" });
              continue;
            }
            const rowCount = rows.length, secretCount = secrets.length;
            const before = structuredClone({ credentials: db.numericCredentials, sessions: db.numericSessions });
            try {
              await ports.query("savepoint n88_member_recovery");
              const issued = await { batch: issueMember, rotate: rotateMember, revoke: revokeMember }[action](db, m, { expectedVersion }, ports);
              if (action === "revoke") {
                if (issued?.revoked !== true || live(db, m)) fail();
                rows.push({ ...base, status: "skipped", reason: "revoked" });
              } else {
                if (!/^1[0-9]{5}$/.test(issued?.code || "") || issued.credentialVersion !== expectedVersion + 1 || !live(db, m)) fail();
                rows.push({ ...base, credentialVersion: issued.credentialVersion, status: "created" });
                secrets.push({ studentId: m.studentId, code: issued.code });
              }
              await ports.query("release savepoint n88_member_recovery");
            } catch {
              await ports.query("rollback to savepoint n88_member_recovery");
              await ports.query("release savepoint n88_member_recovery");
              rows.length = rowCount;
              secrets.length = secretCount;
              db.numericCredentials = before.credentials;
              db.numericSessions = before.sessions;
              rows.push({ ...base, status: "failed", reason: "unavailable" });
            }
          }
          db.classReceipts.push({ ownerId: auth.ownerId, requestId: input.requestId, binding, results: structuredClone(rows) });
          return result(200, { requestId: input.requestId, replayed: false, results: rows, counts: summary(rows), secrets });
        });
      } catch {
        return result(503, { error: "unavailable", outcome: "uncertain", recovery: "reload_with_same_request_id" });
      }
    }
    return Object.freeze({
      listClass: (teachingId) => run("list", teachingId),
      issueMissingClassCodes: (teachingId, input) => run("batch", teachingId, input),
      rotate: (input) => run("rotate", null, input),
      revoke: (input) => run("revoke", null, input)
    });
  } });
}
function createPgClassResolver({ teachingId: boundTeachingId } = {}) {
  return async (db, ports, auth, teachingId, input) => {
    const requested = teachingId ?? boundTeachingId;
    if (!id2(requested) || typeof ports?.query !== "function") return null;
    await ports.query("select n88_private.lock_canonical_sources($1::uuid,$2::integer)", [auth.ownerId, 2e3]);
    const r = await ports.query(`select t.id,t.section_id,t.revision::text as teaching_revision,
      term.revision::text as term_revision from rakeezx.teachings t
      join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
      join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
      join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
      where t.owner_id=$1::uuid and t.id=$2 and t.deleted_at is null
        and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
        and c.deleted_at is null and c.status='active' and y.deleted_at is null and y.status='active'`, [auth.ownerId, requested]);
    if (r.rows.length !== 1) return null;
    const t = r.rows[0];
    if (teachingId === null && !db.memberships.some((m) => m.ownerId === auth.ownerId && m.classId === t.section_id && m.studentId === input.studentId && m.enrollmentId === input.enrollmentId && active2(m))) return null;
    return { ownerId: auth.ownerId, classId: t.section_id, teachingId: t.id, current: true, revision: hash3([t.teaching_revision, t.term_revision]) };
  };
}
function withCredentialRepository(repository, { maxRows = 1e4, maxBytes = 4 * 1024 * 1024 } = {}) {
  if (!repository?.transaction || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail();
  const tables2 = { numericCredentials: "numeric_credentials", numericSessions: "numeric_sessions", numericRates: "numeric_rates", numericAttempts: "numeric_attempts", classReceipts: "class_credential_receipts" };
  const proofs = /* @__PURE__ */ new WeakSet();
  const api = {
    // Existing global advisory lock + fenced COMMIT, without credential reads.
    claimAttempt: (action) => repository.transaction(async (_db, ports) => {
      const state = {}, original = {};
      let bytes = 0;
      for (const [name, table] of [["numericRates", "numeric_rates"], ["numericAttempts", "numeric_attempts"]]) {
        const r = await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`, [maxRows + 1, maxBytes - bytes]);
        if (r.rows.length > maxRows) fail();
        state[name] = r.rows.map(({ payload }) => {
          if (!payload) fail();
          bytes += Buffer4.byteLength(JSON.stringify(payload));
          if (bytes > maxBytes) fail();
          return payload;
        });
        original[name] = structuredClone(state[name]);
      }
      const allowed = await action(state, ports);
      bytes = 0;
      for (const [name, table] of [["numericRates", "numeric_rates"], ["numericAttempts", "numeric_attempts"]]) {
        if (state[name].length > maxRows) fail();
        const pk2 = (r) => name === "numericRates" ? r.key : r.id;
        const after = new Map(state[name].map((r) => [pk2(r), r]));
        if (after.size !== state[name].length) fail();
        const before = new Map(original[name].map((r) => [pk2(r), r]));
        for (const row of original[name]) if (!after.has(pk2(row))) {
          if ((await ports.query(`delete from n88_private.${table} where row_key=$1`, [pk2(row)])).rowCount !== 1) fail();
        }
        for (const row of state[name]) {
          bytes += Buffer4.byteLength(JSON.stringify(row));
          if (bytes > maxBytes) fail();
          if (before.has(pk2(row)) && JSON.stringify(before.get(pk2(row))) === JSON.stringify(row)) continue;
          if ((await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload`, [pk2(row), JSON.stringify(row)])).rowCount !== 1) fail();
        }
      }
      return allowed;
    }),
    commitAttemptSession: async (id4, action) => {
      const committed = await api.transaction(async (db, ports) => {
        const a = db.numericAttempts.find((a2) => a2.id === id4);
        if (!a || a.sessionId !== null || a.settled) fail();
        const before = new Set(db.numericSessions.map((s) => s.id));
        const value = await action(db, ports);
        const fresh = db.numericSessions.filter((s) => !before.has(s.id));
        if (fresh.length > 1) fail();
        if (fresh.length === 1) {
          if (fresh[0].revokedAt !== null) fail();
          a.sessionId = fresh[0].id;
        }
        return { value, receipt: fresh.length ? structuredClone(a) : null };
      });
      const proof = committed.receipt ? Object.freeze(committed.receipt) : null;
      if (proof) proofs.add(proof);
      return { value: committed.value, proof };
    },
    settleAttempt: async (proof, time2) => {
      if (!proof || !proofs.has(proof) || !Number.isSafeInteger(time2)) return false;
      return api.transaction(async (db) => {
        const a = db.numericAttempts.find((a2) => a2.id === proof.id);
        if (!a || a.settled || a.until <= time2 || JSON.stringify(a) !== JSON.stringify(proof) || !db.numericSessions.some((s) => s.id === a.sessionId)) return false;
        const buckets = a.buckets.map((b) => db.numericRates.find((r) => r.key === b.key && r.epoch === b.epoch && r.until === b.until && r.until > time2));
        if (buckets.length !== 2 || new Set(buckets).size !== 2 || buckets.some((b) => !b || b.count < 1)) return false;
        for (const b of buckets) b.count--;
        a.settled = true;
        return true;
      });
    },
    transaction: (action) => repository.transaction(async (db, ports) => {
      if (typeof ports?.query !== "function") fail();
      const extra = {}, original = {};
      let bytes = 0;
      for (const [name, table] of Object.entries(tables2)) {
        const r = await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`, [maxRows + 1, maxBytes - bytes]);
        if (r.rows.length > maxRows) fail();
        extra[name] = r.rows.map((r2) => {
          if (!r2.payload) fail();
          bytes += Buffer4.byteLength(JSON.stringify(r2.payload));
          if (bytes > maxBytes) fail();
          return r2.payload;
        });
        original[name] = structuredClone(extra[name]);
      }
      const state = new Proxy(extra, { get: (o, k) => k in tables2 ? o[k] : db[k], set: (o, k, v) => {
        if (k in tables2) o[k] = v;
        else db[k] = v;
        return true;
      } });
      const value = await action(state, ports);
      bytes = 0;
      for (const [name, table] of Object.entries(tables2)) {
        if (extra[name].length > maxRows) fail();
        const pk2 = (r) => name === "classReceipts" ? JSON.stringify([r.ownerId, r.requestId]) : name === "numericRates" ? r.key : r.id;
        const before = new Map(original[name].map((r) => [pk2(r), r])), after = new Map(extra[name].map((r) => [pk2(r), r]));
        if (after.size !== extra[name].length) fail();
        for (const [key2, row] of before) if (!after.has(key2)) {
          if (name === "numericCredentials" || name === "classReceipts") fail();
          if ((await ports.query(`delete from n88_private.${table} where row_key=$1`, [key2])).rowCount !== 1) fail();
        }
        for (const [key2, row] of after) {
          bytes += Buffer4.byteLength(JSON.stringify(row));
          if (bytes > maxBytes) fail();
          if (before.has(key2) && JSON.stringify(before.get(key2)) === JSON.stringify(row)) continue;
          const ack = before.has(key2) ? await ports.query(`update n88_private.${table} set payload=$2::jsonb where row_key=$1`, [key2, JSON.stringify(row)]) : await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb)`, [key2, JSON.stringify(row)]);
          if (ack.rowCount !== 1) fail();
        }
      }
      return value;
    })
  };
  return Object.freeze(api);
}

// drafts/n88-student-portal/code-recovery.mjs
import { Buffer as Buffer5 } from "node:buffer";
import { randomBytes as randomBytes2, randomUUID as randomUUID2, createCipheriv, createDecipheriv } from "node:crypto";
var fail2 = () => {
  throw Error("n88_recovery_unavailable");
};
var ver = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);
var exact4 = (o, ks) => o && Object.keys(o).length === ks.length && ks.every((k) => Object.hasOwn(o, k));
var fields = ["id", "credentialId", "generation", "envelopeVersion", "algorithm", "keyVersion", "nonce", "ciphertext", "tag"];
function createCodeRecovery({ keys, activeKeyVersion, otherKeys = [] } = {}) {
  if (!(keys instanceof Map) || !keys.size || keys.size > 8 || !ver(activeKeyVersion) || !keys.has(activeKeyVersion) || [...keys].some(([v, k]) => !ver(v) || !Buffer5.isBuffer(k) || k.length !== 32) || new Set([...keys.values()].map((k) => k.toString("hex"))).size !== keys.size || [...keys.values()].some((k) => otherKeys.some((o) => Buffer5.isBuffer(o) && k.equals(o)))) fail2();
  keys = new Map([...keys].map(([v, k]) => [v, Buffer5.from(k)]));
  const aad = (c, e) => Buffer5.from(JSON.stringify(["n88-code-recovery", e.id, e.envelopeVersion, e.algorithm, e.keyVersion, c.id, c.version, c.ownerId, c.studentId, c.format, e.generation]));
  function seal(c, code, generation = 1) {
    if (c.revokedAt !== null || c.format !== "six-v1" || !/^1[0-9]{5}$/.test(code) || !Number.isSafeInteger(generation) || generation < 1) fail2();
    const e = { id: randomUUID2(), credentialId: c.id, generation, envelopeVersion: 1, algorithm: "AES-256-GCM", keyVersion: activeKeyVersion, nonce: randomBytes2(12).toString("hex") };
    const cipher = createCipheriv("aes-256-gcm", keys.get(activeKeyVersion), Buffer5.from(e.nonce, "hex"), { authTagLength: 16 });
    cipher.setAAD(aad(c, e));
    e.ciphertext = Buffer5.concat([cipher.update(code, "ascii"), cipher.final()]).toString("hex");
    e.tag = cipher.getAuthTag().toString("hex");
    return e;
  }
  function open(c, e) {
    try {
      if (c.revokedAt !== null || c.format !== "six-v1" || !exact4(e, fields) || e.credentialId !== c.id || e.envelopeVersion !== 1 || e.algorithm !== "AES-256-GCM" || !keys.has(e.keyVersion) || !Number.isSafeInteger(e.generation) || e.generation < 1 || !/^[a-f0-9]{24}$/.test(e.nonce) || !/^[a-f0-9]{12}$/.test(e.ciphertext) || !/^[a-f0-9]{32}$/.test(e.tag)) fail2();
      const d = createDecipheriv("aes-256-gcm", keys.get(e.keyVersion), Buffer5.from(e.nonce, "hex"), { authTagLength: 16 });
      d.setAAD(aad(c, e));
      d.setAuthTag(Buffer5.from(e.tag, "hex"));
      const code = Buffer5.concat([d.update(Buffer5.from(e.ciphertext, "hex")), d.final()]).toString("ascii");
      if (!/^1[0-9]{5}$/.test(code)) fail2();
      return code;
    } catch {
      fail2();
    }
  }
  async function read(ports, c) {
    const r = await ports.query("select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1", [c.id]);
    return r.rows.length ? { status: "recoverable", credential: open(c, r.rows[0].payload) } : { status: "legacy", credential: null };
  }
  async function append(ports, c, code, generation = 1) {
    for (let n = 0; n < 8; n++) {
      const e = seal(c, code, generation);
      const r = await ports.query(`insert into n88_private.code_recovery(row_key,payload) values($1,$2::jsonb) on conflict(key_version,nonce) do nothing`, [e.id, JSON.stringify(e)]);
      if (r.rowCount === 1) return;
    }
    fail2();
  }
  async function rewrap(ports, c, expectedGeneration) {
    const r = await ports.query("select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1", [c.id]);
    if (r.rows.length !== 1 || r.rows[0].payload.generation !== expectedGeneration) fail2();
    await append(ports, c, open(c, r.rows[0].payload), expectedGeneration + 1);
  }
  return Object.freeze({ read, append, rewrap, seal, open });
}

// drafts/n88-student-portal/numeric-credentials.mjs
import { randomInt as randomInt2, randomBytes as randomBytes3, randomUUID as randomUUID3, createHmac as createHmac2, createHash as createHash5, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var CREDENTIAL_FORMAT = "six-v1";
var CREDENTIAL_CAPACITY = 1e5;
var NUMERIC_POLICY = Object.freeze({
  collisionBudget: 128,
  sessionMs: 8 * 60 * 6e4,
  windowMs: 15 * 6e4,
  clientAttempts: 6,
  globalAttempts: 100,
  maxRateKeys: 1e4,
  sourceRequests: 120,
  globalRequests: 1200,
  maxAttempts: 1e4
});
var generateNumericCredential = () => "1" + String(randomInt2(0, 1e5)).padStart(5, "0");
function normalizeNumericCredential(value) {
  if (typeof value !== "string" || value.length > 80) return null;
  const code = value.replace(/^ +| +$/g, "");
  return /^1[0-9]{5}$/.test(code) ? code : null;
}
var fail3 = () => {
  throw Error("n88_numeric_unavailable");
};
var active3 = (m) => m?.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var identity = (a, b) => a.ownerId === b.ownerId && a.studentId === b.studentId;
var tokenHash = (token) => createHash5("sha256").update(token).digest("hex");
var cookie = (value, age) => `__Secure-n88-student=${value}; Path=/api/n88/student; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
var denied2 = () => ({ status: 401, body: { error: "unavailable" }, cookie: cookie("", 0) });
var response = (r) => ({ ...r, headers: { ...PRIVATE_HEADERS, ...r.cookie ? { "Set-Cookie": r.cookie } : {} } });
function createNumericCredentialOperations({
  keys,
  activeKeyVersion,
  reservationKey,
  now = Date.now,
  generate = generateNumericCredential,
  rollout = createRolloutGuard()
}) {
  if (!(keys instanceof Map) || !keys.size || !/^[A-Za-z0-9_-]{1,40}$/.test(activeKeyVersion || "") || !keys.has(activeKeyVersion) || !Buffer.isBuffer(reservationKey) || reservationKey.length < 32 || [...keys].some(([v, k]) => !/^[A-Za-z0-9_-]{1,40}$/.test(v) || !Buffer.isBuffer(k) || k.length < 32)) fail3();
  keys = new Map([...keys].map(([v, k]) => [v, Buffer.from(k)]));
  reservationKey = Buffer.from(reservationKey);
  const mac2 = (key2, domain, ...parts) => createHmac2("sha256", key2).update(JSON.stringify(["n88-numeric-v1", domain, ...parts])).digest("hex");
  const reservation = (code) => mac2(reservationKey, "global-reservation", code);
  const verifier = (code, c) => mac2(keys.get(c.keyVersion), "credential", c.ownerId, c.studentId, c.version, code);
  function current(db, c) {
    if (!db.contexts.some((x) => x.ownerId === c.ownerId && x.active === true)) return null;
    const members = db.memberships.filter((m) => identity(m, c) && active3(m));
    return members.length === 1 ? members[0] : null;
  }
  function revokeCredential(db, c) {
    if (c.revokedAt === null) c.revokedAt = now();
    for (const s of db.numericSessions) if (s.credentialId === c.id && s.revokedAt === null) s.revokedAt = now();
  }
  function version2(db, m) {
    return Math.max(0, ...db.numericCredentials.filter((c) => identity(c, m)).map((c) => c.version));
  }
  function check(db, m, expectedVersion) {
    if (!rollout.admitsStudent(m)) fail3();
    const canonical = current(db, m);
    if (!canonical || canonical.enrollmentId !== m.enrollmentId || canonical.revision !== m.revision || canonical.canonicalStamp !== m.canonicalStamp || version2(db, m) !== expectedVersion) fail3();
  }
  function issue(db, m, expectedVersion, { rotate = false } = {}) {
    check(db, m, expectedVersion);
    const previous = db.numericCredentials.filter((c2) => identity(c2, m) && c2.revokedAt === null);
    if (previous.length > 1 || previous.length && !rotate) fail3();
    if (!Number.isSafeInteger(expectedVersion + 1)) fail3();
    if (db.numericCredentials.filter((c2) => c2.format === CREDENTIAL_FORMAT).length >= CREDENTIAL_CAPACITY) fail3();
    let code, reserved;
    for (let attempt = 0; attempt < NUMERIC_POLICY.collisionBudget; attempt++) {
      code = generate();
      if (typeof code !== "string" || !/^1[0-9]{5}$/.test(code)) fail3();
      reserved = reservation(code);
      if (!db.numericCredentials.some((c2) => c2.reservation === reserved)) break;
      code = null;
    }
    if (!code) fail3();
    const c = {
      id: randomUUID3(),
      ownerId: m.ownerId,
      studentId: m.studentId,
      version: expectedVersion + 1,
      format: CREDENTIAL_FORMAT,
      keyVersion: activeKeyVersion,
      reservation: reserved,
      verifier: "",
      revokedAt: null
    };
    c.verifier = verifier(code, c);
    previous.forEach((c2) => revokeCredential(db, c2));
    db.numericCredentials.push(c);
    return { code, credentialVersion: c.version };
  }
  const issueMember = (db, m, { expectedVersion }) => issue(db, m, expectedVersion);
  const rotateMember = (db, m, { expectedVersion }) => issue(db, m, expectedVersion, { rotate: true });
  const revokeMember = (db, m, { expectedVersion }) => {
    check(db, m, expectedVersion);
    for (const c of db.numericCredentials.filter((c2) => identity(c2, m))) revokeCredential(db, c);
    return { revoked: true, credentialVersion: expectedVersion };
  };
  function createStudentHandler({ repository, verifyIngress, origin, project }) {
    if (!repository?.transaction || typeof verifyIngress !== "function" || typeof project !== "function" || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail3();
    return async (request) => {
      try {
        const claim = (request.path === "/student/claim" || request.path === "/api/n88/student/claim") && request.method === "POST";
        let attempt;
        if (claim) {
          if (typeof repository.claimAttempt !== "function" || typeof repository.commitAttemptSession !== "function" || typeof repository.settleAttempt !== "function") return response(denied2());
          attempt = await repository.claimAttempt(async (db, ports) => {
            const ingress = await verifyIngress(request, ports);
            if (!ingress?.clientKey) return false;
            const time2 = now();
            db.numericRates = db.numericRates.filter((r) => r.until > time2);
            db.numericAttempts = db.numericAttempts.filter((a2) => a2.until > time2);
            const source = mac2(reservationKey, "client-rate", ingress.clientKey);
            const get = (key2, max) => {
              let b = db.numericRates.find((b2) => b2.key === key2);
              if (!b && db.numericRates.length < NUMERIC_POLICY.maxRateKeys) db.numericRates.push(b = { key: key2, count: 0, until: time2 + NUMERIC_POLICY.windowMs, epoch: randomUUID3() });
              if (b && !b.epoch) b.epoch = randomUUID3();
              return b;
            };
            let blocked = false;
            for (const [key2, max] of [[mac2(reservationKey, "source-flood", ingress.clientKey), NUMERIC_POLICY.sourceRequests], [mac2(reservationKey, "global-flood"), NUMERIC_POLICY.globalRequests]]) {
              const b = get(key2, max);
              if (!b || b.count >= max) blocked = true;
              if (b) b.count = Math.min(max, b.count + 1);
            }
            if (blocked) return null;
            const budgets = [[source, NUMERIC_POLICY.clientAttempts], ["global", NUMERIC_POLICY.globalAttempts]], buckets = [];
            for (const [key2, max] of budgets) {
              const b = get(key2, max);
              if (!b || b.count >= max) blocked = true;
              if (b) buckets.push(b);
            }
            if (blocked || db.numericAttempts.length >= NUMERIC_POLICY.maxAttempts) return null;
            for (const b of buckets) b.count++;
            const a = {
              id: randomUUID3(),
              buckets: buckets.map(({ key: key2, epoch, until }) => ({ key: key2, epoch, until })),
              until: Math.max(...buckets.map((b) => b.until)),
              sessionId: null,
              settled: false
            };
            db.numericAttempts.push(a);
            return a.id;
          });
          if (!attempt) return response(denied2());
        }
        const authenticate = async (db, ports) => {
          const ingress = claim ? { clientKey: "prepaid" } : await verifyIngress(request, ports);
          const { headers = {}, method, body = {} } = request;
          const path = request.path.startsWith("/student/") ? "/api/n88" + request.path : request.path;
          if (!ingress?.clientKey || headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin" || method === "POST" && (headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied2();
          const time2 = now();
          const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || "")?.[1];
          if (path === "/api/n88/student/claim" && method === "POST") {
            const code = normalizeNumericCredential(body.code);
            if (!code) return denied2();
            const c2 = db.numericCredentials.find((c3) => c3.reservation === reservation(code));
            if (!c2 || c2.revokedAt !== null || !keys.has(c2.keyVersion) || !/^[a-f0-9]{64}$/.test(c2.verifier) || !timingSafeEqual2(Buffer.from(c2.verifier, "hex"), Buffer.from(verifier(code, c2), "hex"))) return denied2();
            if (typeof ports?.synchronizeOwner !== "function") fail3();
            if (!rollout.allowsOwner(c2.ownerId) || !db.memberships.some((m3) => identity(m3, c2) && rollout.allowsMember(m3))) return denied2();
            await ports.synchronizeOwner(c2.ownerId);
            const m2 = current(db, c2);
            if (!m2 || !rollout.admitsStudent(m2)) return denied2();
            if (token) {
              for (const s2 of db.numericSessions) if (s2.tokenHash === tokenHash(token) && rollout.allowsMember(s2)) s2.revokedAt = time2;
            }
            const fresh = randomBytes3(32).toString("base64url");
            db.numericSessions = db.numericSessions.filter((s2) => !rollout.allowsMember(s2) || s2.expiresAt > time2 && s2.revokedAt === null);
            if (db.numericSessions.length >= 1e4) fail3();
            db.numericSessions.push({
              id: randomUUID3(),
              credentialId: c2.id,
              ownerId: c2.ownerId,
              studentId: c2.studentId,
              classId: m2.classId,
              enrollmentId: m2.enrollmentId,
              membershipRevision: m2.revision,
              canonicalStamp: m2.canonicalStamp,
              version: c2.version,
              tokenHash: tokenHash(fresh),
              expiresAt: time2 + NUMERIC_POLICY.sessionMs,
              revokedAt: null
            });
            return { status: 200, body: { claimed: true }, cookie: cookie(fresh, NUMERIC_POLICY.sessionMs / 1e3) };
          }
          const s = token && db.numericSessions.find((s2) => s2.tokenHash === tokenHash(token));
          if (s && !rollout.allowsMember(s)) return denied2();
          if (path === "/api/n88/student/end" && method === "POST") {
            if (s) s.revokedAt = time2;
            return { status: 200, body: { ended: true }, cookie: cookie("", 0) };
          }
          if (path !== "/api/n88/student/read" || method !== "GET" || !s || s.revokedAt !== null || s.expiresAt <= time2) return denied2();
          const c = db.numericCredentials.find((c2) => c2.id === s.credentialId && identity(c2, s) && c2.version === s.version && c2.revokedAt === null);
          if (!c) return denied2();
          if (typeof ports?.synchronizeOwner !== "function") fail3();
          await ports.synchronizeOwner(c.ownerId);
          const m = current(db, c);
          if (!rollout.admitsStudent(m)) return denied2();
          if (!m || m.enrollmentId !== s.enrollmentId || m.classId !== s.classId || m.revision !== s.membershipRevision || m.canonicalStamp !== s.canonicalStamp) {
            s.revokedAt = time2;
            return denied2();
          }
          return { status: 200, body: await project(db, m, ports) };
        };
        if (!claim) return response(await repository.transaction(authenticate));
        const committed = await repository.commitAttemptSession(attempt, authenticate);
        if (committed.proof) {
          try {
            await repository.settleAttempt(committed.proof, now());
          } catch {
          }
        }
        return response(committed.value);
      } catch {
        return response(denied2());
      }
    };
  }
  return Object.freeze({ issueMember, rotateMember, revokeMember, createStudentHandler });
}

// drafts/n88-student-portal/integrated-service.mjs
var deny2 = () => ({ status: 401, body: { error: "unavailable" }, headers: PRIVATE_HEADERS });
var hash4 = (v) => createHash6("sha256").update(JSON.stringify(v)).digest("hex");
var camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
var sqlNames = { scoreSubitems: "score_subitems", scoreSubitemCompletions: "score_subitem_completions" };
var numeric = /* @__PURE__ */ new Set(["max", "value", "manualValue", "derivedValue", "perPoint", "penalty", "latePoints"]);
var columns = {
  years: "id,owner_id,revision,deleted_at,status",
  terms: "id,owner_id,revision,deleted_at,year_id,status,start_date,end_date",
  sections: "id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name",
  students: "id,owner_id,revision,deleted_at,status,name",
  enrollments: "id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date",
  teachings: "id,owner_id,revision,deleted_at,section_id,term_id,subject_id",
  items: 'id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id',
  scores: "id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value",
  scoreSubitems: 'id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points',
  scoreSubitemCompletions: "id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state",
  sessions: "id,owner_id,revision,deleted_at,teaching_id,date,status",
  attendance: "id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status",
  logs: "id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta"
};
async function readCanonical(ports, ownerId) {
  await ports.query("select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);
  const canonical = {};
  let bytes = 0;
  for (const table of CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    const selected = columns[table].replace(/\brevision\b/g, "revision::text as revision");
    const r = await ports.query(`select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select ${selected} from rakeezx.${sqlNames[table] || table} where owner_id=$1::uuid order by id limit $2) x) bounded`, [ownerId, 2001, 2 * 1024 * 1024 - bytes]);
    if (r.rows.length > 2e3) throw Error("n88_projection_bound");
    canonical[table] = r.rows.map(({ payload }) => {
      if (typeof payload !== "string" || (bytes += Buffer.byteLength(payload)) > 2 * 1024 * 1024) throw Error("n88_projection_bound");
      const raw = JSON.parse(payload), row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [camel(k), v]));
      row.deleted = row.deletedAt !== null;
      for (const k of numeric) if (row[k] != null) row[k] = Number(row[k]);
      return row;
    });
  }
  return canonical;
}
var fieldsOff = () => Object.fromEntries(VISIBILITY_FIELDS.map((f) => [f, false]));
var bindingKeys = ["ownerId", "sessionId", "leaseId", "teachingId", "classId", "termId", "contextRevision"];
function createIntegratedService(options, adapter, baseRepository) {
  const rollout = options.rollout ?? createRolloutGuard();
  const repository = withCredentialRepository(baseRepository);
  const credentials = createNumericCredentialOperations({ rollout, keys: /* @__PURE__ */ new Map([["v1", options.numericKey]]), activeKeyVersion: "v1", reservationKey: options.reservationKey });
  const recovery = createCodeRecovery({ keys: options.recoveryKeys, activeKeyVersion: options.recoveryActiveKeyVersion, otherKeys: [options.numericKey, options.reservationKey, options.ingressKey, options.secretKey] });
  const ownedCredential = (db, m) => {
    const cs = db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId && c.revokedAt === null);
    if (cs.length > 1) throw Error("n88_recovery_unavailable");
    return cs[0];
  };
  const recovering = Object.fromEntries(["issueMember", "rotateMember"].map((action) => [action, async (db, m, input, ports) => {
    const result2 = credentials[action](db, m, input), c = ownedCredential(db, m);
    await recovery.append(ports, c, result2.code);
    return result2;
  }]));
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
  async function scope(db, ports, auth, teachingId, input = {}) {
    const resolved = await createPgClassResolver()(db, ports, auth, teachingId, input);
    if (!resolved) return null;
    const canonical = await readCanonical(ports, auth.ownerId);
    const teaching = canonical.teachings.find((t) => t.id === teachingId), term = canonical.terms.find((t) => t.id === teaching?.termId);
    if (!teaching || !term || term.startDate && term.startDate > today() || term.endDate && term.endDate < today()) return null;
    return { ...resolved, canonical, termId: term.id };
  }
  const inputFor = (s, m) => ({ teacherContextVersion: "n88-canonical-teacher-context-v1", canonical: s.canonical, ownerId: s.ownerId, classId: s.classId, termId: s.termId, studentId: m.studentId, enrollmentId: m.enrollmentId, now: today() });
  async function policies(ports, ownerId, classId, termId) {
    const r = await ports.query("select payload from n88_private.class_visibility where owner_id=$1::uuid and class_id=$2 and term_id=$3", [ownerId, classId, termId]);
    return r.rows[0]?.payload || { revision: 0, fields: fieldsOff(), members: [] };
  }
  const student = credentials.createStudentHandler({ repository, verifyIngress: adapter.verifyIngress, origin: options.origin, project: async (db, m, ports) => {
    const canonical = await readCanonical(ports, m.ownerId);
    const terms = canonical.terms.filter((t) => !t.deleted && t.status === "active" && canonical.teachings.some((x) => !x.deleted && x.sectionId === m.classId && x.termId === t.id));
    if (terms.length !== 1) throw Error("n88_current_term");
    const s = { ownerId: m.ownerId, classId: m.classId, termId: terms[0].id, canonical }, policy = await policies(ports, m.ownerId, m.classId, s.termId);
    const stored = policy.members.find((p) => p.studentId === m.studentId && p.enrollmentId === m.enrollmentId);
    return projectStudentPortal({ ...inputFor(s, m), visibility: stored || null, taskGuidance: await readTaskGuidance(ports, s) });
  } });
  return async (request) => {
    if (request.path.startsWith("/student/")) return student(request);
    const match = /^\/teacher\/class\/(list|issue-missing|rotate|revoke|visibility|guidance-list|guidance-save)$/.exec(request.path);
    if (!match || request.method !== "POST") return deny2();
    const action = match[1], body = request.body || {}, binding = body.binding;
    if (!binding || Object.keys(binding).length !== bindingKeys.length || !bindingKeys.every((k) => typeof binding[k] === "string" && binding[k].length > 0 && binding[k].length <= 200) || binding.teachingId !== body.teachingId) return deny2();
    const verifyTeacher = async (r2, ports) => {
      const auth = await adapter.verifyTeacher(r2, ports);
      return auth?.ownerId === binding.ownerId && auth.sessionId === binding.sessionId ? auth : null;
    };
    const resolveClass = (db, ports, auth, teachingId, input) => scope(db, ports, auth, teachingId ?? body.teachingId, input).then((s) => {
      if (!s || s.classId !== binding.classId || s.termId !== binding.termId || !rollout.admitsTeacher(auth, s)) return null;
      if (rollout.mode === "pilot" && !db.contexts.some((c) => c.ownerId === auth.ownerId)) db.contexts.push({ namespace: "n88_pilot_" + randomUUID4(), ownerId: auth.ownerId, active: true });
      return s;
    });
    const ops = createClassCredentialOperations({ rollout, repository, ...credentials, ...recovering, origin: options.origin, verifyIngress: adapter.verifyIngress, verifyTeacher, resolveClass });
    if (action === "visibility" || action === "list" || action.startsWith("guidance-")) {
      try {
        return await repository.transaction(async (db, ports) => {
          const h = request.headers || {};
          if (!await adapter.verifyIngress(request, ports) || h.origin !== options.origin || h["x-n88-csrf"] !== "1" || h["content-type"] !== "application/json" || h["sec-fetch-site"] && h["sec-fetch-site"] !== "same-origin") return deny2();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.current || !rollout.allowsOwner(auth.ownerId)) return deny2();
          const s = await resolveClass(db, ports, auth, body.teachingId, body);
          if (!s) return deny2();
          await ports.synchronizeOwner(auth.ownerId);
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === s.classId && m.status === "active" && !m.endDate && m.studentActive && m.classActive && rollout.admitsStudent(m));
          if (members.length > 2e3 || new Set(members.map((m) => m.studentId)).size !== members.length || members.some((m) => db.memberships.filter((x) => x.ownerId === m.ownerId && x.studentId === m.studentId && x.status === "active" && !x.endDate && x.studentActive && x.classActive).length !== 1)) return deny2();
          const rosterRevision = hash4([s.teachingId, s.revision, members.sort((a, b) => a.studentId.localeCompare(b.studentId)).map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          let p = await policies(ports, s.ownerId, s.classId, s.termId), data2;
          if (action.startsWith("guidance-")) {
            const sources = authorizedGuidanceSources(s, members, p, inputFor), stored = await readTaskGuidance(ports, s);
            if (action === "guidance-list") data2 = { tasks: guidanceTeacherList(sources, stored) };
            else {
              if (Object.keys(body).sort().join(",") !== "binding,guidance,requestId,teachingId" || typeof body.requestId !== "string" || body.requestId.length > 100) return deny2();
              data2 = await saveTaskGuidance(ports, s, sources.find((x) => x.subitemId === body.guidance?.subitemId), stored, body.guidance);
            }
          } else if (action === "visibility") {
            if (p.revision !== body.policyRevision || body.expectedRosterRevision !== rosterRevision || !body.fields || Object.keys(body.fields).length !== 6 || !VISIBILITY_FIELDS.every((f) => typeof body.fields[f] === "boolean")) return deny2();
            const membersPolicy = members.map((m) => {
              const input = inputFor(s, m), b = studentPortalPublicationBindings(input);
              return { version: "n88-visibility-v1", ownerId: s.ownerId, studentId: m.studentId, enrollmentId: m.enrollmentId, classId: s.classId, termId: s.termId, scopeStamp: b.scopeStamp, fields: body.fields, sources: b.sources.map((src) => ({ ...src, publicationId: randomUUID4() })) };
            });
            p = { revision: p.revision + 1, fields: body.fields, members: [...p.members.filter((m) => !rollout.allowsMember(m)), ...membersPolicy] };
            await ports.query("insert into n88_private.class_visibility(owner_id,class_id,term_id,payload) values($1::uuid,$2,$3,$4::jsonb) on conflict(owner_id,class_id,term_id) do update set payload=excluded.payload", [s.ownerId, s.classId, s.termId, JSON.stringify(p)]);
            data2 = { updated: true, policyRevision: p.revision, fields: p.fields };
          } else data2 = { classId: s.classId, rosterRevision, policyRevision: p.revision, visibility: p.fields, students: await Promise.all(members.map(async (m) => {
            const cs = db.numericCredentials.filter((c2) => c2.ownerId === m.ownerId && c2.studentId === m.studentId);
            const c = ownedCredential(db, m), r2 = c ? await recovery.read(ports, c) : { status: "inactive", credential: null };
            return { recoveryStatus: r2.status, credential: r2.credential, studentId: m.studentId, enrollmentId: m.enrollmentId, revision: m.revision, label: m.label, hasActiveCode: cs.some((c2) => c2.revokedAt === null), credentialVersion: Math.max(0, ...cs.map((c2) => c2.version)) };
          })) };
          return { status: 200, body: { ack: true, binding, requestId: body.requestId ?? null, data: data2, rollout: rollout.mode }, headers: PRIVATE_HEADERS };
        });
      } catch {
        return { ...deny2(), status: 503 };
      }
    }
    const current = ops.forRequest(request);
    const result2 = action === "issue-missing" ? await current.issueMissingClassCodes(body.teachingId, body) : await current[action](body);
    if (result2.status !== 200) return result2;
    const r = result2.body, created = r.results.filter((x) => x.status === "created").map((x) => ({ studentId: x.studentId, enrollmentId: x.enrollmentId, credentialVersion: x.credentialVersion, credential: r.secrets.find((s) => s.studentId === x.studentId).code }));
    let data;
    if (action === "issue-missing") data = { requestId: r.requestId, created, skipped: r.results.filter((x) => x.status === "skipped").map((x) => ({ studentId: x.studentId, reason: x.reason === "existing" ? "existing" : "revoked" })), failed: r.results.filter((x) => x.status === "failed").map((x) => ({ studentId: x.studentId, reason: "unavailable" })), uncertain: r.results.some((x) => x.status === "uncertain") };
    else {
      const x = r.results[0];
      if (!x || x.status === "failed" || x.status === "uncertain") return { ...deny2(), status: 503 };
      data = { studentId: x.studentId, enrollmentId: x.enrollmentId, credentialVersion: x.credentialVersion, ...action === "rotate" ? { rotated: true, credential: created[0].credential } : { revoked: true } };
    }
    return { ...result2, body: { ack: true, binding, requestId: body.requestId ?? null, data } };
  };
}

// drafts/n88-student-portal/postgres-repository.mjs
import { Buffer as Buffer7 } from "node:buffer";

// drafts/n88-student-portal/activation/private-error-boundary.mjs
import { Buffer as Buffer6 } from "node:buffer";

// drafts/n88-student-portal/activation/error-boundary-contract.json
var error_boundary_contract_default = {
  version: 1,
  encoding: "bound-base64-pg-text-v1",
  controls: [
    "begin isolation level read committed",
    "commit",
    "release savepoint n88_member_recovery",
    "rollback to savepoint n88_member_recovery",
    "savepoint n88_member_recovery",
    "select pg_advisory_xact_lock(1312307256, 88)",
    "select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)"
  ],
  sources: [
    {
      file: "drafts/n88-student-portal/canonical-adapter.mjs",
      sha256: "8adcb9958f559b26d9d090bccab7d070308b8b649eff97ebbe49fdc00b87b458"
    },
    {
      file: "drafts/n88-student-portal/class-credentials.mjs",
      sha256: "97d4c4bb6580a53ae49d20cf95dc48620c8e59ad91b665fb23f811b833f516ad"
    },
    {
      file: "drafts/n88-student-portal/auth-verifier.mjs",
      sha256: "3f50b305d2754bb676afdbfe6051ed892e0019875c5fe1985dff61d7a2ef60c1"
    },
    {
      file: "drafts/n88-student-portal/web-entry.mjs",
      sha256: "fe079ed58f6b066d3b23048a51f5c96e0ea318ca7eca0caa9e825cd4a071bef5"
    },
    {
      file: "drafts/n88-student-portal/integrated-service.mjs",
      sha256: "2190d7b615fb09a546d62e083f063eb3b230ba24a64667cd3da3f1045c649ac2"
    },
    {
      file: "drafts/n88-student-portal/code-recovery.mjs",
      sha256: "ecc33c475b5bd05f09fd2baa90002f9f63c0c71dff81464183c86d8020391c55"
    },
    {
      file: "drafts/n88-student-portal/task-guidance.mjs",
      sha256: "a3b929b13ce02d05a211cf9eb078cf3f3403a3ec6db04a7271f3c878741de88a"
    },
    {
      file: "drafts/n88-student-portal/postgres-repository.mjs",
      sha256: "239bb6c146eaf61e9e9598e6e69a74e79e5a43cf4ad4d6922a62c72715069443"
    }
  ],
  operations: [
    {
      sql: "delete from n88_private.class_credential_receipts where row_key=$1",
      name: "boundary_7df61daf6fc50a8d06ed8a29",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.contexts where namespace=$1",
      name: "boundary_3d90c7fa0fac5598b1e1bb6c",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.credentials where id=$1",
      name: "boundary_3212e88aaa7d7eb7950a7158",
      parameters: [
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.guess_budgets where key=$1",
      name: "boundary_0886008cf6c0da2968564042",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.memberships where owner_id=$1 and class_id=$2 and student_id=$3 and enrollment_id=$4",
      name: "boundary_8ab6a6674ff3f98609cccf79",
      parameters: [
        "uuid",
        "text",
        "text",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.numeric_attempts where row_key=$1",
      name: "boundary_541e1603c6f1fd9d4bfd9638",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.numeric_credentials where row_key=$1",
      name: "boundary_bf3541bec260c19aeaf147e0",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.numeric_rates where row_key=$1",
      name: "boundary_f824c60ac8562824f8a15aeb",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.numeric_sessions where row_key=$1",
      name: "boundary_82d5bc8d4ddbfb141c068308",
      parameters: [
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.publications where id=$1",
      name: "boundary_7405cad4b228853c8a7a5267",
      parameters: [
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n88_private.sessions where id=$1",
      name: "boundary_d556945d2d95f6add8f9ccb4",
      parameters: [
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "insert into n88_private.class_credential_receipts(row_key,payload) values($1,$2::jsonb)",
      name: "boundary_5bd93436112ac6e1081b19e5",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.class_credential_receipts(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload",
      name: "boundary_3cfa500ea5d8a72f35432655",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.class_visibility(owner_id,class_id,term_id,payload) values($1::uuid,$2,$3,$4::jsonb) on conflict(owner_id,class_id,term_id) do update set payload=excluded.payload",
      name: "boundary_98693bf59f6ec88385d1a2e8",
      parameters: [
        "uuid",
        "text",
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.code_recovery(row_key,payload) values($1,$2::jsonb) on conflict(key_version,nonce) do nothing",
      name: "boundary_ac418692d93da9a37ef4d438",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.contexts (namespace,owner_id,active) values ($1,$2,$3)",
      name: "boundary_857bc5c5bf5d0480e3feddef",
      parameters: [
        "text",
        "uuid",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.credentials (id,namespace,owner_id,student_id,version,verifier,entry_verifier,revoked_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      name: "boundary_8505c9e47aa85eab7abcbe9a",
      parameters: [
        "uuid",
        "text",
        "uuid",
        "text",
        "bigint",
        "text",
        "text",
        "timestamp with time zone"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.guess_budgets (key,count,until_at) values ($1,$2,$3)",
      name: "boundary_ec7d0eb73f55bc0a5eb0503e",
      parameters: [
        "text",
        "integer",
        "timestamp with time zone"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.memberships (owner_id,class_id,student_id,enrollment_id,revision,status,end_date,student_active,class_active,label,canonical_stamp,active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      name: "boundary_39534a0df755e773bcc021c2",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "bigint",
        "text",
        "date",
        "boolean",
        "boolean",
        "text",
        "text",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_attempts(row_key,payload) values($1,$2::jsonb)",
      name: "boundary_2a8e33366f34f64e735098e6",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_attempts(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload",
      name: "boundary_529c57f7292a540a297bb56a",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)",
      name: "boundary_9e91362aab78847b4a47db61",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload",
      name: "boundary_b594ab1d10c68ceac544f2f4",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_rates(row_key,payload) values($1,$2::jsonb)",
      name: "boundary_576116ad97aa1134011b5787",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_rates(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload",
      name: "boundary_54df59eab3551edda375b0b3",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)",
      name: "boundary_0ea5712c847150d0ad160f76",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload",
      name: "boundary_a71168a3808c25e88da242ab",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.publications (id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline,status,published) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      name: "boundary_944e29878190b042600a43aa",
      parameters: [
        "uuid",
        "uuid",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "date",
        "text",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.sessions (id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision,entry_verifier,token_hash,expires_at,revoked_at,canonical_stamp) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      name: "boundary_7f808429affeb651ad77cae5",
      parameters: [
        "uuid",
        "uuid",
        "text",
        "uuid",
        "text",
        "text",
        "text",
        "bigint",
        "bigint",
        "text",
        "text",
        "timestamp with time zone",
        "timestamp with time zone",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n88_private.task_guidance(owner_id,class_id,term_id,teaching_id,subitem_id,payload) values($1::uuid,$2,$3,$4,$5,$6::jsonb) on conflict(owner_id,class_id,term_id,teaching_id,subitem_id) do update set payload=excluded.payload",
      name: "boundary_0f039dccf91dfe6f4bc30ece",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "rollback",
      name: "boundary_da25480fb483e6ce3d30f1a1",
      parameters: [],
      output: [],
      effect: true,
      voidResult: false,
      command: "ROLLBACK"
    },
    {
      sql: 'select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=$1::uuid order by id limit $2) x) bounded',
      name: "boundary_ad2e84fec89ba9c5b1fd5f20",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_0e8834ccf4cac5f256e9a2ad",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_e42d2de24a5b2a9d458219d0",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_7700d235b1326b49506b1222",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_4f1ae4e620baf4b52e65c866",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_38603fea89bb426312fb13d0",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_2c10f3346e981b9ed2dc8305",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_7eaf0e6ad46189c16f430c17",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_4b08189b1399c922f5d61eb4",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_c1e4d457aa8a6c7bd31e5277",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: 'select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=$1::uuid order by id limit $2) x) bounded',
      name: "boundary_c365a70fb8ff3318f2e1f14c",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_b75844e451c72d86ecce7361",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x) bounded",
      name: "boundary_218f1146d50bdae36e06ce85",
      parameters: [
        "uuid",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version::text as version,membership_revision::text as membership_revision,entry_verifier,token_hash,(extract(epoch from expires_at)*1000)::text as expires_at,(extract(epoch from revoked_at)*1000)::text as revoked_at,canonical_stamp from n88_private.sessions limit $1) t) bounded",
      name: "boundary_7212828c13ad9de67788e95a",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,namespace,owner_id,student_id,version::text as version,verifier,entry_verifier,(extract(epoch from revoked_at)*1000)::text as revoked_at from n88_private.credentials limit $1) t) bounded",
      name: "boundary_b03c8ea8391678ae71b8031e",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline::text as deadline,status,published from n88_private.publications limit $1) t) bounded",
      name: "boundary_529c1bf7ab8f896422e93ff3",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select key,count::text as count,(extract(epoch from until_at)*1000)::text as until_at from n88_private.guess_budgets limit $1) t) bounded",
      name: "boundary_c17a55bfb4d6e130fbbe3e4d",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select namespace,owner_id,active from n88_private.contexts limit $1) t) bounded",
      name: "boundary_6445f4cd91ac31e4400b91b5",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select owner_id,class_id,student_id,enrollment_id,revision::text as revision,status,end_date::text as end_date,student_active,class_active,label,canonical_stamp,active from n88_private.memberships limit $1) t) bounded",
      name: "boundary_d77d8b0fcafaf2d6444a9283",
      parameters: [
        "bigint",
        "integer",
        "bigint"
      ],
      output: [
        {
          name: "bounded_row",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload\n      from (select row_to_json(x)::text as payload from (\n        select e.owner_id,e.id as enrollment_id,e.section_id,e.student_id,e.revision::text as revision,\n          e.status,e.end_date::text as end_date,e.deleted_at is null as enrollment_present,\n          s.status='active' and s.deleted_at is null as student_active,left(s.name,300) as label,\n          c.status='active' and c.deleted_at is null and y.status='active' and y.deleted_at is null as class_active,\n          s.revision::text as student_revision,c.revision::text as section_revision,y.revision::text as year_revision\n        from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id\n        join rakeezx.sections c on c.owner_id=e.owner_id and c.id=e.section_id\n        join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id\n        where e.owner_id=any($1::uuid[]) order by e.owner_id,e.id limit $2\n      ) x) bounded",
      name: "boundary_5c9fc4857874ea5002e6604f",
      parameters: [
        "uuid[]",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload\n      from (select row_to_json(x)::text as payload from (\n        select i.owner_id,i.id as item_id,left(i.name,160) as title,t.id as teaching_id,t.section_id,\n          i.revision::text as item_revision,t.revision::text as teaching_revision,term.revision::text as term_revision\n        from rakeezx.items i join rakeezx.teachings t on t.owner_id=i.owner_id and t.id=i.teaching_id\n        join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id\n        join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id\n        where i.owner_id=any($1::uuid[]) and i.deleted_at is null and t.deleted_at is null\n          and term.deleted_at is null and term.status='active' and term.year_id=c.year_id\n          and i.auto is null order by i.owner_id,i.id limit $2\n      ) x) bounded",
      name: "boundary_7dfce5786c5f02dcc6e78f35",
      parameters: [
        "uuid[]",
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.class_credential_receipts limit $1",
      name: "boundary_7241eedcf190b772374229ea",
      parameters: [
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.numeric_attempts limit $1",
      name: "boundary_663dba1cb7b909fd24ac94e2",
      parameters: [
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.numeric_credentials limit $1",
      name: "boundary_fada095ce38b422ccf61f489",
      parameters: [
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.numeric_rates limit $1",
      name: "boundary_017a62b1b935f2eb760ae1e8",
      parameters: [
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.numeric_sessions limit $1",
      name: "boundary_e9d8defc0078b184176ffedf",
      parameters: [
        "bigint",
        "integer"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted",
      name: "boundary_f47daacda1442e346327b60d",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "accepted",
          type: "boolean",
          oid: 16
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select n88_private.lock_canonical_sources($1::uuid,$2::integer)",
      name: "boundary_fd19cd46f568a4ae38795f6d",
      parameters: [
        "uuid",
        "integer"
      ],
      output: [
        {
          name: "lock_canonical_sources",
          type: "void",
          oid: 2278
        }
      ],
      effect: false,
      voidResult: true,
      command: "SELECT"
    },
    {
      sql: "select n88_private.lock_projection_sources($1::uuid,$2::integer)",
      name: "boundary_522656818781827547d463af",
      parameters: [
        "uuid",
        "integer"
      ],
      output: [
        {
          name: "lock_projection_sources",
          type: "void",
          oid: 2278
        }
      ],
      effect: false,
      voidResult: true,
      command: "SELECT"
    },
    {
      sql: "select payload from n88_private.class_visibility where owner_id=$1::uuid and class_id=$2 and term_id=$3",
      name: "boundary_b44d6bc61d9a2d54becc9173",
      parameters: [
        "uuid",
        "text",
        "text"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1",
      name: "boundary_36aea132fd3436ff82bed847",
      parameters: [
        "uuid"
      ],
      output: [
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select subitem_id,teaching_id,case when sum(octet_length(payload::text)) over(order by teaching_id,subitem_id rows unbounded preceding)<=2097152 then payload::text else null end as bounded_payload from n88_private.task_guidance where owner_id=$1::uuid and class_id=$2 and term_id=$3 and ($4::text is null or teaching_id=$4) order by teaching_id,subitem_id limit 2001",
      name: "boundary_c0c8bf88c9afd629c6d80e9f",
      parameters: [
        "uuid",
        "text",
        "text",
        "text"
      ],
      output: [
        {
          name: "subitem_id",
          type: "text",
          oid: 25
        },
        {
          name: "teaching_id",
          type: "text",
          oid: 25
        },
        {
          name: "bounded_payload",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select t.id,t.section_id,t.revision::text as teaching_revision,\n      term.revision::text as term_revision from rakeezx.teachings t\n      join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id\n      join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id\n      join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id\n      where t.owner_id=$1::uuid and t.id=$2 and t.deleted_at is null\n        and term.deleted_at is null and term.status='active' and term.year_id=c.year_id\n        and c.deleted_at is null and c.status='active' and y.deleted_at is null and y.status='active'",
      name: "boundary_15ce9f3bf91799d8d16c15e4",
      parameters: [
        "uuid",
        "text"
      ],
      output: [
        {
          name: "id",
          type: "text",
          oid: 25
        },
        {
          name: "section_id",
          type: "text",
          oid: 25
        },
        {
          name: "teaching_revision",
          type: "text",
          oid: 25
        },
        {
          name: "term_revision",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)",
      name: "boundary_988735ac2a1a18389fa0bd91",
      parameters: [
        "uuid",
        "uuid"
      ],
      output: [
        {
          name: "user_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "session_id",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "update n88_private.class_credential_receipts set payload=$2::jsonb where row_key=$1",
      name: "boundary_fbd717658ec0391f83b6ca1e",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.contexts set owner_id=$2,active=$3 where namespace=$1",
      name: "boundary_e132519164f58f14ceaa901e",
      parameters: [
        "text",
        "uuid",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.credentials set namespace=$2,owner_id=$3,student_id=$4,version=$5,verifier=$6,entry_verifier=$7,revoked_at=$8 where id=$1",
      name: "boundary_08056655f7c73fdf53693a15",
      parameters: [
        "uuid",
        "text",
        "uuid",
        "text",
        "bigint",
        "text",
        "text",
        "timestamp with time zone"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.guess_budgets set count=$2,until_at=$3 where key=$1",
      name: "boundary_2743c40170e1429751d7cce8",
      parameters: [
        "text",
        "integer",
        "timestamp with time zone"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.memberships set revision=$5,status=$6,end_date=$7,student_active=$8,class_active=$9,label=$10,canonical_stamp=$11,active=$12 where owner_id=$1 and class_id=$2 and student_id=$3 and enrollment_id=$4",
      name: "boundary_dc3c6d47e9eefd6fefb577c1",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "bigint",
        "text",
        "date",
        "boolean",
        "boolean",
        "text",
        "text",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.numeric_attempts set payload=$2::jsonb where row_key=$1",
      name: "boundary_8926885bfe3455b81ae48704",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.numeric_credentials set payload=$2::jsonb where row_key=$1",
      name: "boundary_f8de722d3598965d1cab8cd6",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.numeric_rates set payload=$2::jsonb where row_key=$1",
      name: "boundary_81d29f136a65d7b7fb3e22b7",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.numeric_sessions set payload=$2::jsonb where row_key=$1",
      name: "boundary_8c4937430e36c8e787e93929",
      parameters: [
        "text",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.publications set owner_id=$2,class_id=$3,student_id=$4,enrollment_id=$5,source_teaching_id=$6,source_item_id=$7,title=$8,instruction=$9,deadline=$10,status=$11,published=$12 where id=$1",
      name: "boundary_fa9d3af42f20a68890242235",
      parameters: [
        "uuid",
        "uuid",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "date",
        "text",
        "boolean"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n88_private.sessions set credential_id=$2,namespace=$3,owner_id=$4,class_id=$5,student_id=$6,enrollment_id=$7,version=$8,membership_revision=$9,entry_verifier=$10,token_hash=$11,expires_at=$12,revoked_at=$13,canonical_stamp=$14 where id=$1",
      name: "boundary_a0e680634378c9709f443e76",
      parameters: [
        "uuid",
        "uuid",
        "text",
        "uuid",
        "text",
        "text",
        "text",
        "bigint",
        "bigint",
        "text",
        "text",
        "timestamp with time zone",
        "timestamp with time zone",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    }
  ],
  migration: {
    path: "supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql",
    sha256: "8c98bd3267364d80c9feb6dd527c19dd11064ede64b66ca01ed83fb221b6de76"
  }
};

// drafts/n88-student-portal/activation/error-boundary-identities.json
var error_boundary_identities_default = [
  {
    name: "boundary_017a62b1b935f2eb760ae1e8",
    definition: "ad8422183f03522f2cf4fb61e10234bd9deb4d9afa0d9fa1c095e2723c7f3482",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_08056655f7c73fdf53693a15",
    definition: "b6d4ee3f5c65b801a1994cfad2d155bb78eca9894bcdee3c36aac86228bc23f1",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0886008cf6c0da2968564042",
    definition: "a896dce5b6ab4765b817991d0e63f0fdd7defe72f31cdf5c55d252c0484e0130",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0e8834ccf4cac5f256e9a2ad",
    definition: "a8cc18cd9705dc81930fec74bb85b14d4e57d19a93d895cf5318a5a87b3234f7",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0ea5712c847150d0ad160f76",
    definition: "766c104178bfb3fce514e8f7a913209bd12517a5e6fe32ec8843487727268618",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0f039dccf91dfe6f4bc30ece",
    definition: "5a6788e94ca627e4780160d9763d41b7bd9ca4439c599f0ac5072de6f0c015ec",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_15ce9f3bf91799d8d16c15e4",
    definition: "6681ab3f0aaa37114e24bc9bbc6a09f35f7f8600ae487e32d2c6d79bcae772fb",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_218f1146d50bdae36e06ce85",
    definition: "4630fcaa6b373f72693e6ea1b3f46dec4ce429254d7158cba30c669265b31090",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_2743c40170e1429751d7cce8",
    definition: "c866c6f9d731dd96b9e7a09c09a0ae5b5e158be7f1e48109be996fccc7d3efcc",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_2a8e33366f34f64e735098e6",
    definition: "04678ead252ae91ab98546e1f78684a4f3f3069e9009738dbd63c32d5ab75628",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_2c10f3346e981b9ed2dc8305",
    definition: "459bb1477268348aec77ae632ff83b038e070b1ae8ee8aa21f928a4b24b97d0f",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_3212e88aaa7d7eb7950a7158",
    definition: "f501f787912d3546d6278a79bdb34ab0fd1048242f320859315d204e31cd7a63",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_36aea132fd3436ff82bed847",
    definition: "960363079de3518c5fc0e14af32fc6999d0c41d6070a4001b278509b9acf777f",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_38603fea89bb426312fb13d0",
    definition: "623879b0dddc1dc6eeec6da5f6a68adcef63d8bfb233119c88af92d50be42175",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_39534a0df755e773bcc021c2",
    definition: "643a4426a6572f347d3c29a80deb593f351535155e539caa36842551f09d5bb9",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_3cfa500ea5d8a72f35432655",
    definition: "02008954d6fd13a5b288064c784c886d50a49207d48822a5ce2eda75f922d788",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_3d90c7fa0fac5598b1e1bb6c",
    definition: "1c06f2a2880d7ff8ad62fa41f8172a464af1e097385211f43444675370feda22",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_4b08189b1399c922f5d61eb4",
    definition: "23b21c17cb48cc20ddf9ea50fdc307a7738ccf8cb7b273756e736badf462ad1f",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_4f1ae4e620baf4b52e65c866",
    definition: "e14386418910aa6dac1847260f95f05e30c9be6ffa7301cfebaafd3f5eeda7b7",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_522656818781827547d463af",
    definition: "43a02a5179b55a57dbb0230ae678187dae9e989badf324f7518a71a61101ce8a",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_529c1bf7ab8f896422e93ff3",
    definition: "33f29a040de7715ead47705ad9acadf11f658daf4f7d77f3a82de5d8de10274c",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_529c57f7292a540a297bb56a",
    definition: "d8680cb3f457d1144c390e9759f4d170943d4eb46bb4c2416275868bff7b7ef9",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_541e1603c6f1fd9d4bfd9638",
    definition: "e262b8fce50ec2734de479de75745eb980bf9f300667b8b8a3136f0ea6957e19",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_54df59eab3551edda375b0b3",
    definition: "bfb02e7ef9779d91c982fd0cf9460d3430df4a592cf3cf437a92f32e00a9c745",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_576116ad97aa1134011b5787",
    definition: "c5c1a58e256b47278e3d6ca6b18af3523e612a561373b2bc7a02d73cc9b8c0c8",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_5bd93436112ac6e1081b19e5",
    definition: "cb155ead3497fc6809d2545ba460cf4ac8f76f3a7546dbb563afb5c0498ccf11",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_5c9fc4857874ea5002e6604f",
    definition: "a869572dd14041fdb2749ddb2105f02d27266ca8a597c86b0ce9e0b502c3001a",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_6445f4cd91ac31e4400b91b5",
    definition: "ca3f9a055a2689c884fa2b984de94f8f3e9e1013bf7249899a530631a16d3dcd",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_663dba1cb7b909fd24ac94e2",
    definition: "126dc30a800aea5a6179ac661a0bc695f237790ab5187b4cb7e457598e8d8f27",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7212828c13ad9de67788e95a",
    definition: "007b4d108cff11e6ad06f26d060ac37dd2b32a6713364285e2f57679f47196b0",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7241eedcf190b772374229ea",
    definition: "83f5051a828b2bf8494937be1d5c2ac8c3a631eafd1455851cfd613ee1b34705",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7405cad4b228853c8a7a5267",
    definition: "4c90c97ee3a76fe180fd8123c0161e15947d13aea34562a7407d5d99f2bee5fe",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7700d235b1326b49506b1222",
    definition: "e8d60e7ff5098c2dedb3629b7cc57f947c16c28fa8f503b1159793f5c6b73a08",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7df61daf6fc50a8d06ed8a29",
    definition: "461f1cf7aa2c5823b427028163ec547113594c427c6b4b6404746c5d70479f70",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7dfce5786c5f02dcc6e78f35",
    definition: "42e1f98a379cb42e24f4518ffb50e005fcddcd4c770c9ecf7b9aa6ec0f5a0a75",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7eaf0e6ad46189c16f430c17",
    definition: "c5f79324ec66d55f23c2bcc64afb1f31d9073b45469e32fbbd1f9e1c7c50a142",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7f808429affeb651ad77cae5",
    definition: "a9494c2bbb40ce22076d3f2f4594a3bd2bdcc0c66f4cf3bfaea707b6ffaba173",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text, p13 text, p14 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_81d29f136a65d7b7fb3e22b7",
    definition: "7a893aa26f6e962a8006524225049a44c404fcacfcb8fc789f6fc62e90c0012e",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_82d5bc8d4ddbfb141c068308",
    definition: "ab80e115c5f97c4e8e8ed9d8693fa70c85f0a412ff568ca86d07e9a12a2c1fd2",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8505c9e47aa85eab7abcbe9a",
    definition: "49fcd5e37c20cbe115c2e48be888713b08eaf353bcc6042a5c23ebcbdc1ff915",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_857bc5c5bf5d0480e3feddef",
    definition: "480323908094fab241d130309ce128361753993624a1480ed0f4b7434508bd9e",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8926885bfe3455b81ae48704",
    definition: "a500a3cdfe0d7c29390d0c379dd4911b44f6cec2cf377472a4456d72224fb295",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8ab6a6674ff3f98609cccf79",
    definition: "31c37b9f2136e484082360906c5541c83b80d4864ba99bf6b35dc0fd965e0755",
    arguments: "p1 text, p2 text, p3 text, p4 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8c4937430e36c8e787e93929",
    definition: "0985aa5e0ffee29c6c6d79531133993577d6377a958da5354ac7f5a5e20ff1f7",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_944e29878190b042600a43aa",
    definition: "526d2c07734c3c727fc216dff567c33ff3cd5fb61ebac566640a3cc59c560455",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_98693bf59f6ec88385d1a2e8",
    definition: "217cf2a2f74bc71dead4eaff9200a4655ab3ae81c836516610345abc5903ea8d",
    arguments: "p1 text, p2 text, p3 text, p4 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_988735ac2a1a18389fa0bd91",
    definition: "820b181a5858b8ffb71db4f67d303fbb5ba8cdfef99365f779734230e13f53ab",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_9e91362aab78847b4a47db61",
    definition: "825b1b5e41641ad1ebe4a7737452587eb31f38e80e6207fb98cb3e8e1b33f8d9",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_a0e680634378c9709f443e76",
    definition: "f44750571117bbe017851c37aa35fe6dc662f6c96fb7f80badef66c5f04d9df4",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text, p13 text, p14 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_a71168a3808c25e88da242ab",
    definition: "2bf1bb4d0689e1a14503c05e239c287f6652b2488fd36077b768c3d3d3283b43",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_ac418692d93da9a37ef4d438",
    definition: "d19653b054e5b972f2e23fedc431ac01aaf92daa5dab4c3fff5a5f682942c23e",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_ad2e84fec89ba9c5b1fd5f20",
    definition: "f31685c46fc1761ab2b24f72284527a1bcbd7547727bacfa0439ffc88b0f5ea3",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_b03c8ea8391678ae71b8031e",
    definition: "2f923d8926c50ddf914e645913f70fe468d41d0b7400b4e16b49faa1f74b086a",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_b44d6bc61d9a2d54becc9173",
    definition: "4411a875c7eb5086d29a42bcc90ac7dbebb144a6735d4acff3b2f6bf124a7a82",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_b594ab1d10c68ceac544f2f4",
    definition: "98a34e56d8d81ebb2906e8ebcdc292af532aacb6a998df0d757d4bdb7cc3af3b",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_b75844e451c72d86ecce7361",
    definition: "d093ceaae66054c4a7a881d2430fdae06f15c935885f2d6af1c7fc461f1f714f",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_bf3541bec260c19aeaf147e0",
    definition: "ce486e129038dbf97d29aa477fb93676b1a9671e16c8a4d01e878e8ae8de3cc3",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_c0c8bf88c9afd629c6d80e9f",
    definition: "43ea53ded05e3694b8ed623ee124c7bd0ca1dbe6d861f3adeae6a77289f19da0",
    arguments: "p1 text, p2 text, p3 text, p4 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_c17a55bfb4d6e130fbbe3e4d",
    definition: "a87dcc303a7fdfe9447819a99d097562c47f0cb036f379c1a4ad50434fe46fed",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_c1e4d457aa8a6c7bd31e5277",
    definition: "d3142c193c0ccf0b4f344a1eeb4d545551a67b0626aecb62c3b9c9b3442dcf2d",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_c365a70fb8ff3318f2e1f14c",
    definition: "1ba973d727104171a93f95e99f3748f9783bad00df755c0f726abadaf6c7a3c5",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_d556945d2d95f6add8f9ccb4",
    definition: "70425a13cb560b5d2dc3d323932865422b9b8c743f61606209d566b041579417",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_d77d8b0fcafaf2d6444a9283",
    definition: "0cb4a4fc11af24430203494d63f9beb6bd4e9a5075b10cc657d260b0c30992e1",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_da25480fb483e6ce3d30f1a1",
    definition: "65898ab88b559617ef1d141efaeb4fb0f332ea85fb2fdb738cc8a51def0b5c9f",
    arguments: "",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_dc3c6d47e9eefd6fefb577c1",
    definition: "3d0833b14db2260e82a9dae9d738dd0fc81bbf4c727abc2e3a083961e2ad3b74",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_e132519164f58f14ceaa901e",
    definition: "6d86b5e404aec1ae81276512d3fe2c60dcf190ad3daa11339ed1e249b751e1f3",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_e42d2de24a5b2a9d458219d0",
    definition: "8bdbaf199f15e00f4c00fbe28297ccd4b90ae06b174a2c0b9dfb871a17d6e5f4",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_e9d8defc0078b184176ffedf",
    definition: "2aa3549d5c2f388337d8e3565d10452c6ceea55e907d2b99656bce3b0d2e26b4",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_ec7d0eb73f55bc0a5eb0503e",
    definition: "63c949a642acda85ca80a2e6526dff3787ffecebd6b45654ef79616973ccff2c",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_f47daacda1442e346327b60d",
    definition: "f83946afa6d20471ddfbcccba3bd1c7395d996563b3f68fa2baaf8ec2bfe0152",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_f824c60ac8562824f8a15aeb",
    definition: "8330256e81d7ccddefa6ea7e343a7348a12e250b1c813c360111dc68ef76a877",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_f8de722d3598965d1cab8cd6",
    definition: "4196f188626de98726603ca49c785e7ed359d8106c7eaea8d43817959f8b0202",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fa9d3af42f20a68890242235",
    definition: "fb3351a5f5cd33e0e45d153293d0086c07a852447aa282f5e8028ea3f483b4c0",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fada095ce38b422ccf61f489",
    definition: "a5d78bebfb17ca08486219e4f570ea98102ff882d10ad13fb0d64352cefc8cdd",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fbd717658ec0391f83b6ca1e",
    definition: "2940286aa89ea8338258c30439aae923df49d954a9755b691d0f1c0f51c4fa4c",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fd19cd46f568a4ae38795f6d",
    definition: "f3916dfe9dc2a9a52704bb905c576cf74c8789e84e449e8c6bda78ded9fcff00",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n88_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  }
];

// drafts/n88-student-portal/activation/private-error-boundary.mjs
var fail4 = () => {
  throw Error("n88_database_unavailable");
};
var verified = /* @__PURE__ */ new WeakSet();
var operations = new Map(error_boundary_contract_default.operations.map((o) => [o.sql, o]));
var controls = new Set(error_boundary_contract_default.controls);
var boundaryCatalogSql = `select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n88_private' and p.proname like 'boundary_%' order by p.proname`;
async function assertVerifiedBoundary(client) {
  verified.delete(client);
  const r = await client.query(boundaryCatalogSql);
  if (error_boundary_identities_default.length !== operations.size || JSON.stringify(r.rows) !== JSON.stringify(error_boundary_identities_default)) fail4();
  verified.add(client);
}
function pgText(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Buffer6.isBuffer(value)) return "\\x" + value.toString("hex");
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return "{" + value.map((v) => v === null ? "NULL" : Array.isArray(v) ? pgText(v) : '"' + pgText(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"').join(",") + "}";
  fail4();
}
async function privateQuery(client, sql, values = []) {
  if (!verified.has(client) || !Array.isArray(values)) fail4();
  if (controls.has(sql)) {
    if (sql.startsWith("select set_config")) {
      if (values.length !== 3 || values.some((v) => typeof v !== "string" || !/^\d{1,5}$/.test(v) || Number(v) < 1 || Number(v) > 6e4)) fail4();
    } else if (values.length) fail4();
    return client.query(sql, values);
  }
  const op = operations.get(sql);
  if (!op || values.length !== op.parameters.length) fail4();
  const wire = values.map(encodeBoundaryParameter);
  const result2 = await client.query(`select * from n88_private.${op.name}(${wire.map((_, i) => "$" + (i + 1) + "::text").join(",")})`, wire);
  if (op.effect) {
    const count = result2.rows?.[0]?.affected;
    if (result2.rows?.length !== 1 || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) fail4();
    return { ...result2, command: op.command, rowCount: Number(count), rows: [] };
  }
  if (op.voidResult) return { ...result2, rows: result2.rows.map(() => ({ [op.output[0].name]: "" })) };
  return result2;
}
var encodeBoundaryParameter = (value) => value === null ? null : Buffer6.from(pgText(value), "utf8").toString("base64");

// drafts/n88-student-portal/postgres-repository.mjs
var unavailable = () => new Error("n88_repository_unavailable");
var must = (test) => {
  if (!test) throw unavailable();
};
var LOCK = "select pg_advisory_xact_lock(1312307256, 88)";
var tables = {
  contexts: {
    sql: "contexts",
    pk: ["namespace"],
    fields: ["namespace", "ownerId", "active"],
    cols: ["namespace", "owner_id", "active"]
  },
  memberships: {
    sql: "memberships",
    pk: ["owner_id", "class_id", "student_id", "enrollment_id"],
    fields: ["ownerId", "classId", "studentId", "enrollmentId", "revision", "status", "endDate", "studentActive", "classActive", "label", "canonicalStamp"],
    cols: ["owner_id", "class_id", "student_id", "enrollment_id", "revision", "status", "end_date", "student_active", "class_active", "label", "canonical_stamp", "active"]
  },
  credentials: {
    sql: "credentials",
    pk: ["id"],
    fields: ["id", "namespace", "ownerId", "studentId", "version", "verifier", "entryVerifier", "revokedAt"],
    cols: ["id", "namespace", "owner_id", "student_id", "version", "verifier", "entry_verifier", "revoked_at"]
  },
  sessions: {
    sql: "sessions",
    pk: ["id"],
    fields: ["id", "credentialId", "namespace", "ownerId", "classId", "studentId", "enrollmentId", "version", "membershipRevision", "entryVerifier", "tokenHash", "expiresAt", "revokedAt", "canonicalStamp"],
    cols: ["id", "credential_id", "namespace", "owner_id", "class_id", "student_id", "enrollment_id", "version", "membership_revision", "entry_verifier", "token_hash", "expires_at", "revoked_at", "canonical_stamp"]
  },
  publications: {
    sql: "publications",
    pk: ["id"],
    fields: ["id", "ownerId", "classId", "studentId", "enrollmentId", "source", "title", "instruction", "deadline", "status", "published"],
    cols: ["id", "owner_id", "class_id", "student_id", "enrollment_id", "source_teaching_id", "source_item_id", "title", "instruction", "deadline", "status", "published"]
  },
  rates: { sql: "guess_budgets", pk: ["key"], fields: ["key", "count", "until"], cols: ["key", "count", "until_at"] }
};
var names = Object.keys(tables);
var exact5 = (o, keys) => must(o && Object.getPrototypeOf(o) === Object.prototype && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k)));
var str = (s, max, min = 1) => must(typeof s === "string" && s.length >= min && s.length <= max && !s.includes("\0"));
var uuid3 = (s) => must(typeof s === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s));
var hex = (s) => must(typeof s === "string" && /^[a-f0-9]{64}$/.test(s));
var bool = (b) => must(typeof b === "boolean");
var safe = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  must(typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max);
  return n;
};
var number = (n) => {
  must(typeof n === "string" && /^(0|[1-9][0-9]*)(\.0+)?$/.test(n));
  return safe(Number(n));
};
var time = (n) => safe(n, 0, 253402300799999);
var date2 = (s) => {
  if (s === null) return;
  must(typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
};
var namespace = (s) => must(typeof s === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(s));
var active4 = (r) => r.status === "active" && r.endDate === null && r.studentActive && r.classActive;
function validate(name, r) {
  exact5(r, tables[name].fields);
  for (const k of ["ownerId", "id", "credentialId"]) if (Object.hasOwn(r, k)) uuid3(r[k]);
  for (const k of ["classId", "studentId", "enrollmentId"]) if (Object.hasOwn(r, k)) str(r[k], 240);
  if (Object.hasOwn(r, "namespace")) namespace(r.namespace);
  for (const k of ["version", "revision", "membershipRevision"]) if (Object.hasOwn(r, k)) safe(r[k], 1);
  for (const k of ["verifier", "entryVerifier", "tokenHash"]) if (Object.hasOwn(r, k)) hex(r[k]);
  if (Object.hasOwn(r, "canonicalStamp")) hex(r.canonicalStamp);
  if (Object.hasOwn(r, "revokedAt") && r.revokedAt !== null) time(r.revokedAt);
  if (name === "contexts") bool(r.active);
  if (name === "memberships") {
    must(["active", "inactive", "ended"].includes(r.status));
    date2(r.endDate);
    bool(r.studentActive);
    bool(r.classActive);
    str(r.label, 300, 0);
  }
  if (name === "sessions") time(r.expiresAt);
  if (name === "publications") {
    exact5(r.source, ["teachingId", "itemId"]);
    str(r.source.teachingId, 240);
    str(r.source.itemId, 240);
    str(r.title, 160);
    str(r.instruction, 500, 0);
    date2(r.deadline);
    must(["todo", "working", "done"].includes(r.status));
    bool(r.published);
  }
  if (name === "rates") {
    must(r.key === "global" || r.key === "global-failure" || /^[a-f0-9]{64}$/.test(r.key));
    safe(r.count, 0, 2147483647);
    time(r.until);
  }
}
var stamp = (n) => n === null ? null : new Date(time(n)).toISOString();
function encode(name, r) {
  validate(name, r);
  if (name === "memberships") return tables[name].fields.map((k) => r[k]).concat(active4(r));
  if (name === "publications") return [r.id, r.ownerId, r.classId, r.studentId, r.enrollmentId, r.source.teachingId, r.source.itemId, r.title, r.instruction, r.deadline, r.status, r.published];
  return tables[name].fields.map((k) => ["revokedAt", "expiresAt", "until"].includes(k) ? stamp(r[k]) : r[k]);
}
function decode(name, row) {
  const t = tables[name];
  exact5(row, t.cols);
  let r;
  if (name === "publications") r = {
    id: row.id,
    ownerId: row.owner_id,
    classId: row.class_id,
    studentId: row.student_id,
    enrollmentId: row.enrollment_id,
    source: { teachingId: row.source_teaching_id, itemId: row.source_item_id },
    title: row.title,
    instruction: row.instruction,
    deadline: row.deadline,
    status: row.status,
    published: row.published
  };
  else r = Object.fromEntries(t.fields.map((k, i) => [k, row[t.cols[i]]]));
  for (const k of ["version", "revision", "membershipRevision", "count"]) if (Object.hasOwn(r, k)) r[k] = number(r[k]);
  for (const k of ["revokedAt", "expiresAt", "until"]) if (Object.hasOwn(r, k) && r[k] !== null) r[k] = number(r[k]);
  validate(name, r);
  if (name === "memberships") {
    bool(row.active);
    must(row.active === active4(r));
  }
  return r;
}
var queries = Object.fromEntries(names.map((name) => {
  const t = tables[name], col = (c) => c.endsWith("_at") ? `(extract(epoch from ${c})*1000)::text as ${c}` : ["revision", "version", "membership_revision", "count", "end_date", "deadline"].includes(c) ? `${c}::text as ${c}` : c;
  return [name, {
    // Bound the transfer as well as the decoded snapshot. Over-cap rows become
    // explicit null sentinels, NEVER filtered/truncated into a successful snapshot.
    // Numeric/time columns are text inside JSON (no implicit bigint/Date coercion).
    read: `select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select ${t.cols.map(col).join(",")} from n88_private.${t.sql} limit $1) t) bounded`,
    insert: `insert into n88_private.${t.sql} (${t.cols.join(",")}) values (${t.cols.map((_, i) => `$${i + 1}`).join(",")})`,
    update: `update n88_private.${t.sql} set ${t.cols.filter((c) => !t.pk.includes(c)).map((c) => `${c}=$${t.cols.indexOf(c) + 1}`).join(",")} where ${t.pk.map((c) => `${c}=$${t.cols.indexOf(c) + 1}`).join(" and ")}`,
    remove: `delete from n88_private.${t.sql} where ${t.pk.map((c, i) => `${c}=$${i + 1}`).join(" and ")}`
  }];
}));
var pk = (name, values) => tables[name].pk.map((k) => values[tables[name].cols.indexOf(k)]);
function snapshot(state, limits) {
  exact5(state, names);
  let total = 0, bytes = 0;
  const maps = {};
  for (const name of names) {
    must(Array.isArray(state[name]) && state[name].length <= limits[name]);
    total += state[name].length;
    must(total <= limits.total);
    maps[name] = /* @__PURE__ */ new Map();
    for (const r of state[name]) {
      const values = encode(name, r), json = JSON.stringify(r), size = Buffer7.byteLength(json);
      must(size <= limits.rowBytes);
      bytes += size;
      must(bytes <= limits.bytes);
      const key2 = JSON.stringify(pk(name, values));
      must(!maps[name].has(key2));
      maps[name].set(key2, values);
    }
  }
  return maps;
}
function transitions(before, after) {
  for (const [key2, a] of before.credentials) {
    const b = after.credentials.get(key2);
    must(b);
    must(a.slice(0, 7).every((v, i) => v === b[i]));
    must(a[7] === null || b[7] !== null);
  }
  for (const [key2, a] of before.sessions) {
    const b = after.sessions.get(key2);
    if (!b) continue;
    must(a.slice(0, 12).every((v, i) => v === b[i]));
    must(a[12] === null || a[12] === b[12]);
    must(a[13] === b[13]);
  }
}
function createPostgresRepository({ acquire, limits, timing, synchronize = async () => {
} }) {
  must(typeof synchronize === "function");
  must(typeof acquire === "function");
  exact5(limits, [...names, "total", "bytes", "rowBytes"]);
  for (const k of names) safe(limits[k], 1, 1e4);
  safe(limits.total, 1, 5e4);
  safe(limits.bytes, 1024, 64 * 1024 * 1024);
  safe(limits.rowBytes, 128, 32768);
  exact5(timing, ["acquireMs", "transactionMs", "cleanupMs", "statementMs", "lockMs"]);
  for (const k of Object.keys(timing)) safe(timing[k], 1, 6e4);
  must(timing.acquireMs <= timing.transactionMs && timing.statementMs <= timing.transactionMs && timing.lockMs <= timing.statementMs);
  limits = { ...limits };
  timing = { ...timing };
  return Object.freeze({ async transaction(action) {
    must(typeof action === "function");
    let c, live2 = true, begun = false, committed = false, destroyed = false;
    const deadline = Date.now() + timing.transactionMs;
    const fence = () => must(live2 && Date.now() < deadline);
    const release = (broken) => {
      if (c && !destroyed) {
        destroyed = true;
        c.release(broken ? unavailable() : void 0);
      }
    };
    const query = async (text2, values = []) => {
      fence();
      const r = await privateQuery(c, text2, values);
      fence();
      return r;
    };
    let timer, acquireTimer;
    const work = (async () => {
      const lease = Promise.resolve().then(acquire);
      lease.then((client) => {
        if (!live2) client.release(unavailable());
      }, () => {
      });
      c = await Promise.race([lease, new Promise((_, reject) => {
        acquireTimer = setTimeout(() => reject(unavailable()), timing.acquireMs);
      })]);
      clearTimeout(acquireTimer);
      fence();
      must(c && typeof c.query === "function" && typeof c.release === "function");
      await assertVerifiedBoundary(c);
      fence();
      await query("begin isolation level read committed");
      begun = true;
      await query(
        "select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)",
        [String(timing.statementMs), String(timing.lockMs), String(timing.transactionMs)]
      );
      await query(LOCK);
      const state = {};
      let count = 0, bytes = 0, transferred = 0;
      for (const name of names) {
        const bound = Math.min(limits[name], limits.total - count);
        const result3 = await query(queries[name].read, [bound + 1, limits.rowBytes, limits.bytes - transferred]);
        must(result3.rows.length <= bound);
        state[name] = result3.rows.map((row) => {
          exact5(row, ["bounded_row"]);
          must(typeof row.bounded_row === "string");
          transferred += Buffer7.byteLength(row.bounded_row);
          must(transferred <= limits.bytes);
          return decode(name, JSON.parse(row.bounded_row));
        });
        count += state[name].length;
        bytes += Buffer7.byteLength(JSON.stringify(state[name]));
        must(bytes <= limits.bytes);
      }
      const original = snapshot(state, limits);
      const owners = /* @__PURE__ */ new Set(), commitGuards = [];
      const beforeCommit = (check) => {
        fence();
        must(typeof check === "function" && commitGuards.length < 8);
        commitGuards.push(check);
      };
      const synchronizeOwner = async (ownerId) => {
        fence();
        uuid3(ownerId);
        if (owners.has(ownerId)) return;
        await synchronize(state, { query }, ownerId);
        fence();
        snapshot(state, limits);
        owners.add(ownerId);
      };
      const value = await action(state, Object.freeze({ query, synchronizeOwner, beforeCommit }));
      fence();
      const final = snapshot(structuredClone(state), limits), result2 = structuredClone(value);
      transitions(original, final);
      fence();
      for (const name of ["sessions", "publications", "memberships", "contexts", "rates"])
        for (const [key2, row] of original[name]) if (!final[name].has(key2))
          must((await query(queries[name].remove, pk(name, row))).rowCount === 1);
      for (const name of names) {
        for (const [key2, row] of final[name]) if (original[name].has(key2) && JSON.stringify(row) !== JSON.stringify(original[name].get(key2)))
          must((await query(queries[name].update, row)).rowCount === 1);
        for (const [key2, row] of final[name]) if (!original[name].has(key2))
          must((await query(queries[name].insert, row)).rowCount === 1);
      }
      for (const check of commitGuards) {
        await check();
        fence();
      }
      const ack = await query("commit");
      must(ack.command === "COMMIT");
      committed = true;
      return result2;
    })();
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(unavailable()), Math.max(1, deadline - Date.now()));
      })]);
    } catch {
      live2 = false;
      if (c && begun && !committed && !destroyed) {
        let cleanupTimer;
        try {
          await Promise.race([c.query("rollback"), new Promise((_, reject) => {
            cleanupTimer = setTimeout(() => reject(unavailable()), timing.cleanupMs);
          })]);
        } catch {
        } finally {
          clearTimeout(cleanupTimer);
        }
      }
      throw unavailable();
    } finally {
      live2 = false;
      clearTimeout(timer);
      clearTimeout(acquireTimer);
      release(!committed);
    }
  } });
}

// drafts/n88-student-portal/canonical-adapter.mjs
import { Buffer as Buffer8 } from "node:buffer";
import { createHash as createHash7 } from "node:crypto";
var CANONICAL_TABLES = Object.freeze(["years", "terms", "sections", "students", "enrollments", "teachings", "items"]);
var fail5 = () => {
  throw Error("n88_canonical_unavailable");
};
var key = (m) => JSON.stringify([m.ownerId, m.classId, m.studentId, m.enrollmentId]);
var id3 = (parts) => {
  const h = createHash7("sha256").update(JSON.stringify(["n88-publication-v1", ...parts])).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function createCanonicalAdapter({ maxRows = 2e3, maxBytes = 2 * 1024 * 1024, rollout = createRolloutGuard() } = {}) {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail5();
  return async (db, { query }, ownerId) => {
    if (!rollout.allowsOwner(ownerId)) fail5();
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId) || !db.contexts.some((c) => c.ownerId === ownerId && c.active)) fail5();
    await query("select n88_private.lock_canonical_sources($1::uuid,$2::integer)", [ownerId, maxRows]);
    const owners = [ownerId];
    const result2 = await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select e.owner_id,e.id as enrollment_id,e.section_id,e.student_id,e.revision::text as revision,
          e.status,e.end_date::text as end_date,e.deleted_at is null as enrollment_present,
          s.status='active' and s.deleted_at is null as student_active,left(s.name,300) as label,
          c.status='active' and c.deleted_at is null and y.status='active' and y.deleted_at is null as class_active,
          s.revision::text as student_revision,c.revision::text as section_revision,y.revision::text as year_revision
        from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id
        join rakeezx.sections c on c.owner_id=e.owner_id and c.id=e.section_id
        join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
        where e.owner_id=any($1::uuid[]) order by e.owner_id,e.id limit $2
      ) x) bounded`, [owners, maxRows + 1, maxBytes]);
    if (result2.rows.length > maxRows) fail5();
    let bytes = 0;
    const read = (row) => {
      if (typeof row.payload !== "string") fail5();
      bytes += Buffer8.byteLength(row.payload);
      if (bytes > maxBytes) fail5();
      return JSON.parse(row.payload);
    };
    const previous = new Map(db.memberships.map((m) => [key(m), m]));
    for (const m of db.memberships.filter((m2) => m2.ownerId === ownerId && rollout.allowsMember(m2))) {
      m.status = "inactive";
      m.studentActive = false;
      m.classActive = false;
    }
    for (const row of result2.rows) {
      const r = read(row), revision2 = Number(r.revision);
      if (!rollout.allowsMember({ ownerId: r.owner_id, classId: r.section_id, studentId: r.student_id })) continue;
      if (!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision2)) fail5();
      const revisions = [r.revision, r.student_revision, r.section_revision, r.year_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail5();
      const canonicalStamp = createHash7("sha256").update(JSON.stringify(["n88-lineage-v1", ...revisions])).digest("hex");
      const m = {
        ownerId: r.owner_id,
        classId: r.section_id,
        studentId: r.student_id,
        enrollmentId: r.enrollment_id,
        revision: revision2,
        canonicalStamp,
        status: r.enrollment_present && r.status === "active" ? "active" : "ended",
        endDate: r.end_date,
        studentActive: r.student_active,
        classActive: r.class_active,
        label: r.label
      };
      if (!owners.includes(m.ownerId)) fail5();
      const old = previous.get(key(m));
      if (old) Object.assign(old, m);
      else {
        db.memberships.push(m);
        previous.set(key(m), m);
      }
    }
    for (const s of db.sessions.filter((s2) => s2.ownerId === ownerId && s2.revokedAt == null && rollout.allowsMember(s2))) {
      const m = db.memberships.find((m2) => key(m2) === key(s));
      if (!m || m.status !== "active" || m.endDate || !m.studentActive || !m.classActive || m.revision !== s.membershipRevision || m.canonicalStamp !== s.canonicalStamp) s.revokedAt = Date.now();
    }
    const source = await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select i.owner_id,i.id as item_id,left(i.name,160) as title,t.id as teaching_id,t.section_id,
          i.revision::text as item_revision,t.revision::text as teaching_revision,term.revision::text as term_revision
        from rakeezx.items i join rakeezx.teachings t on t.owner_id=i.owner_id and t.id=i.teaching_id
        join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
        join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
        where i.owner_id=any($1::uuid[]) and i.deleted_at is null and t.deleted_at is null
          and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
          and i.auto is null order by i.owner_id,i.id limit $2
      ) x) bounded`, [owners, maxRows + 1, maxBytes - bytes]);
    if (source.rows.length > maxRows) fail5();
    const current = /* @__PURE__ */ new Set();
    for (const row of source.rows) {
      const r = read(row);
      if (!rollout.admitsTeacher({ ownerId, current: true }, { ownerId: r.owner_id, current: true, classId: r.section_id, teachingId: r.teaching_id })) continue;
      const revisions = [r.item_revision, r.teaching_revision, r.term_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail5();
      for (const m of db.memberships.filter((m2) => m2.ownerId === r.owner_id && m2.classId === r.section_id && m2.status === "active" && !m2.endDate && m2.studentActive && m2.classActive && rollout.admitsStudent(m2))) {
        const publicationId = id3([m.ownerId, m.enrollmentId, m.canonicalStamp, r.teaching_id, r.item_id, ...revisions]);
        current.add(publicationId);
        const existing = db.publications.find((p) => p.id === publicationId);
        if (existing && (key(existing) !== key(m) || existing.source.teachingId !== r.teaching_id || existing.source.itemId !== r.item_id)) fail5();
        const prior = db.publications.find((p) => key(p) === key(m) && p.source.teachingId === r.teaching_id && p.source.itemId === r.item_id);
        if (!existing) db.publications.push({
          id: publicationId,
          ownerId: m.ownerId,
          classId: m.classId,
          studentId: m.studentId,
          enrollmentId: m.enrollmentId,
          source: { teachingId: r.teaching_id, itemId: r.item_id },
          title: prior?.title || r.title,
          instruction: prior?.instruction || "",
          deadline: prior?.deadline || null,
          status: prior?.status || "todo",
          published: false
        });
        if (db.publications.length > maxRows) fail5();
      }
    }
    db.publications = db.publications.filter((p) => p.ownerId !== ownerId || !rollout.allowsMember(p) || !rollout.admitsTeacher({ ownerId, current: true }, { current: true, ownerId: p.ownerId, classId: p.classId, teachingId: p.source.teachingId }) || current.has(p.id));
  };
}

// drafts/n88-student-portal/http-adapter.mjs
import { Buffer as Buffer9 } from "node:buffer";

// drafts/n88-student-portal/auth-verifier.mjs
import { Buffer as Buffer10 } from "node:buffer";
import { AuthClient } from "@supabase/auth-js";
var uuid4 = (s) => typeof s === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
var fail6 = () => {
  throw Error("n88_auth_configuration");
};
function createTeacherVerifier({ authUrl, apiKey, fetch: send = globalThis.fetch, authDeadlineMs = 2e3, now = Date.now }) {
  const url = new URL(authUrl);
  if (url.origin !== authUrl || url.protocol !== "https:" || !apiKey || typeof send !== "function" || !Number.isInteger(authDeadlineMs) || authDeadlineMs < 20 || authDeadlineMs > 5e3) fail6();
  const issuer = authUrl + "/auth/v1";
  return async (authorization, parentSignal, { query, beforeCommit } = {}) => {
    if (typeof query !== "function" || typeof authorization !== "string" || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) return null;
    const token = authorization.slice(7), abort = new AbortController();
    const cancel = () => abort.abort();
    parentSignal?.addEventListener("abort", cancel, { once: true });
    if (parentSignal?.aborted) abort.abort();
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      abort.abort();
    }, authDeadlineMs);
    const fence = () => {
      if (expired || abort.signal.aborted) throw Error("n88_auth_unavailable");
    };
    try {
      const boundedFetch = async (target, init = {}) => {
        fence();
        const u = new URL(target);
        if (u.origin !== authUrl || ![issuer + "/user", issuer + "/.well-known/jwks.json"].includes(u.href) || init.method && init.method !== "GET") fail6();
        const response2 = await send(u.href, { ...init, redirect: "error", cache: "no-store", credentials: "omit", signal: abort.signal });
        let n = 0;
        const parts = [];
        const reader = response2.body?.getReader();
        if (reader) try {
          for (; ; ) {
            fence();
            const { done, value } = await reader.read();
            if (done) break;
            n += value.length;
            if (n > 65536) throw Error("n88_auth_unavailable");
            parts.push(value);
          }
        } finally {
          await reader.cancel().catch(() => {
          });
          reader.releaseLock();
        }
        fence();
        return new Response(Buffer10.concat(parts), { status: response2.status, headers: response2.headers });
      };
      const auth = new AuthClient({
        url: issuer,
        headers: { apikey: apiKey },
        fetch: boundedFetch,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        skipAutoInitialize: true,
        debug: false
      });
      const verified2 = await auth.getClaims(token);
      fence();
      if (verified2.error || !verified2.data?.claims) return null;
      const c = verified2.data.claims, sec = Math.floor(now() / 1e3);
      if (c.iss !== issuer || !(c.aud === "authenticated" || Array.isArray(c.aud) && c.aud.length === 1 && c.aud[0] === "authenticated") || c.role !== "authenticated" || !uuid4(c.sub) || !uuid4(c.session_id) || c.is_anonymous === true || !Number.isSafeInteger(c.exp) || c.exp <= sec || !Number.isSafeInteger(c.iat) || c.iat > sec || c.iat >= c.exp || c.nbf !== void 0 && (!Number.isSafeInteger(c.nbf) || c.nbf > sec)) return null;
      const current = await query("select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
      fence();
      const matches = (result2) => result2.rows.length === 1 && result2.rows[0].user_id === c.sub && result2.rows[0].session_id === c.session_id;
      if (!matches(current)) return null;
      const fresh = await auth.getUser(token);
      fence();
      const user = fresh.data?.user;
      if (fresh.error || !user || user.id !== c.sub || user.is_anonymous === true || user.deleted_at || user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > now())) return null;
      if (c.exp <= Math.floor(now() / 1e3)) return null;
      beforeCommit?.(async () => {
        if (c.exp <= Math.floor(now() / 1e3)) throw Error("n88_auth_expired");
        const result2 = await query("select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
        if (!matches(result2)) throw Error("n88_auth_expired");
      });
      return Object.freeze({ ownerId: c.sub, sessionId: c.session_id, current: true });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      abort.abort();
      parentSignal?.removeEventListener("abort", cancel);
    }
  };
}

// drafts/n88-student-portal/runtime.mjs
var REQUIRED_ENV = Object.freeze(["N88_PUBLIC_ORIGIN", "N88_DATABASE_URL", "N88_HMAC_KEY", "N88_AUTH_URL", "N88_AUTH_API_KEY", "N88_INGRESS_KEY"]);
function deploymentPreflight({ origin, authUrl, apiKey, secretKey, acquire, canonicalReadback, privateIngressReadback, sourceOnly = true }) {
  if (sourceOnly !== false || typeof acquire !== "function" || canonicalReadback !== true || privateIngressReadback !== true || !Buffer11.isBuffer(secretKey) || secretKey.length < 32 || typeof apiKey !== "string" || !apiKey || ![origin, authUrl].every((u) => {
    try {
      const x = new URL(u);
      return x.origin === u && x.protocol === "https:" && !x.username && !x.password;
    } catch {
      return false;
    }
  })) throw Error("n88_activation_prerequisite_missing");
}
function composeService(options, adapter) {
  deploymentPreflight(options);
  const repository = createPostgresRepository({
    acquire: options.acquire,
    limits: options.limits,
    timing: options.timing,
    synchronize: createCanonicalAdapter(options.canonicalBounds)
  });
  return createIntegratedService(options, adapter, repository);
}

// drafts/n88-student-portal/web-protocol.mjs
var ROUTE = /^\/api\/n88\/(?:teacher\/class\/(?:list|issue-missing|rotate|revoke|visibility|guidance-list|guidance-save)|student\/(?:claim|read|end))$/;
var FORWARDED = Object.freeze(["authorization", "cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"]);
var decodeBytes = (value) => {
  if (typeof value !== "string" || value.length > 5464 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error("n88_envelope");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
};
var hex2 = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex2(await crypto.subtle.digest("SHA-256", bytes));
}
async function mac(key2, value) {
  const k = await crypto.subtle.importKey("raw", key2, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex2(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
}
function signingText({ origin, path, method, headers, bodyHash, time: time2, nonce, source }) {
  return JSON.stringify(["n88-ingress-v1", origin, path, method, FORWARDED.map((n) => headers.get(n) || ""), bodyHash, time2, nonce, source]);
}
async function readBytes(stream, max = 4096, signal) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  let total = 0;
  const parts = [];
  const cancel = () => {
    void reader.cancel().catch(() => {
    });
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (; ; ) {
      if (signal?.aborted) throw Error("n88_deadline");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) throw Error("n88_body_limit");
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.length;
    }
    return bytes;
  } finally {
    signal?.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
var PRIVATE_WEB_HEADERS = Object.freeze({
  "cache-control": "no-store, private",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "x-content-type-options": "nosniff",
  vary: "Cookie",
  "content-type": "application/json; charset=utf-8"
});
var privateResponse = (status = 503) => new Response('{"error":"unavailable"}', { status, headers: PRIVATE_WEB_HEADERS });

// drafts/n88-student-portal/web-entry.mjs
function createWebEntry(options) {
  if (!Buffer12.isBuffer(options.ingressKey) || options.ingressKey.length !== 32) throw Error("n88_ingress_configuration");
  const envelopes = /* @__PURE__ */ new WeakMap(), now = options.now || Date.now;
  const verifier = createTeacherVerifier(options);
  const adapter = {
    verifyTeacher: (r, ports) => {
      const e = envelopes.get(r);
      return e ? verifier(e.authorization, e.signal, ports) : null;
    },
    verifyIngress: async (r, { query }) => {
      const e = envelopes.get(r);
      if (!e || e.signal.aborted || Math.abs(Math.floor(now() / 1e3) - Number(e.time)) > 15) return null;
      const result2 = await query("select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted", [e.nonce, Number(e.time) + 16]);
      return result2.rows.length === 1 && result2.rows[0].accepted === true ? { clientKey: e.source } : null;
    }
  };
  const service = composeService(options, adapter);
  let running = 0;
  return async (request) => {
    if (running >= 8) return privateResponse();
    running++;
    const abort = new AbortController();
    let timer;
    const work = async () => {
      try {
        const u = new URL(request.url), wire = request.headers;
        if (u.origin !== options.authUrl || u.pathname !== "/functions/v1/n88-student-portal/dispatch" || u.search || request.method !== "POST" || wire.get("content-type") !== "application/json" || wire.has("content-encoding")) return privateResponse(400);
        const time2 = wire.get("x-n88-time"), nonce = wire.get("x-n88-nonce"), source = wire.get("x-n88-source"), signature = wire.get("x-n88-signature");
        if (!/^\d{10}$/.test(time2 || "") || Math.abs(Math.floor(now() / 1e3) - Number(time2)) > 15 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(nonce || "") || !/^[a-f0-9]{64}$/.test(source || "") || !/^[a-f0-9]{64}$/.test(signature || "")) return privateResponse(401);
        const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(request.body, 24576, abort.signal)));
        if (!envelope || Object.keys(envelope).sort().join(",") !== "body,headers,method,path" || !ROUTE.test(envelope.path) || !["GET", "POST"].includes(envelope.method) || !Array.isArray(envelope.headers) || envelope.headers.length !== FORWARDED.length || !envelope.headers.every((v) => typeof v === "string" && v.length <= 8200)) return privateResponse(400);
        const { path, method } = envelope, h = new Headers(FORWARDED.map((n, i) => [n, envelope.headers[i]]));
        const cookie2 = h.get("cookie") || "";
        if (cookie2.length > 4096 || (cookie2.match(/(?:^|;\s*)__Secure-n88-student=/g) || []).length > 1 || (h.get("authorization") || "").length > 8200 || h.get("sec-fetch-site") && h.get("sec-fetch-site") !== "same-origin" || h.has("content-encoding")) return privateResponse(400);
        if (method === "POST" && (h.get("origin") !== options.origin || h.get("content-type") !== "application/json" || h.get("x-n88-csrf") !== "1")) return privateResponse(401);
        const bytes = decodeBytes(envelope.body);
        if (bytes.length > 4096) return privateResponse(413);
        const expected = await mac(options.ingressKey, signingText({ origin: options.origin, path, method, headers: h, bodyHash: await sha(bytes), time: time2, nonce, source }));
        if (!timingSafeEqual3(Buffer12.from(expected, "hex"), Buffer12.from(signature, "hex"))) return privateResponse(401);
        let body = {};
        if (bytes.length) body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!body || Array.isArray(body) || typeof body !== "object" || method === "GET" && bytes.length) return privateResponse(400);
        const r = { path: path.slice("/api/n88".length), method, body, headers: Object.fromEntries(["cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"].map((n) => [n, h.get(n) || ""])) };
        envelopes.set(r, { authorization: h.get("authorization"), signal: abort.signal, time: time2, nonce, source });
        try {
          const result2 = await service(r);
          return Response.json({ status: result2.status, body: result2.body, cookie: result2.headers?.["Set-Cookie"] || null }, { headers: PRIVATE_WEB_HEADERS });
        } finally {
          envelopes.delete(r);
        }
      } catch {
        return privateResponse();
      }
    };
    try {
      const pending = work().finally(() => {
        running--;
      });
      return await Promise.race([pending, new Promise((resolve) => {
        timer = setTimeout(() => {
          abort.abort();
          resolve(privateResponse());
        }, 11e3);
      })]);
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  };
}

// drafts/n88-student-portal/activation/database-transport.mjs
import { createHash as createHash8 } from "node:crypto";
function databaseConfig(readEnv) {
  const url = readEnv("N88_DATABASE_URL"), db = new URL(url), user = decodeURIComponent(db.username);
  const direct = user === "n88_backend" && db.hostname === "db.xlrubcwjqktzzunrvuns.supabase.co";
  const session = user === "n88_backend.xlrubcwjqktzzunrvuns" && db.hostname === "aws-0-ap-south-1.pooler.supabase.com";
  const ca = readEnv("N88_DATABASE_CA_CERT");
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || session) || !["", "5432"].includes(db.port) || db.pathname !== "/postgres" || !db.password || db.search || db.hash || typeof ca !== "string" || createHash8("sha256").update(ca.replaceAll("\r\n", "\n")).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") throw Error("n88_database_configuration");
  return { connectionString: url, ssl: { ca, rejectUnauthorized: true, servername: db.hostname, minVersion: "TLSv1.2" }, max: 2, connectionTimeoutMillis: 5e3, idleTimeoutMillis: 1e4, statement_timeout: 3e3, query_timeout: 4e3, application_name: "n88-private-server", allowExitOnIdle: true };
}
async function assertRestrictedTransport(client) {
  const r = (await client.query("select session_user as login,current_user as role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl")).rows[0];
  const flags = { loginExact: r?.login === "n88_backend", roleExact: r?.role === "n88_backend", upstreamSsl: r?.ssl === true, clientTlsAuthorized: client.connection?.stream?.authorized === true };
  if (Object.values(flags).some((v) => v !== true)) {
    const e = Error("n88_transport_invariants");
    e.safeReadiness = flags;
    throw e;
  }
  return flags;
}

// drafts/n88-student-portal/existing-host.mjs
async function assertPrivateDatabaseSession(client) {
  const result2 = await client.query(`select current_user as role,
    current_setting('log_error_verbosity') as error_verbosity,
    current_setting('log_parameter_max_length_on_error') as error_parameters,
    current_setting('log_statement') as statements,
    current_setting('log_min_duration_statement') as duration,
    current_setting('log_min_duration_sample') as duration_sample,
    current_setting('log_transaction_sample_rate') as transaction_sample,
    current_setting('pgaudit.log',true) as audit,
    (select setting from pg_settings where name='auto_explain.log_min_duration') as explain_duration,
    current_setting('auto_explain.log_nested_statements',true) as explain_nested`);
  const r = result2.rows?.[0];
  const explainSafe = r && (r.explain_duration == null || r.explain_duration === "-1" || /^\d+$/.test(r.explain_duration) && Number(r.explain_duration) > 3e3 && r.explain_nested === "off");
  if (result2.rows?.length !== 1 || !r || r.role !== "n88_backend" || !["terse", "default"].includes(r.error_verbosity) || r.error_parameters !== "0" || !["none", "ddl"].includes(r.statements) || r.duration !== "-1" || r.duration_sample !== "-1" || Number(r.transaction_sample) !== 0 || r.transaction_sample == null || ![null, "none"].includes(r.audit) || !explainSafe)
    throw Error("n88_database_unavailable");
  await assertVerifiedBoundary(client);
}
function createExistingHost(readEnv) {
  if (readEnv("N88_ENABLED") !== "true") return Object.freeze({ handle: async () => privateResponse(), close: async () => {
  } });
  const rollout = createRolloutGuard(readEnv);
  if (!rollout.configured) return Object.freeze({ handle: async () => privateResponse(), close: async () => {
  } });
  const required = (n) => {
    const v = readEnv(n);
    if (typeof v !== "string" || !v) throw Error("n88_configuration");
    return v;
  };
  const origin = required("N88_PUBLIC_ORIGIN"), authUrl = required("N88_AUTH_URL"), dbUrl = required("N88_DATABASE_URL");
  const db = new URL(dbUrl);
  const username = decodeURIComponent(db.username);
  const direct = db.hostname === "db.xlrubcwjqktzzunrvuns.supabase.co" && username === "n88_backend";
  const session = db.hostname === "aws-0-ap-south-1.pooler.supabase.com" && username === "n88_backend.xlrubcwjqktzzunrvuns";
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || session) || !["", "5432"].includes(db.port) || db.pathname !== "/postgres" || !db.password || db.search || db.hash) throw Error("n88_database_configuration");
  const key2 = (n) => {
    const s = required(n);
    if (!/^[a-f0-9]{64}$/.test(s)) throw Error("n88_key_configuration");
    return Buffer13.from(s, "hex");
  };
  if (required("N88_SERVICE_REVISION") !== deployment_inactive_default.serviceRevision) throw Error("n88_service_readback_missing");
  const secretKey = key2("N88_HMAC_KEY"), ingressKey = key2("N88_INGRESS_KEY"), numericKey = key2("N88_NUMERIC_KEY"), reservationKey = key2("N88_RESERVATION_KEY");
  if (new Set([secretKey, ingressKey, numericKey, reservationKey].map((k) => k.toString("hex"))).size !== 4) throw Error("n88_separate_keys_required");
  if (secretKey.equals(ingressKey)) throw Error("n88_separate_keys_required");
  const recoveryActiveKeyVersion = required("N88_RECOVERY_ACTIVE_VERSION");
  const versions = required("N88_RECOVERY_VERSIONS").split(",");
  if (versions.length > 8 || new Set(versions).size !== versions.length || versions.some((v) => !/^[A-Za-z0-9_-]{1,40}$/.test(v))) throw Error("n88_configuration");
  const recoveryKeys = new Map(versions.map((v) => [v, key2("N88_RECOVERY_KEY_" + v)]));
  const ca = required("N88_DATABASE_CA_CERT").replaceAll("\r\n", "\n");
  if (createHash9("sha256").update(ca).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") throw Error("n88_database_ca_configuration");
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: true, servername: db.hostname, minVersion: "TLSv1.2", ca },
    max: 2,
    connectionTimeoutMillis: 1e3,
    idleTimeoutMillis: 1e4,
    statement_timeout: 3e3,
    query_timeout: 4e3,
    application_name: "n88-private-server",
    allowExitOnIdle: true
  });
  pool.on("error", () => {
  });
  let waiting = 0;
  const acquire = async () => {
    if (waiting >= 8) throw Error("n88_pool_capacity");
    waiting++;
    let client;
    try {
      client = await pool.connect();
      await assertRestrictedTransport(client);
      await assertPrivateDatabaseSession(client);
      return client;
    } catch {
      client?.release(Error("n88_database_unavailable"));
      throw Error("n88_database_unavailable");
    } finally {
      waiting--;
    }
  };
  try {
    const handle = createWebEntry({
      ...deployment_inactive_default,
      rollout,
      canonicalBounds: { rollout },
      origin,
      authUrl,
      apiKey: required("N88_AUTH_API_KEY"),
      secretKey,
      ingressKey,
      numericKey,
      reservationKey,
      recoveryKeys,
      recoveryActiveKeyVersion,
      acquire,
      sourceOnly: false,
      canonicalReadback: true,
      privateIngressReadback: true
    });
    return Object.freeze({ handle, close: () => pool.end() });
  } catch {
    void pool.end();
    throw Error("n88_configuration");
  }
}

// drafts/n88-student-portal/activation/readiness-entry.mjs
import pg2 from "pg";
import { Buffer as Buffer14 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual4 } from "node:crypto";
var busy = 0;
var nonces = /* @__PURE__ */ new Map();
async function checkReadiness(readEnv) {
  const source = readEnv("N88_SERVICE_SOURCE_SHA");
  const client = new pg2.Client(databaseConfig(readEnv));
  let stage = "connect", identity2 = {};
  try {
    await client.connect();
    stage = "identity";
    identity2 = await assertRestrictedTransport(client);
    stage = "source_boundary";
    await assertPrivateDatabaseSession(client);
    stage = "configuration";
    let configurationReady = false;
    const rollout = createRolloutGuard(readEnv);
    if (readEnv("N88_SERVICE_REVISION") && rollout.configured) {
      const runtime2 = createExistingHost((n) => n === "N88_ENABLED" ? "true" : readEnv(n));
      await runtime2.close();
      configurationReady = true;
    }
    return { status: "ready", ...identity2, sourceBoundary: true, configurationReady, rolloutMode: rollout.mode, rolloutConfigured: rollout.configured, source, enabled: readEnv("N88_ENABLED") === "true" };
  } catch (e) {
    return { status: "unavailable", stage, ...identity2, ...e.safeReadiness ?? {}, code: /^(n88_[a-z_]+|[A-Z0-9]{5})$/.test(e.code ?? e.message) ? e.code ?? e.message : "n88_runtime_unavailable", source, enabled: false };
  } finally {
    await client.end().catch(() => {
    });
  }
}
async function readinessEntry(request, readEnv, check = checkReadiness) {
  if (readEnv("N88_READINESS_ENABLED") !== "true" || busy >= 2) return privateResponse();
  try {
    const u = new URL(request.url), time2 = request.headers.get("x-n88-time"), nonce = request.headers.get("x-n88-nonce"), sig = request.headers.get("x-n88-signature"), key2 = readEnv("N88_HMAC_KEY");
    if (u.origin !== readEnv("N88_AUTH_URL") || u.pathname !== "/functions/v1/n88-student-portal/readiness" || u.search || request.method !== "POST" || request.headers.get("content-type") !== "application/json" || request.headers.has("content-encoding") || !/^[a-f0-9]{64}$/.test(key2 ?? "") || !/^\d{10}$/.test(time2 ?? "") || Math.abs(Date.now() / 1e3 - Number(time2)) > 15 || !/^[a-f0-9-]{36}$/.test(nonce ?? "") || !/^[a-f0-9]{64}$/.test(sig ?? "")) return privateResponse(401);
    const body = new TextDecoder().decode(await readBytes(request.body, 2, AbortSignal.timeout(2e3)));
    if (body !== "{}") return privateResponse(401);
    const expected = await mac(Buffer14.from(key2, "hex"), JSON.stringify(["n88-readiness-v1", u.origin, u.pathname, time2, nonce, await sha(new TextEncoder().encode(body))]));
    if (!timingSafeEqual4(Buffer14.from(expected, "hex"), Buffer14.from(sig, "hex"))) return privateResponse(401);
    for (const [n, t] of nonces) if (t < Date.now() - 15e3) nonces.delete(n);
    if (nonces.has(nonce) || nonces.size >= 100) return privateResponse(401);
    nonces.set(nonce, Date.now());
    busy++;
    try {
      const result2 = await check(readEnv);
      return Response.json(result2, { status: result2.status === "ready" ? 200 : 503, headers: PRIVATE_WEB_HEADERS });
    } finally {
      busy--;
    }
  } catch {
    return privateResponse();
  }
}

// drafts/n88-student-portal/activation/edge-request.mjs
function edgeRequest(request, readEnv) {
  const u = new URL(request.url), local = "/n88-student-portal", publicPath = "/functions/v1/n88-student-portal";
  const origin = readEnv("N88_AUTH_URL");
  if (origin !== "https://xlrubcwjqktzzunrvuns.supabase.co") throw Error("n88_origin");
  if (u.pathname === local || u.pathname.startsWith(local + "/")) {
    const canonical = new URL(origin);
    canonical.pathname = publicPath + u.pathname.slice(local.length);
    canonical.search = u.search;
    return new Request(canonical, request);
  }
  return request;
}

// supabase/functions/n88-student-portal/index.ts
var runtime;
var runtimeGeneration;
Deno.serve(async (request) => {
  try {
    request = edgeRequest(request, (name) => Deno.env.get(name));
  } catch {
    return privateResponse();
  }
  try {
    if (new URL(request.url).pathname === "/functions/v1/n88-student-portal/readiness") return await readinessEntry(request, (name) => Deno.env.get(name));
    const readEnv = (name) => Deno.env.get(name);
    if (readEnv("N88_ENABLED") !== "true" || !createRolloutGuard(readEnv).configured) return privateResponse();
    const generation = JSON.stringify([readEnv("N88_ROLLOUT_MODE"), readEnv("N88_PILOT_BINDING"), readEnv("N88_SERVICE_SOURCE_SHA")]);
    if (runtime && generation !== runtimeGeneration) {
      const old = runtime;
      runtime = void 0;
      void old.close().catch(() => {
      });
    }
    runtime ??= createExistingHost((name) => Deno.env.get(name));
    runtimeGeneration = generation;
    return await runtime.handle(request);
  } catch {
    return privateResponse();
  }
});
addEventListener("beforeunload", () => {
  void runtime?.close().catch(() => {
  });
});
