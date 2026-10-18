// drafts/n88-student-portal/existing-host.mjs
import { Buffer as Buffer10 } from "node:buffer";
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
    "N88_RESERVATION_KEY"
  ],
  requiredTrustedPorts: [],
  requiredReadbacks: [
    "private SQL/helper identities + ACL/FKs",
    "existing Auth issuer/JWKS/user/session",
    "Cloudflare external ingress + log custody + TLS"
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
    "/api/n88/student/end"
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
  }
};

// drafts/n88-student-portal/web-entry.mjs
import { Buffer as Buffer9 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual3 } from "node:crypto";

// drafts/n88-student-portal/runtime.mjs
import { Buffer as Buffer8 } from "node:buffer";
import { isIP } from "node:net";

// drafts/n88-student-portal/integrated-service.mjs
import { createHash as createHash5, randomUUID as randomUUID3 } from "node:crypto";

// drafts/n88-student-portal/class-credentials.mjs
import { Buffer as Buffer3 } from "node:buffer";
import { createHash as createHash2 } from "node:crypto";

// drafts/n88-student-portal/service.mjs
import { Buffer as Buffer2 } from "node:buffer";
import { randomBytes, randomUUID, randomInt, createHash, createHmac, timingSafeEqual } from "node:crypto";
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

// drafts/n88-student-portal/class-credentials.mjs
var fail = () => {
  throw Error("n88_class_unavailable");
};
var hash = (value) => createHash2("sha256").update(JSON.stringify(value)).digest("hex");
var active = (m) => m.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var id = (value) => typeof value === "string" && value.length > 0 && value.length <= 240 && !value.includes("\0");
var requestId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(value);
var version = (db, m) => Math.max(0, ...db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId).map((c) => c.version));
var live = (db, m) => db.numericCredentials.some((c) => c.ownerId === m.ownerId && c.studentId === m.studentId && c.revokedAt === null);
var result = (status, body) => ({ status, body, headers: { ...PRIVATE_HEADERS } });
var denied = () => result(401, { error: "unavailable" });
var replay = (receipt) => receipt.results.map((r) => r.status === "created" ? { ...r, status: "uncertain", recovery: "deliberate_rotate_required" } : { ...r });
var summary = (rows) => Object.fromEntries(["created", "skipped", "failed", "uncertain"].map((s) => [s, rows.filter((r) => r.status === s).length]));
function createClassCredentialOperations({ repository, verifyTeacher, verifyIngress, origin, resolveClass, issueMember, rotateMember, revokeMember }) {
  if (!repository?.transaction || [verifyTeacher, verifyIngress, resolveClass, issueMember, rotateMember, revokeMember].some((f) => typeof f !== "function") || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail();
  return Object.freeze({ forRequest(request) {
    async function run(action, teachingId, input = {}) {
      try {
        return await repository.transaction(async (db, ports) => {
          const ingress = await verifyIngress(request, ports), headers = request.headers || {};
          if (!ingress?.clientKey || headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin" || action === "list" && request.method !== "GET" || action !== "list" && (request.method !== "POST" || headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true || typeof ports?.synchronizeOwner !== "function") return denied();
          await ports.synchronizeOwner(auth.ownerId);
          const scope = await resolveClass(db, ports, auth, teachingId, input);
          if (!scope || scope.ownerId !== auth.ownerId || scope.current !== true || !id(scope.teachingId) || !id(scope.classId) || !id(scope.revision)) return denied();
          if (teachingId !== null && scope.teachingId !== teachingId) return denied();
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === scope.classId && active(m));
          if (members.length > 2e3 || new Set(members.map((m) => m.studentId)).size !== members.length) return denied();
          if (members.some((m) => db.memberships.filter((x) => x.ownerId === m.ownerId && x.studentId === m.studentId && active(x)).length !== 1)) return denied();
          members.sort((a, b) => a.studentId.localeCompare(b.studentId));
          const rosterRevision = hash([scope.teachingId, scope.revision, members.map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          if (action === "list") return result(200, { teachingId: scope.teachingId, rosterRevision, students: members.map((m) => ({
            studentId: m.studentId,
            enrollmentId: m.enrollmentId,
            revision: m.revision,
            label: m.label,
            credentialVersion: version(db, m),
            hasActiveCredential: live(db, m)
          })) });
          if (!requestId(input.requestId)) return denied();
          const binding = hash([action, scope.teachingId, input.expectedRosterRevision ?? null, input.studentId ?? null, input.enrollmentId ?? null, input.revision ?? null, input.credentialVersion ?? null]);
          const prior = db.classReceipts.find((r) => r.ownerId === auth.ownerId && r.requestId === input.requestId);
          if (prior) {
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
            const before = structuredClone({ credentials: db.numericCredentials, sessions: db.numericSessions });
            try {
              const issued = await { batch: issueMember, rotate: rotateMember, revoke: revokeMember }[action](db, m, { expectedVersion });
              if (action === "revoke") {
                if (issued?.revoked !== true || live(db, m)) fail();
                rows.push({ ...base, status: "skipped", reason: "revoked" });
              } else {
                if (!/^1[0-9]{5}$/.test(issued?.code || "") || issued.credentialVersion !== expectedVersion + 1 || !live(db, m)) fail();
                rows.push({ ...base, credentialVersion: issued.credentialVersion, status: "created" });
                secrets.push({ studentId: m.studentId, code: issued.code });
              }
            } catch {
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
    if (!id(requested) || typeof ports?.query !== "function") return null;
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
    if (teachingId === null && !db.memberships.some((m) => m.ownerId === auth.ownerId && m.classId === t.section_id && m.studentId === input.studentId && m.enrollmentId === input.enrollmentId && active(m))) return null;
    return { ownerId: auth.ownerId, classId: t.section_id, teachingId: t.id, current: true, revision: hash([t.teaching_revision, t.term_revision]) };
  };
}
function withCredentialRepository(repository, { maxRows = 1e4, maxBytes = 4 * 1024 * 1024 } = {}) {
  if (!repository?.transaction || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail();
  const tables2 = { numericCredentials: "numeric_credentials", numericSessions: "numeric_sessions", numericRates: "numeric_rates", classReceipts: "class_credential_receipts" };
  return Object.freeze({
    // Existing global advisory lock + fenced COMMIT, without credential reads.
    claimAttempt: (action) => repository.transaction(async (_db, ports) => {
      const r = await ports.query("select payload from n88_private.numeric_rates limit $1", [maxRows + 1]);
      if (r.rows.length > maxRows) fail();
      const state = { numericRates: r.rows.map((r2) => r2.payload) };
      const allowed = await action(state, ports);
      if (state.numericRates.length > maxRows) fail();
      const keys = new Set(state.numericRates.map((r2) => r2.key));
      for (const row of r.rows) if (!keys.has(row.payload.key)) await ports.query("delete from n88_private.numeric_rates where row_key=$1", [row.payload.key]);
      for (const row of state.numericRates) await ports.query("insert into n88_private.numeric_rates(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload", [row.key, JSON.stringify(row)]);
      return allowed;
    }),
    transaction: (action) => repository.transaction(async (db, ports) => {
      if (typeof ports?.query !== "function") fail();
      const extra = {}, original = {};
      let bytes = 0;
      for (const [name, table] of Object.entries(tables2)) {
        const r = await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`, [maxRows + 1, maxBytes - bytes]);
        if (r.rows.length > maxRows) fail();
        extra[name] = r.rows.map((r2) => {
          if (!r2.payload) fail();
          bytes += Buffer3.byteLength(JSON.stringify(r2.payload));
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
          bytes += Buffer3.byteLength(JSON.stringify(row));
          if (bytes > maxBytes) fail();
          if (before.has(key2) && JSON.stringify(before.get(key2)) === JSON.stringify(row)) continue;
          const ack = before.has(key2) ? await ports.query(`update n88_private.${table} set payload=$2::jsonb where row_key=$1`, [key2, JSON.stringify(row)]) : await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb)`, [key2, JSON.stringify(row)]);
          if (ack.rowCount !== 1) fail();
        }
      }
      return value;
    })
  });
}

// drafts/n88-student-portal/numeric-credentials.mjs
import { randomInt as randomInt2, randomBytes as randomBytes2, randomUUID as randomUUID2, createHmac as createHmac2, createHash as createHash3, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var CREDENTIAL_FORMAT = "six-v1";
var CREDENTIAL_CAPACITY = 1e5;
var NUMERIC_POLICY = Object.freeze({
  collisionBudget: 128,
  sessionMs: 8 * 60 * 6e4,
  windowMs: 15 * 6e4,
  clientAttempts: 6,
  globalAttempts: 100,
  maxRateKeys: 1e4
});
var generateNumericCredential = () => "1" + String(randomInt2(0, 1e5)).padStart(5, "0");
function normalizeNumericCredential(value) {
  if (typeof value !== "string" || value.length > 80) return null;
  const code = value.replace(/^ +| +$/g, "");
  return /^1[0-9]{5}$/.test(code) ? code : null;
}
var fail2 = () => {
  throw Error("n88_numeric_unavailable");
};
var active2 = (m) => m?.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var identity = (a, b) => a.ownerId === b.ownerId && a.studentId === b.studentId;
var tokenHash = (token) => createHash3("sha256").update(token).digest("hex");
var cookie = (value, age) => `__Secure-n88-student=${value}; Path=/api/n88/student; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
var denied2 = () => ({ status: 401, body: { error: "unavailable" }, cookie: cookie("", 0) });
var response = (r) => ({ ...r, headers: { ...PRIVATE_HEADERS, ...r.cookie ? { "Set-Cookie": r.cookie } : {} } });
function createNumericCredentialOperations({
  keys,
  activeKeyVersion,
  reservationKey,
  now = Date.now,
  generate = generateNumericCredential
}) {
  if (!(keys instanceof Map) || !keys.size || !/^[A-Za-z0-9_-]{1,40}$/.test(activeKeyVersion || "") || !keys.has(activeKeyVersion) || !Buffer.isBuffer(reservationKey) || reservationKey.length < 32 || [...keys].some(([v, k]) => !/^[A-Za-z0-9_-]{1,40}$/.test(v) || !Buffer.isBuffer(k) || k.length < 32)) fail2();
  keys = new Map([...keys].map(([v, k]) => [v, Buffer.from(k)]));
  reservationKey = Buffer.from(reservationKey);
  const mac2 = (key2, domain, ...parts) => createHmac2("sha256", key2).update(JSON.stringify(["n88-numeric-v1", domain, ...parts])).digest("hex");
  const reservation = (code) => mac2(reservationKey, "global-reservation", code);
  const verifier = (code, c) => mac2(keys.get(c.keyVersion), "credential", c.ownerId, c.studentId, c.version, code);
  function current(db, c) {
    if (!db.contexts.some((x) => x.ownerId === c.ownerId && x.active === true)) return null;
    const members = db.memberships.filter((m) => identity(m, c) && active2(m));
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
    const canonical = current(db, m);
    if (!canonical || canonical.enrollmentId !== m.enrollmentId || canonical.revision !== m.revision || canonical.canonicalStamp !== m.canonicalStamp || version2(db, m) !== expectedVersion) fail2();
  }
  function issue(db, m, expectedVersion, { rotate = false } = {}) {
    check(db, m, expectedVersion);
    const previous = db.numericCredentials.filter((c2) => identity(c2, m) && c2.revokedAt === null);
    if (previous.length > 1 || previous.length && !rotate) fail2();
    if (!Number.isSafeInteger(expectedVersion + 1)) fail2();
    if (db.numericCredentials.filter((c2) => c2.format === CREDENTIAL_FORMAT).length >= CREDENTIAL_CAPACITY) fail2();
    let code, reserved;
    for (let attempt = 0; attempt < NUMERIC_POLICY.collisionBudget; attempt++) {
      code = generate();
      if (typeof code !== "string" || !/^1[0-9]{5}$/.test(code)) fail2();
      reserved = reservation(code);
      if (!db.numericCredentials.some((c2) => c2.reservation === reserved)) break;
      code = null;
    }
    if (!code) fail2();
    const c = {
      id: randomUUID2(),
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
    if (!repository?.transaction || typeof verifyIngress !== "function" || typeof project !== "function" || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail2();
    return async (request) => {
      try {
        const claim = (request.path === "/student/claim" || request.path === "/api/n88/student/claim") && request.method === "POST";
        if (claim) {
          if (typeof repository.claimAttempt !== "function") return response(denied2());
          const allowed = await repository.claimAttempt(async (db, ports) => {
            const ingress = await verifyIngress(request, ports);
            if (!ingress?.clientKey) return false;
            const time2 = now();
            db.numericRates = db.numericRates.filter((r) => r.until > time2);
            const budgets = [[mac2(reservationKey, "client-rate", ingress.clientKey), NUMERIC_POLICY.clientAttempts], ["global", NUMERIC_POLICY.globalAttempts]];
            let blocked = false;
            for (const [key2, max] of budgets) {
              let b = db.numericRates.find((b2) => b2.key === key2);
              if (!b && db.numericRates.length < NUMERIC_POLICY.maxRateKeys) db.numericRates.push(b = { key: key2, count: 0, until: time2 + NUMERIC_POLICY.windowMs });
              if (!b || b.count >= max) blocked = true;
              if (b) b.count = Math.min(max, b.count + 1);
            }
            return !blocked;
          });
          if (!allowed) return response(denied2());
        }
        return response(await repository.transaction(async (db, ports) => {
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
            if (typeof ports?.synchronizeOwner !== "function") fail2();
            await ports.synchronizeOwner(c2.ownerId);
            const m2 = current(db, c2);
            if (!m2) return denied2();
            if (token) {
              for (const s2 of db.numericSessions) if (s2.tokenHash === tokenHash(token)) s2.revokedAt = time2;
            }
            const fresh = randomBytes2(32).toString("base64url");
            db.numericSessions = db.numericSessions.filter((s2) => s2.expiresAt > time2 && s2.revokedAt === null);
            if (db.numericSessions.length >= 1e4) fail2();
            db.numericSessions.push({
              id: randomUUID2(),
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
          if (path === "/api/n88/student/end" && method === "POST") {
            if (s) s.revokedAt = time2;
            return { status: 200, body: { ended: true }, cookie: cookie("", 0) };
          }
          if (path !== "/api/n88/student/read" || method !== "GET" || !s || s.revokedAt !== null || s.expiresAt <= time2) return denied2();
          const c = db.numericCredentials.find((c2) => c2.id === s.credentialId && identity(c2, s) && c2.version === s.version && c2.revokedAt === null);
          if (!c) return denied2();
          if (typeof ports?.synchronizeOwner !== "function") fail2();
          await ports.synchronizeOwner(c.ownerId);
          const m = current(db, c);
          if (!m || m.enrollmentId !== s.enrollmentId || m.classId !== s.classId || m.revision !== s.membershipRevision || m.canonicalStamp !== s.canonicalStamp) {
            s.revokedAt = time2;
            return denied2();
          }
          return { status: 200, body: await project(db, m, ports) };
        }));
      } catch {
        return response(denied2());
      }
    };
  }
  return Object.freeze({ issueMember, rotateMember, revokeMember, createStudentHandler });
}

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
  const getTeaching = (id3) => live2(state.teachings).find((r) => r.id === id3) ?? null;
  const getSection = (id3) => live2(state.sections).find((r) => r.id === id3) ?? null;
  const items = (id3) => sortByOrder(live2(state.items).filter((r) => r.teachingId === id3));
  const scoresOf = (id3) => live2(state.scores).filter((r) => r.studentId === id3);
  const enrollmentsOf = (id3) => live2(state.enrollments).filter((r) => r.studentId === id3);
  const logsOf = (id3) => live2(state.logs).filter((r) => r.studentId === id3);
  const attendanceOf = (id3) => live2(state.attendance).filter((r) => r.studentId === id3);
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
import { createHash as createHash4 } from "node:crypto";

// drafts/n88-student-portal/visibility-policy.mjs
var VISIBILITY_FIELDS = Object.freeze(["name", "class", "grades", "required", "completed", "scheduled"]);
var VISIBILITY_VERSION = "n88-visibility-v1";
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var exact = (value, keys) => object(value) && Object.keys(value).every((key2) => keys.includes(key2));
var text = (value) => typeof value === "string" && value.length > 0 && value.length <= 300;
var hash2 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
function validateVisibilityPolicy(policy) {
  const fail5 = () => {
    throw new TypeError("n88_visibility_invalid");
  };
  if (!exact(policy, ["version", "ownerId", "studentId", "enrollmentId", "classId", "termId", "scopeStamp", "fields", "sources"]) || policy.version !== VISIBILITY_VERSION || !hash2(policy.scopeStamp) || !["ownerId", "studentId", "enrollmentId", "classId", "termId"].every((key2) => text(policy[key2])) || !exact(policy.fields, VISIBILITY_FIELDS) || Object.values(policy.fields).some((value) => typeof value !== "boolean") || !Array.isArray(policy.sources) || policy.sources.length > 2e3) fail5();
  const ids = /* @__PURE__ */ new Set(), sources = /* @__PURE__ */ new Set();
  for (const source of policy.sources) {
    if (!exact(source, ["kind", "sourceId", "publicationId", "stamp"]) || !["item", "subitem"].includes(source.kind) || !text(source.sourceId) || !uuid(source.publicationId) || !hash2(source.stamp)) fail5();
    const key2 = JSON.stringify([source.kind, source.sourceId]);
    if (ids.has(source.publicationId) || sources.has(key2)) fail5();
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
var digest = (value) => createHash4("sha256").update(JSON.stringify(value)).digest("hex");
var active3 = (row) => row && row.deleted === false && row.deletedAt == null && row.archivedAt == null && row.status !== "archived";
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
  const one = (table, id3) => rows[table].find((row) => row.id === id3);
  const student = one("students", studentId), section = one("sections", classId), term = one("terms", termId);
  const year = one("years", section?.yearId), enrollment = one("enrollments", enrollmentId);
  if (![student, section, term, year, enrollment].every(active3) || [student, section, term, year, enrollment].some((row) => row.status !== "active") || term.yearId !== section.yearId || enrollment.studentId !== studentId || enrollment.sectionId !== classId || enrollment.endDate != null || date(enrollment.startDate) && enrollment.startDate > today || date(term.startDate) && term.startDate > today || date(term.endDate) && term.endDate < today) deny();
  const current = rows.enrollments.filter((row) => active3(row) && row.studentId === studentId && row.status === "active" && row.endDate == null && active3(one("sections", row.sectionId)) && one("sections", row.sectionId).yearId === year.id);
  if (current.length !== 1 || current[0].id !== enrollmentId) deny("unique_current_enrollment");
  const teachings = rows.teachings.filter((row) => active3(row) && row.sectionId === classId && row.termId === termId);
  const items = sortByOrder(rows.items.filter((row) => active3(row) && teachings.some((t) => t.id === row.teachingId)));
  const definitions = sortByOrder(rows.scoreSubitems.filter((row) => active3(row) && items.some((item) => item.id === row.itemId && item.scoreMode === "subitems")));
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
      const logs = s.rows.logs.filter((row) => active3(row) && row.teachingId === teaching.id);
      const sessions = s.rows.sessions.filter((row) => active3(row) && row.teachingId === teaching.id);
      const ctx = {
        ...canonicalGradeContext(s.rows, studentId, teaching.id),
        logs: logs.filter((row) => row.studentId === studentId),
        classHasParticipation: logs.some((row) => row.kind === "participation"),
        attendance: s.rows.attendance.filter((row) => active3(row) && row.studentId === studentId && row.teachingId === teaching.id && sessions.some((session) => session.id === row.sessionId))
      };
      for (const item of published.filter((item2) => item2.teachingId === teaching.id)) {
        const scores = s.rows.scores.filter((row) => active3(row) && row.studentId === studentId && row.itemId === item.id);
        if (scores.length > 1) deny("unique_student_item_score");
        const score = scores[0];
        if (item.scoreMode === "subitems" && !item.auto) {
          const completions = s.rows.scoreSubitemCompletions.filter((row) => active3(row) && row.studentId === studentId);
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
    const completions = s.rows.scoreSubitemCompletions.filter((row) => active3(row) && row.studentId === studentId && row.subitemId === definition.id);
    if (completions.length > 1) deny("unique_student_subitem_completion");
    const completionState = subitemCompletionState(completions[0]);
    const { startDate, dueDate } = normalizeSubitemDatesAndPoints(definition);
    const family = completionState !== "unrecorded" ? "completed" : startDate && startDate > s.today ? "scheduled" : "required";
    if (enabled(family)) out.work[family].push({ id: publication.publicationId, title: definition.name, startDate, dueDate, completionState });
  }
  return out;
}

// drafts/n88-student-portal/integrated-service.mjs
var deny2 = () => ({ status: 401, body: { error: "unavailable" }, headers: PRIVATE_HEADERS });
var hash3 = (v) => createHash5("sha256").update(JSON.stringify(v)).digest("hex");
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
  const repository = withCredentialRepository(baseRepository);
  const credentials = createNumericCredentialOperations({ keys: /* @__PURE__ */ new Map([["v1", options.numericKey]]), activeKeyVersion: "v1", reservationKey: options.reservationKey });
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
    return projectStudentPortal({ ...inputFor(s, m), visibility: stored || null });
  } });
  return async (request) => {
    if (request.path.startsWith("/student/")) return student(request);
    const match = /^\/teacher\/class\/(list|issue-missing|rotate|revoke|visibility)$/.exec(request.path);
    if (!match || request.method !== "POST") return deny2();
    const action = match[1], body = request.body || {}, binding = body.binding;
    if (!binding || Object.keys(binding).length !== bindingKeys.length || !bindingKeys.every((k) => typeof binding[k] === "string" && binding[k].length > 0 && binding[k].length <= 200) || binding.teachingId !== body.teachingId) return deny2();
    const verifyTeacher = async (r2, ports) => {
      const auth = await adapter.verifyTeacher(r2, ports);
      return auth?.ownerId === binding.ownerId && auth.sessionId === binding.sessionId ? auth : null;
    };
    const resolveClass = (db, ports, auth, teachingId, input) => scope(db, ports, auth, teachingId ?? body.teachingId, input).then((s) => s && s.classId === binding.classId && s.termId === binding.termId ? s : null);
    const ops = createClassCredentialOperations({ repository, ...credentials, origin: options.origin, verifyIngress: adapter.verifyIngress, verifyTeacher, resolveClass });
    if (action === "visibility" || action === "list") {
      try {
        return await repository.transaction(async (db, ports) => {
          const h = request.headers || {};
          if (!await adapter.verifyIngress(request, ports) || h.origin !== options.origin || h["x-n88-csrf"] !== "1" || h["content-type"] !== "application/json" || h["sec-fetch-site"] && h["sec-fetch-site"] !== "same-origin") return deny2();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.current) return deny2();
          await ports.synchronizeOwner(auth.ownerId);
          const s = await resolveClass(db, ports, auth, body.teachingId, body);
          if (!s) return deny2();
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === s.classId && m.status === "active" && !m.endDate && m.studentActive && m.classActive);
          const rosterRevision = hash3([s.teachingId, s.revision, members.sort((a, b) => a.studentId.localeCompare(b.studentId)).map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          let p = await policies(ports, s.ownerId, s.classId, s.termId), data2;
          if (action === "visibility") {
            if (p.revision !== body.policyRevision || body.expectedRosterRevision !== rosterRevision || !body.fields || Object.keys(body.fields).length !== 6 || !VISIBILITY_FIELDS.every((f) => typeof body.fields[f] === "boolean")) return deny2();
            const membersPolicy = members.map((m) => {
              const input = inputFor(s, m), b = studentPortalPublicationBindings(input);
              return { version: "n88-visibility-v1", ownerId: s.ownerId, studentId: m.studentId, enrollmentId: m.enrollmentId, classId: s.classId, termId: s.termId, scopeStamp: b.scopeStamp, fields: body.fields, sources: b.sources.map((src) => ({ ...src, publicationId: randomUUID3() })) };
            });
            p = { revision: p.revision + 1, fields: body.fields, members: membersPolicy };
            await ports.query("insert into n88_private.class_visibility(owner_id,class_id,term_id,payload) values($1::uuid,$2,$3,$4::jsonb) on conflict(owner_id,class_id,term_id) do update set payload=excluded.payload", [s.ownerId, s.classId, s.termId, JSON.stringify(p)]);
            data2 = { updated: true, policyRevision: p.revision, fields: p.fields };
          } else data2 = { classId: s.classId, rosterRevision, policyRevision: p.revision, visibility: p.fields, students: members.map((m) => {
            const cs = db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId);
            return { studentId: m.studentId, enrollmentId: m.enrollmentId, revision: m.revision, label: m.label, hasActiveCode: cs.some((c) => c.revokedAt === null), credentialVersion: Math.max(0, ...cs.map((c) => c.version)) };
          }) };
          return { status: 200, body: { ack: true, binding, requestId: body.requestId ?? null, data: data2 }, headers: PRIVATE_HEADERS };
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
import { Buffer as Buffer4 } from "node:buffer";
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
var exact2 = (o, keys) => must(o && Object.getPrototypeOf(o) === Object.prototype && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k)));
var str = (s, max, min = 1) => must(typeof s === "string" && s.length >= min && s.length <= max && !s.includes("\0"));
var uuid2 = (s) => must(typeof s === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s));
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
  exact2(r, tables[name].fields);
  for (const k of ["ownerId", "id", "credentialId"]) if (Object.hasOwn(r, k)) uuid2(r[k]);
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
    exact2(r.source, ["teachingId", "itemId"]);
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
  exact2(row, t.cols);
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
  exact2(state, names);
  let total = 0, bytes = 0;
  const maps = {};
  for (const name of names) {
    must(Array.isArray(state[name]) && state[name].length <= limits[name]);
    total += state[name].length;
    must(total <= limits.total);
    maps[name] = /* @__PURE__ */ new Map();
    for (const r of state[name]) {
      const values = encode(name, r), json = JSON.stringify(r), size = Buffer4.byteLength(json);
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
  exact2(limits, [...names, "total", "bytes", "rowBytes"]);
  for (const k of names) safe(limits[k], 1, 1e4);
  safe(limits.total, 1, 5e4);
  safe(limits.bytes, 1024, 64 * 1024 * 1024);
  safe(limits.rowBytes, 128, 32768);
  exact2(timing, ["acquireMs", "transactionMs", "cleanupMs", "statementMs", "lockMs"]);
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
      const r = await c.query(text2, values);
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
          exact2(row, ["bounded_row"]);
          must(typeof row.bounded_row === "string");
          transferred += Buffer4.byteLength(row.bounded_row);
          must(transferred <= limits.bytes);
          return decode(name, JSON.parse(row.bounded_row));
        });
        count += state[name].length;
        bytes += Buffer4.byteLength(JSON.stringify(state[name]));
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
        uuid2(ownerId);
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
import { Buffer as Buffer5 } from "node:buffer";
import { createHash as createHash6 } from "node:crypto";
var CANONICAL_TABLES = Object.freeze(["years", "terms", "sections", "students", "enrollments", "teachings", "items"]);
var fail3 = () => {
  throw Error("n88_canonical_unavailable");
};
var key = (m) => JSON.stringify([m.ownerId, m.classId, m.studentId, m.enrollmentId]);
var id2 = (parts) => {
  const h = createHash6("sha256").update(JSON.stringify(["n88-publication-v1", ...parts])).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function createCanonicalAdapter({ maxRows = 2e3, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail3();
  return async (db, { query }, ownerId) => {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId) || !db.contexts.some((c) => c.ownerId === ownerId && c.active)) fail3();
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
    if (result2.rows.length > maxRows) fail3();
    let bytes = 0;
    const read = (row) => {
      if (typeof row.payload !== "string") fail3();
      bytes += Buffer5.byteLength(row.payload);
      if (bytes > maxBytes) fail3();
      return JSON.parse(row.payload);
    };
    const previous = new Map(db.memberships.map((m) => [key(m), m]));
    for (const m of db.memberships.filter((m2) => m2.ownerId === ownerId)) {
      m.status = "inactive";
      m.studentActive = false;
      m.classActive = false;
    }
    for (const row of result2.rows) {
      const r = read(row), revision2 = Number(r.revision);
      if (!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision2)) fail3();
      const revisions = [r.revision, r.student_revision, r.section_revision, r.year_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail3();
      const canonicalStamp = createHash6("sha256").update(JSON.stringify(["n88-lineage-v1", ...revisions])).digest("hex");
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
      if (!owners.includes(m.ownerId)) fail3();
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
    if (source.rows.length > maxRows) fail3();
    const current = /* @__PURE__ */ new Set();
    for (const row of source.rows) {
      const r = read(row);
      const revisions = [r.item_revision, r.teaching_revision, r.term_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail3();
      for (const m of db.memberships.filter((m2) => m2.ownerId === r.owner_id && m2.classId === r.section_id && m2.status === "active" && !m2.endDate && m2.studentActive && m2.classActive)) {
        const publicationId = id2([m.ownerId, m.enrollmentId, m.canonicalStamp, r.teaching_id, r.item_id, ...revisions]);
        current.add(publicationId);
        const existing = db.publications.find((p) => p.id === publicationId);
        if (existing && (key(existing) !== key(m) || existing.source.teachingId !== r.teaching_id || existing.source.itemId !== r.item_id)) fail3();
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
        if (db.publications.length > maxRows) fail3();
      }
    }
    db.publications = db.publications.filter((p) => p.ownerId !== ownerId || current.has(p.id));
  };
}

// drafts/n88-student-portal/http-adapter.mjs
import { Buffer as Buffer6 } from "node:buffer";

// drafts/n88-student-portal/auth-verifier.mjs
import { Buffer as Buffer7 } from "node:buffer";
import { AuthClient } from "@supabase/auth-js";
var uuid3 = (s) => typeof s === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
var fail4 = () => {
  throw Error("n88_auth_configuration");
};
function createTeacherVerifier({ authUrl, apiKey, fetch: send = globalThis.fetch, authDeadlineMs = 2e3, now = Date.now }) {
  const url = new URL(authUrl);
  if (url.origin !== authUrl || url.protocol !== "https:" || !apiKey || typeof send !== "function" || !Number.isInteger(authDeadlineMs) || authDeadlineMs < 20 || authDeadlineMs > 5e3) fail4();
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
        if (u.origin !== authUrl || ![issuer + "/user", issuer + "/.well-known/jwks.json"].includes(u.href) || init.method && init.method !== "GET") fail4();
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
        return new Response(Buffer7.concat(parts), { status: response2.status, headers: response2.headers });
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
      if (c.iss !== issuer || !(c.aud === "authenticated" || Array.isArray(c.aud) && c.aud.length === 1 && c.aud[0] === "authenticated") || c.role !== "authenticated" || !uuid3(c.sub) || !uuid3(c.session_id) || c.is_anonymous === true || !Number.isSafeInteger(c.exp) || c.exp <= sec || !Number.isSafeInteger(c.iat) || c.iat > sec || c.iat >= c.exp || c.nbf !== void 0 && (!Number.isSafeInteger(c.nbf) || c.nbf > sec)) return null;
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
  if (sourceOnly !== false || typeof acquire !== "function" || canonicalReadback !== true || privateIngressReadback !== true || !Buffer8.isBuffer(secretKey) || secretKey.length < 32 || typeof apiKey !== "string" || !apiKey || ![origin, authUrl].every((u) => {
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
var ROUTE = /^\/api\/n88\/(?:teacher\/class\/(?:list|issue-missing|rotate|revoke|visibility)|student\/(?:claim|read|end))$/;
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
  if (!Buffer9.isBuffer(options.ingressKey) || options.ingressKey.length !== 32) throw Error("n88_ingress_configuration");
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
        if (!timingSafeEqual3(Buffer9.from(expected, "hex"), Buffer9.from(signature, "hex"))) return privateResponse(401);
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
    return Buffer10.from(s, "hex");
  };
  if (required("N88_SERVICE_REVISION") !== deployment_inactive_default.serviceRevision) throw Error("n88_service_readback_missing");
  const secretKey = key2("N88_HMAC_KEY"), ingressKey = key2("N88_INGRESS_KEY"), numericKey = key2("N88_NUMERIC_KEY"), reservationKey = key2("N88_RESERVATION_KEY");
  if (new Set([secretKey, ingressKey, numericKey, reservationKey].map((k) => k.toString("hex"))).size !== 4) throw Error("n88_separate_keys_required");
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
      numericKey,
      reservationKey,
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
