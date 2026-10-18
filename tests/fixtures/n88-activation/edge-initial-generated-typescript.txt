// drafts/n88-student-portal/existing-host.mjs
import { Buffer as Buffer8 } from "node:buffer";
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
    "N88_SERVICE_REVISION"
  ],
  requiredTrustedPorts: [],
  requiredReadbacks: [
    "private SQL/helper identities + ACL/FKs",
    "existing Auth issuer/JWKS/user/session",
    "Cloudflare external ingress + log custody + TLS"
  ],
  sourceOnly: true,
  routes: [
    "/api/n88/teacher/students",
    "/api/n88/teacher/issue",
    "/api/n88/teacher/publish",
    "/api/n88/teacher/revoke",
    "/api/n88/s/<private-entry>/claim",
    "/api/n88/s/<private-entry>/read",
    "/api/n88/s/<private-entry>/logout"
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
  serviceRevision: "n88-existing-host-v1",
  ingress: {
    entry: "drafts/n88-student-portal/cloudflare-entry.mjs",
    environmentNames: [
      "N88_ENABLED",
      "N88_PUBLIC_ORIGIN",
      "N88_EDGE_URL",
      "N88_INGRESS_KEY"
    ],
    trust: "Cloudflare external HTTPS cf metadata; deny CF-Worker; signed allowlist/body/source/time/nonce; durable replay receipt"
  }
};

// drafts/n88-student-portal/web-entry.mjs
import { Buffer as Buffer7 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";

// drafts/n88-student-portal/runtime.mjs
import { Buffer as Buffer6 } from "node:buffer";
import { isIP } from "node:net";

// drafts/n88-student-portal/service.mjs
import { Buffer } from "node:buffer";
import { randomBytes, randomUUID, randomInt, createHash, createHmac, timingSafeEqual } from "node:crypto";

// src/lib/rakeez-datetime-values.js
var normalizeDateTimeDigits = (value) => String(value ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "\u0669" ? 1632 : 1776)));

// drafts/n88-student-portal/service.mjs
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
var hash = (value) => createHash("sha256").update(value).digest("hex");
var generateCode = (draw = randomInt) => String(draw(1e3, 1e4));
var secret = () => randomBytes(32).toString("base64url");
var denied = () => ({ status: 401, body: { error: "unavailable" } });
var PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie"
});
var active = (m) => m && m.status === "active" && !m.endDate && m.studentActive && m.classActive;
var bound = (a, b) => a.ownerId === b.ownerId && a.classId === b.classId && a.studentId === b.studentId && a.enrollmentId === b.enrollmentId;
var identity = (a, b) => a.ownerId === b.ownerId && a.studentId === b.studentId;
var currentMember = (db, credential) => {
  const members = db.memberships.filter((m) => identity(m, credential) && active(m));
  return members.length === 1 ? members[0] : null;
};
var revoke = (db, c, time2) => {
  c.revokedAt = time2;
  for (const s of db.sessions) if (s.credentialId === c.id) s.revokedAt = time2;
};
function bucket(db, key2, time2, window) {
  let b = db.rates.find((r) => r.key === key2);
  if (!b) {
    if (db.rates.length >= POLICY.maxRateKeys) return null;
    db.rates.push(b = { key: key2, count: 0, until: time2 + window });
  }
  return b;
}
function projection(db, session) {
  const tasks = db.publications.filter((p) => bound(p, session) && p.published === true).map((p) => ({
    id: p.id,
    title: String(p.title).slice(0, 160),
    instruction: String(p.instruction || "").slice(0, 500),
    status: ["done", "working", "todo"].includes(p.status) ? p.status : "todo",
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || "") ? p.deadline : null
  })).sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.id.localeCompare(b.id));
  return { tasks, progress: { completed: tasks.filter((t) => t.status === "done").length, total: tasks.length } };
}
function createPortalService({ repository, verifyTeacher, verifyIngress, secretKey, origin, now = Date.now, newCode = generateCode }) {
  if (!repository?.transaction || typeof verifyTeacher !== "function" || typeof verifyIngress !== "function" || !Buffer.isBuffer(secretKey) || secretKey.length < 32 || new URL(origin).origin !== origin) throw Error("Explicit secure server adapters required");
  const digest = (domain, ...parts) => createHmac("sha256", secretKey).update(JSON.stringify(["n88-v2", domain, ...parts])).digest("hex");
  const cookie = (namespace2, token, age) => `__Secure-n88=${token}; Path=/api/n88/s/${namespace2}; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  return async (request) => {
    let result;
    try {
      result = await repository.transaction(async (db, ports) => {
        const ingress = await verifyIngress(request, ports);
        if (!ingress?.clientKey) return denied();
        const time2 = now();
        db.rates = db.rates.filter((r) => r.until > time2);
        db.sessions = db.sessions.filter((s2) => s2.expiresAt > time2 && s2.revokedAt == null);
        const { path, method, headers = {}, body = {} } = request;
        if (headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin") return denied();
        if (method === "POST" && (headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied();
        if (path.startsWith("/teacher/")) {
          const auth = await verifyTeacher(request, ports);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true) return denied();
          const context2 = db.contexts.find((c2) => c2.ownerId === auth.ownerId && c2.active);
          if (!context2) return denied();
          await ports?.synchronizeOwner?.(auth.ownerId);
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && active(m));
          if (method === "GET" && path === "/teacher/students") return { status: 200, body: {
            namespace: context2.namespace,
            students: members.map((m) => ({
              enrollmentId: m.enrollmentId,
              revision: m.revision,
              label: m.label,
              publications: db.publications.filter((p) => bound(p, m)).map((p) => ({ id: p.id, title: p.title, status: p.status, published: p.published }))
            }))
          } };
          const member2 = members.find((m) => m.enrollmentId === body.enrollmentId && m.revision === body.revision);
          if (!member2) return denied();
          if (method === "POST" && path === "/teacher/issue") {
            let code, verifier;
            for (let attempt = 0; attempt < 128; attempt++) {
              code = newCode();
              if (typeof code !== "string" || !/^[1-9][0-9]{3}$/.test(code)) throw Error("Invalid generator");
              verifier = digest("code", context2.namespace, code);
              if (!db.credentials.some((c2) => c2.namespace === context2.namespace && c2.verifier === verifier)) break;
              code = null;
            }
            if (!code) throw Error("Collision budget");
            for (const c2 of db.credentials) if (identity(c2, member2) && c2.revokedAt == null) revoke(db, c2, time2);
            const version = Math.max(0, ...db.credentials.filter((c2) => identity(c2, member2)).map((c2) => c2.version)) + 1;
            const entrySecret2 = secret(), entryVerifier2 = digest("entry", entrySecret2);
            if (db.credentials.some((c2) => c2.entryVerifier === entryVerifier2)) throw Error("Entry collision");
            db.credentials.push({
              id: randomUUID(),
              ownerId: member2.ownerId,
              studentId: member2.studentId,
              namespace: context2.namespace,
              verifier,
              entryVerifier: entryVerifier2,
              version,
              revokedAt: null
            });
            return { status: 200, body: { code, entrySecret: entrySecret2, namespace: context2.namespace } };
          }
          if (method === "POST" && path === "/teacher/revoke") {
            for (const c2 of db.credentials) if (identity(c2, member2)) revoke(db, c2, time2);
            return { status: 200, body: { revoked: true } };
          }
          if (method === "POST" && path === "/teacher/publish") {
            const p = db.publications.find((p2) => p2.id === body.publicationId && bound(p2, member2));
            if (!p || typeof body.published !== "boolean" || !["todo", "working", "done"].includes(body.status) || typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) return denied();
            p.title = body.title.trim();
            p.status = body.status;
            p.published = body.published;
            return { status: 200, body: { updated: true } };
          }
          return denied();
        }
        const route = /^\/s\/([A-Za-z0-9_-]{43})\/(claim|read|logout)$/.exec(path);
        if (!route) return denied();
        const [, entrySecret, action] = route;
        const entryVerifier = digest("entry", entrySecret);
        const token = /(?:^|;\s*)__Secure-n88=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || "")?.[1];
        const clearDenied = () => ({ ...denied(), cookie: cookie(entrySecret, "", 0) });
        if (method === "POST" && action === "claim") {
          const attempts = [
            [digest("source", ingress.clientKey), POLICY.sourceAttempts],
            [digest("context", entryVerifier), POLICY.contextAttempts],
            ["global", POLICY.globalAttempts]
          ].map(([key2, max]) => ({ b: bucket(db, key2, time2, POLICY.rateWindowMs), max }));
          const failures = [[digest("context-failure", entryVerifier), POLICY.contextFailures], ["global-failure", POLICY.globalFailures]].map(([key2, max]) => ({ b: bucket(db, key2, time2, POLICY.failureWindowMs), max }));
          const blocked = [...attempts, ...failures].some(({ b, max }) => !b || b.count >= max);
          if (token) {
            for (const s2 of db.sessions) if (s2.entryVerifier === entryVerifier && s2.tokenHash === hash(token)) s2.revokedAt = time2;
          }
          if (blocked) return clearDenied();
          attempts.forEach(({ b }) => b.count++);
          const fail3 = () => {
            failures.forEach(({ b }) => b.count++);
            return clearDenied();
          };
          if (typeof body.code !== "string") return fail3();
          const code = normalizeDateTimeDigits(body.code);
          if (!/^[1-9][0-9]{3}$/.test(code)) return fail3();
          const credential = db.credentials.find((c2) => c2.entryVerifier === entryVerifier && c2.revokedAt == null);
          const context2 = credential && db.contexts.find((c2) => c2.namespace === credential.namespace && c2.active);
          const verifier = digest("code", credential?.namespace || "", code);
          const matches = timingSafeEqual(Buffer.from(credential?.verifier || "0".repeat(64), "hex"), Buffer.from(verifier, "hex"));
          if (context2 && credential && matches && context2.ownerId === credential.ownerId) await ports?.synchronizeOwner?.(credential.ownerId);
          const member2 = credential && currentMember(db, credential);
          if (!context2 || !credential || !matches || context2.ownerId !== credential.ownerId || !member2) return fail3();
          const sessionToken = secret();
          db.sessions.push({
            ...Object.fromEntries(["ownerId", "classId", "studentId", "enrollmentId"].map((k) => [k, member2[k]])),
            id: randomUUID(),
            credentialId: credential.id,
            version: credential.version,
            membershipRevision: member2.revision,
            canonicalStamp: member2.canonicalStamp,
            namespace: credential.namespace,
            entryVerifier,
            tokenHash: hash(sessionToken),
            expiresAt: time2 + POLICY.sessionMs,
            revokedAt: null
          });
          return { status: 200, body: { claimed: true }, cookie: cookie(entrySecret, sessionToken, POLICY.sessionMs / 1e3) };
        }
        const s = token && db.sessions.find((s2) => s2.entryVerifier === entryVerifier && s2.tokenHash === hash(token));
        if (method === "POST" && action === "logout") {
          if (s) s.revokedAt = time2;
          return { status: 200, body: { loggedOut: true }, cookie: cookie(entrySecret, "", 0) };
        }
        const c = s && db.credentials.find((c2) => c2.id === s.credentialId && identity(c2, s) && c2.entryVerifier === entryVerifier && c2.namespace === s.namespace);
        if (c && c.revokedAt == null && s.revokedAt == null && s.expiresAt > time2) await ports?.synchronizeOwner?.(c.ownerId);
        const member = c && currentMember(db, c);
        const context = s && db.contexts.find((c2) => c2.namespace === s.namespace && c2.active);
        if (!s || s.revokedAt != null || s.expiresAt <= time2 || !c || c.revokedAt != null || c.version !== s.version || !context || context.ownerId !== s.ownerId || !member || !bound(member, s) || member.revision !== s.membershipRevision || member.canonicalStamp !== s.canonicalStamp) return clearDenied();
        if (method === "GET" && action === "read") return { status: 200, body: projection(db, s) };
        return denied();
      });
    } catch {
      result = { status: 503, body: { error: "unavailable" } };
    }
    return { ...result, headers: { ...PRIVATE_HEADERS, ...result.cookie ? { "Set-Cookie": result.cookie } : {} } };
  };
}

// drafts/n88-student-portal/postgres-repository.mjs
import { Buffer as Buffer2 } from "node:buffer";
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
var exact = (o, keys) => must(o && Object.getPrototypeOf(o) === Object.prototype && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k)));
var str = (s, max, min = 1) => must(typeof s === "string" && s.length >= min && s.length <= max && !s.includes("\0"));
var uuid = (s) => must(typeof s === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s));
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
var date = (s) => {
  if (s === null) return;
  must(typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
};
var namespace = (s) => must(typeof s === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(s));
var active2 = (r) => r.status === "active" && r.endDate === null && r.studentActive && r.classActive;
function validate(name, r) {
  exact(r, tables[name].fields);
  for (const k of ["ownerId", "id", "credentialId"]) if (Object.hasOwn(r, k)) uuid(r[k]);
  for (const k of ["classId", "studentId", "enrollmentId"]) if (Object.hasOwn(r, k)) str(r[k], 240);
  if (Object.hasOwn(r, "namespace")) namespace(r.namespace);
  for (const k of ["version", "revision", "membershipRevision"]) if (Object.hasOwn(r, k)) safe(r[k], 1);
  for (const k of ["verifier", "entryVerifier", "tokenHash"]) if (Object.hasOwn(r, k)) hex(r[k]);
  if (Object.hasOwn(r, "canonicalStamp")) hex(r.canonicalStamp);
  if (Object.hasOwn(r, "revokedAt") && r.revokedAt !== null) time(r.revokedAt);
  if (name === "contexts") bool(r.active);
  if (name === "memberships") {
    must(["active", "inactive", "ended"].includes(r.status));
    date(r.endDate);
    bool(r.studentActive);
    bool(r.classActive);
    str(r.label, 300, 0);
  }
  if (name === "sessions") time(r.expiresAt);
  if (name === "publications") {
    exact(r.source, ["teachingId", "itemId"]);
    str(r.source.teachingId, 240);
    str(r.source.itemId, 240);
    str(r.title, 160);
    str(r.instruction, 500, 0);
    date(r.deadline);
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
  if (name === "memberships") return tables[name].fields.map((k) => r[k]).concat(active2(r));
  if (name === "publications") return [r.id, r.ownerId, r.classId, r.studentId, r.enrollmentId, r.source.teachingId, r.source.itemId, r.title, r.instruction, r.deadline, r.status, r.published];
  return tables[name].fields.map((k) => ["revokedAt", "expiresAt", "until"].includes(k) ? stamp(r[k]) : r[k]);
}
function decode(name, row) {
  const t = tables[name];
  exact(row, t.cols);
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
    must(row.active === active2(r));
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
  exact(state, names);
  let total = 0, bytes = 0;
  const maps = {};
  for (const name of names) {
    must(Array.isArray(state[name]) && state[name].length <= limits[name]);
    total += state[name].length;
    must(total <= limits.total);
    maps[name] = /* @__PURE__ */ new Map();
    for (const r of state[name]) {
      const values = encode(name, r), json = JSON.stringify(r), size = Buffer2.byteLength(json);
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
  exact(limits, [...names, "total", "bytes", "rowBytes"]);
  for (const k of names) safe(limits[k], 1, 1e4);
  safe(limits.total, 1, 5e4);
  safe(limits.bytes, 1024, 64 * 1024 * 1024);
  safe(limits.rowBytes, 128, 32768);
  exact(timing, ["acquireMs", "transactionMs", "cleanupMs", "statementMs", "lockMs"]);
  for (const k of Object.keys(timing)) safe(timing[k], 1, 6e4);
  must(timing.acquireMs <= timing.transactionMs && timing.statementMs <= timing.transactionMs && timing.lockMs <= timing.statementMs);
  limits = { ...limits };
  timing = { ...timing };
  return Object.freeze({ async transaction(action) {
    must(typeof action === "function");
    let c, live = true, begun = false, committed = false, destroyed = false;
    const deadline = Date.now() + timing.transactionMs;
    const fence = () => must(live && Date.now() < deadline);
    const release = (broken) => {
      if (c && !destroyed) {
        destroyed = true;
        c.release(broken ? unavailable() : void 0);
      }
    };
    const query = async (text, values = []) => {
      fence();
      const r = await c.query(text, values);
      fence();
      return r;
    };
    let timer, acquireTimer;
    const work = (async () => {
      const lease = Promise.resolve().then(acquire);
      lease.then((client) => {
        if (!live) client.release(unavailable());
      }, () => {
      });
      c = await Promise.race([lease, new Promise((_, reject) => {
        acquireTimer = setTimeout(() => reject(unavailable()), timing.acquireMs);
      })]);
      clearTimeout(acquireTimer);
      fence();
      must(c && typeof c.query === "function" && typeof c.release === "function");
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
        const bound2 = Math.min(limits[name], limits.total - count);
        const result2 = await query(queries[name].read, [bound2 + 1, limits.rowBytes, limits.bytes - transferred]);
        must(result2.rows.length <= bound2);
        state[name] = result2.rows.map((row) => {
          exact(row, ["bounded_row"]);
          must(typeof row.bounded_row === "string");
          transferred += Buffer2.byteLength(row.bounded_row);
          must(transferred <= limits.bytes);
          return decode(name, JSON.parse(row.bounded_row));
        });
        count += state[name].length;
        bytes += Buffer2.byteLength(JSON.stringify(state[name]));
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
        uuid(ownerId);
        if (owners.has(ownerId)) return;
        await synchronize(state, { query }, ownerId);
        fence();
        snapshot(state, limits);
        owners.add(ownerId);
      };
      const value = await action(state, Object.freeze({ query, synchronizeOwner, beforeCommit }));
      fence();
      const final = snapshot(structuredClone(state), limits), result = structuredClone(value);
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
      return result;
    })();
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(unavailable()), Math.max(1, deadline - Date.now()));
      })]);
    } catch {
      live = false;
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
      live = false;
      clearTimeout(timer);
      clearTimeout(acquireTimer);
      release(!committed);
    }
  } });
}

// drafts/n88-student-portal/canonical-adapter.mjs
import { Buffer as Buffer3 } from "node:buffer";
import { createHash as createHash2 } from "node:crypto";
var CANONICAL_TABLES = Object.freeze(["years", "terms", "sections", "students", "enrollments", "teachings", "items"]);
var fail = () => {
  throw Error("n88_canonical_unavailable");
};
var key = (m) => JSON.stringify([m.ownerId, m.classId, m.studentId, m.enrollmentId]);
var id = (parts) => {
  const h = createHash2("sha256").update(JSON.stringify(["n88-publication-v1", ...parts])).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function createCanonicalAdapter({ maxRows = 2e3, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail();
  return async (db, { query }, ownerId) => {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId) || !db.contexts.some((c) => c.ownerId === ownerId && c.active)) fail();
    await query("select n88_private.lock_canonical_sources($1::uuid,$2::integer)", [ownerId, maxRows]);
    const owners = [ownerId];
    const result = await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
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
    if (result.rows.length > maxRows) fail();
    let bytes = 0;
    const read = (row) => {
      if (typeof row.payload !== "string") fail();
      bytes += Buffer3.byteLength(row.payload);
      if (bytes > maxBytes) fail();
      return JSON.parse(row.payload);
    };
    const previous = new Map(db.memberships.map((m) => [key(m), m]));
    for (const m of db.memberships.filter((m2) => m2.ownerId === ownerId)) {
      m.status = "inactive";
      m.studentActive = false;
      m.classActive = false;
    }
    for (const row of result.rows) {
      const r = read(row), revision = Number(r.revision);
      if (!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision)) fail();
      const revisions = [r.revision, r.student_revision, r.section_revision, r.year_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail();
      const canonicalStamp = createHash2("sha256").update(JSON.stringify(["n88-lineage-v1", ...revisions])).digest("hex");
      const m = {
        ownerId: r.owner_id,
        classId: r.section_id,
        studentId: r.student_id,
        enrollmentId: r.enrollment_id,
        revision,
        canonicalStamp,
        status: r.enrollment_present && r.status === "active" ? "active" : "ended",
        endDate: r.end_date,
        studentActive: r.student_active,
        classActive: r.class_active,
        label: r.label
      };
      if (!owners.includes(m.ownerId)) fail();
      const old = previous.get(key(m));
      if (old) Object.assign(old, m);
      else {
        db.memberships.push(m);
        previous.set(key(m), m);
      }
    }
    for (const s of db.sessions.filter((s2) => s2.ownerId === ownerId && s2.revokedAt == null)) {
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
    if (source.rows.length > maxRows) fail();
    const current = /* @__PURE__ */ new Set();
    for (const row of source.rows) {
      const r = read(row);
      const revisions = [r.item_revision, r.teaching_revision, r.term_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail();
      for (const m of db.memberships.filter((m2) => m2.ownerId === r.owner_id && m2.classId === r.section_id && m2.status === "active" && !m2.endDate && m2.studentActive && m2.classActive)) {
        const publicationId = id([m.ownerId, m.enrollmentId, m.canonicalStamp, r.teaching_id, r.item_id, ...revisions]);
        current.add(publicationId);
        const existing = db.publications.find((p) => p.id === publicationId);
        if (existing && (key(existing) !== key(m) || existing.source.teachingId !== r.teaching_id || existing.source.itemId !== r.item_id)) fail();
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
        if (db.publications.length > maxRows) fail();
      }
    }
    db.publications = db.publications.filter((p) => p.ownerId !== ownerId || current.has(p.id));
  };
}

// drafts/n88-student-portal/http-adapter.mjs
import { Buffer as Buffer4 } from "node:buffer";

// drafts/n88-student-portal/auth-verifier.mjs
import { Buffer as Buffer5 } from "node:buffer";
import { AuthClient } from "@supabase/auth-js";
var uuid2 = (s) => typeof s === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
var fail2 = () => {
  throw Error("n88_auth_configuration");
};
function createTeacherVerifier({ authUrl, apiKey, fetch: send = globalThis.fetch, authDeadlineMs = 2e3, now = Date.now }) {
  const url = new URL(authUrl);
  if (url.origin !== authUrl || url.protocol !== "https:" || !apiKey || typeof send !== "function" || !Number.isInteger(authDeadlineMs) || authDeadlineMs < 20 || authDeadlineMs > 5e3) fail2();
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
        if (u.origin !== authUrl || ![issuer + "/user", issuer + "/.well-known/jwks.json"].includes(u.href) || init.method && init.method !== "GET") fail2();
        const response = await send(u.href, { ...init, redirect: "error", cache: "no-store", credentials: "omit", signal: abort.signal });
        let n = 0;
        const parts = [];
        const reader = response.body?.getReader();
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
        return new Response(Buffer5.concat(parts), { status: response.status, headers: response.headers });
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
      const verified = await auth.getClaims(token);
      fence();
      if (verified.error || !verified.data?.claims) return null;
      const c = verified.data.claims, sec = Math.floor(now() / 1e3);
      if (c.iss !== issuer || !(c.aud === "authenticated" || Array.isArray(c.aud) && c.aud.length === 1 && c.aud[0] === "authenticated") || c.role !== "authenticated" || !uuid2(c.sub) || !uuid2(c.session_id) || c.is_anonymous === true || !Number.isSafeInteger(c.exp) || c.exp <= sec || !Number.isSafeInteger(c.iat) || c.iat > sec || c.iat >= c.exp || c.nbf !== void 0 && (!Number.isSafeInteger(c.nbf) || c.nbf > sec)) return null;
      const current = await query("select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
      fence();
      const matches = (result) => result.rows.length === 1 && result.rows[0].user_id === c.sub && result.rows[0].session_id === c.session_id;
      if (!matches(current)) return null;
      const fresh = await auth.getUser(token);
      fence();
      const user = fresh.data?.user;
      if (fresh.error || !user || user.id !== c.sub || user.is_anonymous === true || user.deleted_at || user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > now())) return null;
      if (c.exp <= Math.floor(now() / 1e3)) return null;
      beforeCommit?.(async () => {
        if (c.exp <= Math.floor(now() / 1e3)) throw Error("n88_auth_expired");
        const result = await query("select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
        if (!matches(result)) throw Error("n88_auth_expired");
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
  if (sourceOnly !== false || typeof acquire !== "function" || canonicalReadback !== true || privateIngressReadback !== true || !Buffer6.isBuffer(secretKey) || secretKey.length < 32 || typeof apiKey !== "string" || !apiKey || ![origin, authUrl].every((u) => {
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
  return createPortalService({
    repository,
    origin: options.origin,
    secretKey: options.secretKey,
    verifyIngress: adapter.verifyIngress,
    verifyTeacher: adapter.verifyTeacher
  });
}

// drafts/n88-student-portal/web-protocol.mjs
var ROUTE = /^\/api\/n88\/(?:teacher\/(?:students|issue|publish|revoke)|s\/[A-Za-z0-9_-]{43}\/(?:claim|read|logout))$/;
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
  if (!Buffer7.isBuffer(options.ingressKey) || options.ingressKey.length !== 32) throw Error("n88_ingress_configuration");
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
      const result = await query("select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted", [e.nonce, Number(e.time) + 16]);
      return result.rows.length === 1 && result.rows[0].accepted === true ? { clientKey: e.source } : null;
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
        const cookie = h.get("cookie") || "";
        if (cookie.length > 4096 || (cookie.match(/(?:^|;\s*)__Secure-n88=/g) || []).length > 1 || (h.get("authorization") || "").length > 8200 || h.get("sec-fetch-site") && h.get("sec-fetch-site") !== "same-origin" || h.has("content-encoding")) return privateResponse(400);
        if (method === "POST" && (h.get("origin") !== options.origin || h.get("content-type") !== "application/json" || h.get("x-n88-csrf") !== "1")) return privateResponse(401);
        const bytes = decodeBytes(envelope.body);
        if (bytes.length > 4096) return privateResponse(413);
        const expected = await mac(options.ingressKey, signingText({ origin: options.origin, path, method, headers: h, bodyHash: await sha(bytes), time: time2, nonce, source }));
        if (!timingSafeEqual2(Buffer7.from(expected, "hex"), Buffer7.from(signature, "hex"))) return privateResponse(401);
        let body = {};
        if (bytes.length) body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!body || Array.isArray(body) || typeof body !== "object" || method === "GET" && bytes.length) return privateResponse(400);
        const r = { path: path.slice("/api/n88".length), method, body, headers: Object.fromEntries(["cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"].map((n) => [n, h.get(n) || ""])) };
        envelopes.set(r, { authorization: h.get("authorization"), signal: abort.signal, time: time2, nonce, source });
        try {
          const result = await service(r);
          return Response.json({ status: result.status, body: result.body, cookie: result.headers?.["Set-Cookie"] || null }, { headers: PRIVATE_WEB_HEADERS });
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

// drafts/n88-student-portal/existing-host.mjs
function createExistingHost(readEnv) {
  if (readEnv("N88_ENABLED") !== "true") return Object.freeze({ handle: async () => privateResponse(), close: async () => {
  } });
  const required = (n) => {
    const v = readEnv(n);
    if (typeof v !== "string" || !v) throw Error("n88_configuration");
    return v;
  };
  const origin = required("N88_PUBLIC_ORIGIN"), authUrl = required("N88_AUTH_URL"), dbUrl = required("N88_DATABASE_URL");
  const db = new URL(dbUrl);
  const username = decodeURIComponent(db.username);
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !(username === "n88_backend" || /^n88_backend\.[a-z0-9]{20}$/.test(username)) || !db.password || db.search || db.hash) throw Error("n88_database_configuration");
  const key2 = (n) => {
    const s = required(n);
    if (!/^[a-f0-9]{64}$/.test(s)) throw Error("n88_key_configuration");
    return Buffer8.from(s, "hex");
  };
  if (required("N88_SERVICE_REVISION") !== deployment_inactive_default.serviceRevision) throw Error("n88_service_readback_missing");
  const secretKey = key2("N88_HMAC_KEY"), ingressKey = key2("N88_INGRESS_KEY");
  if (secretKey.equals(ingressKey)) throw Error("n88_separate_keys_required");
  const ca = readEnv("N88_DATABASE_CA_CERT");
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: true, ...ca ? { ca } : {} },
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
      if ((await client.query("select current_user as role")).rows[0]?.role !== "n88_backend") throw Error("n88_database_role");
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
      origin,
      authUrl,
      apiKey: required("N88_AUTH_API_KEY"),
      secretKey,
      ingressKey,
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

// supabase/functions/n88-student-portal/index.ts
var runtime;
Deno.serve(async (request) => {
  try {
    runtime ??= createExistingHost((name) => Deno.env.get(name));
    return await runtime.handle(request);
  } catch {
    return privateResponse();
  }
});
addEventListener("beforeunload", () => {
  void runtime?.close();
});
