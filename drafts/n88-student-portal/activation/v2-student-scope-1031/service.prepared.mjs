// drafts/n88-student-portal/activation/node-globals.mjs
import { Buffer as Buffer2 } from "node:buffer";
import process from "node:process";
if (!globalThis.Buffer) globalThis.Buffer = Buffer2;
if (!globalThis.process) globalThis.process = process;

// drafts/n88-student-portal/existing-host.mjs
import { Buffer as Buffer15 } from "node:buffer";
import { createHash as createHash17 } from "node:crypto";
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
    acquireMs: 6e3,
    transactionMs: 16e3,
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
    connectionTimeoutMillis: 5e3,
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
import { Buffer as Buffer14 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual3 } from "node:crypto";

// drafts/n88-student-portal/runtime.mjs
import { Buffer as Buffer12 } from "node:buffer";
import { isIP } from "node:net";

// drafts/n88-student-portal/receipt-reconciliation.mjs
import { createHash } from "node:crypto";
var digest = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
var hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
var command = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(v);
function credentialStateRevision(db, members) {
  return digest(members.map((m) => [m.studentId, m.enrollmentId, ...db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId).map((c) => [c.version, c.revokedAt === null]).sort((a, b) => a[0] - b[0])]).sort((a, b) => a[0].localeCompare(b[0])));
}
function reconcileIssuanceReceipts(db, scope2, members, requests) {
  if (!scope2?.current || members.some((m) => m.ownerId !== scope2.ownerId || m.classId !== scope2.classId) || !Array.isArray(requests) || requests.length > 8 || requests.some((r) => !r || Object.keys(r).sort().join(",") !== "expectedCredentialRevision,expectedRosterRevision,requestId" || !command(r.requestId) || !hex(r.expectedRosterRevision) || !hex(r.expectedCredentialRevision)) || new Set(requests.map((r) => r.requestId)).size !== requests.length) throw Error("n88_receipt_read_denied");
  return requests.map((r) => {
    const matches = db.classReceipts.filter((x) => x.ownerId === scope2.ownerId && x.requestId === r.requestId);
    if (matches.length !== 1) return { state: "unknown", created: 0, skipped: 0, failed: 0 };
    const receipt2 = matches[0], binding = digest(["batch", scope2.teachingId, r.expectedRosterRevision, null, null, null, null, r.expectedCredentialRevision]);
    if (receipt2.binding !== binding || !Array.isArray(receipt2.results) || receipt2.results.length > 2e3 || receipt2.results.some((x) => !members.some((m) => m.studentId === x.studentId && m.enrollmentId === x.enrollmentId) || !["created", "skipped", "failed"].includes(x.status))) return { state: "unknown", created: 0, skipped: 0, failed: 0 };
    return { state: "committed", ...Object.fromEntries(["created", "skipped", "failed"].map((k) => [k, receipt2.results.filter((x) => x.status === k).length])) };
  });
}

// drafts/n88-student-portal/receipt-terminal-review.inactive.mjs
import { createHash as createHash2 } from "node:crypto";
import { Buffer as Buffer3 } from "node:buffer";
var digest2 = (value) => createHash2("sha256").update(JSON.stringify(value)).digest("hex");
var exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((k) => Object.hasOwn(value, k));
var id = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("\0");
var hex2 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var requestId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(value);
var unknown = () => ({ resolutionVersion: 1, state: "unknown", created: 0, skipped: 0, failed: 0 });
var closed = () => ({ ...unknown(), state: "closed" });
function cancelOriginalIntentTransaction(db, authority, request, mode) {
  const a = authority, r = request;
  if (!["status", "close"].includes(mode) || !exact(r, ["requestId", "expectedRosterRevision", "expectedCredentialRevision"]) || !requestId(r.requestId) || !hex2(r.expectedRosterRevision) || !hex2(r.expectedCredentialRevision) || a?.current !== true || !["ownerId", "sessionId", "teachingId", "classId", "termId"].every((k) => id(a[k])) || !Array.isArray(a.members) || a.members.length > 2e3 || a.members.some((m) => !id(m.studentId) || !id(m.enrollmentId) || m.ownerId !== a.ownerId || m.classId !== a.classId) || new Set(a.members.map((m) => m.studentId)).size !== a.members.length || new Set(a.members.map((m) => m.enrollmentId)).size !== a.members.length || !Array.isArray(db?.classReceipts) || db.classReceipts.length > 1e4 || a.rosterRevision !== r.expectedRosterRevision || a.credentialRevision !== r.expectedCredentialRevision) return unknown();
  const binding = digest2([
    "n88-negative-original-intent-closed-v1",
    a.ownerId,
    a.teachingId,
    a.classId,
    a.termId,
    r.requestId,
    r.expectedRosterRevision,
    r.expectedCredentialRevision
  ]);
  const rows = db.classReceipts.filter((x) => x?.ownerId === a.ownerId && x.requestId === r.requestId);
  if (rows.length) return rows.length === 1 && exact(rows[0], ["ownerId", "requestId", "binding", "results"]) && rows[0].binding === binding && Array.isArray(rows[0].results) && rows[0].results.length === 0 ? closed() : unknown();
  if (mode === "status" || db.classReceipts.length === 1e4) return unknown();
  db.classReceipts.push({ ownerId: a.ownerId, requestId: r.requestId, binding, results: [] });
  return closed();
}

// drafts/n88-student-portal/activation/v2-hosted-compat-1031/operations.json
var operations_default = {
  version: 1,
  definitions: [
    {
      id: "owner-context",
      sql: "select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share",
      sha256: "f8a1689cd78951d7fc52ef91eb51423510f98cbf717a42c162572b2c69bf692b",
      parameters: [
        "owner:uuid"
      ],
      output: [
        "namespace:text",
        "owner_id:uuid",
        "active:boolean"
      ],
      maxRows: 1,
      maxBytes: 4096,
      effect: false,
      name: "v2_f8a1689cd78951d7fc52ef91",
      types: [
        "uuid"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_f8a1689cd78951d7fc52ef91($1::uuid)",
      safeName: "safe_1031_f8a1689cd78951d7fc52ef91",
      safeSql: "select n88_private.safe_1031_f8a1689cd78951d7fc52ef91($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>1 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('namespace',r.namespace,'owner_id',r.owner_id,'active',r.active)),'[]'::jsonb)) into v from n88_private.v2_f8a1689cd78951d7fc52ef91((a->>0)::uuid) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "885239c2ca3cc58212c5745ae37314334fa03f2f98249dace54f8250c34ea0bc"
    },
    {
      id: "numeric-session",
      sql: "select payload from n88_private.numeric_sessions where token_hash=$1 for share",
      sha256: "7874a827dae2373223bc8adc67a2a30d158ed7e1e40183e72a8cff2c1df55a90",
      parameters: [
        "tokenHash:hex64"
      ],
      output: [
        "payload:numericSession"
      ],
      maxRows: 1,
      maxBytes: 4096,
      effect: false,
      name: "v2_7874a827dae2373223bc8adc",
      types: [
        "text"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_7874a827dae2373223bc8adc($1::text)",
      safeName: "safe_1031_7874a827dae2373223bc8adc",
      safeSql: "select n88_private.safe_1031_7874a827dae2373223bc8adc($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>1 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('payload',r.payload)),'[]'::jsonb)) into v from n88_private.v2_7874a827dae2373223bc8adc((a->>0)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "7ef5ad1d07da770a914fc4f5aad6fb1715535d042dc24ad18da82fd4cadb35b2"
    },
    {
      id: "numeric-credential",
      sql: "select payload from n88_private.numeric_credentials where id=$1::uuid and owner_id=$2::uuid and student_id=$3 and version=$4::bigint for share",
      sha256: "6d27c8049efec0665b9d1f91f20f631f036ebb8403a3301bcc211176a6d1c751",
      parameters: [
        "credentialId:uuid",
        "owner:uuid",
        "studentId:text240",
        "version:positiveBigint"
      ],
      output: [
        "payload:numericCredential"
      ],
      maxRows: 1,
      maxBytes: 2048,
      effect: false,
      name: "v2_6d27c8049efec0665b9d1f91",
      types: [
        "uuid",
        "uuid",
        "text",
        "text"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_6d27c8049efec0665b9d1f91($1::uuid,$2::uuid,$3::text,$4::text)",
      safeName: "safe_1031_6d27c8049efec0665b9d1f91",
      safeSql: "select n88_private.safe_1031_6d27c8049efec0665b9d1f91($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('payload',r.payload)),'[]'::jsonb)) into v from n88_private.v2_6d27c8049efec0665b9d1f91((a->>0)::uuid,(a->>1)::uuid,(a->>2)::text,(a->>3)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "48575aa509c436696460926928cd6980fa94c68a32ea38e0f397ac2622a17761"
    },
    {
      id: "read-scopes",
      sql: "select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,store_revision::text as store_revision,payload from n88_private.publication_v2_scopes where owner_id=$1::uuid order by scope_key limit $2) r) bounded",
      sha256: "e1b1c0927f6164faeccb760bbe7678f49ff4bfec39ac0e057b7be9b754ec33bf",
      parameters: [
        "owner:uuid",
        "overflowLimit:10001",
        "rowBytes:2097152",
        "remainingBytes:1..4194304"
      ],
      output: [
        "body:typedStorageJSON"
      ],
      maxRows: 1e4,
      maxBytes: 4194304,
      effect: false,
      name: "v2_e1b1c0927f6164faeccb760b",
      types: [
        "uuid",
        "integer",
        "integer",
        "integer"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_e1b1c0927f6164faeccb760b($1::uuid,$2::integer,$3::integer,$4::integer)",
      safeName: "safe_1031_e1b1c0927f6164faeccb760b",
      safeSql: "select n88_private.safe_1031_e1b1c0927f6164faeccb760b($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_e1b1c0927f6164faeccb760b((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "28378cc1586c9deb10e301edbd383e12bad506ac725e77c3dd9b5082d5527a13"
    },
    {
      id: "read-items",
      sql: "select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload from n88_private.publication_v2_items where owner_id=$1::uuid order by scope_key,row_id limit $2) r) bounded",
      sha256: "f46afed1e023d013cdabf257a722636fc6929997f1612d157d83327bae417a22",
      parameters: [
        "owner:uuid",
        "overflowLimit:10001",
        "rowBytes:2097152",
        "remainingBytes:1..4194304"
      ],
      output: [
        "body:typedStorageJSON"
      ],
      maxRows: 1e4,
      maxBytes: 4194304,
      effect: false,
      name: "v2_f46afed1e023d013cdabf257",
      types: [
        "uuid",
        "integer",
        "integer",
        "integer"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_f46afed1e023d013cdabf257($1::uuid,$2::integer,$3::integer,$4::integer)",
      safeName: "safe_1031_f46afed1e023d013cdabf257",
      safeSql: "select n88_private.safe_1031_f46afed1e023d013cdabf257($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_f46afed1e023d013cdabf257((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "5e0ad30a54f22ad48842598ec9edbb6a6255fcc12ad3efbff52262cc90dec3a0"
    },
    {
      id: "read-high_water",
      sql: "select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,source_key,canonical_revision::text as canonical_revision,retired from n88_private.publication_v2_high_water where owner_id=$1::uuid order by scope_key,source_key limit $2) r) bounded",
      sha256: "0dad27a56bfdc5bfab552235376bffb18292e9cfd59f29465272b0ba1bef11f3",
      parameters: [
        "owner:uuid",
        "overflowLimit:10001",
        "rowBytes:2097152",
        "remainingBytes:1..4194304"
      ],
      output: [
        "body:typedStorageJSON"
      ],
      maxRows: 1e4,
      maxBytes: 4194304,
      effect: false,
      name: "v2_0dad27a56bfdc5bfab552235",
      types: [
        "uuid",
        "integer",
        "integer",
        "integer"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_0dad27a56bfdc5bfab552235($1::uuid,$2::integer,$3::integer,$4::integer)",
      safeName: "safe_1031_0dad27a56bfdc5bfab552235",
      safeSql: "select n88_private.safe_1031_0dad27a56bfdc5bfab552235($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_0dad27a56bfdc5bfab552235((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "92c724304a7787820ab23063d020a6193931a3d64e3860d77be80c796d2c9a0f"
    },
    {
      id: "read-receipts",
      sql: "select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select request_id,scope_key,fingerprint,payload from n88_private.publication_v2_receipts where owner_id=$1::uuid order by request_id limit $2) r) bounded",
      sha256: "71a3e914da47cf1053850671fc8c2835603b1bc3490153fbb1784e773e0417eb",
      parameters: [
        "owner:uuid",
        "overflowLimit:10001",
        "rowBytes:2097152",
        "remainingBytes:1..4194304"
      ],
      output: [
        "body:typedStorageJSON"
      ],
      maxRows: 1e4,
      maxBytes: 4194304,
      effect: false,
      name: "v2_71a3e914da47cf1053850671",
      types: [
        "uuid",
        "integer",
        "integer",
        "integer"
      ],
      command: "SELECT",
      callSql: "select * from n88_private.v2_71a3e914da47cf1053850671($1::uuid,$2::integer,$3::integer,$4::integer)",
      safeName: "safe_1031_71a3e914da47cf1053850671",
      safeSql: "select n88_private.safe_1031_71a3e914da47cf1053850671($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_71a3e914da47cf1053850671((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "e15ee1938b5948b3b15e09da534c59ca89cc78d8f418601cc6e3729f62b78266"
    },
    {
      id: "insert-scope",
      sql: "insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values($1::uuid,$2,1,$3::jsonb)",
      sha256: "74c4aa4d430911e99002af80476a8c2647e430d81bd66eff0ce4ca1c1d7ddf12",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "root:canonicalJSON"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_74c4aa4d430911e99002af80",
      types: [
        "uuid",
        "text",
        "text"
      ],
      command: "INSERT",
      callSql: "select * from n88_private.v2_74c4aa4d430911e99002af80($1::uuid,$2::text,$3::text)",
      safeName: "safe_1031_74c4aa4d430911e99002af80",
      safeSql: "select n88_private.safe_1031_74c4aa4d430911e99002af80($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>3 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_74c4aa4d430911e99002af80((a->>0)::uuid,(a->>1)::text,(a->>2)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "850423d46a42ca040032674480e535ac20056b34b10d204a4a1b09e28271904b"
    },
    {
      id: "cas-scope",
      sql: "update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=$3::jsonb where owner_id=$1::uuid and scope_key=$2 and store_revision=$4::bigint",
      sha256: "dbe074dae923ca8a3746d390240287893cd777e5f01b8b27fe07477aeda85df0",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "root:canonicalJSON",
        "priorStoreRevision:positiveBigint"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_dbe074dae923ca8a3746d390",
      types: [
        "uuid",
        "text",
        "text",
        "text"
      ],
      command: "UPDATE",
      callSql: "select * from n88_private.v2_dbe074dae923ca8a3746d390($1::uuid,$2::text,$3::text,$4::text)",
      safeName: "safe_1031_dbe074dae923ca8a3746d390",
      safeSql: "select n88_private.safe_1031_dbe074dae923ca8a3746d390($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_dbe074dae923ca8a3746d390((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "63fa35c9404ed82c24ff0da077a1d33de2fbf58a2b7bfe943a4c4e9622bf601e"
    },
    {
      id: "insert-item",
      sql: "insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1::uuid,$2,$3,$4::bigint,$5,$6::jsonb)",
      sha256: "a3e6d95cdff2d66f56ae84f6530f07f9bc970a014b2f3a25d31f548173d2c508",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "rowId:text",
        "revision:safeBigint",
        "tombstone:boolean",
        "publication:canonicalJSON"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_a3e6d95cdff2d66f56ae84f6",
      types: [
        "uuid",
        "text",
        "text",
        "text",
        "boolean",
        "text"
      ],
      command: "INSERT",
      callSql: "select * from n88_private.v2_a3e6d95cdff2d66f56ae84f6($1::uuid,$2::text,$3::text,$4::text,$5::boolean,$6::text)",
      safeName: "safe_1031_a3e6d95cdff2d66f56ae84f6",
      safeSql: "select n88_private.safe_1031_a3e6d95cdff2d66f56ae84f6($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>6 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_a3e6d95cdff2d66f56ae84f6((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "b6a2457c600b33dd7bd88f021ef8fd76143e22e128bc8fc20f8b61ae6f9badad"
    },
    {
      id: "cas-item",
      sql: "update n88_private.publication_v2_items set publication_revision=$4::bigint,tombstone=$5,payload=$6::jsonb where owner_id=$1::uuid and scope_key=$2 and row_id=$3 and publication_revision=$7::bigint and payload=$8::jsonb",
      sha256: "5d62e77b02ab6a1fb4e97688aa1810d3559d998a42ab85a04435819f19017f21",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "rowId:text",
        "revision:safeBigint",
        "tombstone:boolean",
        "publication:canonicalJSON",
        "priorRevision:safeBigint",
        "priorPublication:canonicalJSON"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_5d62e77b02ab6a1fb4e97688",
      types: [
        "uuid",
        "text",
        "text",
        "text",
        "boolean",
        "text",
        "text",
        "text"
      ],
      command: "UPDATE",
      callSql: "select * from n88_private.v2_5d62e77b02ab6a1fb4e97688($1::uuid,$2::text,$3::text,$4::text,$5::boolean,$6::text,$7::text,$8::text)",
      safeName: "safe_1031_5d62e77b02ab6a1fb4e97688",
      safeSql: "select n88_private.safe_1031_5d62e77b02ab6a1fb4e97688($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>8 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_5d62e77b02ab6a1fb4e97688((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text,(a->>6)::text,(a->>7)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "877c8715199fe7fe11fdbd80c315c615e19492415206f268fc7abd00171037f9"
    },
    {
      id: "insert-high-water",
      sql: "insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values($1::uuid,$2,$3,$4::bigint,$5)",
      sha256: "23ccfc1e16cd0b122d0cb3c342a2492cc10f5e108becfcd5b1955b3a42772c73",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "sourceKey:text220",
        "canonicalRevision:positiveBigint",
        "retired:boolean"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_23ccfc1e16cd0b122d0cb3c3",
      types: [
        "uuid",
        "text",
        "text",
        "text",
        "boolean"
      ],
      command: "INSERT",
      callSql: "select * from n88_private.v2_23ccfc1e16cd0b122d0cb3c3($1::uuid,$2::text,$3::text,$4::text,$5::boolean)",
      safeName: "safe_1031_23ccfc1e16cd0b122d0cb3c3",
      safeSql: "select n88_private.safe_1031_23ccfc1e16cd0b122d0cb3c3($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>5 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_23ccfc1e16cd0b122d0cb3c3((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "eab985bb8e138507157e54b2a0b0e61a385456b63e6400296f2eefed2cb158a9"
    },
    {
      id: "cas-high-water",
      sql: "update n88_private.publication_v2_high_water set canonical_revision=$4::bigint,retired=$5 where owner_id=$1::uuid and scope_key=$2 and source_key=$3 and canonical_revision=$6::bigint and retired=$7",
      sha256: "94bb23dac56c2e002713130ac7ddb2c686561f7c1bbe1f1464a873629c5237fc",
      parameters: [
        "owner:uuid",
        "scopeKey:hex64",
        "sourceKey:text220",
        "canonicalRevision:positiveBigint",
        "retired:boolean",
        "priorRevision:positiveBigint",
        "priorRetired:boolean"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_94bb23dac56c2e002713130a",
      types: [
        "uuid",
        "text",
        "text",
        "text",
        "boolean",
        "text",
        "boolean"
      ],
      command: "UPDATE",
      callSql: "select * from n88_private.v2_94bb23dac56c2e002713130a($1::uuid,$2::text,$3::text,$4::text,$5::boolean,$6::text,$7::boolean)",
      safeName: "safe_1031_94bb23dac56c2e002713130a",
      safeSql: "select n88_private.safe_1031_94bb23dac56c2e002713130a($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>7 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_94bb23dac56c2e002713130a((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text,(a->>6)::boolean) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "5843b74f44e12f9670c10651a7fa43564c140b77e16082f08a25191709084543"
    },
    {
      id: "insert-receipt",
      sql: "insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values($1::uuid,$2,$3,$4,$5::jsonb)",
      sha256: "3b143936c792a16ff5425c3dd129c1065921837cfaa15fdcc018734517196acf",
      parameters: [
        "owner:uuid",
        "requestId:text16..100",
        "scopeKey:hex64",
        "fingerprint:hex64",
        "receipt:canonicalJSON"
      ],
      output: [],
      maxRows: 0,
      maxBytes: 0,
      effect: true,
      name: "v2_3b143936c792a16ff5425c3d",
      types: [
        "uuid",
        "text",
        "text",
        "text",
        "text"
      ],
      command: "INSERT",
      callSql: "select * from n88_private.v2_3b143936c792a16ff5425c3d($1::uuid,$2::text,$3::text,$4::text,$5::text)",
      safeName: "safe_1031_3b143936c792a16ff5425c3d",
      safeSql: "select n88_private.safe_1031_3b143936c792a16ff5425c3d($1::text) as envelope",
      body: `
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>5 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_3b143936c792a16ff5425c3d((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`,
      bodySha256: "7a21d04ca74df248ab8c4f7c1a4de90cc950f71f424c7a47efd0a570ae653c59"
    }
  ]
};

// drafts/n88-student-portal/activation/v2-hosted-compat-1031/boundary.mjs
var fail = () => {
  throw Error("n88_safe_boundary_required");
};
var definitions = operations_default.definitions;
var safeReadbackSql = `select p.proname,p.prosrc,p.prosecdef,pg_get_userbyid(p.proowner) as owner,p.proconfig,has_function_privilege(current_user,p.oid,'EXECUTE') as callable,(has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0)) as public_call from pg_proc p where p.pronamespace='n88_private'::regnamespace and p.proname=any($1::text[]) order by p.proname`;
async function verifySafeBoundary(client) {
  const expected = [...definitions].sort((a, b) => a.safeName.localeCompare(b.safeName));
  const rows = (await client.query(safeReadbackSql, [expected.map((o) => o.safeName)])).rows;
  if (rows?.length !== 14 || rows.some((r, i) => r.proname !== expected[i].safeName || r.prosrc !== expected[i].body || !r.prosecdef || r.owner !== "n88_v2_guard" || JSON.stringify(r.proconfig) !== '["search_path=pg_catalog"]' || !r.callable || r.public_call)) fail();
}
var loggingSql = `select current_setting('log_error_verbosity') as verbosity,current_setting('log_parameter_max_length_on_error') as parameters,current_setting('log_statement') as statements,current_setting('log_min_duration_statement') as duration,current_setting('log_min_duration_sample') as sample,current_setting('log_transaction_sample_rate') as sampling,current_setting('pgaudit.log',true) as audit,(select setting from pg_settings where name='auto_explain.log_min_duration') as explain,current_setting('statement_timeout') as statement_timeout`;
var milliseconds = (s) => {
  const m = /^(\d+)(ms|s|min)?$/.exec(s ?? "");
  return m ? Number(m[1]) * ({ ms: 1, s: 1e3, min: 6e4 }[m[2]] ?? 1) : NaN;
};
function safeLoggingProfile(r) {
  const timeout = milliseconds(r?.statement_timeout), explain = r?.explain == null || r.explain === "-1" ? Infinity : Number(r.explain);
  return !!r && ["terse", "default"].includes(r.verbosity) && r.parameters === "0" && ["none", "ddl"].includes(r.statements) && r.duration === "-1" && r.sample === "-1" && r.sampling != null && Number(r.sampling) === 0 && [null, "none"].includes(r.audit) && timeout > 0 && timeout <= 5e3 && explain > timeout + 2e3;
}
function encodeArguments(args) {
  return Buffer.from(JSON.stringify(args), "utf8").toString("base64");
}
function unwrapEnvelope(raw) {
  const v = raw?.rows?.length === 1 ? raw.rows[0]?.envelope : null;
  if (!v || Object.keys(v).sort().join(",") !== "ok,result" || v.ok !== true || !v.result || Object.keys(v.result).sort().join(",") !== "command,rowCount,rows" || !Array.isArray(v.result.rows) || !Number.isSafeInteger(v.result.rowCount) || v.result.rowCount < 0 || !["SELECT", "INSERT", "UPDATE"].includes(v.result.command)) fail();
  return v.result;
}

// drafts/n88-student-portal/activation/v2-runtime-writer-1031/capability.mjs
var capabilities = /* @__PURE__ */ new WeakSet();
var runtimeIdentitySql = `select session_user::text as login,current_user::text as role,r.rolsuper as superuser,r.rolbypassrls as bypass,r.rolcreaterole as create_role,r.rolcreatedb as create_db,pg_has_role(current_user,'n88_guard','SET') as owner_set,pg_has_role(current_user,'n88_v2_guard','SET') as guard_set,i.database_name,i.system_identifier from pg_roles r cross join n88_private.v2_runtime_identity_1031() i where r.rolname=current_user`;
async function authorizeRuntimeConnection(client, { expectedSystemIdentifier, assertTransport }) {
  await assertTransport(client);
  const result2 = await client.query(runtimeIdentitySql);
  const identity2 = result2.rows?.[0];
  if (result2.rows?.length !== 1 || identity2?.database_name !== "postgres" || identity2.system_identifier !== expectedSystemIdentifier || identity2.login !== "n88_backend" || identity2.role !== "n88_backend" || identity2.superuser || identity2.bypass || identity2.create_role || identity2.create_db || identity2.owner_set || identity2.guard_set) throw Error("n88_restricted_runtime_required");
  await verifySafeBoundary(client);
  const logging = (await client.query(loggingSql)).rows?.[0];
  if (!safeLoggingProfile(logging)) throw Error("n88_private_runtime_logging_required");
  const token = Object.freeze({});
  capabilities.add(token);
  return token;
}
var publicationRuntimeAllowed = (mode, token) => mode === "synthetic" || mode === "hosted" && capabilities.has(token);

// drafts/n88-student-portal/publication-v2-service.inactive.mjs
import { createHash as createHash6 } from "node:crypto";

// src/lib/rakeez-datetime-values.js
var normalizeDateTimeDigits = (value) => String(value ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "\u0669" ? 1632 : 1776)));
var PRODUCT_DATE_FLOOR = "2026-08-01";
function localDateISO(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function dateControlBounds(scope2, declaredMin = "", declaredMax = "", now = /* @__PURE__ */ new Date()) {
  if (!["planning", "historical", "session"].includes(scope2)) throw new Error(`Unknown date scope: ${scope2}`);
  const min = declaredMin && declaredMin > PRODUCT_DATE_FLOOR ? declaredMin : PRODUCT_DATE_FLOOR;
  const ceiling = scope2 === "planning" ? `${now.getFullYear() + 1}-12-31` : scope2 === "historical" ? localDateISO(now) : "";
  const max = declaredMax && (!ceiling || declaredMax < ceiling) ? declaredMax : ceiling;
  const years = [];
  const lastYear = max ? Number(max.slice(0, 4)) : Number(min.slice(0, 4));
  if (!max || max >= min) for (let year = Number(min.slice(0, 4)); year <= lastYear; year++) years.push(year);
  return { min, max, years };
}
function validDateTimeValue(value, kind, min = "", max = "") {
  if (!value) return true;
  if (kind === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && (!min || value >= min) && (!max || value <= max);
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date3 = new Date(Date.UTC(year, month - 1, day));
  return date3.getUTCFullYear() === year && date3.getUTCMonth() === month - 1 && date3.getUTCDate() === day && (!min || value >= min) && (!max || value <= max);
}

// src/lib/n88-manual-task-link-safety.js
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
function manualTaskDraft(input, now = /* @__PURE__ */ new Date()) {
  if (!input || typeof input.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(input.id)) throw Error("\u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0647\u0645\u0629 \u0645\u0637\u0644\u0648\u0628\u0629.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = input.description ?? "";
  if (!title || title.length > 200 || typeof description !== "string" || description.length > 2e3) throw Error("\u062A\u062D\u0642\u0642 \u0645\u0646 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0647\u0645\u0629 \u0648\u0648\u0635\u0641\u0647\u0627.");
  const bounds = dateControlBounds("planning", "", "", now);
  const date3 = (value) => {
    const normalized = normalizeDateTimeDigits(value);
    if (!validDateTimeValue(normalized, "date", bounds.min, bounds.max)) throw Error("\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u062E\u0627\u0631\u062C \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u0639\u062A\u0645\u062F.");
    return normalized || null;
  };
  const startDate = date3(input.startDate), dueDate = date3(input.dueDate);
  if (startDate && dueDate && dueDate < startDate) throw Error("\u0627\u0644\u062A\u0633\u0644\u064A\u0645 \u064A\u0633\u0628\u0642 \u0627\u0644\u0628\u062F\u0627\u064A\u0629.");
  return { id: input.id, title, description, startDate, dueDate, link: safeTeacherLink(input.link) };
}

// src/lib/n88-item-publication-proposal.js
var scopeKeys = ["ownerId", "teachingId", "sectionId", "termId", "subjectId"];
var flags = ["required", "scheduled", "completed", "grade"];
var id2 = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
var fail2 = () => {
  throw Error("invalid_or_stale_publication_scope");
};
var exact2 = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));
var privateFlags = () => Object.fromEntries(flags.map((k) => [k, false]));
function samePublicationScope(a, b) {
  return exact2(a, scopeKeys) && exact2(b, scopeKeys) && scopeKeys.every((k) => id2(a[k]) && a[k] === b[k]);
}
function scopeCheck(scope2, data) {
  if (!samePublicationScope(scope2, scope2) || data?.ownerId !== scope2.ownerId) fail2();
  const one = (rows, key3) => {
    const matches = rows.filter((r) => r.id === scope2[key3] && r.ownerId === scope2.ownerId && !r.deleted);
    if (matches.length !== 1) fail2();
    return matches[0];
  };
  const teaching = one(data.teachings, "teachingId");
  const section = one(data.sections, "sectionId"), term = one(data.terms, "termId");
  if (teaching.sectionId !== section.id || teaching.termId !== term.id || teaching.subjectId !== scope2.subjectId || section.yearId !== term.yearId) fail2();
}
var storedDate = (value) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !validDateTimeValue(value, "date")) fail2();
  return value;
};
var titleOf = (r) => {
  if (!id2(r.id) || typeof r.name !== "string" || !r.name.trim() || r.name.length > 2e3) fail2();
  return r.name;
};
function proposePublicationRows({ scope: scope2, data, previous = null, manualTasks = [] }) {
  scopeCheck(scope2, data);
  const rows = [];
  const add2 = (kind, parent, source, work, manual = null) => {
    const title = manual ? manual.title : titleOf(source);
    const startDate = storedDate(manual ? manual.startDate : source.startDate);
    const dueDate = storedDate(manual ? manual.dueDate : source.dueDate);
    if (startDate && dueDate && dueDate < startDate) fail2();
    const rowId2 = JSON.stringify([kind, parent?.id ?? null, source.id]);
    const sourceRevision = JSON.stringify([
      kind,
      parent?.name ?? null,
      parent?.scoreMode ?? null,
      parent?.revision ?? null,
      parent?.distributionVersion ?? null,
      parent?.updatedAt ?? null,
      parent?.max ?? null,
      source.revision ?? null,
      source.distributionVersion ?? null,
      source.updatedAt ?? null,
      title,
      startDate,
      dueDate,
      source.value ?? null,
      manual?.description ?? "",
      manual?.link ?? null
    ]);
    const old = samePublicationScope(scope2, previous?.scope) ? previous.rows.find((r) => r.id === rowId2 && r.sourceRevision === sourceRevision) : null;
    const decisions = privateFlags();
    for (const key3 of flags) decisions[key3] = old?.decisions?.[key3] === true && (key3 === "grade" ? kind !== "manual" : work);
    rows.push({
      id: rowId2,
      kind,
      sourceId: source.id,
      itemId: parent?.id ?? source.id,
      title,
      startDate,
      dueDate,
      sourceRevision,
      work,
      description: manual?.description ?? "",
      link: manual?.link ?? null,
      decisions
    });
  };
  const items = data.items.filter((r) => r.ownerId === scope2.ownerId && r.teachingId === scope2.teachingId && !r.deleted);
  if (new Set(items.map((r) => r.id)).size !== items.length) fail2();
  for (const item of items) {
    titleOf(item);
    if (item.scoreMode === "subitems") {
      for (const sub of data.scoreSubitems.filter((r) => r.ownerId === scope2.ownerId && r.itemId === item.id && !r.deleted)) add2("subitem", item, sub, true);
    } else add2("item", item, item, false);
  }
  for (const task of manualTasks) {
    if (!samePublicationScope(scope2, task.scope)) fail2();
    const manual = manualTaskDraft(task);
    add2("manual", null, manual, true, manual);
  }
  if (new Set(rows.map((r) => r.id)).size !== rows.length) fail2();
  if (new Set(rows.filter((r) => r.kind === "subitem").map((r) => r.sourceId)).size !== rows.filter((r) => r.kind === "subitem").length) fail2();
  return { version: 2, localDraft: true, scope: Object.fromEntries(scopeKeys.map((k) => [k, scope2[k]])), rows };
}

// drafts/n88-student-portal/task-guidance.mjs
import { createHash as createHash3 } from "node:crypto";
var hash = (v) => createHash3("sha256").update(JSON.stringify(v)).digest("hex");
var exact3 = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));
var validGuidanceText = (v) => typeof v === "string" && v.length <= 400 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?[A-Za-z][^>]*>|<!--|javascript\s*:/i.test(v);
var validGuidanceInput = (v) => exact3(v, ["subitemId", "sourceStamp", "revision", "executionInstructions", "deliveryInstructions", "confirmClear"]) && typeof v.subitemId === "string" && v.subitemId.length > 0 && v.subitemId.length <= 200 && /^[a-f0-9]{64}$/.test(v.sourceStamp) && Number.isSafeInteger(v.revision) && v.revision >= 0 && validGuidanceText(v.executionInstructions) && validGuidanceText(v.deliveryInstructions) && typeof v.confirmClear === "boolean" && (v.executionInstructions.trim() || v.deliveryInstructions.trim() || v.confirmClear);
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
      const publication2 = visibility.sources.find((x) => x.kind === "subitem" && x.publicationId === task.id), src = b.sources.find((x) => x.kind === "subitem" && x.sourceId === publication2?.sourceId && x.stamp === publication2.stamp);
      const row = s.canonical.scoreSubitems.find((x) => x.id === src?.sourceId), item = s.canonical.items.find((x) => x.id === row?.itemId);
      if (!row || item?.teachingId !== s.teachingId) continue;
      const entry = sources.get(row.id) || { subitemId: row.id, title: row.name, bindings: [] };
      entry.bindings.push({ studentId: m.studentId, enrollmentId: m.enrollmentId, scopeStamp: b.scopeStamp, stamp: src.stamp, publicationId: task.id });
      sources.set(row.id, entry);
    }
  }
  return [...sources.values()].map((x) => ({ ...x, sourceStamp: hash([s.ownerId, s.classId, s.termId, s.teachingId, policy.revision, x.subitemId, x.bindings]) }));
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
function guidanceForStudent(input, definition, publication2) {
  const item = input.canonical.items.find((x) => x.id === definition.itemId);
  const p = input.taskGuidance?.find((r) => r.subitem_id === definition.id && r.teaching_id === item?.teachingId)?.payload;
  if (!p || !validGuidanceText(p.executionInstructions) || !validGuidanceText(p.deliveryInstructions)) return {};
  const current = studentPortalPublicationBindings(input), src = current.sources.find((x) => x.kind === "subitem" && x.sourceId === definition.id);
  if (!p.bindings.some((b) => b.studentId === input.studentId && b.enrollmentId === input.enrollmentId && b.scopeStamp === current.scopeStamp && b.stamp === src?.stamp && b.publicationId === publication2.publicationId)) return {};
  return { ...p.executionInstructions.trim() ? { executionInstructions: p.executionInstructions } : {}, ...p.deliveryInstructions.trim() ? { deliveryInstructions: p.deliveryInstructions } : {} };
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
function projectSubitemScore(item, definitions3, completions, manualInput, { studentId = null, ownerId = null } = {}) {
  if (!studentId && completions.some((row) => row.studentId)) {
    throw new Error("Student identity is required for score projection");
  }
  const maximum = scoreCents(item.max);
  const active7 = definitions3.filter((row) => !row.deleted && (!item.id || row.itemId === item.id) && (!ownerId || !row.ownerId || row.ownerId === ownerId));
  const selected = new Map(completions.filter((row) => (!studentId || row.studentId === studentId) && (!ownerId || !row.ownerId || row.ownerId === ownerId) && !row.deleted && row.checked === true && active7.some((definition) => definition.id === row.subitemId)).map((row) => [row.subitemId, row]));
  const derivedCents = Math.min(maximum, active7.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + Math.min(scoreCents(row.value), scoreCents(subitemSelectedPoints(row, selected.get(row.id)))), 0));
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
function normalizeSearchText(text3) {
  return normalizeSectionLabel(text3).toLowerCase();
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
  const getTeaching = (id9) => live2(state.teachings).find((r) => r.id === id9) ?? null;
  const getSection = (id9) => live2(state.sections).find((r) => r.id === id9) ?? null;
  const items = (id9) => sortByOrder(live2(state.items).filter((r) => r.teachingId === id9));
  const scoresOf = (id9) => live2(state.scores).filter((r) => r.studentId === id9);
  const enrollmentsOf = (id9) => live2(state.enrollments).filter((r) => r.studentId === id9);
  const logsOf = (id9) => live2(state.logs).filter((r) => r.studentId === id9);
  const attendanceOf = (id9) => live2(state.attendance).filter((r) => r.studentId === id9);
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
    const key3 = automaticItemKey(item);
    if (!teaching || !key3) return null;
    if (!group) return /* @__PURE__ */ new Set([teaching.id]);
    const targetMatches = items(teaching.id).filter((candidate) => portableGroup(candidate) === group);
    if (targetMatches.length !== 1 || automaticItemKey(targetMatches[0]) !== key3) return null;
    const targetSection = getSection(teaching.sectionId);
    const targetEnrollment = enrollmentsOf(studentId2).find((enrollment) => enrollment.sectionId === teaching.sectionId);
    if (!targetSection || !targetEnrollment) return /* @__PURE__ */ new Set([teaching.id]);
    const transferredSections = new Set(enrollmentsOf(studentId2).filter((enrollment) => enrollment.status === "transferred").map((enrollment) => enrollment.sectionId));
    const teachingIds = /* @__PURE__ */ new Set([teaching.id]);
    for (const sourceTeaching of live2(state.teachings)) {
      if (sourceTeaching.id === teaching.id || sourceTeaching.subjectId !== teaching.subjectId || sourceTeaching.termId !== teaching.termId || !transferredSections.has(sourceTeaching.sectionId) || getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId || getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
      const sameItem = items(sourceTeaching.id).filter((candidate) => portableGroup(candidate) === group);
      if (!sameItem.length) continue;
      if (sameItem.length !== 1 || automaticItemKey(sameItem[0]) !== key3) return null;
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
var exact4 = (value, keys) => object(value) && Object.keys(value).every((key3) => keys.includes(key3));
var text = (value) => typeof value === "string" && value.length > 0 && value.length <= 300;
var hash2 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
function validateVisibilityPolicy(policy) {
  const fail15 = () => {
    throw new TypeError("n88_visibility_invalid");
  };
  if (!exact4(policy, ["version", "ownerId", "studentId", "enrollmentId", "classId", "termId", "scopeStamp", "fields", "sources"]) || policy.version !== VISIBILITY_VERSION || !hash2(policy.scopeStamp) || !["ownerId", "studentId", "enrollmentId", "classId", "termId"].every((key3) => text(policy[key3])) || !exact4(policy.fields, VISIBILITY_FIELDS) || Object.values(policy.fields).some((value) => typeof value !== "boolean") || !Array.isArray(policy.sources) || policy.sources.length > 2e3) fail15();
  const ids = /* @__PURE__ */ new Set(), sources = /* @__PURE__ */ new Set();
  for (const source of policy.sources) {
    if (!exact4(source, ["kind", "sourceId", "publicationId", "stamp"]) || !["item", "subitem"].includes(source.kind) || !text(source.sourceId) || !uuid(source.publicationId) || !hash2(source.stamp)) fail15();
    const key3 = JSON.stringify([source.kind, source.sourceId]);
    if (ids.has(source.publicationId) || sources.has(key3)) fail15();
    ids.add(source.publicationId);
    sources.add(key3);
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
var digest3 = (value) => createHash4("sha256").update(JSON.stringify(value)).digest("hex");
var active = (row) => row && row.deleted === false && row.deletedAt == null && row.archivedAt == null && row.status !== "archived";
var revision = (row) => {
  if (!/^[1-9][0-9]*$/.test(String(row?.revision ?? ""))) deny("canonical_revision");
  return [row.id, String(row.revision)];
};
var date = (value) => {
  if (value == null) return null;
  return normalizeSubitemDatesAndPoints({ value: 0, startDate: value }).startDate;
};
var scopeKeys2 = ["ownerId", "studentId", "enrollmentId", "classId", "termId"];
function readScope(input) {
  const { canonical: c, ownerId, studentId, enrollmentId, classId, termId, now } = input;
  if (!scopeKeys2.every((key3) => typeof input[key3] === "string" && input[key3]) || typeof now !== "string") deny();
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
  const one = (table, id9) => rows[table].find((row) => row.id === id9);
  const student = one("students", studentId), section = one("sections", classId), term = one("terms", termId);
  const year = one("years", section?.yearId), enrollment = one("enrollments", enrollmentId);
  if (![student, section, term, year, enrollment].every(active) || [student, section, term, year, enrollment].some((row) => row.status !== "active") || term.yearId !== section.yearId || enrollment.studentId !== studentId || enrollment.sectionId !== classId || enrollment.endDate != null || date(enrollment.startDate) && enrollment.startDate > today || date(term.startDate) && term.startDate > today || date(term.endDate) && term.endDate < today) deny();
  const current = rows.enrollments.filter((row) => active(row) && row.studentId === studentId && row.status === "active" && row.endDate == null && active(one("sections", row.sectionId)) && one("sections", row.sectionId).yearId === year.id);
  if (current.length !== 1 || current[0].id !== enrollmentId) deny("unique_current_enrollment");
  const teachings = rows.teachings.filter((row) => active(row) && row.sectionId === classId && row.termId === termId);
  const items = sortByOrder(rows.items.filter((row) => active(row) && teachings.some((t) => t.id === row.teachingId)));
  const definitions3 = sortByOrder(rows.scoreSubitems.filter((row) => active(row) && items.some((item) => item.id === row.itemId && item.scoreMode === "subitems")));
  const scopeStamp = digest3([
    "n88-scope-v1",
    ...scopeKeys2.map((key3) => input[key3]),
    ...[year, term, section, student, enrollment].map(revision),
    ...teachings.sort((a, b) => a.id.localeCompare(b.id)).map(revision)
  ]);
  const sourceStamp = (kind, row) => digest3([
    "n88-source-v1",
    scopeStamp,
    kind,
    revision(row),
    ...kind === "subitem" ? [revision(items.find((item) => item.id === row.itemId))] : []
  ]);
  return { rows, today, student, section, items, definitions: definitions3, teachings, scopeStamp, sourceStamp };
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
  const policy = input.visibility == null ? null : validateVisibilityPolicy(input.visibility);
  if (policy && (scopeKeys2.some((key3) => policy[key3] !== input[key3]) || policy.scopeStamp !== s.scopeStamp)) deny();
  const out = {
    version: STUDENT_PROJECTION_VERSION,
    profile: { name: s.student.name, classLabel: sectionLabel(s.section) }
  };
  if (policy === null) return out;
  const enabled = (key3) => policy.fields[key3] === true;
  const grant = (kind, row) => policy.sources.find((source) => source.kind === kind && source.sourceId === row.id && source.stamp === s.sourceStamp(kind, row));
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
    const publication2 = grant("subitem", definition);
    if (!publication2) continue;
    const completions = s.rows.scoreSubitemCompletions.filter((row) => active(row) && row.studentId === studentId && row.subitemId === definition.id);
    if (completions.length > 1) deny("unique_student_subitem_completion");
    const completionState = subitemCompletionState(completions[0]);
    const { startDate, dueDate } = normalizeSubitemDatesAndPoints(definition);
    const family = completionState !== "unrecorded" ? "completed" : startDate && startDate > s.today ? "scheduled" : "required";
    if (enabled(family)) out.work[family].push({ id: publication2.publicationId, title: definition.name, startDate, dueDate, completionState, ...guidanceForStudent(input, definition, publication2) });
  }
  return out;
}
function projectStudentPublicationV2(input, draft, publications) {
  const selected = input.selectedTeachingId ?? draft.scope.teachingId, c = input.canonical;
  if (selected !== draft.scope.teachingId) deny();
  const items = c.items.filter((r) => r.teachingId === selected), ids = new Set(items.map((r) => r.id));
  const definitions3 = c.scoreSubitems.filter((r) => ids.has(r.itemId)), subids = new Set(definitions3.map((r) => r.id));
  input = { ...input, canonical: {
    ...c,
    teachings: c.teachings.filter((r) => r.id === selected),
    items,
    scores: c.scores.filter((r) => ids.has(r.itemId)),
    scoreSubitems: definitions3,
    scoreSubitemCompletions: c.scoreSubitemCompletions.filter((r) => subids.has(r.subitemId)),
    sessions: c.sessions.filter((r) => r.teachingId === selected),
    attendance: c.attendance.filter((r) => r.teachingId === selected),
    logs: c.logs.filter((r) => r.teachingId === selected)
  } };
  const s = readScope(input);
  if (draft.scope.ownerId !== input.ownerId || draft.scope.sectionId !== input.classId || draft.scope.termId !== input.termId || !s.teachings.some((t) => t.id === draft.scope.teachingId && t.subjectId === draft.scope.subjectId)) deny();
  const out = { work: [], grades: [] };
  for (const row of draft.rows) {
    const matches = publications.filter((p2) => p2.rowId === row.id);
    const p = matches.length === 1 ? matches[0] : null;
    if (!p || p.tombstone || p.sourceRevision !== row.sourceRevision || p.publicationRevision < 1) continue;
    const definition = row.kind === "subitem" ? s.definitions.find((d) => d.id === row.sourceId && d.itemId === row.itemId) : null;
    if (definition) normalizeSubitemDatesAndPoints(definition);
    const completions = definition ? s.rows.scoreSubitemCompletions.filter((c2) => active(c2) && c2.studentId === input.studentId && c2.subitemId === definition.id) : [];
    if (completions.length > 1) deny("unique_student_subitem_completion");
    const family = definition && subitemCompletionState(completions[0]) !== "unrecorded" ? "completed" : row.startDate && row.startDate > s.today ? "scheduled" : "required";
    if (row.work && p.decisions[family]) out.work.push({
      id: row.id,
      title: row.title,
      startDate: row.startDate,
      dueDate: row.dueDate,
      categories: [family],
      description: row.description,
      link: row.link
    });
    if (row.kind === "manual" || !p.decisions.grade) continue;
    let value;
    if (definition) {
      value = subitemCompletionState(completions[0]) === "unrecorded" ? null : subitemSelectedPoints(definition, completions[0]);
    } else {
      const item = s.items.find((i) => i.id === row.sourceId && i.teachingId === draft.scope.teachingId);
      if (!item || item.scoreMode === "subitems") deny();
      const scores = s.rows.scores.filter((r) => active(r) && r.studentId === input.studentId && r.itemId === item.id);
      if (scores.length > 1) deny("unique_student_item_score");
      const logs = s.rows.logs.filter((r) => active(r) && r.teachingId === item.teachingId);
      const sessions = s.rows.sessions.filter((r) => active(r) && r.teachingId === item.teachingId);
      value = itemScore(item, {
        ...canonicalGradeContext(s.rows, input.studentId, item.teachingId),
        logs: logs.filter((r) => r.studentId === input.studentId),
        classHasParticipation: logs.some((r) => r.kind === "participation"),
        attendance: s.rows.attendance.filter((r) => active(r) && r.studentId === input.studentId && r.teachingId === item.teachingId && sessions.some((session) => session.id === r.sessionId))
      });
    }
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) deny();
    out.grades.push({ id: row.id, title: row.title, value });
  }
  return out;
}

// drafts/n88-student-portal/service.mjs
import { Buffer as Buffer4 } from "node:buffer";
import { randomBytes, randomUUID, randomInt, createHash as createHash5, createHmac, timingSafeEqual } from "node:crypto";
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

// drafts/n88-student-portal/web-protocol.mjs
var ROUTE = /^\/api\/n88\/(?:teacher\/class\/(?:list|issue-missing|rotate|revoke|visibility|guidance-list|guidance-save)|student\/(?:claim|read|end))$/;
var FORWARDED = Object.freeze(["authorization", "cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"]);
function parseStudentScopePath(path, prefix = "/api/n88") {
  const base = prefix + "/student/publication-v2/read";
  if (path === base) return { path: base, teachingId: null };
  if (typeof path !== "string" || !path.startsWith(base + "?teaching=")) return null;
  const encoded = path.slice((base + "?teaching=").length);
  let value;
  try {
    value = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!value || value.length > 200 || /[\u0000-\u001f\u007f-\u009f]/u.test(value) || encodeURIComponent(value) !== encoded) return null;
  return { path: base, teachingId: value };
}
var decodeBytes = (value) => {
  if (typeof value !== "string" || value.length > 5464 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error("n88_envelope");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
};
var hex3 = (bytes2) => Array.from(new Uint8Array(bytes2), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes2) {
  return hex3(await crypto.subtle.digest("SHA-256", bytes2));
}
async function mac(key3, value) {
  const k = await crypto.subtle.importKey("raw", key3, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex3(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
}
function signingText({ origin, path, method, headers, bodyHash, time: time3, nonce, source }) {
  return JSON.stringify(["n88-ingress-v1", origin, path, method, FORWARDED.map((n) => headers.get(n) || ""), bodyHash, time3, nonce, source]);
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
    const bytes2 = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      bytes2.set(p, at);
      at += p.length;
    }
    return bytes2;
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
var READ_PHASE_NAMES = Object.freeze(["pool", "boundary", "snapshot", "sync", "canonical", "visibility", "guidance", "projection", "commit", "total"]);
function validateReadPhases(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === READ_PHASE_NAMES.length && READ_PHASE_NAMES.every((k) => Object.hasOwn(value, k) && Number.isInteger(value[k]) && value[k] >= 0 && value[k] <= 2e4 && value[k] % 250 === 0);
}
function createReadPhaseTiming() {
  const started = performance.now(), durations = Object.fromEntries(READ_PHASE_NAMES.map((k) => [k, 0]));
  const measure = async (name, action) => {
    const start = performance.now();
    try {
      return await action();
    } finally {
      if (READ_PHASE_NAMES.includes(name) && name !== "total") durations[name] += Math.max(0, performance.now() - start);
    }
  };
  return { measure, finish: () => Object.fromEntries(READ_PHASE_NAMES.map((k) => [k, Math.min(2e4, Math.max(0, Math.floor((k === "total" ? performance.now() - started : durations[k]) / 250) * 250))])) };
}

// drafts/n88-student-portal/publication-v2-service.inactive.mjs
var PUBLICATION_V2_PATHS = Object.freeze(["/teacher/class/publication-v2", "/student/publication-v2/read"]);
var isPublicationV2Path = (path) => path === PUBLICATION_V2_PATHS[0] || !!parseStudentScopePath(path, "");
var flags2 = ["required", "scheduled", "completed", "grade"];
var scopeKeys3 = ["ownerId", "teachingId", "sectionId", "termId", "subjectId"];
var bindingKeys = ["sessionId", "leaseId", "contextRevision"];
var commandKeys = [
  "version",
  "action",
  "requestId",
  "scope",
  "binding",
  "expectedMembershipRevision",
  "sourceId",
  "rowId",
  "expectedSourceRevision",
  "expectedPublicationRevision",
  "decisions",
  "manualTask"
];
var exact5 = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var id3 = (v) => typeof v === "string" && v.length > 0 && v.length <= 200 && !v.includes("\0");
var revision2 = (v) => Number.isSafeInteger(v) && v >= 0;
var hex4 = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
var off = () => Object.fromEntries(flags2.map((k) => [k, false]));
var fail3 = () => {
  throw Error("n88_publication_v2_unavailable");
};
var stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
var digest4 = (v) => createHash6("sha256").update(JSON.stringify(stable(v))).digest("hex");
var active2 = (r) => r && r.deleted === false && r.deletedAt == null && r.archivedAt == null && !["archived", "closed", "retired"].includes(r.status);
var response = (status, body) => ({ status, body, headers: PRIVATE_HEADERS });
var unavailable = () => response(503, { state: "unknown", retry: false });
var pupilInput = (snapshot2, scope2, member) => ({
  canonical: snapshot2.canonical,
  selectedTeachingId: scope2.teachingId,
  ownerId: scope2.ownerId,
  classId: scope2.sectionId,
  termId: scope2.termId,
  studentId: member.studentId,
  enrollmentId: member.id,
  teacherContextVersion: "n88-canonical-teacher-context-v1",
  now: snapshot2.now
});
function canonicalSnapshot(snapshot2, scope2) {
  const c = snapshot2?.canonical;
  if (!c || !validDateTimeValue(snapshot2.now, "date") || !snapshot2.now) fail3();
  for (const table of CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    const rows = c[table];
    if (!Array.isArray(rows) || rows.length > 2e3 || new Set(rows.map((r) => r.id)).size !== rows.length || rows.some((r) => !id3(r.id) || r.ownerId !== scope2.ownerId || typeof r.deleted !== "boolean" || !/^[1-9][0-9]*$/.test(String(r.revision)))) fail3();
  }
  if (Buffer.byteLength(JSON.stringify(c)) > 2 * 1024 * 1024) fail3();
  const one = (table, key3) => c[table].find((r) => r.id === key3 && active2(r));
  const t = one("teachings", scope2.teachingId), section = one("sections", scope2.sectionId), term = one("terms", scope2.termId);
  const year = one("years", section?.yearId);
  if (!t || !section || !term || !year || t.sectionId !== section.id || t.termId !== term.id || t.subjectId !== scope2.subjectId || section.yearId !== term.yearId || [section, term, year].some((r) => r.status !== "active") || term.startDate && (!validDateTimeValue(term.startDate, "date") || term.startDate > snapshot2.now) || term.endDate && (!validDateTimeValue(term.endDate, "date") || term.endDate < snapshot2.now)) fail3();
  const members = c.enrollments.filter((r) => active2(r) && r.sectionId === section.id && r.status === "active" && r.endDate == null);
  if (new Set(members.map((r) => r.studentId)).size !== members.length) fail3();
  for (const m of members) studentPortalPublicationBindings(pupilInput(snapshot2, scope2, m));
  const membershipRevision = digest4([
    scope2,
    year,
    term,
    section,
    t,
    members,
    c.students.filter((s) => members.some((m) => m.studentId === s.id))
  ]);
  return { c, members, membershipRevision };
}
function rowsFrom(snapshot2, scope2, manualTasks, retired = []) {
  const { c, members, membershipRevision } = canonicalSnapshot(snapshot2, scope2);
  const draft = proposePublicationRows({ scope: scope2, data: {
    ...c,
    ownerId: scope2.ownerId,
    items: c.items.filter((r) => active2(r) && !retired.includes("items:" + r.id)),
    scoreSubitems: c.scoreSubitems.filter((r) => active2(r) && !retired.includes("scoreSubitems:" + r.id))
  }, manualTasks: manualTasks.map((m) => ({ ...m, scope: scope2 })) });
  for (const row of draft.rows) {
    const item = c.items.find((i) => i.id === row.itemId);
    const definition = row.kind === "subitem" ? c.scoreSubitems.find((d) => d.id === row.sourceId) : null;
    const gradeInputs = row.kind === "manual" ? [] : row.kind === "subitem" ? [
      definition,
      c.scoreSubitemCompletions.filter((r) => r.subitemId === row.sourceId && members.some((m) => m.studentId === r.studentId))
    ] : item?.auto || item?.portabilityGroupId ? c : [item, c.scores.filter((r) => r.itemId === row.sourceId && members.some((m) => m.studentId === r.studentId))];
    row.sourceRevision = digest4([row.sourceRevision, gradeInputs]);
  }
  return { draft, members, membershipRevision };
}
function trackSources(stored, snapshot2, scope2) {
  const c = snapshot2.canonical;
  const parents = c.items.filter((r) => r.teachingId === scope2.teachingId);
  const sources = [
    ...parents.map((r) => ({ table: "items", row: r })),
    ...c.scoreSubitems.filter((r) => parents.some((p) => p.id === r.itemId)).map((r) => ({ table: "scoreSubitems", row: r }))
  ];
  for (const prior of stored.sourceVersions) {
    const next = sources.find((s) => prior.key === s.table + ":" + s.row.id);
    if (!next) prior.retired = true;
  }
  for (const { table, row } of sources) {
    const key3 = table + ":" + row.id;
    const prior = stored.sourceVersions.find((s) => s.key === key3);
    if (prior) {
      if (BigInt(row.revision) < BigInt(prior.revision)) fail3();
      prior.revision = String(row.revision);
      prior.retired ||= !active2(row);
    } else stored.sourceVersions.push({ key: key3, revision: String(row.revision), retired: !active2(row) });
  }
  if (stored.sourceVersions.length > 4e3) fail3();
  return stored.sourceVersions.filter((s) => s.retired).map((s) => s.key);
}
function reconcileSources(stored, current) {
  for (const p of stored.publications) {
    const row = current.draft.rows.find((r) => r.id === p.rowId);
    if (p.tombstone) continue;
    if (!row || p.sourceRevision !== row.sourceRevision || p.membershipRevision !== current.membershipRevision) {
      p.publicationRevision++;
      if (!revision2(p.publicationRevision)) fail3();
      p.decisions = off();
      p.tombstone = !row;
      if (row) p.sourceRevision = row.sourceRevision;
      p.membershipRevision = current.membershipRevision;
    }
  }
  for (const row of current.draft.rows) if (!stored.publications.some((p) => p.rowId === row.id)) stored.publications.push({
    rowId: row.id,
    sourceRevision: row.sourceRevision,
    publicationRevision: 0,
    membershipRevision: current.membershipRevision,
    decisions: off(),
    tombstone: false
  });
}
function validCommand(r) {
  return exact5(r, commandKeys) && r.version === 2 && ["item-publication-set", "item-publication-delete"].includes(r.action) && /^[A-Za-z0-9_-]{16,100}$/.test(r.requestId ?? "") && id3(r.sourceId) && typeof r.rowId === "string" && r.rowId.length <= 1e3 && /^[a-f0-9]{64}$/.test(r.expectedSourceRevision ?? "") && id3(r.expectedMembershipRevision) && revision2(r.expectedPublicationRevision) && exact5(r.decisions, flags2) && flags2.every((k) => typeof r.decisions[k] === "boolean") && (r.manualTask === null || exact5(r.manualTask, ["id", "title", "description", "startDate", "dueDate", "link"]));
}
function validStored(stored) {
  if (!Array.isArray(stored.manualTasks) || !Array.isArray(stored.publications) || !Array.isArray(stored.sourceVersions) || new Set(stored.publications.map((p) => p.rowId)).size !== stored.publications.length || new Set(stored.manualTasks.map((m) => m.id)).size !== stored.manualTasks.length || new Set(stored.sourceVersions.map((s) => s.key)).size !== stored.sourceVersions.length || stored.publications.some((p) => !exact5(p, ["rowId", "sourceRevision", "publicationRevision", "membershipRevision", "decisions", "tombstone"]) || typeof p.rowId !== "string" || !hex4(p.sourceRevision) || !hex4(p.membershipRevision) || !revision2(p.publicationRevision) || typeof p.tombstone !== "boolean" || !exact5(p.decisions, flags2) || !flags2.every((k) => typeof p.decisions[k] === "boolean")) || stored.sourceVersions.some((s) => !exact5(s, ["key", "revision", "retired"]) || typeof s.key !== "string" || !/^[1-9][0-9]*$/.test(s.revision) || typeof s.retired !== "boolean")) fail3();
}
function createPublicationV2Service({ executionMode, runtimeCapability, enabled = false, origin, transaction, authenticate, readCurrent }) {
  if (enabled !== true || !publicationRuntimeAllowed(executionMode, runtimeCapability)) return async () => response(401, { error: "unavailable" });
  if (![transaction, authenticate, readCurrent].every((fn) => typeof fn === "function") || !origin) fail3();
  return async (request) => {
    const student = !!parseStudentScopePath(request.path, ""), r = request.body;
    const h = request.headers ?? {};
    if (!isPublicationV2Path(request.path) || request.method !== (student ? "GET" : "POST") || h.origin !== origin || h["x-n88-csrf"] !== "1" || h["sec-fetch-site"] && h["sec-fetch-site"] !== "same-origin" || !student && h["content-type"] !== "application/json") return response(401, { error: "unavailable" });
    try {
      if (Buffer.byteLength(JSON.stringify(r ?? {})) > 16384) fail3();
      return await transaction(async (tx) => {
        if (!tx?.state || !Array.isArray(tx.state.scopes) || !Array.isArray(tx.state.receipts) || typeof tx.beforeCommit !== "function") fail3();
        const auth = await authenticate(request, tx, student ? "student" : "teacher");
        if (auth?.current !== true || !id3(auth.ownerId) || !id3(auth.sessionId)) fail3();
        if (tx.bindOwner) await tx.bindOwner(auth.ownerId);
        if (student && auth.selectionState && auth.selectionState !== "selected") {
          if (r != null || !["choice", "empty"].includes(auth.selectionState) || !Array.isArray(auth.choices)) fail3();
          const before = digest4(auth);
          tx.beforeCommit(async () => {
            if (digest4(await authenticate(request, tx, "student")) !== before) fail3();
          });
          return response(200, { version: "n88-student-scope-v2", state: auth.selectionState, choices: auth.choices });
        }
        const scope2 = student ? auth.scope : r?.scope;
        if (!exact5(scope2, scopeKeys3) || !scopeKeys3.every((k) => id3(scope2[k])) || scope2.ownerId !== auth.ownerId) fail3();
        if (student) {
          if (r != null || !id3(auth.studentId) || !id3(auth.enrollmentId)) fail3();
        } else if (!exact5(r?.binding, bindingKeys) || !bindingKeys.every((k) => id3(r.binding[k])) || r.binding.sessionId !== auth.sessionId) fail3();
        const snapshot2 = await readCurrent(tx, auth, scope2);
        const snapshotDigest = digest4(snapshot2);
        tx.beforeCommit(async () => {
          const freshAuth = await authenticate(request, tx, student ? "student" : "teacher");
          if (digest4(freshAuth) !== digest4(auth) || freshAuth?.current !== true || digest4(await readCurrent(tx, freshAuth, scope2)) !== snapshotDigest) fail3();
          if (tx.state.scopes.length > 2e3 || tx.state.receipts.length > 1e4 || tx.state.scopes.some((s) => s.publications.length > 2e3 || s.manualTasks.length > 2e3 || s.sourceVersions.length > 4e3) || Buffer.byteLength(JSON.stringify(tx.state)) > 4 * 1024 * 1024) fail3();
        });
        if (tx.state.scopes.length > 2e3 || tx.state.receipts.length >= 1e4) fail3();
        let matches = tx.state.scopes.filter((s) => samePublicationScope(s.scope, scope2));
        if (matches.length > 1) fail3();
        let stored = matches[0];
        if (!stored) {
          stored = { scope: structuredClone(scope2), manualTasks: [], publications: [], sourceVersions: [] };
          tx.state.scopes.push(stored);
        }
        validStored(stored);
        canonicalSnapshot(snapshot2, scope2);
        const retired = trackSources(stored, snapshot2, scope2);
        let current = rowsFrom(snapshot2, scope2, stored.manualTasks, retired);
        reconcileSources(stored, current);
        if (student) {
          const member = current.members.find((m) => m.studentId === auth.studentId && m.id === auth.enrollmentId);
          if (!member) fail3();
          const projection = projectStudentPublicationV2(pupilInput(snapshot2, scope2, member), current.draft, stored.publications);
          return response(200, auth.selectionState ? { version: "n88-student-scope-v2", state: "selected", teachingId: scope2.teachingId, choices: auth.choices, projection } : projection);
        }
        if (r.action === "manual-preview" && exact5(r, ["action", "scope", "binding", "manualTask"]) && exact5(r.manualTask, ["id", "title", "description", "startDate", "dueDate", "link"])) {
          const manual2 = manualTaskDraft(r.manualTask, /* @__PURE__ */ new Date(snapshot2.now + "T12:00:00"));
          const preview = rowsFrom(snapshot2, scope2, [...stored.manualTasks.filter((t) => t.id !== manual2.id), manual2], retired);
          const row2 = preview.draft.rows.find((row3) => row3.kind === "manual" && row3.sourceId === manual2.id);
          const p2 = stored.publications.find((p3) => p3.rowId === row2.id);
          return response(200, {
            version: 2,
            inactive: true,
            membershipRevision: current.membershipRevision,
            row: { ...row2, publicationRevision: p2?.publicationRevision ?? 0, tombstone: p2?.tombstone ?? false }
          });
        }
        if (r.action === "list" && exact5(r, ["action", "scope", "binding"])) return response(200, {
          version: 2,
          inactive: true,
          scope: scope2,
          binding: r.binding,
          membershipRevision: current.membershipRevision,
          rows: current.draft.rows.map((row2) => {
            const p2 = stored.publications.find((p3) => p3.rowId === row2.id);
            return {
              ...row2,
              decisions: { ...p2.decisions },
              publicationRevision: p2.publicationRevision,
              tombstone: p2.tombstone
            };
          })
        });
        const lookup = r.action === "status" && exact5(r, ["action", "scope", "binding", "command"]);
        const command2 = lookup ? r.command : r;
        if (!validCommand(command2) || !samePublicationScope(command2.scope, scope2) || digest4(command2.binding) !== digest4(r.binding)) fail3();
        const key3 = { ownerId: auth.ownerId, requestId: command2.requestId };
        const fingerprint = digest4(command2);
        const receipts = tx.state.receipts.filter((p2) => p2.ownerId === key3.ownerId && p2.requestId === key3.requestId);
        if (receipts.length > 1 || receipts.length && receipts[0].fingerprint !== fingerprint) return unavailable();
        if (receipts.length || lookup) {
          const receipt3 = receipts[0]?.receipt;
          if (!receipt3) return unavailable();
          if (!exact5(receipt3, ["version", "scope", "binding", "requestId", "rowId", "sourceRevision", "state", "publicationRevision"]) || receipt3.version !== 2 || !samePublicationScope(receipt3.scope, scope2) || digest4(receipt3.binding) !== digest4(command2.binding) || receipt3.requestId !== command2.requestId || receipt3.rowId !== command2.rowId || receipt3.sourceRevision !== command2.expectedSourceRevision || !["applied", "rejected"].includes(receipt3.state) || !revision2(receipt3.publicationRevision)) return unavailable();
          const p2 = stored.publications.find((p3) => p3.rowId === command2.rowId);
          const fresh = p2 && !p2.tombstone && p2.sourceRevision === command2.expectedSourceRevision && p2.membershipRevision === command2.expectedMembershipRevision ? { ...receipt3, fresh: true, publicationRevision: p2.publicationRevision, membershipRevision: current.membershipRevision, decisions: { ...p2.decisions } } : null;
          return response(200, { receipt: structuredClone(receipt3), fresh });
        }
        let manual = null, next = current;
        if (command2.manualTask && command2.action === "item-publication-set") {
          manual = manualTaskDraft(command2.manualTask, /* @__PURE__ */ new Date(snapshot2.now + "T12:00:00"));
          if (manual.id !== command2.sourceId || command2.rowId !== JSON.stringify(["manual", null, manual.id])) fail3();
          const tasks = [...stored.manualTasks.filter((t) => t.id !== manual.id), manual];
          next = rowsFrom(snapshot2, scope2, tasks, retired);
        }
        const row = next.draft.rows.find((row2) => row2.id === command2.rowId && row2.sourceId === command2.sourceId);
        const p = stored.publications.find((p2) => p2.rowId === command2.rowId);
        const allowed = row && !p?.tombstone && command2.expectedMembershipRevision === current.membershipRevision && row.sourceRevision === command2.expectedSourceRevision && (p?.publicationRevision ?? 0) === command2.expectedPublicationRevision && (row.kind === "manual" ? !command2.decisions.grade : command2.manualTask === null) && (command2.action !== "item-publication-delete" || row.kind === "manual" && command2.manualTask === null && flags2.every((k) => !command2.decisions[k])) && (row.work || flags2.filter((k) => k !== "grade").every((k) => !command2.decisions[k]));
        const receipt2 = {
          version: 2,
          scope: structuredClone(scope2),
          binding: structuredClone(command2.binding),
          requestId: command2.requestId,
          rowId: command2.rowId,
          sourceRevision: command2.expectedSourceRevision,
          state: allowed ? "applied" : "rejected",
          publicationRevision: command2.expectedPublicationRevision + (allowed ? 1 : 0)
        };
        if (!revision2(receipt2.publicationRevision)) fail3();
        if (allowed) {
          if (manual) stored.manualTasks = [...stored.manualTasks.filter((t) => t.id !== manual.id), manual];
          const publication2 = {
            rowId: row.id,
            sourceRevision: row.sourceRevision,
            publicationRevision: receipt2.publicationRevision,
            membershipRevision: current.membershipRevision,
            decisions: structuredClone(command2.decisions),
            tombstone: false
          };
          if (p) Object.assign(p, publication2);
          else stored.publications.push(publication2);
          if (command2.action === "item-publication-delete") {
            publication2.tombstone = true;
            Object.assign(stored.publications.find((p2) => p2.rowId === row.id), publication2);
            stored.manualTasks = stored.manualTasks.filter((t) => t.id !== row.sourceId);
          }
        }
        tx.state.receipts.push({ ...key3, fingerprint, receipt: structuredClone(receipt2) });
        if (stored.publications.length > 2e3 || stored.manualTasks.length > 2e3 || Buffer.byteLength(JSON.stringify(tx.state)) > 4 * 1024 * 1024) fail3();
        const saved = stored.publications.find((p2) => p2.rowId === command2.rowId);
        return response(200, { receipt: receipt2, fresh: saved && !saved.tombstone && saved.sourceRevision === command2.expectedSourceRevision ? { ...receipt2, fresh: true, membershipRevision: current.membershipRevision, decisions: { ...saved.decisions } } : null });
      });
    } catch {
      return unavailable();
    }
  };
}

// drafts/n88-student-portal/canonical-adapter.mjs
import { Buffer as Buffer5 } from "node:buffer";
import { createHash as createHash7 } from "node:crypto";

// drafts/n88-student-portal/rollout-guard.mjs
var uuid2 = (v) => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
var id4 = (v) => typeof v === "string" && v.length > 0 && v.length <= 240 && !v.includes("\0");
var exact6 = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var off2 = () => Object.freeze({ mode: "off", configured: false, allowsOwner: () => false, allowsMember: () => false, admitsTeacher: () => false, admitsStudent: () => false });
function createRolloutGuard(readEnv) {
  if (typeof readEnv !== "function") return off2();
  let mode, binding, proof;
  try {
    mode = readEnv("N88_ROLLOUT_MODE");
    if (mode === "off" || mode == null) return off2();
    if (mode === "public") {
      proof = readEnv("N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256");
      if (typeof proof !== "string" || !/^[a-f0-9]{64}$/.test(proof) || readEnv("N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED") !== "true") return off2();
    } else if (mode === "pilot") {
      const text3 = readEnv("N88_PILOT_BINDING");
      if (typeof text3 !== "string" || text3.length > 2048) return off2();
      binding = JSON.parse(text3);
      if (!exact6(binding, ["ownerId", "classId", "teachingId", "studentIds"]) || !uuid2(binding.ownerId) || !id4(binding.classId) || !id4(binding.teachingId) || !Array.isArray(binding.studentIds) || binding.studentIds.length !== 2 || binding.studentIds.some((v) => !id4(v)) || new Set(binding.studentIds).size !== 2) return off2();
      binding = { ...binding, studentIds: new Set(binding.studentIds) };
    } else return off2();
  } catch {
    return off2();
  }
  const allowsOwner = (ownerId) => uuid2(ownerId) && (mode === "public" || ownerId === binding.ownerId);
  const allowsMember = (m) => !!m && allowsOwner(m.ownerId) && id4(m.studentId) && id4(m.classId) && (mode === "public" || m.classId === binding.classId && binding.studentIds.has(m.studentId));
  return Object.freeze({
    mode,
    configured: true,
    allowsOwner,
    allowsMember,
    admitsTeacher: (auth, scope2) => !!auth && auth.current === true && allowsOwner(auth.ownerId) && !!scope2 && scope2.current === true && scope2.ownerId === auth.ownerId && id4(scope2.classId) && id4(scope2.teachingId) && (mode === "public" || scope2.classId === binding.classId && scope2.teachingId === binding.teachingId),
    admitsStudent: (member) => allowsMember(member) && member.status === "active" && member.endDate === null && member.studentActive === true && member.classActive === true
  });
}

// drafts/n88-student-portal/canonical-adapter.mjs
var CANONICAL_TABLES = Object.freeze(["years", "terms", "sections", "students", "enrollments", "teachings", "items"]);
var fail4 = () => {
  throw Error("n88_canonical_unavailable");
};
var key = (m) => JSON.stringify([m.ownerId, m.classId, m.studentId, m.enrollmentId]);
var id5 = (parts) => {
  const h = createHash7("sha256").update(JSON.stringify(["n88-publication-v1", ...parts])).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function createCanonicalAdapter({ maxRows = 2e3, maxBytes = 2 * 1024 * 1024, rollout = createRolloutGuard() } = {}) {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail4();
  return async (db, { query }, ownerId) => {
    if (!rollout.allowsOwner(ownerId)) fail4();
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId) || !db.contexts.some((c) => c.ownerId === ownerId && c.active)) fail4();
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
    if (result2.rows.length > maxRows) fail4();
    let bytes2 = 0;
    const read = (row) => {
      if (typeof row.payload !== "string") fail4();
      bytes2 += Buffer5.byteLength(row.payload);
      if (bytes2 > maxBytes) fail4();
      return JSON.parse(row.payload);
    };
    const previous = new Map(db.memberships.map((m) => [key(m), m]));
    for (const m of db.memberships.filter((m2) => m2.ownerId === ownerId && rollout.allowsMember(m2))) {
      m.status = "inactive";
      m.studentActive = false;
      m.classActive = false;
    }
    for (const row of result2.rows) {
      const r = read(row), revision5 = Number(r.revision);
      if (!rollout.allowsMember({ ownerId: r.owner_id, classId: r.section_id, studentId: r.student_id })) continue;
      if (!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision5)) fail4();
      const revisions = [r.revision, r.student_revision, r.section_revision, r.year_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail4();
      const canonicalStamp = createHash7("sha256").update(JSON.stringify(["n88-lineage-v1", ...revisions])).digest("hex");
      const m = {
        ownerId: r.owner_id,
        classId: r.section_id,
        studentId: r.student_id,
        enrollmentId: r.enrollment_id,
        revision: revision5,
        canonicalStamp,
        status: r.enrollment_present && r.status === "active" ? "active" : "ended",
        endDate: r.end_date,
        studentActive: r.student_active,
        classActive: r.class_active,
        label: r.label
      };
      if (!owners.includes(m.ownerId)) fail4();
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
      ) x) bounded`, [owners, maxRows + 1, maxBytes - bytes2]);
    if (source.rows.length > maxRows) fail4();
    const current = /* @__PURE__ */ new Set();
    for (const row of source.rows) {
      const r = read(row);
      if (!rollout.admitsTeacher({ ownerId, current: true }, { ownerId: r.owner_id, current: true, classId: r.section_id, teachingId: r.teaching_id })) continue;
      const revisions = [r.item_revision, r.teaching_revision, r.term_revision];
      if (!revisions.every((v) => typeof v === "string" && /^[1-9][0-9]*$/.test(v))) fail4();
      for (const m of db.memberships.filter((m2) => m2.ownerId === r.owner_id && m2.classId === r.section_id && m2.status === "active" && !m2.endDate && m2.studentActive && m2.classActive && rollout.admitsStudent(m2))) {
        const publicationId = id5([m.ownerId, m.enrollmentId, m.canonicalStamp, r.teaching_id, r.item_id, ...revisions]);
        current.add(publicationId);
        const existing = db.publications.find((p) => p.id === publicationId);
        if (existing && (key(existing) !== key(m) || existing.source.teachingId !== r.teaching_id || existing.source.itemId !== r.item_id)) fail4();
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
        if (db.publications.length > maxRows) fail4();
      }
    }
    db.publications = db.publications.filter((p) => p.ownerId !== ownerId || !rollout.allowsMember(p) || !rollout.admitsTeacher({ ownerId, current: true }, { current: true, ownerId: p.ownerId, classId: p.classId, teachingId: p.source.teachingId }) || current.has(p.id));
  };
}

// drafts/n88-student-portal/integrated-service.mjs
import { createHash as createHash10, randomUUID as randomUUID4 } from "node:crypto";

// drafts/n88-student-portal/class-credentials.mjs
import { Buffer as Buffer6 } from "node:buffer";
import { createHash as createHash8 } from "node:crypto";
var fail5 = () => {
  throw Error("n88_class_unavailable");
};
var hash3 = (value) => createHash8("sha256").update(JSON.stringify(value)).digest("hex");
var active3 = (m) => m.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var id6 = (value) => typeof value === "string" && value.length > 0 && value.length <= 240 && !value.includes("\0");
var requestId2 = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(value);
var version = (db, m) => Math.max(0, ...db.numericCredentials.filter((c) => c.ownerId === m.ownerId && c.studentId === m.studentId).map((c) => c.version));
var live = (db, m) => db.numericCredentials.some((c) => c.ownerId === m.ownerId && c.studentId === m.studentId && c.revokedAt === null);
var result = (status, body) => ({ status, body, headers: { ...PRIVATE_HEADERS } });
var denied = () => result(401, { error: "unavailable" });
var replay = (receipt2) => receipt2.results.map((r) => r.status === "created" ? { ...r, status: "uncertain", recovery: "refresh_current_roster" } : { ...r });
var summary = (rows) => Object.fromEntries(["created", "skipped", "failed", "uncertain"].map((s) => [s, rows.filter((r) => r.status === s).length]));
function createClassCredentialOperations({ repository, verifyTeacher, verifyIngress, origin, resolveClass, issueMember, rotateMember, revokeMember, rollout = createRolloutGuard() }) {
  if (!repository?.transaction || [verifyTeacher, verifyIngress, resolveClass, issueMember, rotateMember, revokeMember].some((f) => typeof f !== "function") || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail5();
  return Object.freeze({ forRequest(request) {
    async function run(action, teachingId, input = {}) {
      try {
        return await repository.transaction(async (db, ports) => {
          const ingress = await verifyIngress(request, ports), headers = request.headers || {};
          if (!ingress?.clientKey || headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin" || action === "list" && request.method !== "GET" || action !== "list" && (request.method !== "POST" || headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true || !rollout.allowsOwner(auth.ownerId) || typeof ports?.synchronizeOwner !== "function") return denied();
          const scope2 = await resolveClass(db, ports, auth, teachingId, input);
          if (!scope2 || scope2.ownerId !== auth.ownerId || scope2.current !== true || !id6(scope2.teachingId) || !id6(scope2.classId) || !id6(scope2.revision)) return denied();
          if (teachingId !== null && scope2.teachingId !== teachingId) return denied();
          if (!rollout.admitsTeacher(auth, scope2)) return denied();
          await ports.synchronizeOwner(auth.ownerId);
          const members = db.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === scope2.classId && active3(m) && rollout.admitsStudent(m));
          if (members.length > 2e3 || new Set(members.map((m) => m.studentId)).size !== members.length) return denied();
          if (members.some((m) => db.memberships.filter((x) => x.ownerId === m.ownerId && x.studentId === m.studentId && active3(x)).length !== 1)) return denied();
          members.sort((a, b) => a.studentId.localeCompare(b.studentId));
          const rosterRevision = hash3([scope2.teachingId, scope2.revision, members.map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          if (action === "list") return result(200, { teachingId: scope2.teachingId, rosterRevision, students: members.map((m) => ({
            studentId: m.studentId,
            enrollmentId: m.enrollmentId,
            revision: m.revision,
            label: m.label,
            credentialVersion: version(db, m),
            hasActiveCredential: live(db, m)
          })) });
          if (!requestId2(input.requestId)) return denied();
          if (input.expectedCredentialRevision !== void 0 && !/^[a-f0-9]{64}$/.test(input.expectedCredentialRevision)) return denied();
          const binding = hash3([action, scope2.teachingId, input.expectedRosterRevision ?? null, input.studentId ?? null, input.enrollmentId ?? null, input.revision ?? null, input.credentialVersion ?? null, ...input.expectedCredentialRevision === void 0 ? [] : [input.expectedCredentialRevision]]);
          const prior = db.classReceipts.find((r) => r.ownerId === auth.ownerId && r.requestId === input.requestId);
          if (prior) {
            if (!prior.results.every((r) => members.some((m) => m.studentId === r.studentId && m.enrollmentId === r.enrollmentId))) return denied();
            if (prior.binding !== binding) return result(409, { error: "stale_request" });
            const rows2 = replay(prior);
            return result(200, { requestId: input.requestId, replayed: true, results: rows2, counts: summary(rows2) });
          }
          if (db.classReceipts.length >= 1e4) fail5();
          if (action === "batch" && (input.expectedRosterRevision !== rosterRevision || input.expectedCredentialRevision !== void 0 && input.expectedCredentialRevision !== credentialStateRevision(db, members))) return result(409, { error: "roster_changed" });
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
                if (issued?.revoked !== true || live(db, m)) fail5();
                rows.push({ ...base, status: "skipped", reason: "revoked" });
              } else {
                if (!/^1[0-9]{5}$/.test(issued?.code || "") || issued.credentialVersion !== expectedVersion + 1 || !live(db, m)) fail5();
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
    if (!id6(requested) || typeof ports?.query !== "function") return null;
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
    if (teachingId === null && !db.memberships.some((m) => m.ownerId === auth.ownerId && m.classId === t.section_id && m.studentId === input.studentId && m.enrollmentId === input.enrollmentId && active3(m))) return null;
    return { ownerId: auth.ownerId, classId: t.section_id, teachingId: t.id, current: true, revision: hash3([t.teaching_revision, t.term_revision]) };
  };
}
function withCredentialRepository(repository, { maxRows = 1e4, maxBytes = 4 * 1024 * 1024 } = {}) {
  if (!repository?.transaction || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1e4 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) fail5();
  const tables3 = { numericCredentials: "numeric_credentials", numericSessions: "numeric_sessions", numericRates: "numeric_rates", numericAttempts: "numeric_attempts", classReceipts: "class_credential_receipts" };
  const proofs = /* @__PURE__ */ new WeakSet();
  const api = {
    // Existing global advisory lock + fenced COMMIT, without credential reads.
    claimAttempt: (action) => repository.transaction(async (_db, ports) => {
      const state = {}, original = {};
      let bytes2 = 0;
      for (const [name, table] of [["numericRates", "numeric_rates"], ["numericAttempts", "numeric_attempts"]]) {
        const r = await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`, [maxRows + 1, maxBytes - bytes2]);
        if (r.rows.length > maxRows) fail5();
        state[name] = r.rows.map(({ payload }) => {
          if (!payload) fail5();
          bytes2 += Buffer6.byteLength(JSON.stringify(payload));
          if (bytes2 > maxBytes) fail5();
          return payload;
        });
        original[name] = structuredClone(state[name]);
      }
      const allowed = await action(state, ports);
      bytes2 = 0;
      for (const [name, table] of [["numericRates", "numeric_rates"], ["numericAttempts", "numeric_attempts"]]) {
        if (state[name].length > maxRows) fail5();
        const pk2 = (r) => name === "numericRates" ? r.key : r.id;
        const after = new Map(state[name].map((r) => [pk2(r), r]));
        if (after.size !== state[name].length) fail5();
        const before = new Map(original[name].map((r) => [pk2(r), r]));
        for (const row of original[name]) if (!after.has(pk2(row))) {
          if ((await ports.query(`delete from n88_private.${table} where row_key=$1`, [pk2(row)])).rowCount !== 1) fail5();
        }
        for (const row of state[name]) {
          bytes2 += Buffer6.byteLength(JSON.stringify(row));
          if (bytes2 > maxBytes) fail5();
          if (before.has(pk2(row)) && JSON.stringify(before.get(pk2(row))) === JSON.stringify(row)) continue;
          if ((await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload`, [pk2(row), JSON.stringify(row)])).rowCount !== 1) fail5();
        }
      }
      return allowed;
    }),
    commitAttemptSession: async (id9, action) => {
      const committed = await api.transaction(async (db, ports) => {
        const a = db.numericAttempts.find((a2) => a2.id === id9);
        if (!a || a.sessionId !== null || a.settled) fail5();
        const before = new Set(db.numericSessions.map((s) => s.id));
        const value = await action(db, ports);
        const fresh = db.numericSessions.filter((s) => !before.has(s.id));
        if (fresh.length > 1) fail5();
        if (fresh.length === 1) {
          if (fresh[0].revokedAt !== null) fail5();
          a.sessionId = fresh[0].id;
        }
        return { value, receipt: fresh.length ? structuredClone(a) : null };
      });
      const proof = committed.receipt ? Object.freeze(committed.receipt) : null;
      if (proof) proofs.add(proof);
      return { value: committed.value, proof };
    },
    settleAttempt: async (proof, time3) => {
      if (!proof || !proofs.has(proof) || !Number.isSafeInteger(time3)) return false;
      return api.transaction(async (db) => {
        const a = db.numericAttempts.find((a2) => a2.id === proof.id);
        if (!a || a.settled || a.until <= time3 || JSON.stringify(a) !== JSON.stringify(proof) || !db.numericSessions.some((s) => s.id === a.sessionId)) return false;
        const buckets = a.buckets.map((b) => db.numericRates.find((r) => r.key === b.key && r.epoch === b.epoch && r.until === b.until && r.until > time3));
        if (buckets.length !== 2 || new Set(buckets).size !== 2 || buckets.some((b) => !b || b.count < 1)) return false;
        for (const b of buckets) b.count--;
        a.settled = true;
        return true;
      });
    },
    transaction: (action) => repository.transaction(async (db, ports) => {
      if (typeof ports?.query !== "function") fail5();
      const extra = {}, original = {};
      let bytes2 = 0;
      for (const [name, table] of Object.entries(tables3)) {
        const r = await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`, [maxRows + 1, maxBytes - bytes2]);
        if (r.rows.length > maxRows) fail5();
        extra[name] = r.rows.map((r2) => {
          if (!r2.payload) fail5();
          bytes2 += Buffer6.byteLength(JSON.stringify(r2.payload));
          if (bytes2 > maxBytes) fail5();
          return r2.payload;
        });
        original[name] = structuredClone(extra[name]);
      }
      const state = new Proxy(extra, { get: (o, k) => k in tables3 ? o[k] : db[k], set: (o, k, v) => {
        if (k in tables3) o[k] = v;
        else db[k] = v;
        return true;
      } });
      const value = await action(state, ports);
      bytes2 = 0;
      for (const [name, table] of Object.entries(tables3)) {
        if (extra[name].length > maxRows) fail5();
        const pk2 = (r) => name === "classReceipts" ? JSON.stringify([r.ownerId, r.requestId]) : name === "numericRates" ? r.key : r.id;
        const before = new Map(original[name].map((r) => [pk2(r), r])), after = new Map(extra[name].map((r) => [pk2(r), r]));
        if (after.size !== extra[name].length) fail5();
        for (const [key3, row] of before) if (!after.has(key3)) {
          if (name === "numericCredentials" || name === "classReceipts") fail5();
          if ((await ports.query(`delete from n88_private.${table} where row_key=$1`, [key3])).rowCount !== 1) fail5();
        }
        for (const [key3, row] of after) {
          bytes2 += Buffer6.byteLength(JSON.stringify(row));
          if (bytes2 > maxBytes) fail5();
          if (before.has(key3) && JSON.stringify(before.get(key3)) === JSON.stringify(row)) continue;
          const ack = before.has(key3) ? await ports.query(`update n88_private.${table} set payload=$2::jsonb where row_key=$1`, [key3, JSON.stringify(row)]) : await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb)`, [key3, JSON.stringify(row)]);
          if (ack.rowCount !== 1) fail5();
        }
      }
      return value;
    })
  };
  return Object.freeze(api);
}

// drafts/n88-student-portal/code-recovery.mjs
import { Buffer as Buffer7 } from "node:buffer";
import { randomBytes as randomBytes2, randomUUID as randomUUID2, createCipheriv, createDecipheriv } from "node:crypto";
var fail6 = () => {
  throw Error("n88_recovery_unavailable");
};
var ver = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);
var exact7 = (o, ks) => o && Object.keys(o).length === ks.length && ks.every((k) => Object.hasOwn(o, k));
var fields = ["id", "credentialId", "generation", "envelopeVersion", "algorithm", "keyVersion", "nonce", "ciphertext", "tag"];
function createCodeRecovery({ keys, activeKeyVersion, otherKeys = [] } = {}) {
  if (!(keys instanceof Map) || !keys.size || keys.size > 8 || !ver(activeKeyVersion) || !keys.has(activeKeyVersion) || [...keys].some(([v, k]) => !ver(v) || !Buffer7.isBuffer(k) || k.length !== 32) || new Set([...keys.values()].map((k) => k.toString("hex"))).size !== keys.size || [...keys.values()].some((k) => otherKeys.some((o) => Buffer7.isBuffer(o) && k.equals(o)))) fail6();
  keys = new Map([...keys].map(([v, k]) => [v, Buffer7.from(k)]));
  const aad = (c, e) => Buffer7.from(JSON.stringify(["n88-code-recovery", e.id, e.envelopeVersion, e.algorithm, e.keyVersion, c.id, c.version, c.ownerId, c.studentId, c.format, e.generation]));
  function seal(c, code, generation = 1) {
    if (c.revokedAt !== null || c.format !== "six-v1" || !/^1[0-9]{5}$/.test(code) || !Number.isSafeInteger(generation) || generation < 1) fail6();
    const e = { id: randomUUID2(), credentialId: c.id, generation, envelopeVersion: 1, algorithm: "AES-256-GCM", keyVersion: activeKeyVersion, nonce: randomBytes2(12).toString("hex") };
    const cipher = createCipheriv("aes-256-gcm", keys.get(activeKeyVersion), Buffer7.from(e.nonce, "hex"), { authTagLength: 16 });
    cipher.setAAD(aad(c, e));
    e.ciphertext = Buffer7.concat([cipher.update(code, "ascii"), cipher.final()]).toString("hex");
    e.tag = cipher.getAuthTag().toString("hex");
    return e;
  }
  function open(c, e) {
    try {
      if (c.revokedAt !== null || c.format !== "six-v1" || !exact7(e, fields) || e.credentialId !== c.id || e.envelopeVersion !== 1 || e.algorithm !== "AES-256-GCM" || !keys.has(e.keyVersion) || !Number.isSafeInteger(e.generation) || e.generation < 1 || !/^[a-f0-9]{24}$/.test(e.nonce) || !/^[a-f0-9]{12}$/.test(e.ciphertext) || !/^[a-f0-9]{32}$/.test(e.tag)) fail6();
      const d = createDecipheriv("aes-256-gcm", keys.get(e.keyVersion), Buffer7.from(e.nonce, "hex"), { authTagLength: 16 });
      d.setAAD(aad(c, e));
      d.setAuthTag(Buffer7.from(e.tag, "hex"));
      const code = Buffer7.concat([d.update(Buffer7.from(e.ciphertext, "hex")), d.final()]).toString("ascii");
      if (!/^1[0-9]{5}$/.test(code)) fail6();
      return code;
    } catch {
      fail6();
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
    fail6();
  }
  async function rewrap(ports, c, expectedGeneration) {
    const r = await ports.query("select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1", [c.id]);
    if (r.rows.length !== 1 || r.rows[0].payload.generation !== expectedGeneration) fail6();
    await append(ports, c, open(c, r.rows[0].payload), expectedGeneration + 1);
  }
  return Object.freeze({ read, append, rewrap, seal, open });
}

// drafts/n88-student-portal/numeric-credentials.mjs
import { randomInt as randomInt2, randomBytes as randomBytes3, randomUUID as randomUUID3, createHmac as createHmac2, createHash as createHash9, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
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
var fail7 = () => {
  throw Error("n88_numeric_unavailable");
};
var active4 = (m) => m?.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
var identity = (a, b) => a.ownerId === b.ownerId && a.studentId === b.studentId;
var tokenHash = (token) => createHash9("sha256").update(token).digest("hex");
var cookie = (value, age) => `__Secure-n88-student=${value}; Path=/api/n88/student; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
var denied2 = () => ({ status: 401, body: { error: "unavailable" }, cookie: cookie("", 0) });
var response2 = (r) => ({ ...r, headers: { ...PRIVATE_HEADERS, ...r.cookie ? { "Set-Cookie": r.cookie } : {} } });
function createNumericCredentialOperations({
  keys,
  activeKeyVersion,
  reservationKey,
  now = Date.now,
  generate = generateNumericCredential,
  rollout = createRolloutGuard()
}) {
  if (!(keys instanceof Map) || !keys.size || !/^[A-Za-z0-9_-]{1,40}$/.test(activeKeyVersion || "") || !keys.has(activeKeyVersion) || !Buffer.isBuffer(reservationKey) || reservationKey.length < 32 || [...keys].some(([v, k]) => !/^[A-Za-z0-9_-]{1,40}$/.test(v) || !Buffer.isBuffer(k) || k.length < 32)) fail7();
  keys = new Map([...keys].map(([v, k]) => [v, Buffer.from(k)]));
  reservationKey = Buffer.from(reservationKey);
  const mac2 = (key3, domain, ...parts) => createHmac2("sha256", key3).update(JSON.stringify(["n88-numeric-v1", domain, ...parts])).digest("hex");
  const reservation = (code) => mac2(reservationKey, "global-reservation", code);
  const verifier = (code, c) => mac2(keys.get(c.keyVersion), "credential", c.ownerId, c.studentId, c.version, code);
  function current(db, c) {
    if (!db.contexts.some((x) => x.ownerId === c.ownerId && x.active === true)) return null;
    const members = db.memberships.filter((m) => identity(m, c) && active4(m));
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
    if (!rollout.admitsStudent(m)) fail7();
    const canonical2 = current(db, m);
    if (!canonical2 || canonical2.enrollmentId !== m.enrollmentId || canonical2.revision !== m.revision || canonical2.canonicalStamp !== m.canonicalStamp || version2(db, m) !== expectedVersion) fail7();
  }
  function issue(db, m, expectedVersion, { rotate = false } = {}) {
    check(db, m, expectedVersion);
    const previous = db.numericCredentials.filter((c2) => identity(c2, m) && c2.revokedAt === null);
    if (previous.length > 1 || previous.length && !rotate) fail7();
    if (!Number.isSafeInteger(expectedVersion + 1)) fail7();
    if (db.numericCredentials.filter((c2) => c2.format === CREDENTIAL_FORMAT).length >= CREDENTIAL_CAPACITY) fail7();
    let code, reserved;
    for (let attempt = 0; attempt < NUMERIC_POLICY.collisionBudget; attempt++) {
      code = generate();
      if (typeof code !== "string" || !/^1[0-9]{5}$/.test(code)) fail7();
      reserved = reservation(code);
      if (!db.numericCredentials.some((c2) => c2.reservation === reserved)) break;
      code = null;
    }
    if (!code) fail7();
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
    if (!repository?.transaction || typeof verifyIngress !== "function" || typeof project !== "function" || new URL(origin).origin !== origin || !origin.startsWith("https://")) fail7();
    return async (request) => {
      try {
        const claim = (request.path === "/student/claim" || request.path === "/api/n88/student/claim") && request.method === "POST";
        let attempt;
        if (claim) {
          if (typeof repository.claimAttempt !== "function" || typeof repository.commitAttemptSession !== "function" || typeof repository.settleAttempt !== "function") return response2(denied2());
          attempt = await repository.claimAttempt(async (db, ports) => {
            const ingress = await verifyIngress(request, ports);
            if (!ingress?.clientKey) return false;
            const time3 = now();
            db.numericRates = db.numericRates.filter((r) => r.until > time3);
            db.numericAttempts = db.numericAttempts.filter((a2) => a2.until > time3);
            const source = mac2(reservationKey, "client-rate", ingress.clientKey);
            const get = (key3, max) => {
              let b = db.numericRates.find((b2) => b2.key === key3);
              if (!b && db.numericRates.length < NUMERIC_POLICY.maxRateKeys) db.numericRates.push(b = { key: key3, count: 0, until: time3 + NUMERIC_POLICY.windowMs, epoch: randomUUID3() });
              if (b && !b.epoch) b.epoch = randomUUID3();
              return b;
            };
            let blocked = false;
            for (const [key3, max] of [[mac2(reservationKey, "source-flood", ingress.clientKey), NUMERIC_POLICY.sourceRequests], [mac2(reservationKey, "global-flood"), NUMERIC_POLICY.globalRequests]]) {
              const b = get(key3, max);
              if (!b || b.count >= max) blocked = true;
              if (b) b.count = Math.min(max, b.count + 1);
            }
            if (blocked) return null;
            const budgets = [[source, NUMERIC_POLICY.clientAttempts], ["global", NUMERIC_POLICY.globalAttempts]], buckets = [];
            for (const [key3, max] of budgets) {
              const b = get(key3, max);
              if (!b || b.count >= max) blocked = true;
              if (b) buckets.push(b);
            }
            if (blocked || db.numericAttempts.length >= NUMERIC_POLICY.maxAttempts) return null;
            for (const b of buckets) b.count++;
            const a = {
              id: randomUUID3(),
              buckets: buckets.map(({ key: key3, epoch, until }) => ({ key: key3, epoch, until })),
              until: Math.max(...buckets.map((b) => b.until)),
              sessionId: null,
              settled: false
            };
            db.numericAttempts.push(a);
            return a.id;
          });
          if (!attempt) return response2(denied2());
        }
        const authenticate = async (db, ports) => {
          const ingress = claim ? { clientKey: "prepaid" } : await verifyIngress(request, ports);
          const { headers = {}, method, body = {} } = request;
          const path = request.path.startsWith("/student/") ? "/api/n88" + request.path : request.path;
          if (!ingress?.clientKey || headers["sec-fetch-site"] && headers["sec-fetch-site"] !== "same-origin" || method === "POST" && (headers.origin !== origin || headers["x-n88-csrf"] !== "1" || headers["content-type"] !== "application/json")) return denied2();
          const time3 = now();
          const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || "")?.[1];
          if (path === "/api/n88/student/claim" && method === "POST") {
            const code = normalizeNumericCredential(body.code);
            if (!code) return denied2();
            const c2 = db.numericCredentials.find((c3) => c3.reservation === reservation(code));
            if (!c2 || c2.revokedAt !== null || !keys.has(c2.keyVersion) || !/^[a-f0-9]{64}$/.test(c2.verifier) || !timingSafeEqual2(Buffer.from(c2.verifier, "hex"), Buffer.from(verifier(code, c2), "hex"))) return denied2();
            if (typeof ports?.synchronizeOwner !== "function") fail7();
            if (!rollout.allowsOwner(c2.ownerId) || !db.memberships.some((m3) => identity(m3, c2) && rollout.allowsMember(m3))) return denied2();
            await ports.synchronizeOwner(c2.ownerId);
            const m2 = current(db, c2);
            if (!m2 || !rollout.admitsStudent(m2)) return denied2();
            if (token) {
              for (const s2 of db.numericSessions) if (s2.tokenHash === tokenHash(token) && rollout.allowsMember(s2)) s2.revokedAt = time3;
            }
            const fresh = randomBytes3(32).toString("base64url");
            db.numericSessions = db.numericSessions.filter((s2) => !rollout.allowsMember(s2) || s2.expiresAt > time3 && s2.revokedAt === null);
            if (db.numericSessions.length >= 1e4) fail7();
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
              expiresAt: time3 + NUMERIC_POLICY.sessionMs,
              revokedAt: null
            });
            return { status: 200, body: { claimed: true }, cookie: cookie(fresh, NUMERIC_POLICY.sessionMs / 1e3) };
          }
          const s = token && db.numericSessions.find((s2) => s2.tokenHash === tokenHash(token));
          if (s && !rollout.allowsMember(s)) return denied2();
          if (path === "/api/n88/student/end" && method === "POST") {
            if (s) s.revokedAt = time3;
            return { status: 200, body: { ended: true }, cookie: cookie("", 0) };
          }
          if (path !== "/api/n88/student/read" || method !== "GET" || !s || s.revokedAt !== null || s.expiresAt <= time3) return denied2();
          const c = db.numericCredentials.find((c2) => c2.id === s.credentialId && identity(c2, s) && c2.version === s.version && c2.revokedAt === null);
          if (!c) return denied2();
          if (typeof ports?.synchronizeOwner !== "function") fail7();
          await ports.synchronizeOwner(c.ownerId);
          const m = current(db, c);
          if (!rollout.admitsStudent(m)) return denied2();
          if (!m || m.enrollmentId !== s.enrollmentId || m.classId !== s.classId || m.revision !== s.membershipRevision || m.canonicalStamp !== s.canonicalStamp) {
            s.revokedAt = time3;
            return denied2();
          }
          return { status: 200, body: await project(db, m, ports), readPhaseDiagnostic: true };
        };
        if (!claim) return response2(await repository.transaction(authenticate));
        const committed = await repository.commitAttemptSession(attempt, authenticate);
        if (committed.proof) {
          try {
            await repository.settleAttempt(committed.proof, now());
          } catch {
          }
        }
        return response2(committed.value);
      } catch {
        return response2(denied2());
      }
    };
  }
  return Object.freeze({ issueMember, rotateMember, revokeMember, createStudentHandler });
}

// drafts/n88-student-portal/integrated-service.mjs
var deny2 = () => ({ status: 401, body: { error: "unavailable" }, headers: PRIVATE_HEADERS });
var hash4 = (v) => createHash10("sha256").update(JSON.stringify(v)).digest("hex");
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
async function readCanonicalSerial(ports, ownerId, listScopeOnly = false) {
  await ports.query(listScopeOnly ? "select n88_private.lock_canonical_sources($1::uuid,$2::integer)" : "select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);
  const canonical2 = {};
  let bytes2 = 0;
  for (const table of listScopeOnly ? ["terms", "teachings"] : CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    const selected = columns[table].replace(/\brevision\b/g, "revision::text as revision");
    const r = await ports.query(`select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select ${selected} from rakeezx.${sqlNames[table] || table} where owner_id=$1::uuid order by id limit $2) x) bounded`, [ownerId, 2001, 2 * 1024 * 1024 - bytes2]);
    if (r.rows.length > 2e3) throw Error("n88_projection_bound");
    canonical2[table] = r.rows.map(({ payload }) => {
      if (typeof payload !== "string" || (bytes2 += Buffer.byteLength(payload)) > 2 * 1024 * 1024) throw Error("n88_projection_bound");
      const raw = JSON.parse(payload), row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [camel(k), v]));
      row.deleted = row.deletedAt !== null;
      for (const k of numeric) if (row[k] != null) row[k] = Number(row[k]);
      return row;
    });
  }
  return canonical2;
}
async function readCanonical(ports, ownerId, listScopeOnly = false) {
  const mode = ports.canonicalReadMode();
  if (mode === "serial") return readCanonicalSerial(ports, ownerId, listScopeOnly);
  if (mode !== "batch") throw Error("n88_database_unavailable");
  await ports.query(listScopeOnly ? "select n88_private.lock_canonical_sources($1::uuid,$2::integer)" : "select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);
  const names2 = listScopeOnly ? ["terms", "teachings"] : CANONICAL_PROJECTION_REQUIREMENTS.tables;
  const canonical2 = Object.fromEntries(names2.map((t) => [t, []]));
  let bytes2 = 0;
  const result2 = await ports.query(listScopeOnly ? "select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id" : 'select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 2 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=$1::uuid order by id limit $2) x union all select 3 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=$1::uuid order by id limit $2) x union all select 4 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=$1::uuid order by id limit $2) x union all select 5 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x union all select 6 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=$1::uuid order by id limit $2) x union all select 7 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=$1::uuid order by id limit $2) x union all select 8 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=$1::uuid order by id limit $2) x union all select 9 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=$1::uuid order by id limit $2) x union all select 10 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=$1::uuid order by id limit $2) x union all select 11 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=$1::uuid order by id limit $2) x union all select 12 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id', [ownerId, 2001, 2 * 1024 * 1024]);
  for (const { table_index, payload } of result2.rows) {
    const rows = canonical2[names2[table_index]];
    if (!Number.isInteger(table_index) || !rows || rows.length >= 2e3 || typeof payload !== "string" || (bytes2 += Buffer.byteLength(payload)) > 2 * 1024 * 1024) throw Error("n88_projection_bound");
    const row = Object.fromEntries(Object.entries(JSON.parse(payload)).map(([k, v]) => [camel(k), v]));
    row.deleted = row.deletedAt !== null;
    for (const k of numeric) if (row[k] != null) row[k] = Number(row[k]);
    rows.push(row);
  }
  return canonical2;
}
async function readGuidanceCanonical(ports, ownerId, classId, termId) {
  const names2 = CANONICAL_PROJECTION_REQUIREMENTS.tables;
  const canonical2 = Object.fromEntries(names2.map((t) => [t, []]));
  let bytes2 = 0;
  const result2 = await ports.query("select table_index,payload from n88_private.boundary_guidance_sources_v1($1::uuid,$2::text,$3::text)", [ownerId, classId, termId]);
  const seen = /* @__PURE__ */ new Set();
  for (const { table_index, payload } of result2.rows) {
    if (!Number.isInteger(table_index) || !canonical2[names2[table_index]] || typeof payload !== "string" || (bytes2 += Buffer.byteLength(payload)) > 2 * 1024 * 1024) throw Error("n88_projection_bound");
    const raw = JSON.parse(payload);
    if (!Array.isArray(raw) || seen.has(table_index) || raw.length > 2e3) throw Error("n88_projection_bound");
    seen.add(table_index);
    canonical2[names2[table_index]] = raw.map((r) => {
      const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v]));
      row.deleted = row.deletedAt !== null;
      for (const k of numeric) if (row[k] != null) row[k] = Number(row[k]);
      return row;
    });
  }
  if (seen.size !== names2.length) throw Error("n88_projection_bound");
  return canonical2;
}
var fieldsOff = () => Object.fromEntries(VISIBILITY_FIELDS.map((f) => [f, false]));
var bindingKeys2 = ["ownerId", "sessionId", "leaseId", "teachingId", "classId", "termId", "contextRevision"];
var classListResponseMode = (mode, protocol) => mode === "public" && protocol === void 0 ? "pilot" : mode;
function createStudentReadBoundary(createHandler, options) {
  const normal = createHandler(options);
  return async (request) => {
    if (request.method !== "GET" || !["/student/read", "/api/n88/student/read"].includes(request.path)) return normal(request);
    let repositoryFailed = false;
    const repository = { ...options.repository, transaction: async (action) => {
      try {
        return await options.repository.transaction(action);
      } catch {
        repositoryFailed = true;
        throw Error("n88_student_read_unavailable");
      }
    } };
    const result2 = await createHandler({ ...options, repository })(request);
    return repositoryFailed ? { status: 503, body: { error: "unavailable" }, headers: PRIVATE_HEADERS } : result2;
  };
}
function createIntegratedService(options, adapter, baseRepository) {
  const publicationV2 = createPublicationV2Service({
    ...options.publicationV2,
    executionMode: options.executionMode,
    enabled: options.publicationV2Enabled === true,
    origin: options.origin
  });
  const negativeTerminalEnabled = options.terminalResolutionEnabled === true;
  const scopedGuidanceEnabled = options.syntheticGuidanceClosureEnabled === true && options.executionMode === "synthetic";
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
  async function scope2(db, ports, auth, teachingId, input = {}, listScopeOnly = false, scopedGuidance = false) {
    const resolved = await createPgClassResolver()(db, ports, auth, teachingId, input);
    if (!resolved) return null;
    let canonical2 = await readCanonical(ports, auth.ownerId, scopedGuidance || listScopeOnly);
    const teaching = canonical2.teachings.find((t) => t.id === teachingId), term = canonical2.terms.find((t) => t.id === teaching?.termId);
    if (!teaching || !term || term.startDate && term.startDate > today() || term.endDate && term.endDate < today()) return null;
    if (scopedGuidance) {
      if (term.id !== input.binding?.termId) return null;
      canonical2 = await readGuidanceCanonical(ports, auth.ownerId, resolved.classId, term.id);
    }
    return { ...resolved, canonical: canonical2, termId: term.id };
  }
  const inputFor = (s, m) => ({ teacherContextVersion: "n88-canonical-teacher-context-v1", canonical: s.canonical, ownerId: s.ownerId, classId: s.classId, termId: s.termId, studentId: m.studentId, enrollmentId: m.enrollmentId, now: today() });
  async function policies(ports, ownerId, classId, termId) {
    const r = await ports.query("select payload from n88_private.class_visibility where owner_id=$1::uuid and class_id=$2 and term_id=$3", [ownerId, classId, termId]);
    return r.rows[0]?.payload || { revision: 0, fields: fieldsOff(), members: [] };
  }
  const student = createStudentReadBoundary(credentials.createStudentHandler, { repository, verifyIngress: adapter.verifyIngress, origin: options.origin, project: async (db, m, ports) => {
    const measure = ports.measure ?? (async (_name, action) => action());
    const canonical2 = await measure("canonical", () => readCanonical(ports, m.ownerId));
    const terms = canonical2.terms.filter((t) => !t.deleted && t.status === "active" && canonical2.teachings.some((x) => !x.deleted && x.sectionId === m.classId && x.termId === t.id));
    if (terms.length !== 1) throw Error("n88_current_term");
    const s = { ownerId: m.ownerId, classId: m.classId, termId: terms[0].id, canonical: canonical2 }, policy = await measure("visibility", () => policies(ports, m.ownerId, m.classId, s.termId));
    const stored = policy.members.find((p) => p.studentId === m.studentId && p.enrollmentId === m.enrollmentId);
    const taskGuidance = await measure("guidance", () => readTaskGuidance(ports, s));
    return measure("projection", () => projectStudentPortal({ ...inputFor(s, m), visibility: stored || null, taskGuidance }));
  } });
  return async (request) => {
    if (isPublicationV2Path(request.path)) return publicationV2(request);
    if (request.path.startsWith("/student/")) return student(request);
    const match = /^\/teacher\/class\/(list|issue-missing|rotate|revoke|visibility|guidance-list|guidance-save)$/.exec(request.path);
    if (!match || request.method !== "POST") return deny2();
    const action = match[1], body = request.body || {}, binding = body.binding;
    const terminalRequest = Object.hasOwn(body, "resolutionVersion") || Object.hasOwn(body, "resolution");
    if (terminalRequest && (!negativeTerminalEnabled || action !== "revoke" || body.resolutionVersion !== 1 || !["status", "close"].includes(body.resolution) || Object.keys(body).sort().join(",") !== "binding,expectedCredentialRevision,expectedRosterRevision,requestId,resolution,resolutionVersion,teachingId")) return deny2();
    if (action === "list" && body.uiProtocol !== void 0 && body.uiProtocol !== "n88-public-ui-v1") return deny2();
    if (!binding || Object.keys(binding).length !== bindingKeys2.length || !bindingKeys2.every((k) => typeof binding[k] === "string" && binding[k].length > 0 && binding[k].length <= 200) || binding.teachingId !== body.teachingId) return deny2();
    const verifyTeacher = async (r2, ports) => {
      const auth = await adapter.verifyTeacher(r2, ports);
      return auth?.ownerId === binding.ownerId && auth.sessionId === binding.sessionId ? auth : null;
    };
    const resolveClass = (db, ports, auth, teachingId, input) => scope2(db, ports, auth, teachingId ?? body.teachingId, input, ["list", "issue-missing", "rotate", "revoke"].includes(action), scopedGuidanceEnabled && action === "guidance-list").then((s) => {
      if (!s || s.classId !== binding.classId || s.termId !== binding.termId || !rollout.admitsTeacher(auth, s)) return null;
      if (!terminalRequest && ["pilot", "public"].includes(rollout.mode) && !db.contexts.some((c) => c.ownerId === auth.ownerId)) db.contexts.push({ namespace: (rollout.mode === "pilot" ? "n88_pilot_" : "n88_owner_") + randomUUID4(), ownerId: auth.ownerId, active: true });
      return s;
    });
    if (terminalRequest) {
      try {
        return await repository.transaction(async (db, ports) => {
          const h = request.headers || {}, ingress = await adapter.verifyIngress(request, ports);
          if (!ingress?.clientKey || h.origin !== options.origin || h["x-n88-csrf"] !== "1" || h["content-type"] !== "application/json" || h["sec-fetch-site"] && h["sec-fetch-site"] !== "same-origin" || typeof ports.beforeCommit !== "function") return deny2();
          const auth = await verifyTeacher(request, ports);
          if (!auth?.ownerId || !auth.sessionId || auth.current !== true || !rollout.allowsOwner(auth.ownerId)) return deny2();
          const s = await resolveClass(db, ports, auth, body.teachingId, body);
          if (!s) return deny2();
          const current2 = { contexts: structuredClone(db.contexts), memberships: structuredClone(db.memberships), sessions: [], publications: [] };
          await createCanonicalAdapter({ rollout })(current2, ports, auth.ownerId);
          const active7 = (m) => m.status === "active" && m.endDate === null && m.studentActive === true && m.classActive === true;
          const members = current2.memberships.filter((m) => m.ownerId === auth.ownerId && m.classId === s.classId && active7(m) && rollout.admitsStudent(m));
          if (members.length > 2e3 || new Set(members.map((m) => m.studentId)).size !== members.length || members.some((m) => current2.memberships.filter((x) => x.ownerId === m.ownerId && x.studentId === m.studentId && active7(x)).length !== 1)) return deny2();
          members.sort((a, b) => a.studentId.localeCompare(b.studentId));
          const rosterRevision = hash4([s.teachingId, s.revision, members.map((m) => [m.studentId, m.enrollmentId, m.revision, m.canonicalStamp])]);
          const data2 = cancelOriginalIntentTransaction(db, {
            ownerId: auth.ownerId,
            sessionId: auth.sessionId,
            current: true,
            teachingId: s.teachingId,
            classId: s.classId,
            termId: s.termId,
            members,
            rosterRevision,
            credentialRevision: credentialStateRevision(db, members)
          }, Object.fromEntries(
            ["requestId", "expectedRosterRevision", "expectedCredentialRevision"].map((k) => [k, body[k]])
          ), body.resolution);
          return { status: 200, body: { ack: true, binding, requestId: body.requestId, data: data2 }, headers: PRIVATE_HEADERS };
        });
      } catch {
        return { ...deny2(), status: 503 };
      }
    }
    const ops = createClassCredentialOperations({ rollout, repository, ...credentials, ...recovering, origin: options.origin, verifyIngress: adapter.verifyIngress, verifyTeacher, resolveClass });
    if (action === "visibility" || action === "list" || action.startsWith("guidance-")) {
      let stage = "repository";
      try {
        return await repository.transaction(async (db, ports) => {
          const h = request.headers || {};
          if (!await adapter.verifyIngress(request, ports) || h.origin !== options.origin || h["x-n88-csrf"] !== "1" || h["content-type"] !== "application/json" || h["sec-fetch-site"] && h["sec-fetch-site"] !== "same-origin") return deny2();
          stage = "teacher";
          const auth = await verifyTeacher(request, ports);
          if (!auth?.current || !rollout.allowsOwner(auth.ownerId)) return deny2();
          stage = "source";
          const s = await resolveClass(db, ports, auth, body.teachingId, body);
          if (!s) return deny2();
          stage = "synchronize";
          await ports.synchronizeOwner(auth.ownerId);
          stage = "projection";
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
          if (action === "list" && body.reconciliationVersion !== void 0) {
            if (body.reconciliationVersion !== 1) return deny2();
            data2.credentialRevision = credentialStateRevision(db, members);
            data2.reconciliation = reconcileIssuanceReceipts(db, s, members, body.reconcile ?? []);
            if (negativeTerminalEnabled && body.terminalResolutionVersion === 1)
              data2.terminalResolution = "n88-terminal-no-issuance-v1";
          }
          const responseMode = action === "list" ? classListResponseMode(rollout.mode, body.uiProtocol) : rollout.mode;
          return { status: 200, body: { ack: true, binding, requestId: body.requestId ?? null, data: data2, rollout: responseMode }, headers: PRIVATE_HEADERS };
        });
      } catch (e) {
        const phase = ["acquire", "begin", "snapshot"].includes(e.safeStage) ? e.safeStage : stage;
        return { ...deny2(), status: 503, body: { error: "unavailable", stage: phase } };
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
import { Buffer as Buffer9 } from "node:buffer";

// drafts/n88-student-portal/activation/read-service-20261023/typed-read-operations.json
var typed_read_operations_default = [
  {
    sql: 'select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 2 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=$1::uuid order by id limit $2) x union all select 3 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=$1::uuid order by id limit $2) x union all select 4 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=$1::uuid order by id limit $2) x union all select 5 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x union all select 6 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=$1::uuid order by id limit $2) x union all select 7 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=$1::uuid order by id limit $2) x union all select 8 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=$1::uuid order by id limit $2) x union all select 9 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=$1::uuid order by id limit $2) x union all select 10 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=$1::uuid order by id limit $2) x union all select 11 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=$1::uuid order by id limit $2) x union all select 12 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id',
    name: "boundary_9e3f889e8b1e375a0a980496",
    parameters: [
      "uuid",
      "bigint",
      "integer"
    ],
    output: [
      {
        name: "table_index",
        type: "integer",
        oid: 23
      },
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
    sql: "select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id",
    name: "boundary_3121e2df6802725969086adf",
    parameters: [
      "uuid",
      "bigint",
      "integer"
    ],
    output: [
      {
        name: "table_index",
        type: "integer",
        oid: 23
      },
      {
        name: "payload",
        type: "text",
        oid: 25
      }
    ],
    effect: false,
    voidResult: false,
    command: "SELECT"
  }
];

// drafts/n88-student-portal/activation/read-service-20261023/typed-identities.json
var typed_identities_default = [
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
    name: "boundary_3121e2df6802725969086adf",
    definition: "85c759eddc12f862b88fea693762db33e1bb22b0b49fbfcfbca5d4a86fb82cb5",
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
    name: "boundary_9e3f889e8b1e375a0a980496",
    definition: "db26298dae922e9ae1e606a63d70b496439055a5133253247c74e8ac57ce0a08",
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

// drafts/n88-student-portal/activation/v2-external-plan-1028/read-authority.json
var read_authority_default = {
  version: 1,
  productId: "N88",
  taskId: "n88-authorized-read-preflight-1028",
  runId: "6c91874c-cfc8-4e2f-88e4-2e084980210a",
  authorityRef: "po-20261028-n88-read-authority/authority.json",
  evidencePath: "C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-20261028-n88-read-authority/authority.json",
  evidenceSha256: "117927aeb8b003e31d662f76e1659b1b4784b2fac638166efc50d4987e952281",
  approved: true,
  approvedAt: "2026-10-28T20:46:51.023Z",
  scope: "nine-exact-read-only-metadata-statements",
  projectRef: "xlrubcwjqktzzunrvuns",
  provider: {
    tool: "Supabase.get_project",
    observedAt: "2026-10-28T20:50:15.441Z",
    projectRef: "xlrubcwjqktzzunrvuns",
    status: "ACTIVE_HEALTHY",
    region: "ap-south-1",
    databaseHost: "db.xlrubcwjqktzzunrvuns.supabase.co",
    databaseVersion: "17.6.1.166",
    postgresEngine: "17"
  },
  providerEvidenceSha256: "0f93c24c07c46b188d1f4d4bed44e3e662f0db09072bca55c2eabb788afa6e56",
  phaseDeadline: "2026-10-28T22:38:35.817Z",
  maxDurationMs: 12e4,
  queryPlanSha256: "fda7e7fdb72b79a80b4e33c4c0aef29da41c3a2aa60ccb27e849af744b74181b",
  installationAuthorized: false,
  allowIdentityDiscovery: true,
  operations: [
    {
      id: "target-identity",
      sql: "select current_database() as database_name,(select oid::text from pg_database where datname=current_database()) as database_oid,current_user::text as current_role,session_user::text as session_role,host(inet_server_addr()) as server_address,inet_server_port() as server_port,current_setting('server_version_num') as server_version_num,(pg_control_system()).system_identifier::text as system_identifier",
      sha256: "06e7a2bc647807b361ff0e5ec6a0bad3f341efc0dccc7159662e0eb16a9c7773",
      maxRows: 1,
      maxBytes: 8192
    },
    {
      id: "roles-and-memberships",
      sql: "select r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin,r.rolcreatedb,r.rolcreaterole,(select jsonb_agg(jsonb_build_object('role',p.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname) from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid) as memberships from pg_roles r where r.rolname in ('postgres','supabase_auth_admin','n88_backend','n88_guard','n88_v2_runtime','n88_v2_guard','anon','authenticated') order by r.rolname limit 9",
      sha256: "c11726020aec75969838a93bdcd26c0d02063f374e5bfe75636f58ff1250ecca",
      maxRows: 8,
      maxBytes: 32768
    },
    {
      id: "relation-identity",
      sql: "select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65",
      sha256: "1c4ce0241aa019e7d8c64a4e9064f78a82d935e2a078a8d9b803a0633a763950",
      maxRows: 64,
      maxBytes: 65536
    },
    {
      id: "constraints-columns-policies",
      sql: "select n.nspname,c.relname,(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,(select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable) order by k.conname) from pg_constraint k where k.conrelid=c.oid) as constraints,(select jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles::text,'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65",
      sha256: "c1c774c43129c8be23491337e28e46e264052b35cdaf7ff40192a5c7f13889cb",
      maxRows: 64,
      maxBytes: 524288
    },
    {
      id: "function-and-trigger-identity",
      sql: "select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and (p.proname in ('lock_current_session','lock_owner_key','lock_canonical_sources','lock_projection_sources','publication_v2_exact','publication_v2_scope','publication_v2_flags','publication_v2_manual','publication_v2_transition','publication_v2_retire_source') or p.proname in ('v2_0dad27a56bfdc5bfab552235','v2_23ccfc1e16cd0b122d0cb3c3','v2_3b143936c792a16ff5425c3d','v2_5d62e77b02ab6a1fb4e97688','v2_6d27c8049efec0665b9d1f91','v2_71a3e914da47cf1053850671','v2_74c4aa4d430911e99002af80','v2_7874a827dae2373223bc8adc','v2_94bb23dac56c2e002713130a','v2_a3e6d95cdff2d66f56ae84f6','v2_dbe074dae923ca8a3746d390','v2_e1b1c0927f6164faeccb760b','v2_f46afed1e023d013cdabf257','v2_f8a1689cd78951d7fc52ef91')) or n.nspname='rakeezx' and p.proname in ('apply_sync_v2_mutation','sync_v2_stamp_revision') order by n.nspname,p.proname,arguments limit 65",
      sha256: "089b41040ea77a109acc22f77d81cf29c1eb21faaa55d29f005c810485df5dec",
      maxRows: 64,
      maxBytes: 65536
    },
    {
      id: "trigger-and-index-identity",
      sql: "select n.nspname,c.relname,t.tgname as name,'trigger'::text as kind,pg_get_triggerdef(t.oid) as definition,t.tgenabled::text as enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts'))) union all select n.nspname,c.relname,i.relname as name,'index'::text as kind,pg_get_indexdef(i.oid) as definition,null::text as enabled from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) order by nspname,relname,name limit 257",
      sha256: "fe462bd8f0a8b38908aca24d904837e2f23458c145291ce89d26f643c0a8b8bc",
      maxRows: 256,
      maxBytes: 262144
    },
    {
      id: "effective-table-privileges",
      sql: "select n.nspname,c.relname,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') as table_select,has_any_column_privilege(r.oid,c.oid,'SELECT') as column_select,has_table_privilege(r.oid,c.oid,'INSERT') as insert,has_table_privilege(r.oid,c.oid,'UPDATE') as update,has_any_column_privilege(r.oid,c.oid,'UPDATE') as column_update,has_table_privilege(r.oid,c.oid,'DELETE') as delete,has_table_privilege(r.oid,c.oid,'TRUNCATE') as truncate from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r where r.rolname in ('n88_v2_guard','n88_v2_runtime','anon','authenticated') and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions'))) order by n.nspname,c.relname,r.rolname limit 129",
      sha256: "da7fbb557b64ab7946acd1d41ce00f6d437526f7f104afd875d8061690338265",
      maxRows: 128,
      maxBytes: 131072
    },
    {
      id: "exposure-and-effective-privileges",
      sql: "select n.nspname,pg_get_userbyid(n.nspowner) as owner,n.nspacl::text as acl,has_schema_privilege('anon',n.oid,'USAGE') as anon_usage,has_schema_privilege('authenticated',n.oid,'USAGE') as authenticated_usage,current_setting('pgrst.db_schemas',true) as configured_api_schemas from pg_namespace n where n.nspname in ('n88_private','rakeezx','auth') order by n.nspname limit 4",
      sha256: "2ed736aeec2a50344553d29957fa2bb723531ac4266c978096471d9a8e25cea1",
      maxRows: 3,
      maxBytes: 16384
    },
    {
      id: "baseline-inventory-digest",
      sql: "select encode(sha256(convert_to(jsonb_build_object('roles-and-memberships',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin,r.rolcreatedb,r.rolcreaterole,(select jsonb_agg(jsonb_build_object('role',p.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname) from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid) as memberships from pg_roles r where r.rolname in ('postgres','supabase_auth_admin','n88_backend','n88_guard','n88_v2_runtime','n88_v2_guard','anon','authenticated') order by r.rolname limit 9) q),'relation-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65) q),'constraints-columns-policies',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,(select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable) order by k.conname) from pg_constraint k where k.conrelid=c.oid) as constraints,(select jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles::text,'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65) q),'function-and-trigger-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and (p.proname in ('lock_current_session','lock_owner_key','lock_canonical_sources','lock_projection_sources','publication_v2_exact','publication_v2_scope','publication_v2_flags','publication_v2_manual','publication_v2_transition','publication_v2_retire_source') or p.proname in ('v2_0dad27a56bfdc5bfab552235','v2_23ccfc1e16cd0b122d0cb3c3','v2_3b143936c792a16ff5425c3d','v2_5d62e77b02ab6a1fb4e97688','v2_6d27c8049efec0665b9d1f91','v2_71a3e914da47cf1053850671','v2_74c4aa4d430911e99002af80','v2_7874a827dae2373223bc8adc','v2_94bb23dac56c2e002713130a','v2_a3e6d95cdff2d66f56ae84f6','v2_dbe074dae923ca8a3746d390','v2_e1b1c0927f6164faeccb760b','v2_f46afed1e023d013cdabf257','v2_f8a1689cd78951d7fc52ef91')) or n.nspname='rakeezx' and p.proname in ('apply_sync_v2_mutation','sync_v2_stamp_revision') order by n.nspname,p.proname,arguments limit 65) q),'trigger-and-index-identity',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,t.tgname as name,'trigger'::text as kind,pg_get_triggerdef(t.oid) as definition,t.tgenabled::text as enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts'))) union all select n.nspname,c.relname,i.relname as name,'index'::text as kind,pg_get_indexdef(i.oid) as definition,null::text as enabled from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) order by nspname,relname,name limit 257) q),'effective-table-privileges',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (select n.nspname,c.relname,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') as table_select,has_any_column_privilege(r.oid,c.oid,'SELECT') as column_select,has_table_privilege(r.oid,c.oid,'INSERT') as insert,has_table_privilege(r.oid,c.oid,'UPDATE') as update,has_any_column_privilege(r.oid,c.oid,'UPDATE') as column_update,has_table_privilege(r.oid,c.oid,'DELETE') as delete,has_table_privilege(r.oid,c.oid,'TRUNCATE') as truncate from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r where r.rolname in ('n88_v2_guard','n88_v2_runtime','anon','authenticated') and ((n.nspname='n88_private' and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')) or (n.nspname='rakeezx' and c.relname in ('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')) or (n.nspname='auth' and c.relname in ('users','sessions'))) order by n.nspname,c.relname,r.rolname limit 129) q))::text,'UTF8')),'hex') as sha256",
      sha256: "9f6a6058d1259c3ee00f62c376714cfcc5aec813cb3b87f29e74603dd9d1edee",
      maxRows: 1,
      maxBytes: 1024
    }
  ],
  readback: {
    state: "READ_ONLY_COMPLETE",
    reportPath: "artifacts/n88-authorized-read-preflight-1028-6c91874c-cfc8-4e2f-88e4-2e084980210a.tmp/report.json",
    reportSha256: "7091f6d661c363a2b644005de89d61300acc6ca5dee35001f60f404a59698553",
    recordedAt: "2026-10-28T21:15:00.940Z",
    tool: "Supabase.execute_sql",
    connectionPlane: "original-supported-custodian-management-metadata; not application-backend health proof",
    actualDatabaseIdentity: {
      database_name: "postgres",
      database_oid: "5",
      current_role: "postgres",
      session_role: "postgres",
      server_address: "2406:da1a:314:7102:b56b:ec54:38ab:5060",
      server_port: 5432,
      server_version_num: "170006",
      system_identifier: "7678071634733212629"
    },
    boundaryMode: "batch",
    queries: [
      {
        id: "target-identity",
        rows: 1,
        sha256: "7bb2c77b31a7e42b79f66112eea7e0b04e0ceabc5d808df9fe799f8ddc374e36"
      },
      {
        id: "roles-and-memberships",
        rows: 6,
        sha256: "6d52e79dc1384fd0ca0023292a32b7f4ac8385b3ca9bde45f9a324dab36cf73a"
      },
      {
        id: "relation-identity",
        rows: 19,
        sha256: "df54b0cd740e1b63254b2b46b35e342f443b36bc597594a5256ca7e6950aa33e"
      },
      {
        id: "constraints-columns-policies",
        rows: 19,
        sha256: "61c05cca3003bab16973f817940909d55fbf7e0b0ed1f8f52b5c9064d96671fa"
      },
      {
        id: "function-and-trigger-identity",
        rows: 6,
        sha256: "51e86d791eac3c09ac9e448c6c327965d99f7ee92a7160d5c9fb7f6d6263bcac"
      },
      {
        id: "trigger-and-index-identity",
        rows: 173,
        sha256: "5515fdc569f83c906f821c2445176d447423bcf51c4e0a849fff5d9010c70008"
      },
      {
        id: "effective-table-privileges",
        rows: 38,
        sha256: "940f407007f30f1e72bcab04401c88889449dacfaec6184f1a3d41b6f36acc65"
      },
      {
        id: "exposure-and-effective-privileges",
        rows: 3,
        sha256: "18c1a5a24e2f851e5c9a6c346df39b0d7010d05d0b339440b29c02fae7077306"
      },
      {
        id: "baseline-inventory-digest",
        rows: 1,
        sha256: "ee639dc72298feb8328d2351ac6d0f888fedc0160b18a22101c5f202f353bef1"
      }
    ],
    baselineInventorySha256: "d5f9f0451c70076e67fc9adee68d672c2a42dc852a440b1995889a20db7b0b7f",
    roleReadback: [
      {
        name: "anon",
        superuser: false,
        bypassRls: false,
        login: false,
        inherit: true,
        createRole: false,
        createDb: false
      },
      {
        name: "authenticated",
        superuser: false,
        bypassRls: false,
        login: false,
        inherit: true,
        createRole: false,
        createDb: false
      },
      {
        name: "n88_backend",
        superuser: false,
        bypassRls: false,
        login: true,
        inherit: false,
        createRole: false,
        createDb: false
      },
      {
        name: "n88_guard",
        superuser: false,
        bypassRls: false,
        login: false,
        inherit: false,
        createRole: false,
        createDb: false
      },
      {
        name: "postgres",
        superuser: false,
        bypassRls: true,
        login: true,
        inherit: true,
        createRole: true,
        createDb: true
      },
      {
        name: "supabase_auth_admin",
        superuser: false,
        bypassRls: false,
        login: true,
        inherit: false,
        createRole: true,
        createDb: false
      }
    ],
    functionReadback: [
      {
        nspname: "n88_private",
        proname: "lock_canonical_sources",
        arguments: "p_owner uuid, p_max integer",
        definition: "9f58e60276c6f1a55a4650e7a7cb3a9c7d788930c7bc75cf05f69828fc3b1f54",
        definer: true,
        owner: "n88_guard",
        proconfig: [
          "search_path=pg_catalog"
        ],
        acl: "{n88_guard=X/n88_guard,n88_backend=X/n88_guard}"
      },
      {
        nspname: "n88_private",
        proname: "lock_current_session",
        arguments: "p_user uuid, p_session uuid",
        definition: "bf8790087827a61f9ac0f805a2c5907b6fcd9ab2037d421fb99d1f239eb47317",
        definer: true,
        owner: "postgres",
        proconfig: [
          "search_path=pg_catalog"
        ],
        acl: "{postgres=X/postgres,n88_backend=X/postgres}"
      },
      {
        nspname: "n88_private",
        proname: "lock_owner_key",
        arguments: "p_owner uuid",
        definition: "67a6f790e195a27fe02d95b9bd50ba4a58fa061cc21064bc3c5d7048fd816f55",
        definer: true,
        owner: "postgres",
        proconfig: [
          "search_path=pg_catalog"
        ],
        acl: "{postgres=X/postgres,n88_guard=X/postgres}"
      },
      {
        nspname: "n88_private",
        proname: "lock_projection_sources",
        arguments: "p_owner uuid, p_max integer",
        definition: "544fbe7f5d6758b065a9e3fcfd127edd23e73c0fd521a9b434cc36a36b70bd37",
        definer: true,
        owner: "n88_guard",
        proconfig: [
          "search_path=pg_catalog"
        ],
        acl: "{n88_guard=X/n88_guard,n88_backend=X/n88_guard}"
      },
      {
        nspname: "rakeezx",
        proname: "apply_sync_v2_mutation",
        arguments: "p_entity text, p_record_id text, p_mutation_id text, p_device_id text, p_base_revision bigint, p_patch jsonb, p_operation text, p_client_updated_at bigint",
        definition: "76084d0bb32cad6751c2f02a7ed03269cba7be374c2f7248aef305f2b66bda11",
        definer: true,
        owner: "postgres",
        proconfig: [
          'search_path=""'
        ],
        acl: "{postgres=X/postgres,authenticated=X/postgres}"
      },
      {
        nspname: "rakeezx",
        proname: "sync_v2_stamp_revision",
        arguments: "",
        definition: "9413ec533e02d14661af75047b228d0f7eb1b2fa377a6ec14c32410d46d0b835",
        definer: false,
        owner: "postgres",
        proconfig: [
          'search_path=""'
        ],
        acl: null
      }
    ],
    relationReadback: [
      {
        schema: "auth",
        name: "sessions",
        owner: "supabase_auth_admin",
        rls: true,
        forceRls: false
      },
      {
        schema: "auth",
        name: "users",
        owner: "supabase_auth_admin",
        rls: true,
        forceRls: false
      },
      {
        schema: "n88_private",
        name: "contexts",
        owner: "postgres",
        rls: true,
        forceRls: false
      },
      {
        schema: "n88_private",
        name: "numeric_credentials",
        owner: "postgres",
        rls: true,
        forceRls: false
      },
      {
        schema: "n88_private",
        name: "numeric_sessions",
        owner: "postgres",
        rls: true,
        forceRls: false
      },
      {
        schema: "rakeezx",
        name: "attendance",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "enrollments",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "items",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "logs",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "score_subitem_completions",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "score_subitems",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "scores",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "sections",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "sessions",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "students",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "sync_mutation_receipts",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "teachings",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "terms",
        owner: "postgres",
        rls: true,
        forceRls: true
      },
      {
        schema: "rakeezx",
        name: "years",
        owner: "postgres",
        rls: true,
        forceRls: true
      }
    ],
    privateSchema: {
      nspname: "n88_private",
      owner: "postgres",
      acl: "{postgres=UC/postgres,n88_guard=U/postgres,n88_backend=U/postgres}",
      anon_usage: false,
      authenticated_usage: false,
      configured_api_schemas: null
    },
    newV2Objects: {
      relations: 0,
      roles: 0,
      fixedFunctions: 0,
      supportFunctions: 0
    },
    ownedCleanup: {
      disposed: true,
      processExited: true,
      relayFilesRemoved: true,
      integrationLease: "RELEASED"
    },
    installationAuthorized: false,
    harnessHistory: [
      {
        stage: "noninteractive-stdin",
        failure: "write_stdin failed: stdin is closed for this session; rerun exec_command with tty=true to keep stdin open",
        outcome: "local deadline; no nine-query metadata request dispatched; actual original catalog response preserved"
      },
      {
        stage: "PTY-relay",
        failure: "terminal wrapping duplicated characters in relayed SQL text; original role predicate was not byte-exact",
        outcome: "local deadline after identity and unreliable role result; role result discarded as proof; no service denial or writes; exact identity/catalog reused under same owned phase"
      },
      {
        stage: "owned-file-relay",
        correction: "queryIndex+hash token only; parent selected SQL from pinned authority.operations, never terminal text",
        outcome: "all nine original exact query results accepted, no SQL retries after real denial"
      }
    ]
  }
};

// drafts/n88-student-portal/activation/private-error-boundary.mjs
import { Buffer as Buffer8 } from "node:buffer";
import { createHash as createHash11 } from "node:crypto";

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
  },
  guidanceClosure: {
    version: 1,
    sourceOnly: true,
    operations: [
      {
        sql: "select table_index,payload from n88_private.boundary_guidance_sources_v1($1::uuid,$2::text,$3::text)",
        name: "boundary_fe813d4f5db3d68913a8d78d",
        parameters: [
          "uuid",
          "text",
          "text"
        ],
        output: [
          {
            name: "table_index",
            type: "integer",
            oid: 23
          },
          {
            name: "payload",
            type: "text",
            oid: 25
          }
        ],
        effect: false,
        voidResult: false,
        command: "SELECT"
      }
    ],
    identities: [
      {
        name: "boundary_fe813d4f5db3d68913a8d78d",
        definition: "966e9930febe3c973dc796bc44e1fb630309d70a831d9d9ddaf78d18591a6b8e",
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
        name: "boundary_guidance_sources_v1",
        definition: "ccb0d3dbbdc047e28c4d644a7cfea8f486697faf2b0618fad1eb877ac5ba469f",
        arguments: "p_owner uuid, p_class text, p_term text",
        definer: true,
        owner: "n88_guard",
        config: [
          "search_path=pg_catalog"
        ],
        acl: [
          "n88_backend:EXECUTE",
          "n88_guard:EXECUTE"
        ]
      }
    ],
    staging: {
      path: "drafts/n88-student-portal/guidance-closure.inactive.sql",
      sha256: "bce8f06b60a0a0bce7d93aa6c33e4b6306714bdc7815883f6c8be4c41d67e177"
    }
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
var fail8 = () => {
  throw Error("n88_database_unavailable");
};
var verified = /* @__PURE__ */ new WeakMap();
var guidanceVerified = /* @__PURE__ */ new WeakSet();
var guidanceOperations = new Map((error_boundary_contract_default.guidanceClosure?.operations ?? []).map((o) => [o.sql, o]));
var operations = new Map(error_boundary_contract_default.operations.map((o) => [o.sql, o]));
var controls = new Set(error_boundary_contract_default.controls);
var typedOperations = new Map([...error_boundary_contract_default.operations, ...typed_read_operations_default].map((o) => [o.sql, o]));
var metadataOperations = new Map(read_authority_default.operations.map((o) => [o.sql, o]));
var metadataReaders = /* @__PURE__ */ new WeakMap();
var metadataSpent = /* @__PURE__ */ new WeakSet();
var metadataKeys = [
  ["database_name", "database_oid", "current_role", "session_role", "server_address", "server_port", "server_version_num", "system_identifier"],
  ["rolname", "rolsuper", "rolbypassrls", "rolinherit", "rolcanlogin", "rolcreatedb", "rolcreaterole", "memberships"],
  ["nspname", "relname", "relkind", "owner", "relrowsecurity", "relforcerowsecurity", "acl"],
  ["nspname", "relname", "columns", "constraints", "policies"],
  ["nspname", "proname", "arguments", "definition", "definer", "owner", "proconfig", "acl"],
  ["nspname", "relname", "name", "kind", "definition", "enabled"],
  ["nspname", "relname", "rolname", "table_select", "column_select", "insert", "update", "column_update", "delete", "truncate"],
  ["nspname", "owner", "acl", "anon_usage", "authenticated_usage", "configured_api_schemas"],
  ["sha256"]
];
async function metadataRead(client, sql, values) {
  const scope2 = metadataReaders.get(client), op = metadataOperations.get(sql);
  try {
    if (!scope2 || Date.now() >= scope2.deadline || values.length !== 0 || read_authority_default.operations[scope2.position]?.sql !== sql) fail8();
    const keys = metadataKeys[scope2.position++];
    const r = await client.query(sql, []);
    if (metadataReaders.get(client) !== scope2 || Date.now() >= scope2.deadline || !r || r.command !== "SELECT" || !Array.isArray(r.rows) || r.rows.length > op.maxRows || r.rowCount !== r.rows.length || Buffer8.byteLength(JSON.stringify(r.rows)) > op.maxBytes || r.rows.some((row) => !row || Object.getPrototypeOf(row) !== Object.prototype || Object.keys(row).length !== keys.length || keys.some((k) => !Object.hasOwn(row, k)))) fail8();
    if (scope2.position === 9) metadataReaders.delete(client);
    return r;
  } catch (e) {
    metadataReaders.delete(client);
    const error = Error("n88_database_unavailable");
    error.metadataDenial = {
      queryId: op.id,
      sqlSha256: op.sha256,
      code: /^[A-Z0-9]{5}$/.test(e.code ?? "") ? e.code : null,
      custodianError: typeof e.custodianError === "string" ? e.custodianError.slice(0, 512) : null
    };
    throw error;
  }
}
var boundaryCatalogSql = `select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n88_private' and p.proname like 'boundary_%' order by p.proname`;
async function assertVerifiedBoundary(client) {
  verified.delete(client);
  guidanceVerified.delete(client);
  const r = await client.query(boundaryCatalogSql);
  if (error_boundary_identities_default.length !== 76 || operations.size !== 76 || typed_identities_default.length !== 78 || typedOperations.size !== 78) fail8();
  const extension = error_boundary_contract_default.guidanceClosure;
  const extensionNames = new Set((extension?.identities ?? []).map((r2) => r2.name));
  const extra = r.rows.filter((r2) => extensionNames.has(r2.name));
  if (extra.length) {
    if (extension?.sourceOnly !== true || extension.version !== 1 || guidanceOperations.size !== 1 || extra.length !== 2 || JSON.stringify(extra) !== JSON.stringify(extension.identities)) fail8();
    guidanceVerified.add(client);
  }
  const rows = JSON.stringify(r.rows.filter((r2) => !extensionNames.has(r2.name)));
  if (rows === JSON.stringify(error_boundary_identities_default)) verified.set(client, "serial");
  else if (rows === JSON.stringify(typed_identities_default)) verified.set(client, "batch");
  else fail8();
}
function verifiedBoundaryMode(client) {
  const mode = verified.get(client);
  if (!mode) fail8();
  return mode;
}
function pgText(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Buffer8.isBuffer(value)) return "\\x" + value.toString("hex");
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return "{" + value.map((v) => v === null ? "NULL" : Array.isArray(v) ? pgText(v) : '"' + pgText(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"').join(",") + "}";
  fail8();
}
async function privateQuery(client, sql, values = []) {
  if (!verified.has(client) || !Array.isArray(values)) {
    if (metadataSpent.has(client)) metadataReaders.delete(client);
    fail8();
  }
  if (metadataOperations.has(sql)) return metadataRead(client, sql, values);
  if (metadataSpent.has(client)) {
    metadataReaders.delete(client);
    fail8();
  }
  if (controls.has(sql)) {
    if (sql.startsWith("select set_config")) {
      if (values.length !== 3 || values.some((v) => typeof v !== "string" || !/^\d{1,5}$/.test(v) || Number(v) < 1 || Number(v) > 6e4)) fail8();
    } else if (values.length) fail8();
    return client.query(sql, values);
  }
  const op = (verifiedBoundaryMode(client) === "batch" ? typedOperations : operations).get(sql) ?? (guidanceVerified.has(client) ? guidanceOperations.get(sql) : void 0);
  if (!op || values.length !== op.parameters.length) fail8();
  const wire = values.map(encodeBoundaryParameter);
  const result2 = await client.query(`select * from n88_private.${op.name}(${wire.map((_, i) => "$" + (i + 1) + "::text").join(",")})`, wire);
  if (op.effect) {
    const count = result2.rows?.[0]?.affected;
    if (result2.rows?.length !== 1 || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) fail8();
    return { ...result2, command: op.command, rowCount: Number(count), rows: [] };
  }
  if (op.voidResult) return { ...result2, rows: result2.rows.map(() => ({ [op.output[0].name]: "" })) };
  return result2;
}
var encodeBoundaryParameter = (value) => value === null ? null : Buffer8.from(pgText(value), "utf8").toString("base64");

// drafts/n88-student-portal/postgres-repository.mjs
var unavailable2 = () => new Error("n88_repository_unavailable");
var must = (test) => {
  if (!test) throw unavailable2();
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
var exact8 = (o, keys) => must(o && Object.getPrototypeOf(o) === Object.prototype && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k)));
var str = (s, max, min = 1) => must(typeof s === "string" && s.length >= min && s.length <= max && !s.includes("\0"));
var uuid3 = (s) => must(typeof s === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s));
var hex5 = (s) => must(typeof s === "string" && /^[a-f0-9]{64}$/.test(s));
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
var active5 = (r) => r.status === "active" && r.endDate === null && r.studentActive && r.classActive;
function validate(name, r) {
  exact8(r, tables[name].fields);
  for (const k of ["ownerId", "id", "credentialId"]) if (Object.hasOwn(r, k)) uuid3(r[k]);
  for (const k of ["classId", "studentId", "enrollmentId"]) if (Object.hasOwn(r, k)) str(r[k], 240);
  if (Object.hasOwn(r, "namespace")) namespace(r.namespace);
  for (const k of ["version", "revision", "membershipRevision"]) if (Object.hasOwn(r, k)) safe(r[k], 1);
  for (const k of ["verifier", "entryVerifier", "tokenHash"]) if (Object.hasOwn(r, k)) hex5(r[k]);
  if (Object.hasOwn(r, "canonicalStamp")) hex5(r.canonicalStamp);
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
    exact8(r.source, ["teachingId", "itemId"]);
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
  if (name === "memberships") return tables[name].fields.map((k) => r[k]).concat(active5(r));
  if (name === "publications") return [r.id, r.ownerId, r.classId, r.studentId, r.enrollmentId, r.source.teachingId, r.source.itemId, r.title, r.instruction, r.deadline, r.status, r.published];
  return tables[name].fields.map((k) => ["revokedAt", "expiresAt", "until"].includes(k) ? stamp(r[k]) : r[k]);
}
function decode(name, row) {
  const t = tables[name];
  exact8(row, t.cols);
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
    must(row.active === active5(r));
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
  exact8(state, names);
  let total = 0, bytes2 = 0;
  const maps = {};
  for (const name of names) {
    must(Array.isArray(state[name]) && state[name].length <= limits[name]);
    total += state[name].length;
    must(total <= limits.total);
    maps[name] = /* @__PURE__ */ new Map();
    for (const r of state[name]) {
      const values = encode(name, r), json3 = JSON.stringify(r), size = Buffer9.byteLength(json3);
      must(size <= limits.rowBytes);
      bytes2 += size;
      must(bytes2 <= limits.bytes);
      const key3 = JSON.stringify(pk(name, values));
      must(!maps[name].has(key3));
      maps[name].set(key3, values);
    }
  }
  return maps;
}
function transitions(before, after) {
  for (const [key3, a] of before.credentials) {
    const b = after.credentials.get(key3);
    must(b);
    must(a.slice(0, 7).every((v, i) => v === b[i]));
    must(a[7] === null || b[7] !== null);
  }
  for (const [key3, a] of before.sessions) {
    const b = after.sessions.get(key3);
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
  exact8(limits, [...names, "total", "bytes", "rowBytes"]);
  for (const k of names) safe(limits[k], 1, 1e4);
  safe(limits.total, 1, 5e4);
  safe(limits.bytes, 1024, 64 * 1024 * 1024);
  safe(limits.rowBytes, 128, 32768);
  exact8(timing, ["acquireMs", "transactionMs", "cleanupMs", "statementMs", "lockMs"]);
  for (const k of Object.keys(timing)) safe(timing[k], 1, 6e4);
  must(timing.acquireMs <= timing.transactionMs && timing.statementMs <= timing.transactionMs && timing.lockMs <= timing.statementMs);
  limits = { ...limits };
  timing = { ...timing };
  return Object.freeze({ async transaction(action) {
    must(typeof action === "function");
    let c, live2 = true, begun = false, committed = false, destroyed = false, stage = "acquire";
    const phases = createReadPhaseTiming(), measure = phases.measure;
    const deadline = Date.now() + timing.transactionMs;
    const fence = () => must(live2 && Date.now() < deadline);
    const release = (broken) => {
      if (c && !destroyed) {
        destroyed = true;
        c.release(broken ? unavailable2() : void 0);
      }
    };
    const query = async (text3, values = []) => {
      fence();
      const run = () => privateQuery(c, text3, values);
      const r = await (["begin", "snapshot"].includes(stage) || text3.startsWith("select case when octet_length(payload::text)") ? measure("snapshot", run) : run());
      fence();
      return r;
    };
    let timer, acquireTimer;
    const work = (async () => {
      const lease = Promise.resolve().then(() => acquire(measure));
      lease.then((client) => {
        if (!live2) client.release(unavailable2());
      }, () => {
      });
      c = await Promise.race([lease, new Promise((_, reject) => {
        acquireTimer = setTimeout(() => reject(unavailable2()), timing.acquireMs);
      })]);
      clearTimeout(acquireTimer);
      fence();
      must(c && typeof c.query === "function" && typeof c.release === "function");
      await measure("boundary", () => assertVerifiedBoundary(c));
      fence();
      stage = "begin";
      await query("begin isolation level read committed");
      begun = true;
      await query(
        "select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)",
        [String(timing.statementMs), String(timing.lockMs), String(timing.transactionMs)]
      );
      await query(LOCK);
      stage = "snapshot";
      const state = {};
      let count = 0, bytes2 = 0, transferred = 0;
      for (const name of names) {
        const bound = Math.min(limits[name], limits.total - count);
        const result3 = await query(queries[name].read, [bound + 1, limits.rowBytes, limits.bytes - transferred]);
        must(result3.rows.length <= bound);
        state[name] = result3.rows.map((row) => {
          exact8(row, ["bounded_row"]);
          must(typeof row.bounded_row === "string");
          transferred += Buffer9.byteLength(row.bounded_row);
          must(transferred <= limits.bytes);
          return decode(name, JSON.parse(row.bounded_row));
        });
        count += state[name].length;
        bytes2 += Buffer9.byteLength(JSON.stringify(state[name]));
        must(bytes2 <= limits.bytes);
      }
      const original = snapshot(state, limits);
      stage = "operation";
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
        await measure("sync", () => synchronize(state, { query }, ownerId));
        fence();
        snapshot(state, limits);
        owners.add(ownerId);
      };
      const value = await action(state, Object.freeze({ query, synchronizeOwner, beforeCommit, measure, canonicalReadMode: () => {
        fence();
        return verifiedBoundaryMode(c);
      } }));
      fence();
      const final = snapshot(structuredClone(state), limits), result2 = structuredClone(value);
      transitions(original, final);
      fence();
      for (const name of ["sessions", "publications", "memberships", "contexts", "rates"])
        for (const [key3, row] of original[name]) if (!final[name].has(key3))
          must((await query(queries[name].remove, pk(name, row))).rowCount === 1);
      for (const name of names) {
        for (const [key3, row] of final[name]) if (original[name].has(key3) && JSON.stringify(row) !== JSON.stringify(original[name].get(key3)))
          must((await query(queries[name].update, row)).rowCount === 1);
        for (const [key3, row] of final[name]) if (!original[name].has(key3))
          must((await query(queries[name].insert, row)).rowCount === 1);
      }
      for (const check of commitGuards) {
        await check();
        fence();
      }
      const ack = await measure("commit", () => query("commit"));
      must(ack.command === "COMMIT");
      committed = true;
      if (result2?.readPhaseDiagnostic === true) {
        delete result2.readPhaseDiagnostic;
        if (result2.status === 200) result2.readPhases = phases.finish();
      }
      return result2;
    })();
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(unavailable2()), Math.max(1, deadline - Date.now()));
      })]);
    } catch {
      live2 = false;
      if (c && begun && !committed && !destroyed) {
        let cleanupTimer;
        try {
          await Promise.race([c.query("rollback"), new Promise((_, reject) => {
            cleanupTimer = setTimeout(() => reject(unavailable2()), timing.cleanupMs);
          })]);
        } catch {
        } finally {
          clearTimeout(cleanupTimer);
        }
      }
      const error = unavailable2();
      error.safeStage = stage;
      throw error;
    } finally {
      live2 = false;
      clearTimeout(timer);
      clearTimeout(acquireTimer);
      release(!committed);
    }
  } });
}

// drafts/n88-student-portal/http-adapter.mjs
import { Buffer as Buffer10 } from "node:buffer";

// drafts/n88-student-portal/auth-verifier.mjs
import { Buffer as Buffer11 } from "node:buffer";
import { AuthClient } from "@supabase/auth-js";
var uuid4 = (s) => typeof s === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
var fail9 = () => {
  throw Error("n88_auth_configuration");
};
function createTeacherVerifier({ authUrl, apiKey, fetch: send = globalThis.fetch, authDeadlineMs = 2e3, now = Date.now }) {
  const url = new URL(authUrl);
  if (url.origin !== authUrl || url.protocol !== "https:" || !apiKey || typeof send !== "function" || !Number.isInteger(authDeadlineMs) || authDeadlineMs < 20 || authDeadlineMs > 5e3) fail9();
  const issuer = authUrl + "/auth/v1";
  return async (authorization, parentSignal, { query, beforeCommit } = {}) => {
    if (typeof query !== "function" || typeof authorization !== "string" || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) return null;
    const token = authorization.slice(7), abort = new AbortController();
    const cancel = () => abort.abort();
    parentSignal?.addEventListener("abort", cancel, { once: true });
    if (parentSignal?.aborted) abort.abort();
    let expired = false;
    let remaining = authDeadlineMs, started = performance.now(), timer;
    const arm = () => {
      started = performance.now();
      timer = setTimeout(() => {
        expired = true;
        abort.abort();
      }, remaining);
    };
    const pause = () => {
      clearTimeout(timer);
      remaining -= performance.now() - started;
      if (remaining <= 0) {
        expired = true;
        abort.abort();
      }
    };
    arm();
    const fence = () => {
      if (expired || abort.signal.aborted) throw Error("n88_auth_unavailable");
    };
    try {
      const boundedFetch = async (target, init = {}) => {
        fence();
        const u = new URL(target);
        if (u.origin !== authUrl || ![issuer + "/user", issuer + "/.well-known/jwks.json"].includes(u.href) || init.method && init.method !== "GET") fail9();
        const response3 = await send(u.href, { ...init, redirect: "error", cache: "no-store", credentials: "omit", signal: abort.signal });
        let n = 0;
        const parts = [];
        const reader = response3.body?.getReader();
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
        return new Response(Buffer11.concat(parts), { status: response3.status, headers: response3.headers });
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
      pause();
      fence();
      const current = await query("select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
      fence();
      arm();
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
  if (sourceOnly !== false || typeof acquire !== "function" || canonicalReadback !== true || privateIngressReadback !== true || !Buffer12.isBuffer(secretKey) || secretKey.length < 32 || typeof apiKey !== "string" || !apiKey || ![origin, authUrl].every((u) => {
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

// drafts/n88-student-portal/activation/v2-runtime-writer-1031/host.mjs
import { createHash as createHash15 } from "node:crypto";

// drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs
import { createHash as createHash12 } from "node:crypto";
var fail10 = () => {
  throw Error("n88_v2_catalog_unavailable");
};
var must2 = (v) => {
  if (!v) fail10();
};
var exact9 = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var text2 = (v, n = 200) => typeof v === "string" && v.length > 0 && v.length <= n && !v.includes("\0");
var uuid5 = (v) => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
var hex6 = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
var revision3 = (v) => Number.isSafeInteger(v) && v >= 0;
var bigint = (v, min = 1n) => typeof v === "string" && /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) >= min && BigInt(v) <= 9223372036854775807n;
var stable2 = (v) => Array.isArray(v) ? v.map(stable2) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable2(v[k])])) : v;
var json = (v) => JSON.stringify(stable2(v));
var sha2 = (v) => createHash12("sha256").update(v).digest("hex");
var bytes = (v) => Buffer.byteLength(v);
var freeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};
var scopeKeys4 = ["ownerId", "teachingId", "sectionId", "termId", "subjectId"];
var flags3 = ["required", "scheduled", "completed", "grade"];
var scope = (v, owner) => exact9(v, scopeKeys4) && scopeKeys4.every((k) => text2(v[k])) && v.ownerId === owner;
var rowId = (v) => {
  if (!text2(v, 1e3) || bytes(v) > 2e3) return false;
  let a;
  try {
    a = JSON.parse(v);
  } catch {
    return false;
  }
  return Array.isArray(a) && a.length === 3 && ["item", "subitem", "manual"].includes(a[0]) && text2(a[2]) && (a[0] === "manual" ? a[1] === null : text2(a[1])) && JSON.stringify(a) === v;
};
var sourceKey = (v) => text2(v, 220) && /^(items|scoreSubitems):./.test(v);
var publication = (v) => {
  if (!(exact9(v, ["rowId", "sourceRevision", "publicationRevision", "membershipRevision", "decisions", "tombstone"]) && rowId(v.rowId) && hex6(v.sourceRevision) && hex6(v.membershipRevision) && revision3(v.publicationRevision) && typeof v.tombstone === "boolean" && exact9(v.decisions, flags3) && flags3.every((k) => typeof v.decisions[k] === "boolean"))) return false;
  const kind = JSON.parse(v.rowId)[0];
  return (!v.tombstone || flags3.every((k) => !v.decisions[k])) && (kind !== "manual" || !v.decisions.grade) && (kind !== "item" || flags3.filter((k) => k !== "grade").every((k) => !v.decisions[k]));
};
var root = (v, owner, currentDate) => {
  if (!exact9(v, ["scope", "manualTasks"]) || !scope(v.scope, owner) || !Array.isArray(v.manualTasks) || v.manualTasks.length > 2e3) return false;
  const ids = /* @__PURE__ */ new Set();
  for (const m of v.manualTasks) {
    if (!exact9(m, ["id", "title", "description", "startDate", "dueDate", "link"]) || ids.has(m.id)) return false;
    try {
      if (json(manualTaskDraft(m, new Date(currentDate))) !== json(m)) return false;
    } catch {
      return false;
    }
    ids.add(m.id);
  }
  return true;
};
var receipt = (v, owner) => exact9(v, ["version", "scope", "binding", "requestId", "rowId", "sourceRevision", "state", "publicationRevision"]) && v.version === 2 && scope(v.scope, owner) && exact9(v.binding, ["sessionId", "leaseId", "contextRevision"]) && Object.values(v.binding).every((x) => text2(x)) && typeof v.requestId === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(v.requestId) && rowId(v.rowId) && hex6(v.sourceRevision) && ["applied", "rejected"].includes(v.state) && revision3(v.publicationRevision);
var time2 = (v) => Number.isSafeInteger(v) && v >= 0;
var revoked = (v) => v === null || time2(v);
var numericSession = (v) => exact9(v, [
  "id",
  "credentialId",
  "ownerId",
  "studentId",
  "classId",
  "enrollmentId",
  "membershipRevision",
  "canonicalStamp",
  "version",
  "tokenHash",
  "expiresAt",
  "revokedAt"
]) && uuid5(v.id) && uuid5(v.credentialId) && uuid5(v.ownerId) && ["studentId", "classId", "enrollmentId", "membershipRevision"].every((k) => text2(v[k], 240)) && hex6(v.canonicalStamp) && Number.isSafeInteger(v.version) && v.version >= 1 && hex6(v.tokenHash) && time2(v.expiresAt) && revoked(v.revokedAt);
var credential = (v) => exact9(v, ["id", "ownerId", "studentId", "version", "reservation", "verifier", "keyVersion", "revokedAt"]) && uuid5(v.id) && uuid5(v.ownerId) && text2(v.studentId, 240) && Number.isSafeInteger(v.version) && v.version >= 1 && hex6(v.reservation) && hex6(v.verifier) && typeof v.keyVersion === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v.keyVersion) && revoked(v.revokedAt);
var definitions2 = [];
var add = (id9, sql, parameters, output, maxRows, maxBytes, effect = false) => definitions2.push({ id: id9, sql, sha256: sha2(sql), parameters, output, maxRows, maxBytes, effect });
add(
  "owner-context",
  "select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share",
  ["owner:uuid"],
  ["namespace:text", "owner_id:uuid", "active:boolean"],
  1,
  4096
);
add(
  "numeric-session",
  "select payload from n88_private.numeric_sessions where token_hash=$1 for share",
  ["tokenHash:hex64"],
  ["payload:numericSession"],
  1,
  4096
);
add(
  "numeric-credential",
  "select payload from n88_private.numeric_credentials where id=$1::uuid and owner_id=$2::uuid and student_id=$3 and version=$4::bigint for share",
  ["credentialId:uuid", "owner:uuid", "studentId:text240", "version:positiveBigint"],
  ["payload:numericCredential"],
  1,
  2048
);
var stores = [
  ["scopes", "scope_key,store_revision::text as store_revision,payload", "scope_key"],
  ["items", "scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload", "scope_key,row_id"],
  ["high_water", "scope_key,source_key,canonical_revision::text as canonical_revision,retired", "scope_key,source_key"],
  ["receipts", "request_id,scope_key,fingerprint,payload", "request_id"]
];
for (const [table, columns2, order] of stores) add(
  `read-${table}`,
  `select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select ${columns2} from n88_private.publication_v2_${table} where owner_id=$1::uuid order by ${order} limit $2) r) bounded`,
  ["owner:uuid", "overflowLimit:10001", "rowBytes:2097152", "remainingBytes:1..4194304"],
  ["body:typedStorageJSON"],
  1e4,
  4194304
);
add(
  "insert-scope",
  "insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values($1::uuid,$2,1,$3::jsonb)",
  ["owner:uuid", "scopeKey:hex64", "root:canonicalJSON"],
  [],
  0,
  0,
  true
);
add(
  "cas-scope",
  "update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=$3::jsonb where owner_id=$1::uuid and scope_key=$2 and store_revision=$4::bigint",
  ["owner:uuid", "scopeKey:hex64", "root:canonicalJSON", "priorStoreRevision:positiveBigint"],
  [],
  0,
  0,
  true
);
add(
  "insert-item",
  "insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1::uuid,$2,$3,$4::bigint,$5,$6::jsonb)",
  ["owner:uuid", "scopeKey:hex64", "rowId:text", "revision:safeBigint", "tombstone:boolean", "publication:canonicalJSON"],
  [],
  0,
  0,
  true
);
add(
  "cas-item",
  "update n88_private.publication_v2_items set publication_revision=$4::bigint,tombstone=$5,payload=$6::jsonb where owner_id=$1::uuid and scope_key=$2 and row_id=$3 and publication_revision=$7::bigint and payload=$8::jsonb",
  ["owner:uuid", "scopeKey:hex64", "rowId:text", "revision:safeBigint", "tombstone:boolean", "publication:canonicalJSON", "priorRevision:safeBigint", "priorPublication:canonicalJSON"],
  [],
  0,
  0,
  true
);
add(
  "insert-high-water",
  "insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values($1::uuid,$2,$3,$4::bigint,$5)",
  ["owner:uuid", "scopeKey:hex64", "sourceKey:text220", "canonicalRevision:positiveBigint", "retired:boolean"],
  [],
  0,
  0,
  true
);
add(
  "cas-high-water",
  "update n88_private.publication_v2_high_water set canonical_revision=$4::bigint,retired=$5 where owner_id=$1::uuid and scope_key=$2 and source_key=$3 and canonical_revision=$6::bigint and retired=$7",
  ["owner:uuid", "scopeKey:hex64", "sourceKey:text220", "canonicalRevision:positiveBigint", "retired:boolean", "priorRevision:positiveBigint", "priorRetired:boolean"],
  [],
  0,
  0,
  true
);
add(
  "insert-receipt",
  "insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values($1::uuid,$2,$3,$4,$5::jsonb)",
  ["owner:uuid", "requestId:text16..100", "scopeKey:hex64", "fingerprint:hex64", "receipt:canonicalJSON"],
  [],
  0,
  0,
  true
);
var publicationV2FiniteCatalog = freeze(definitions2);
var publicationV2FiniteCatalogSha256 = sha2(json(publicationV2FiniteCatalog));
var byId = new Map(definitions2.map((v) => [v.id, v]));
var parse = (s, max) => {
  must2(typeof s === "string" && bytes(s) <= max);
  return JSON.parse(s);
};
var canonical = (s, max) => {
  const v = parse(s, max);
  must2(json(v) === s);
  return v;
};
function validateArgs(op, a, c, currentDate) {
  must2(Array.isArray(a) && a.length === op.parameters.length);
  if (c.role === "locator") must2(["numeric-session", "numeric-credential", "owner-context"].includes(op.id));
  if (op.id === "numeric-session") {
    must2(c.numeric && a[0] === c.numeric.tokenHash);
    return;
  }
  if (op.id === "numeric-credential") {
    must2(c.numeric && a[0] === c.numeric.credentialId && a[1] === c.ownerId && a[2] === c.numeric.studentId && a[3] === c.numeric.version);
    return;
  }
  must2(a[0] === c.ownerId);
  if (op.id === "owner-context") return;
  if (op.id.startsWith("read-")) {
    must2(a[1] === 10001 && a[2] === 2097152 && Number.isSafeInteger(a[3]) && a[3] >= 1 && a[3] <= 4194304);
    return;
  }
  must2(c.storageWrite && hex6(a[op.id === "insert-receipt" ? 2 : 1]));
  if (op.id.endsWith("scope")) {
    const v = canonical(a[2], 2097152);
    must2(root(v, c.ownerId, currentDate) && sha2(json(v.scope)) === a[1]);
    if (op.id === "cas-scope") must2(bigint(a[3]));
  } else if (op.id.endsWith("item")) {
    const v = canonical(a[5], 16384);
    must2(publication(v) && a[2] === v.rowId && a[3] === String(v.publicationRevision) && a[4] === v.tombstone);
    if (op.id === "cas-item") {
      const old = canonical(a[7], 16384);
      must2(publication(old) && a[2] === old.rowId && a[6] === String(old.publicationRevision) && v.publicationRevision > old.publicationRevision && (!old.tombstone || v.tombstone));
    }
  } else if (op.id.endsWith("high-water")) {
    must2(sourceKey(a[2]) && bigint(a[3]) && typeof a[4] === "boolean");
    if (op.id === "cas-high-water") must2(bigint(a[5]) && BigInt(a[3]) >= BigInt(a[5]) && typeof a[6] === "boolean" && (!a[6] || a[4]));
  } else {
    must2(op.id === "insert-receipt");
    const v = canonical(a[4], 16384);
    must2(receipt(v, c.ownerId) && v.binding.sessionId === c.sessionId && a[1] === v.requestId && a[2] === sha2(json(v.scope)) && hex6(a[3]));
  }
}
function validateBody(id9, r, c, currentDate, scopes) {
  must2(hex6(r.scope_key));
  if (id9 !== "read-scopes") must2(scopes.has(r.scope_key));
  if (id9 === "read-scopes") {
    must2(exact9(r, ["scope_key", "store_revision", "payload"]) && bigint(r.store_revision) && root(r.payload, c.ownerId, currentDate) && sha2(json(r.payload.scope)) === r.scope_key);
    must2(!scopes.has(r.scope_key));
    scopes.add(r.scope_key);
  } else if (id9 === "read-items") {
    must2(exact9(r, ["scope_key", "row_id", "publication_revision", "tombstone", "payload"]) && publication(r.payload) && r.row_id === r.payload.rowId && r.publication_revision === String(r.payload.publicationRevision) && r.tombstone === r.payload.tombstone);
  } else if (id9 === "read-high_water") {
    must2(exact9(r, ["scope_key", "source_key", "canonical_revision", "retired"]) && sourceKey(r.source_key) && bigint(r.canonical_revision) && typeof r.retired === "boolean");
  } else must2(exact9(r, ["request_id", "scope_key", "fingerprint", "payload"]) && receipt(r.payload, c.ownerId) && r.request_id === r.payload.requestId && hex6(r.fingerprint) && r.scope_key === sha2(json(r.payload.scope)));
}
function validateResult(op, r, a, c, currentDate, scopes) {
  must2(exact9(r, ["command", "rowCount", "rows"]) && Array.isArray(r.rows) && Number.isSafeInteger(r.rowCount) && r.rowCount >= 0);
  if (op.effect) {
    must2(r.command === (op.id.startsWith("insert-") ? "INSERT" : "UPDATE") && r.rows.length === 0 && r.rowCount === 1);
    return 0;
  }
  must2(r.command === "SELECT" && r.rowCount === r.rows.length && r.rows.length <= op.maxRows);
  let total = 0;
  for (const row of r.rows) {
    if (op.id.startsWith("read-")) {
      must2(exact9(row, ["body"]) && typeof row.body === "string");
      const size = bytes(row.body);
      must2(size <= a[2]);
      total += size;
      must2(total <= a[3]);
      validateBody(op.id, parse(row.body, a[2]), c, currentDate, scopes);
    } else {
      total += bytes(json(row));
      if (op.id === "owner-context") must2(exact9(row, ["namespace", "owner_id", "active"]) && typeof row.namespace === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(row.namespace) && row.owner_id === c.ownerId && typeof row.active === "boolean");
      else {
        must2(exact9(row, ["payload"]));
        const v = row.payload;
        must2(bytes(json(v)) <= op.maxBytes);
        if (op.id === "numeric-session") must2(numericSession(v) && v.tokenHash === c.numeric.tokenHash && (c.role === "locator" && c.ownerId === null || v.ownerId === c.ownerId && v.id === c.sessionId && v.credentialId === c.numeric.credentialId && v.studentId === c.numeric.studentId && String(v.version) === c.numeric.version));
        else must2(credential(v) && v.ownerId === c.ownerId && v.id === a[0] && v.studentId === a[2] && String(v.version) === a[3]);
      }
    }
  }
  must2(total <= (op.id.startsWith("numeric-") ? op.maxBytes + 32 : op.maxBytes));
  return total;
}
var admission = (c, now) => exact9(c, ["ownerId", "sessionId", "role", "expiresAt", "numeric", "storageWrite"]) && time2(c.expiresAt) && c.expiresAt > now && typeof c.storageWrite === "boolean" && (c.role === "locator" ? c.ownerId === null && c.sessionId === null && !c.storageWrite && exact9(c.numeric, ["tokenHash", "credentialId", "studentId", "version"]) && hex6(c.numeric.tokenHash) && ["credentialId", "studentId", "version"].every((k) => c.numeric[k] === null) : uuid5(c.ownerId) && text2(c.sessionId) && ["teacher", "student"].includes(c.role) && (c.role === "teacher" ? c.numeric === null : exact9(c.numeric, ["tokenHash", "credentialId", "studentId", "version"]) && hex6(c.numeric.tokenHash) && uuid5(c.numeric.credentialId) && text2(c.numeric.studentId, 240) && bigint(c.numeric.version)));
var matchesLocated = (c, v) => c.ownerId === v.ownerId && c.sessionId === v.id && c.numeric?.tokenHash === v.tokenHash && c.numeric.credentialId === v.credentialId && c.numeric.studentId === v.studentId && c.numeric.version === String(v.version);
function createInactivePublicationV2FiniteCatalog({
  executionMode,
  runtimeCapability,
  verifyAdmission,
  executeFixed,
  now = Date.now,
  budgetMs = 5e3,
  maxOperations = 2e4
}) {
  must2(publicationRuntimeAllowed(executionMode, runtimeCapability) && typeof verifyAdmission === "function" && typeof executeFixed === "function" && typeof now === "function" && Number.isSafeInteger(budgetMs) && budgetMs >= 10 && budgetMs <= 1e4 && Number.isSafeInteger(maxOperations) && maxOperations >= 1 && maxOperations <= 2e4);
  const requests = /* @__PURE__ */ new WeakMap(), tickets = /* @__PURE__ */ new WeakMap();
  const state = (request) => {
    must2(request && typeof request === "object");
    if (!requests.has(request)) requests.set(request, {
      deadline: now() + budgetMs,
      calls: 0,
      bytes: 0,
      rows: 0,
      poisoned: false,
      busy: false,
      controller: new AbortController(),
      context: null,
      located: null,
      scopes: /* @__PURE__ */ new Set(),
      effects: /* @__PURE__ */ new Set()
    });
    return requests.get(request);
  };
  const poison = (s) => {
    s.poisoned = true;
    s.controller.abort();
  };
  const fence = (s) => must2(!s.poisoned && now() < s.deadline);
  const within = async (s, action) => {
    fence(s);
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
        timer = setTimeout(() => {
          poison(s);
          reject(Error("n88_v2_catalog_unavailable"));
        }, Math.max(1, s.deadline - now()));
      })]);
    } finally {
      clearTimeout(timer);
    }
  };
  const verify = async (s, request) => {
    fence(s);
    const c = structuredClone(await within(s, () => verifyAdmission(request, s.controller.signal)));
    fence(s);
    must2(admission(c, now()));
    if (s.context && json(s.context) !== json(c)) {
      must2(s.context.role === "locator" && c.role === "student" && s.located && matchesLocated(c, s.located) && c.numeric.tokenHash === s.context.numeric.tokenHash);
      s.context = c;
    } else if (!s.context) s.context = c;
    return c.role === "locator" && s.located ? {
      ...c,
      ownerId: s.located.ownerId,
      sessionId: s.located.id,
      numeric: { tokenHash: s.located.tokenHash, credentialId: s.located.credentialId, studentId: s.located.studentId, version: String(s.located.version) }
    } : c;
  };
  return Object.freeze({
    async prepare(request, command2) {
      const s = state(request);
      try {
        fence(s);
        must2(!s.busy && exact9(command2, ["operation", "args"]));
        s.busy = true;
        must2(typeof command2.operation === "string" && byId.has(command2.operation) && ++s.calls <= maxOperations);
        const op = byId.get(command2.operation);
        must2(Array.isArray(command2.args) && command2.args.length === op.parameters.length && Object.keys(command2.args).length === command2.args.length && command2.args.every((v) => typeof v === "boolean" || typeof v === "number" && Number.isFinite(v) || typeof v === "string" && bytes(v) <= 2097152));
        const args = structuredClone(command2.args);
        const c = await verify(s, request);
        validateArgs(op, args, c, now());
        if (op.effect) {
          const key3 = sha2(json([op.id, args]));
          must2(!s.effects.has(key3));
          s.effects.add(key3);
        }
        const ticket = Object.freeze({});
        tickets.set(ticket, { request, op, args, context: json(c), spent: false });
        return ticket;
      } catch {
        poison(s);
        fail10();
      } finally {
        s.busy = false;
      }
    },
    async execute(request, ticket) {
      const t = tickets.get(ticket), s = state(request);
      const spent = t?.spent;
      if (t) t.spent = true;
      try {
        fence(s);
        must2(t && !spent && t.request === request && !s.busy);
        s.busy = true;
        const c = await verify(s, request);
        must2(json(c) === t.context);
        validateArgs(t.op, t.args, c, now());
        if (t.op.effect && !t.op.id.endsWith("scope")) must2(s.scopes.has(t.args[t.op.id === "insert-receipt" ? 2 : 1]));
        const raw = await within(s, () => executeFixed(t.op.sql, structuredClone(t.args), s.controller.signal));
        if (t.op.id === "read-scopes") s.scopes.clear();
        fence(s);
        s.bytes += validateResult(t.op, raw, t.args, c, now(), s.scopes);
        s.rows += raw.rows.length;
        const result2 = structuredClone(raw);
        if (t.op.id === "numeric-session" && c.role === "locator" && result2.rows.length === 1) {
          const v = result2.rows[0].payload;
          if (s.located) must2(json(s.located) === json(v));
          else s.located = structuredClone(v);
        }
        if (t.op.effect && t.op.id.endsWith("scope")) s.scopes.add(t.args[1]);
        must2(s.bytes <= 4194304 && s.rows <= 2e4);
        await verify(s, request);
        fence(s);
        return result2;
      } catch {
        poison(s);
        if (t) poison(state(t.request));
        fail10();
      } finally {
        s.busy = false;
      }
    },
    close(request) {
      poison(state(request));
    }
  });
}

// drafts/n88-student-portal/publication-v2-canonical.inactive.mjs
import { createHash as createHash14 } from "node:crypto";

// drafts/n88-student-portal/publication-v2-postgres.inactive.mjs
import { createHash as createHash13 } from "node:crypto";
var fail11 = () => {
  throw Error("n88_v2_storage_unavailable");
};
var must3 = (v) => {
  if (!v) fail11();
};
var exact10 = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var id7 = (v) => typeof v === "string" && v.length > 0 && v.length <= 200 && !v.includes("\0");
var uuid6 = (v) => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
var hex7 = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
var revision4 = (v) => Number.isSafeInteger(v) && v >= 0;
var bigint2 = (v) => typeof v === "string" && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n;
var flags4 = ["required", "scheduled", "completed", "grade"];
var scopeKeys5 = ["ownerId", "teachingId", "sectionId", "termId", "subjectId"];
var stable3 = (v) => Array.isArray(v) ? v.map(stable3) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable3(v[k])])) : v;
var json2 = (v) => JSON.stringify(stable3(v));
var key2 = (scope2) => hash5(scope2);
var hash5 = (v) => createHash13("sha256").update(json2(v)).digest("hex");
var scoped = (scope2, owner) => exact10(scope2, scopeKeys5) && scopeKeys5.every((k) => id7(scope2[k])) && scope2.ownerId === owner && uuid6(owner);
var tables2 = {
  scopes: ["publication_v2_scopes", "scope_key,store_revision::text as store_revision,payload", "scope_key"],
  publications: ["publication_v2_items", "scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload", "scope_key,row_id"],
  sourceVersions: ["publication_v2_high_water", "scope_key,source_key,canonical_revision::text as canonical_revision,retired", "scope_key,source_key"],
  receipts: ["publication_v2_receipts", "request_id,scope_key,fingerprint,payload", "request_id"]
};
var reads = Object.fromEntries(Object.entries(tables2).map(([name, [table, cols, order]]) => [
  name,
  `select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select ${cols} from n88_private.${table} where owner_id=$1::uuid order by ${order} limit $2) r) bounded`
]));
function createPublicationV2PostgresRepository({ executionMode, runtimeCapability, acquire, transactionMs = 5e3, cleanupMs = 500 }) {
  must3(publicationRuntimeAllowed(executionMode, runtimeCapability) && typeof acquire === "function" && Number.isInteger(transactionMs) && transactionMs >= 50 && transactionMs <= 1e4 && Number.isInteger(cleanupMs) && cleanupMs >= 1 && cleanupMs <= 1e3);
  return Object.freeze({ async transaction(action) {
    let client, poisoned = false, live2 = true, committed = false, begun = false, timer, released = false;
    const release = (c, broken) => {
      if (!released) {
        released = true;
        c.release(broken ? Error("n88_v2_storage_unavailable") : void 0);
      }
    };
    const deadline = Date.now() + transactionMs, guards = [];
    const fence = () => must3(live2 && !poisoned && Date.now() < deadline);
    const query = async (sql, args = []) => {
      fence();
      try {
        const r = await client.query(sql, args);
        fence();
        return r;
      } catch {
        poisoned = true;
        fail11();
      }
    };
    const lease = Promise.resolve().then(acquire);
    lease.then((c) => {
      if (!live2) release(c, true);
    }, () => {
    });
    const work = (async () => {
      client = await lease;
      fence();
      must3(typeof client?.query === "function" && typeof client.release === "function");
      await query("begin isolation level read committed");
      begun = true;
      await query("select set_config('statement_timeout',$1,true),set_config('lock_timeout',$1,true),set_config('idle_in_transaction_session_timeout',$1,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)", [String(transactionMs)]);
      if (executionMode === "hosted") {
        const effective = (await query("select current_setting('statement_timeout') as timeout")).rows[0]?.timeout;
        must3(effective === String(transactionMs) + "ms" || effective === String(transactionMs / 1e3) + "s");
        must3(transactionMs <= 5e3);
      }
      await query("select pg_advisory_xact_lock(1312307256, 88)");
      const result2 = structuredClone(await action({}, Object.freeze({
        query,
        poison: () => {
          poisoned = true;
        },
        beforeCommit: (fn) => {
          fence();
          must3(typeof fn === "function" && guards.length < 8);
          guards.push(fn);
        },
        canonicalReadMode: () => {
          fence();
          return "serial";
        }
      })));
      fence();
      for (const guard of guards) {
        await guard();
        fence();
      }
      must3((await query("commit")).command === "COMMIT");
      committed = true;
      return result2;
    })();
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("n88_v2_storage_unavailable")), transactionMs);
      })]);
    } catch {
      live2 = false;
      if (client && begun && !committed) {
        let cleanup;
        try {
          await Promise.race([client.query("rollback"), new Promise((_, reject) => {
            cleanup = setTimeout(reject, cleanupMs);
          })]);
        } catch {
        } finally {
          clearTimeout(cleanup);
        }
      }
      fail11();
    } finally {
      live2 = false;
      clearTimeout(timer);
      if (client) release(client, !committed);
    }
  } });
}
function validate2(state, owner) {
  must3(exact10(state, ["scopes", "receipts"]) && Array.isArray(state.scopes) && Array.isArray(state.receipts));
  must3(state.scopes.length <= 2e3 && state.receipts.length <= 1e4 && Buffer.byteLength(json2(state)) <= 4 * 1024 * 1024);
  const scopes = /* @__PURE__ */ new Map(), receipts = /* @__PURE__ */ new Map();
  for (const s of state.scopes) {
    must3(exact10(s, ["scope", "manualTasks", "publications", "sourceVersions"]) && scoped(s.scope, owner));
    const k = key2(s.scope);
    must3(!scopes.has(k));
    scopes.set(k, s);
    must3(Array.isArray(s.manualTasks) && s.manualTasks.length <= 2e3 && Array.isArray(s.publications) && s.publications.length <= 2e3 && Array.isArray(s.sourceVersions) && s.sourceVersions.length <= 4e3);
    const manual = /* @__PURE__ */ new Set(), pubs = /* @__PURE__ */ new Set(), versions = /* @__PURE__ */ new Set();
    for (const m of s.manualTasks) {
      must3(exact10(m, ["id", "title", "description", "startDate", "dueDate", "link"]) && !manual.has(m.id));
      must3(json2(manualTaskDraft(m)) === json2(m));
      manual.add(m.id);
    }
    for (const p of s.publications) {
      must3(exact10(p, ["rowId", "sourceRevision", "publicationRevision", "membershipRevision", "decisions", "tombstone"]) && typeof p.rowId === "string" && p.rowId.length <= 1e3 && Buffer.byteLength(p.rowId) <= 2e3 && !pubs.has(p.rowId) && hex7(p.sourceRevision) && hex7(p.membershipRevision) && revision4(p.publicationRevision) && typeof p.tombstone === "boolean" && exact10(p.decisions, flags4) && flags4.every((k2) => typeof p.decisions[k2] === "boolean"));
      let tuple;
      try {
        tuple = JSON.parse(p.rowId);
      } catch {
        fail11();
      }
      must3(Array.isArray(tuple) && tuple.length === 3 && ["manual", "item", "subitem"].includes(tuple[0]) && id7(tuple[2]) && (tuple[0] === "manual" ? tuple[1] === null && !p.decisions.grade : id7(tuple[1])));
      if (p.tombstone) must3(flags4.every((k2) => !p.decisions[k2]));
      if (tuple[0] === "manual" && !p.tombstone) must3(manual.has(tuple[2]));
      if (tuple[0] === "item") must3(flags4.filter((k2) => k2 !== "grade").every((k2) => !p.decisions[k2]));
      pubs.add(p.rowId);
    }
    for (const m of s.manualTasks) must3(s.publications.some((p) => p.rowId === JSON.stringify(["manual", null, m.id]) && !p.tombstone));
    for (const v of s.sourceVersions) {
      must3(exact10(v, ["key", "revision", "retired"]) && typeof v.key === "string" && /^(items|scoreSubitems):./.test(v.key) && v.key.length <= 220 && bigint2(v.revision) && typeof v.retired === "boolean" && !versions.has(v.key));
      versions.add(v.key);
    }
  }
  for (const r of state.receipts) {
    must3(exact10(r, ["ownerId", "requestId", "fingerprint", "receipt"]) && r.ownerId === owner && /^[A-Za-z0-9_-]{16,100}$/.test(r.requestId) && hex7(r.fingerprint) && !receipts.has(r.requestId));
    const a = r.receipt;
    must3(exact10(a, ["version", "scope", "binding", "requestId", "rowId", "sourceRevision", "state", "publicationRevision"]) && a.version === 2 && scoped(a.scope, owner) && scopes.has(key2(a.scope)) && exact10(a.binding, ["sessionId", "leaseId", "contextRevision"]) && Object.values(a.binding).every(id7) && a.requestId === r.requestId && typeof a.rowId === "string" && a.rowId.length <= 1e3 && hex7(a.sourceRevision) && ["applied", "rejected"].includes(a.state) && revision4(a.publicationRevision));
    receipts.set(r.requestId, r);
  }
  return { scopes, receipts };
}
function transitions2(before, after) {
  for (const [k, old] of before.scopes) {
    const next = after.scopes.get(k);
    must3(next);
    for (const p of old.publications) {
      const n = next.publications.find((n2) => n2.rowId === p.rowId);
      must3(n);
      must3(json2(n) === json2(p) || n.publicationRevision > p.publicationRevision);
      must3(!p.tombstone || n.tombstone);
    }
    for (const v of old.sourceVersions) {
      const n = next.sourceVersions.find((n2) => n2.key === v.key);
      must3(n && BigInt(n.revision) >= BigInt(v.revision) && (!v.retired || n.retired));
    }
  }
  for (const [id9, receipt2] of before.receipts) must3(json2(after.receipts.get(id9)) === json2(receipt2));
}
function createPublicationV2PostgresPorts({
  executionMode,
  runtimeCapability,
  repository,
  authenticate,
  readCurrent = async (tx, auth) => ({
    canonical: await readCanonical(tx, auth.ownerId),
    now: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date())
  })
}) {
  must3(publicationRuntimeAllowed(executionMode, runtimeCapability) && typeof repository?.transaction === "function" && typeof authenticate === "function" && typeof readCurrent === "function");
  const owned = /* @__PURE__ */ new WeakSet();
  return Object.freeze({
    authenticate: (request, tx, role) => {
      must3(owned.has(tx));
      return authenticate(request, tx, role);
    },
    readCurrent: (tx, auth, scope2) => {
      must3(owned.has(tx) && tx.ownerId === auth.ownerId && scoped(scope2, auth.ownerId));
      return readCurrent(tx, auth, scope2);
    },
    async transaction(action) {
      let revoke = () => {
      };
      try {
        return await repository.transaction(async (_legacy, ports) => {
          must3(typeof ports?.query === "function" && typeof ports.beforeCommit === "function" && typeof ports.canonicalReadMode === "function");
          let live2 = true, owner = null, original = null, stores2 = /* @__PURE__ */ new Map();
          const guards = [], fence = () => must3(live2);
          const state = { scopes: [], receipts: [] };
          const tx = {
            state,
            get ownerId() {
              fence();
              return owner;
            },
            query: (...args) => {
              fence();
              return ports.query(...args);
            },
            canonicalReadMode: () => {
              fence();
              return ports.canonicalReadMode();
            },
            beforeCommit: (fn) => {
              fence();
              must3(typeof fn === "function" && guards.length < 8);
              guards.push(fn);
            },
            async bindOwner(nextOwner) {
              fence();
              must3(uuid6(nextOwner) && (!owner || owner === nextOwner));
              if (owner) return;
              owner = nextOwner;
              let bytes2 = 0, count = 0;
              for (const name of Object.keys(tables2)) {
                const result2 = await tx.query(reads[name], [owner, 10001, 2 * 1024 * 1024, 4 * 1024 * 1024 - bytes2]);
                must3(result2.rows.length <= 1e4 && (count += result2.rows.length) <= 2e4);
                for (const raw of result2.rows) {
                  must3(exact10(raw, ["body"]) && typeof raw.body === "string");
                  bytes2 += Buffer.byteLength(raw.body);
                  must3(bytes2 <= 4 * 1024 * 1024);
                  const r = JSON.parse(raw.body);
                  if (name === "scopes") {
                    must3(exact10(r, ["scope_key", "store_revision", "payload"]) && bigint2(r.store_revision) && exact10(r.payload, ["scope", "manualTasks"]) && scoped(r.payload.scope, owner) && r.scope_key === key2(r.payload.scope) && !stores2.has(r.scope_key));
                    stores2.set(r.scope_key, r.store_revision);
                    state.scopes.push({ ...r.payload, publications: [], sourceVersions: [] });
                  } else if (name === "receipts") {
                    must3(exact10(r, ["request_id", "scope_key", "fingerprint", "payload"]) && r.scope_key === key2(r.payload.scope));
                    state.receipts.push({ ownerId: owner, requestId: r.request_id, fingerprint: r.fingerprint, receipt: r.payload });
                  } else {
                    const s = state.scopes.find((s2) => key2(s2.scope) === r.scope_key);
                    must3(s);
                    if (name === "publications") {
                      must3(exact10(r, ["scope_key", "row_id", "publication_revision", "tombstone", "payload"]) && r.row_id === r.payload.rowId && String(r.payload.publicationRevision) === r.publication_revision && r.tombstone === r.payload.tombstone);
                      s.publications.push(r.payload);
                    } else {
                      must3(exact10(r, ["scope_key", "source_key", "canonical_revision", "retired"]));
                      s.sourceVersions.push({ key: r.source_key, revision: r.canonical_revision, retired: r.retired });
                    }
                  }
                }
              }
              validate2(state, owner);
              original = structuredClone(state);
            }
          };
          owned.add(tx);
          Object.freeze(tx);
          revoke = () => {
            live2 = false;
            owned.delete(tx);
          };
          try {
            const value = await action(tx);
            fence();
            must3(owner && original);
            const final = structuredClone(state), result2 = structuredClone(value);
            const before = validate2(original, owner), after = validate2(final, owner);
            transitions2(before, after);
            for (const [k, s] of after.scopes) {
              const old = before.scopes.get(k), args = [owner, k];
              const root2 = { scope: s.scope, manualTasks: s.manualTasks };
              if (!old) must3((await tx.query("insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values($1::uuid,$2,1,$3::jsonb)", [...args, json2(root2)])).rowCount === 1);
              else if (json2(old) !== json2(s)) must3((await tx.query("update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=$3::jsonb where owner_id=$1::uuid and scope_key=$2 and store_revision=$4::bigint", [...args, json2(root2), stores2.get(k)])).rowCount === 1);
              for (const p of s.publications) {
                const prior = old?.publications.find((v) => v.rowId === p.rowId);
                const values = [...args, p.rowId, String(p.publicationRevision), p.tombstone, json2(p)];
                if (!prior) must3((await tx.query("insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1::uuid,$2,$3,$4::bigint,$5,$6::jsonb)", values)).rowCount === 1);
                else if (json2(prior) !== json2(p)) must3((await tx.query("update n88_private.publication_v2_items set publication_revision=$4::bigint,tombstone=$5,payload=$6::jsonb where owner_id=$1::uuid and scope_key=$2 and row_id=$3 and publication_revision=$7::bigint and payload=$8::jsonb", [...values, String(prior.publicationRevision), json2(prior)])).rowCount === 1);
              }
              for (const v of s.sourceVersions) {
                const prior = old?.sourceVersions.find((p) => p.key === v.key), values = [...args, v.key, v.revision, v.retired];
                if (!prior) must3((await tx.query("insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values($1::uuid,$2,$3,$4::bigint,$5)", values)).rowCount === 1);
                else if (json2(prior) !== json2(v)) must3((await tx.query("update n88_private.publication_v2_high_water set canonical_revision=$4::bigint,retired=$5 where owner_id=$1::uuid and scope_key=$2 and source_key=$3 and canonical_revision=$6::bigint and retired=$7", [...values, prior.revision, prior.retired])).rowCount === 1);
              }
            }
            for (const [id9, r] of after.receipts) if (!before.receipts.has(id9)) must3((await tx.query("insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values($1::uuid,$2,$3,$4,$5::jsonb)", [owner, id9, key2(r.receipt.scope), r.fingerprint, json2(r.receipt)])).rowCount === 1);
            ports.beforeCommit(async () => {
              fence();
              must3(hash5(state) === hash5(final));
              for (const guard of guards) {
                await guard();
                fence();
              }
              must3(hash5(state) === hash5(final));
            });
            return result2;
          } catch {
            live2 = false;
            owned.delete(tx);
            fail11();
          }
        });
      } finally {
        revoke();
      }
    }
  });
}

// drafts/n88-student-portal/activation/v2-student-scope-1031/labels.mjs
import { Buffer as Buffer13 } from "node:buffer";
var LABEL_READ = Object.freeze({
  id: "student-scope-labels-1031",
  name: "safe_student_scope_labels_1031",
  sql: "select n88_private.safe_student_scope_labels_1031($1::text) as envelope",
  maxRows: 2e3,
  maxBytes: 2097152
});
async function readStudentLabels(tx, ownerId, classId, sessionId, today) {
  const r = unwrapEnvelope(await tx.query(LABEL_READ.sql, [encodeArguments([ownerId, classId, sessionId, today])]));
  const fail15 = () => {
    throw Error("n88_scope_labels_unavailable");
  };
  if (r.command !== "SELECT" || r.rowCount !== r.rows.length || r.rows.length > 2e3 || Buffer13.byteLength(JSON.stringify(r)) > LABEL_READ.maxBytes) fail15();
  const keys = ["teaching_id", "subject_id", "term_id", "subject_name", "term_name"], seen = /* @__PURE__ */ new Set();
  for (const row of r.rows) {
    if (!row || Object.keys(row).sort().join(",") !== keys.slice().sort().join(",") || seen.has(row.teaching_id) || keys.some((k) => typeof row[k] !== "string" || !row[k].trim() || row[k].length > (k.endsWith("_name") ? 2e3 : 200) || row[k].includes("\0"))) fail15();
    seen.add(row.teaching_id);
  }
  return r.rows;
}

// drafts/n88-student-portal/publication-v2-canonical.inactive.mjs
var fail12 = () => {
  throw Error("n88_v2_canonical_unavailable");
};
var id8 = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
var active6 = (r) => r && !r.deleted && r.deletedAt == null && r.archivedAt == null;
var flagsOff = () => ({ required: false, scheduled: false, completed: false, grade: false });
var clockDate = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now()));
var receiptScope = (c, owner, teachingId) => {
  const t = c.teachings.find((t2) => t2.id === teachingId && t2.ownerId === owner && active6(t2));
  if (!t) fail12();
  return { ownerId: owner, teachingId: t.id, sectionId: t.sectionId, termId: t.termId, subjectId: t.subjectId };
};
function createCanonicalPublicationV2Ports({
  executionMode,
  runtimeCapability,
  repository,
  teacher,
  numeric: numeric2,
  rollout,
  verifyIngress,
  origin,
  now = Date.now,
  onVerifiedIdentity
}) {
  if (!publicationRuntimeAllowed(executionMode, runtimeCapability) || typeof verifyIngress !== "function" || typeof now !== "function" || !rollout?.configured || !numeric2) fail12();
  const verifyTeacher = createTeacherVerifier({ ...teacher, now });
  const numbers = createNumericCredentialOperations({ ...numeric2, rollout, now });
  const synchronize = createCanonicalAdapter({ rollout });
  const admission2 = /* @__PURE__ */ new WeakMap(), ingress = /* @__PURE__ */ new WeakMap(), tickets = /* @__PURE__ */ new WeakMap();
  const admitted = async (request, tx) => {
    let record = ingress.get(tx);
    if (!record) {
      record = { request, result: await verifyIngress(request, tx) };
      ingress.set(tx, record);
    }
    if (record.request !== request || !record.result?.clientKey) fail12();
    return record.result;
  };
  const read = async (tx, owner) => readCanonical(tx, owner);
  const snapshot2 = async (tx, auth, scope2) => {
    if (!samePublicationScope(scope2, scope2) || scope2.ownerId !== auth.ownerId) fail12();
    const c = await read(tx, auth.ownerId);
    if (!samePublicationScope(receiptScope(c, auth.ownerId, scope2.teachingId), scope2)) fail12();
    proposePublicationRows({ scope: scope2, data: { ...c, ownerId: auth.ownerId } });
    const section = c.sections.find((s) => s.id === scope2.sectionId), term = c.terms.find((t) => t.id === scope2.termId);
    const year = c.years.find((y) => y.id === section?.yearId), today = clockDate(now);
    if (![section, term, year].every((r) => active6(r) && r.status === "active") || term.startDate && term.startDate > today || term.endDate && term.endDate < today || !rollout.admitsTeacher({ ownerId: auth.ownerId, current: true }, {
      ownerId: auth.ownerId,
      current: true,
      classId: scope2.sectionId,
      teachingId: scope2.teachingId
    })) fail12();
    return { canonical: c, now: today };
  };
  const ports = createPublicationV2PostgresPorts({
    executionMode,
    runtimeCapability,
    repository,
    authenticate: async (request, tx, role) => {
      await admitted(request, tx);
      if (role === "teacher") {
        const auth = await verifyTeacher(request.headers?.authorization, request.signal, tx);
        if (!auth?.current || !rollout.allowsOwner(auth.ownerId)) return null;
        await onVerifiedIdentity?.({ role, auth }, request, tx);
        const contexts2 = await tx.query("select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share", [auth.ownerId]);
        if (contexts2.rows.length !== 1 || contexts2.rows[0].active !== true) return null;
        admission2.set(tx, { role, auth });
        return auth;
      }
      if (role !== "student" || request.method !== "GET") return null;
      const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers?.cookie ?? "")?.[1];
      if (!token) return null;
      const found = await tx.query(
        "select payload from n88_private.numeric_sessions where token_hash=$1 for share",
        [createHash14("sha256").update(token).digest("hex")]
      );
      if (found.rows.length !== 1) return null;
      const s = found.rows[0].payload;
      const credentials = await tx.query(
        "select payload from n88_private.numeric_credentials where id=$1::uuid and owner_id=$2::uuid and student_id=$3 and version=$4::bigint for share",
        [s.credentialId, s.ownerId, s.studentId, String(s.version)]
      );
      const contexts = await tx.query("select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share", [s.ownerId]);
      if (credentials.rows.length !== 1 || contexts.rows.length !== 1) return null;
      const db = {
        contexts: contexts.rows.map((r) => ({ namespace: r.namespace, ownerId: r.owner_id, active: r.active })),
        memberships: [],
        sessions: [],
        publications: [],
        numericCredentials: [credentials.rows[0].payload],
        numericSessions: [s]
      };
      let current;
      const handler = numbers.createStudentHandler({
        origin,
        repository: { transaction: (action) => action(db, {
          query: tx.query,
          synchronizeOwner: (owner) => synchronize(db, tx, owner)
        }) },
        verifyIngress: () => admitted(request, tx),
        project: async (_db, member) => {
          const c = await read(tx, member.ownerId), today = clockDate(now), selector = parseStudentScopePath(request.path, "");
          if (!selector) fail12();
          current = {
            ownerId: member.ownerId,
            sessionId: s.id,
            studentId: member.studentId,
            enrollmentId: member.enrollmentId,
            scope: null,
            current: true
          };
          await onVerifiedIdentity?.({ role, auth: current, numeric: { tokenHash: s.tokenHash, credentialId: s.credentialId, studentId: s.studentId, version: String(s.version) }, expiresAt: s.expiresAt }, request, tx);
          const labels = await readStudentLabels(tx, member.ownerId, member.classId, s.id, today), eligible = [];
          for (const t of c.teachings) {
            if (t.ownerId !== member.ownerId || t.sectionId !== member.classId || !active6(t)) continue;
            const term = c.terms.find((r) => r.id === t.termId && r.ownerId === member.ownerId), section = c.sections.find((r) => r.id === member.classId && r.ownerId === member.ownerId), year = c.years.find((r) => r.id === section?.yearId && r.ownerId === member.ownerId);
            if (![term, section, year].every((r) => active6(r) && r.status === "active") || term.yearId !== section.yearId || term.startDate && term.startDate > today || term.endDate && term.endDate < today) continue;
            if (!rollout.admitsTeacher({ ownerId: member.ownerId, current: true }, { ownerId: member.ownerId, current: true, classId: member.classId, teachingId: t.id })) continue;
            const label = labels.find((r) => r.teaching_id === t.id && r.subject_id === t.subjectId && r.term_id === t.termId);
            if (!label) fail12();
            studentPortalPublicationBindings({ canonical: c, ownerId: member.ownerId, studentId: member.studentId, enrollmentId: member.enrollmentId, classId: member.classId, termId: t.termId, now: today });
            eligible.push({ scope: receiptScope(c, member.ownerId, t.id), subject: label.subject_name, term: label.term_name });
          }
          if (eligible.length > 2e3) fail12();
          const choices = eligible.map((e) => ({ teachingId: e.scope.teachingId, label: e.subject + (eligible.filter((v) => v.subject === e.subject).length > 1 ? " \u2014 " + e.term : "") }));
          let selected = selector.teachingId;
          if (selected && !eligible.some((e) => e.scope.teachingId === selected)) fail12();
          if (!selected && eligible.length === 1) selected = eligible[0].scope.teachingId;
          current = {
            ...current,
            scope: selected ? eligible.find((e) => e.scope.teachingId === selected).scope : null,
            choices,
            selectionState: selected ? "selected" : choices.length ? "choice" : "empty",
            eligibilityRevision: createHash14("sha256").update(JSON.stringify([c, labels, choices])).digest("hex")
          };
          return {};
        }
      });
      const result2 = await handler({ ...request, path: "/student/read" });
      if (result2.status !== 200 || !current) return null;
      await onVerifiedIdentity?.({ role, auth: current, numeric: {
        tokenHash: s.tokenHash,
        credentialId: s.credentialId,
        studentId: s.studentId,
        version: String(s.version)
      }, expiresAt: s.expiresAt }, request, tx);
      admission2.set(tx, { role, auth: current });
      return Object.freeze(current);
    },
    readCurrent: async (tx, auth, scope2) => {
      const admitted2 = admission2.get(tx);
      if (!admitted2 || admitted2.auth.ownerId !== auth.ownerId || admitted2.auth.sessionId !== auth.sessionId || admitted2.role === "student" && !samePublicationScope(admitted2.auth.scope, scope2)) fail12();
      return snapshot2(tx, auth, scope2);
    }
  });
  const captureRetirement = async (tx, scope2, kind, sourceId, expectedRevision) => {
    const a = admission2.get(tx);
    if (a?.role !== "teacher" || !["item", "subitem"].includes(kind) || !id8(sourceId)) fail12();
    await tx.bindOwner(a.auth.ownerId);
    const { canonical: c } = await snapshot2(tx, a.auth, scope2);
    const item = kind === "item" ? c.items.find((r) => r.id === sourceId) : c.items.find((r) => r.id === c.scoreSubitems.find((s) => s.id === sourceId)?.itemId);
    const source = kind === "item" ? item : c.scoreSubitems.find((s) => s.id === sourceId);
    if (!active6(item) || !active6(source) || item.teachingId !== scope2.teachingId || source.revision !== expectedRevision) fail12();
    const retired = [{ table: kind === "item" ? "items" : "scoreSubitems", id: source.id, revision: source.revision }];
    if (kind === "item") for (const s of c.scoreSubitems.filter((s2) => s2.itemId === item.id)) retired.push({ table: "scoreSubitems", id: s.id, revision: s.revision });
    const ticket = Object.freeze({});
    const pending = { tx, auth: a.auth, scope: structuredClone(scope2), kind, sourceId, retired, complete: false };
    tickets.set(ticket, pending);
    tx.beforeCommit(async () => {
      if (!pending.complete) fail12();
      const current = await read(tx, pending.auth.ownerId);
      for (const r of pending.retired) {
        const row = current[r.table].find((row2) => row2.id === r.id);
        if (row && (active6(row) || BigInt(row.revision) <= BigInt(r.revision))) fail12();
      }
    });
    return ticket;
  };
  const completeRetirement = async (tx, ticket) => {
    const plan = tickets.get(ticket), a = admission2.get(tx);
    if (!plan || plan.tx !== tx || plan.complete || a?.role !== "teacher" || a.auth.sessionId !== plan.auth.sessionId) fail12();
    const after = await read(tx, plan.auth.ownerId);
    for (const r of plan.retired) {
      const row = after[r.table].find((row2) => row2.id === r.id);
      if (row && (active6(row) || BigInt(row.revision) <= BigInt(r.revision))) fail12();
    }
    let scopes = tx.state.scopes.filter((s) => s.scope.teachingId === plan.scope.teachingId);
    if (!scopes.length) {
      const stored = { scope: plan.scope, manualTasks: [], publications: [], sourceVersions: [] };
      tx.state.scopes.push(stored);
      scopes = [stored];
    }
    for (const s of scopes) {
      for (const r of plan.retired) {
        const key3 = r.table + ":" + r.id, row = after[r.table].find((row2) => row2.id === r.id);
        const v = s.sourceVersions.find((v2) => v2.key === key3);
        const revision5 = row?.revision ?? r.revision;
        if (v) {
          if (BigInt(revision5) < BigInt(v.revision)) fail12();
          v.revision = revision5;
          v.retired = true;
        } else s.sourceVersions.push({ key: key3, revision: revision5, retired: true });
      }
      for (const p of s.publications) {
        const [kind, parent, id9] = JSON.parse(p.rowId);
        if (!p.tombstone && (plan.kind === "item" ? kind !== "manual" && parent === plan.sourceId : kind === "subitem" && id9 === plan.sourceId)) {
          p.publicationRevision++;
          p.tombstone = true;
          p.decisions = flagsOff();
        }
      }
    }
    plan.complete = true;
  };
  return Object.freeze({ ...ports, captureRetirement, completeRetirement });
}

// drafts/n88-student-portal/publication-v2-finite-bridge.inactive.mjs
var fail13 = () => {
  throw Error("n88_v2_bridge_unavailable");
};
var must4 = (v) => {
  if (!v) fail13();
};
var operations2 = new Map(publicationV2FiniteCatalog.map((op) => [op.sql, op]));
function encodeNumeric(op, raw) {
  if (!op.id.startsWith("numeric-") || !Array.isArray(raw?.rows) || raw.rows.length !== 1) return raw;
  const row = raw.rows[0], payload = row?.payload;
  must4(Object.getPrototypeOf(raw) === Object.prototype && row && Object.getPrototypeOf(row) === Object.prototype && payload && Object.getPrototypeOf(payload) === Object.prototype && Buffer.byteLength(JSON.stringify(payload)) <= op.maxBytes);
  if (op.id === "numeric-session") {
    must4(Number.isSafeInteger(payload.membershipRevision) && payload.membershipRevision >= 1);
    return { ...raw, rows: [{ ...row, payload: { ...payload, membershipRevision: String(payload.membershipRevision) } }] };
  }
  must4(payload.format === CREDENTIAL_FORMAT);
  const { format: _format, ...finitePayload } = payload;
  return { ...raw, rows: [{ ...row, payload: finitePayload }] };
}
function decodeNumeric(op, result2) {
  if (!op.id.startsWith("numeric-") || result2.rows.length !== 1) return result2;
  const payload = result2.rows[0].payload;
  if (op.id === "numeric-session") {
    const revision5 = Number(payload.membershipRevision);
    must4(Number.isSafeInteger(revision5) && revision5 >= 1 && String(revision5) === payload.membershipRevision);
    payload.membershipRevision = revision5;
  } else payload.format = CREDENTIAL_FORMAT;
  must4(Buffer.byteLength(JSON.stringify(payload)) <= op.maxBytes);
  return result2;
}
function createInactivePublicationV2FiniteBridge({
  executionMode,
  runtimeCapability,
  enabled = false,
  origin,
  catalogSha256,
  repository,
  verifyAdmission,
  canonical: canonical2,
  now = Date.now,
  budgetMs = 5e3,
  maxOperations = 2e4
} = {}) {
  if (enabled !== true || !publicationRuntimeAllowed(executionMode, runtimeCapability))
    return createPublicationV2Service({ executionMode, runtimeCapability, origin });
  must4(catalogSha256 === publicationV2FiniteCatalogSha256 && typeof repository?.transaction === "function" && typeof verifyAdmission === "function" && typeof now === "function" && canonical2 && Number.isSafeInteger(budgetMs) && budgetMs >= 10 && budgetMs <= 1e4 && Number.isSafeInteger(maxOperations) && maxOperations >= 1 && maxOperations <= 2e4);
  return async (request) => {
    let finite, admitted = null, sourceReady = false, live2 = true, poisoned = false;
    const deadline = now() + budgetMs;
    const fence = () => must4(live2 && !poisoned && now() < deadline);
    const wrappedRepository = { transaction: (action) => repository.transaction(async (legacy, original) => {
      fence();
      must4(typeof original?.query === "function" && typeof original.beforeCommit === "function" && typeof original.canonicalReadMode === "function" && typeof original.executePublicationV2 === "function");
      must4(!finite);
      finite = createInactivePublicationV2FiniteCatalog({
        executionMode,
        runtimeCapability,
        now,
        budgetMs: Math.max(10, deadline - now()),
        maxOperations,
        verifyAdmission: async (sameRequest, signal) => {
          fence();
          must4(sameRequest === request);
          const context = await verifyAdmission(sameRequest, original, signal);
          fence();
          if (admitted) must4(context?.ownerId === admitted.ownerId && context.sessionId === admitted.sessionId && context.role === admitted.role);
          return context;
        },
        executeFixed: async (sql, args, signal) => {
          fence();
          return encodeNumeric(operations2.get(sql), await original.executePublicationV2(sql, args, signal));
        }
      });
      const query = async (sql, args) => {
        fence();
        try {
          const op = operations2.get(sql);
          if (!op) {
            must4(typeof sql === "string" && !/publication_v2_|numeric_sessions|numeric_credentials|n88_private\.contexts/i.test(sql));
            const result3 = await original.query(sql, args);
            fence();
            return result3;
          }
          if (op.effect) must4(sourceReady && admitted);
          const ticket = await finite.prepare(request, { operation: op.id, args });
          const result2 = await finite.execute(request, ticket);
          fence();
          return decodeNumeric(op, result2);
        } catch {
          poisoned = true;
          finite.close(request);
          fail13();
        }
      };
      original.beforeCommit(() => {
        fence();
      });
      return action(legacy, Object.freeze({
        query,
        beforeCommit: (fn) => {
          fence();
          return original.beforeCommit(fn);
        },
        canonicalReadMode: () => {
          fence();
          return original.canonicalReadMode();
        }
      }));
    }) };
    try {
      const ports = createCanonicalPublicationV2Ports({ ...canonical2, executionMode, runtimeCapability, repository: wrappedRepository, origin, now });
      const authenticate = async (r, tx, role) => {
        fence();
        must4(r === request);
        const auth = await ports.authenticate(r, tx, role);
        fence();
        if (auth?.current === true) {
          if (admitted) must4(admitted.ownerId === auth.ownerId && admitted.sessionId === auth.sessionId && admitted.role === role);
          admitted = Object.freeze({ ownerId: auth.ownerId, sessionId: auth.sessionId, role });
        }
        return auth;
      };
      const readCurrent = async (tx, auth, scope2) => {
        fence();
        must4(admitted && auth.ownerId === admitted.ownerId && auth.sessionId === admitted.sessionId);
        const snapshot2 = await ports.readCurrent(tx, auth, scope2);
        fence();
        sourceReady = true;
        return snapshot2;
      };
      return await createPublicationV2Service({
        executionMode,
        runtimeCapability,
        enabled: true,
        origin,
        transaction: ports.transaction,
        authenticate,
        readCurrent
      })(request);
    } catch {
      return await createPublicationV2Service({
        executionMode,
        runtimeCapability,
        enabled: true,
        origin,
        transaction: async () => fail13(),
        authenticate: () => null,
        readCurrent: () => null
      })(request);
    } finally {
      live2 = false;
      finite?.close(request);
    }
  };
}

// drafts/n88-student-portal/activation/v2-package-1028/manifest.json
var manifest_default = {
  version: 1,
  inactive: true,
  taskId: "n88-backend-package-1028",
  runId: "ee57b00d-1c90-4926-8819-77989368fcc1",
  baseSha: "6096fe7c3232c728e5766b2f28b63fb015dde101",
  sourceBridge: "6042d71eeae023380cd5bf7e84061d98d574711b",
  catalogSha256: "373b98aa5f9594c267fed36523d6affecb58ce20c247704d2605b9510d64aad5",
  files: {
    "drafts/n88-student-portal/publication-v2-host.inactive.mjs": "d87cd25fa4dc7e46d870479a31dc2e47d79a403c8314461f29b441c13d8bed9b",
    "drafts/n88-student-portal/publication-v2-finite-bridge.inactive.mjs": "22a3b48ee4c5d20908e51a818cc0d68335b854456957d193948a2ef4dd2b48ae",
    "drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs": "e9dec5fb83b1897a229e328c6b57ffd8a30ff7bf15f3c4a79bc7a98aa7f1f780",
    "drafts/n88-student-portal/publication-v2-canonical.inactive.mjs": "71c3314ce80ad3508d8f8b83bfafcecb37d8b017d9bf9cc563e0fba62b83ecb0",
    "drafts/n88-student-portal/publication-v2-postgres.inactive.mjs": "0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0",
    "drafts/n88-student-portal/publication-v2-service.inactive.mjs": "1950f6a195ac330c81d679fc90773bab84ee1d594e3a6c09a452bcfbc46c3cb6",
    "drafts/n88-student-portal/publication-v2-storage.inactive.sql": "399f6d5f513bf0fd3bb3bb9f8a206018e451ed9d6cc5d9a9b7fa89b3a81525c0",
    "drafts/n88-student-portal/auth-verifier.mjs": "6605b61c5422a090c8220a346f5a1e7c00aea5bedde212f62b54ed6f4592be2c",
    "drafts/n88-student-portal/canonical-adapter.mjs": "bdcf29c5dce1e406657d0361c5c5ee3e56f9fcbd8b4b8912d6f1b90bcde9c19f",
    "drafts/n88-student-portal/canonical-grade-context.mjs": "1595f7588c9a683be570986bde907c2b6a3eb22ccdc3e00fa8cd43eb8c51152f",
    "drafts/n88-student-portal/numeric-credentials.mjs": "99831e65ad3dc977b459d204b7b0a0f1568cbed96f32a1a285a843e732554957",
    "drafts/n88-student-portal/integrated-service.mjs": "6348d080dc6364d8741be4699afe0f8e71954e3ff6ae4dfb4a1b3c0532caaf64",
    "drafts/n88-student-portal/student-projection.mjs": "b407eb68c492c6d861ceb2da9c8dafe24ab3736aa679174ff2539a881bb5d754",
    "drafts/n88-student-portal/activation/private-error-boundary.mjs": "58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e",
    "drafts/n88-student-portal/activation/error-boundary-contract.json": "19640c963f6696dbacfc68fbcac06ecc75765701686aaa08aed4fb52f1f753cb",
    "drafts/n88-student-portal/activation/read-service-20261023/typed-read-operations.json": "ad5445a843afbfe464869fa6789b518d0f80fcb5518cd611c93442da768e9ccf",
    "drafts/n88-student-portal/activation/v2-package-1028/schema.sql": "bf8fbd6c695338f478216f348de2a073cd2e942aed80517715f9945d2204008a",
    "drafts/n88-student-portal/activation/v2-package-1028/boundary-operations.json": "202a22db6b07c212737dcc6bac36a3098b2e1344f4925398538ed624cfd7c553",
    "drafts/n88-student-portal/activation/v2-package-1028/lifecycle-attach.inactive.mjs": "6f0e6b9ff819a43e948135d507227028731c7799d46d879e8e30d86b7a7453e2"
  },
  functions: [
    {
      name: "v2_0dad27a56bfdc5bfab552235",
      definition: "0aadee3865cb4c0575a3abe06ccd6fc1bce7e317da292c133145f6cc2117b91a",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_23ccfc1e16cd0b122d0cb3c3",
      definition: "277c6405d47dfe5f193982cb4d591889081f63aa403f1b53698da3cc963e6573",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_3b143936c792a16ff5425c3d",
      definition: "70ebe1fab16d248125ba9ba231e05e7d5385bddd91973031e5407f8b822564bb",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_5d62e77b02ab6a1fb4e97688",
      definition: "a70a8255124089753437b62447cb542fa21af059ee025fe7641f3e0a02454cf1",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_6d27c8049efec0665b9d1f91",
      definition: "ba27f79ab0a2aeab728a5695543ea64f660c9ee049847bcfa74f86c2badc8822",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_71a3e914da47cf1053850671",
      definition: "1d32ca5bbb74a3d9af199a378c9b71f5dca364db588fd47eadf9298203e9db28",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_74c4aa4d430911e99002af80",
      definition: "ccb5c0585d18d7e94f6765ca522a2426f0c0e4cc2ce363b23ffbd1d25dadbbda",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_7874a827dae2373223bc8adc",
      definition: "0f38db25d66389643b074dd8c46eab079aea0e3e25e8dd082bd58a327e26e533",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_94bb23dac56c2e002713130a",
      definition: "38a36af0320818a809b4dcca844098eadc71af5cf95912ed6aca49d9f89d34d3",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_a3e6d95cdff2d66f56ae84f6",
      definition: "f32fbd2a6ce1d8a3abb4503d67cee64f006d9af38c764ee8d2e0a9011fa6beb6",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_dbe074dae923ca8a3746d390",
      definition: "2b7cba6ba01cd276e76267da996f3a8a336e1e5d9ac1bad149698ff05908b5b5",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_e1b1c0927f6164faeccb760b",
      definition: "a8a31033f93b613376ac1c4695cc6839def54236794c8f698b000ba6605cb471",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_f46afed1e023d013cdabf257",
      definition: "17bd70bd63d76000de1a54906634e3cbecd9941350315af89d0210748ed45960",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    },
    {
      name: "v2_f8a1689cd78951d7fc52ef91",
      definition: "ed645e03679e62e1bf90646037781c367e0b2f421583749b59bfc591df866e33",
      definer: true,
      owner: "n88_v2_guard",
      config: [
        "search_path=pg_catalog"
      ],
      acl: [
        "n88_v2_guard:EXECUTE",
        "n88_v2_runtime:EXECUTE"
      ]
    }
  ],
  sourceEncoding: "utf8-lf-preserve-bom"
};

// drafts/n88-student-portal/activation/v2-student-scope-1031/manifest.json
var manifest_default2 = {
  version: 1,
  aiAuthored: true,
  enabled: false,
  hostedExecuted: false,
  taskId: "continuous-n88-student-scope-source-20261031",
  runId: "9f046986-1f78-4ad5-a247-397a19fc7e66",
  baseSha: "5b77024e36f254a6568a0224abb9ea25d78698af",
  parentBundleSha256: "b76a030cc443ad89c1772d18572a7e54a2d277ec8047b01a1554b1e15d8d9208",
  parentInstallerSha256: "62e06e5ad1b9eaae7407e6017d8d9905e89ee6450ea66c58dbf45144b0128819",
  bundleSha256: "aaaeb23eb4cb5e22c510cda30cc46c9d7f2bcaab798bb6749762aefb7c8eeb62",
  files: {
    "label-delta.sql": "a59d89e86d73a39ed898fb6e99520c3a1a7949ffccb7309e52a9f11080a52d3d",
    "labels.mjs": "edcdae653c939980ea61d3bc5767fec12344e74b06183e02bcda9467a2e81948",
    "../../publication-v2-canonical.inactive.mjs": "e9bb637d11cba86cf0e6f9dc0214509467a2f56e8ca0ee85c2fddb8d76111a4e",
    "../../publication-v2-service.inactive.mjs": "6e75c80ecdd52526d1d0e0705648d59aefb652a0c3b085c5e3daeaf1c65c03b5",
    "../../web-protocol.mjs": "1aa5abc3d62e4b241bc3917942fb761d5d2544cb0d06169f86b49b1c203acf60",
    "../v2-runtime-writer-1031/host.mjs": "8685b3497fbdcb208edfb5050d88b9f261e5a9fee250bc36511b3d35177c4a61"
  },
  labelRead: {
    id: "student-scope-labels-1031",
    name: "safe_student_scope_labels_1031",
    bodySha256: "c404e514185e2d2f84300cf7945d6eb3225ad2eddffc6d58d592bf1771562ff1",
    parameters: [
      "owner:uuid",
      "class:text200",
      "verifiedNumericSession:uuid",
      "currentDate:ISO"
    ],
    maxRows: 2e3,
    maxBytes: 2097152
  },
  storage14Unchanged: true,
  additionalPrivateReaders: 1,
  newPublicFunctions: 0,
  installerSha256: "3cb168cd95a260cd16b89d5f2ad17d9418e79ed2ea0020b2aee45be4e5c4f959",
  disableSha256: "f1328e7eb4464d68dfb707a967ac7b5de11e090620d919729de1cd9950deb77c",
  readbackSha256: "d83fc9c595d76604f3f2c517238732ef0d9ce3adb8ef391d2f66f8b7901ba819"
};

// drafts/n88-student-portal/activation/v2-runtime-writer-1031/host.mjs
var fail14 = () => {
  throw Error("n88_v2_host_unavailable");
};
var must5 = (v) => {
  if (!v) fail14();
};
var sha3 = (s) => createHash15("sha256").update(s).digest("hex");
var clean = (r) => ({ command: r.command, rowCount: r.rowCount, rows: r.rows });
var currentSession = "select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)";
var ingressSql = "select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted";
async function createHostedPublicationV2Runtime({ enabled = false, acquire, assertTransport, expectedSystemIdentifier = "7678071634733212629", canonical: canonical2, origin, now = Date.now, transactionMs = 5e3 } = {}) {
  if (enabled !== true) return Object.freeze({ handle: createPublicationV2Service({ origin }) });
  must5(typeof acquire === "function" && typeof assertTransport === "function" && canonical2 && Number.isInteger(transactionMs) && transactionMs >= 50 && transactionMs <= 5e3);
  const operations3 = new Map(definitions.map((o) => [o.sql, o]));
  const oldReads = new Map([...error_boundary_contract_default.operations, ...typed_read_operations_default].filter((o) => o.sql === currentSession || o.sql === ingressSql || /^select n88_private\.lock_(?:canonical|projection)_sources\(/.test(o.sql) || o.sql.includes("from rakeezx.")).map((o) => [o.sql, o]));
  const prove = async (c) => {
    const token = await authorizeRuntimeConnection(c, { expectedSystemIdentifier, assertTransport });
    await assertVerifiedBoundary(c);
    const fs = (await c.query(`select proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,prosecdef,pg_get_userbyid(proowner) as owner,has_function_privilege(current_user,p.oid,'EXECUTE') as callable,(has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')) as public_call from pg_proc p where pronamespace='n88_private'::regnamespace and proname=any($1::text[]) order by proname`, [manifest_default.functions.map((f) => f.name)])).rows;
    must5(fs.length === 14 && fs.every((f, i) => f.proname === manifest_default.functions[i].name && f.definition === manifest_default.functions[i].definition && f.prosecdef && f.owner === "n88_v2_guard" && !f.callable && !f.public_call));
    const label = (await c.query(`select encode(sha256(convert_to(prosrc,'UTF8')),'hex') as body,prosecdef,pg_get_userbyid(proowner) as owner,proconfig,has_function_privilege(current_user,oid,'EXECUTE') as callable,(has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE')) as public_call from pg_proc where pronamespace='n88_private'::regnamespace and proname='safe_student_scope_labels_1031'`)).rows;
    must5(label.length === 1 && label[0].body === manifest_default2.labelRead.bodySha256 && label[0].prosecdef && label[0].owner === "postgres" && label[0].callable && !label[0].public_call && JSON.stringify(label[0].proconfig) === '["search_path=pg_catalog"]');
    return token;
  };
  const first = await acquire();
  let runtimeCapability;
  try {
    runtimeCapability = await prove(first);
  } finally {
    first.release();
  }
  const repository = createPublicationV2PostgresRepository({ executionMode: "hosted", runtimeCapability, transactionMs, acquire: async () => {
    const c = await acquire();
    try {
      await prove(c);
      return { query: (sql, args) => oldReads.has(sql) ? privateQuery(c, sql, args) : c.query(sql, args), release: (broken) => c.release(broken) };
    } catch {
      c.release(Error("n88_v2_host_unavailable"));
      fail14();
    }
  } });
  const scopeOwner = "select set_config('n88.v2_owner',$1,true)";
  const assemble = (request) => {
    let identity2 = null, located = null, raw, deadline = now() + transactionMs;
    const admission2 = async () => {
      must5(raw && now() < deadline);
      if (identity2) {
        if (identity2.role === "teacher") {
          const r = await raw.query(currentSession, [identity2.ownerId, identity2.sessionId]);
          must5(r.rows.length === 1 && r.rows[0].user_id === identity2.ownerId && r.rows[0].session_id === identity2.sessionId);
        }
        must5(identity2.expiresAt > now());
        return structuredClone(identity2);
      }
      const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers?.cookie ?? "")?.[1];
      must5(token && request.method === "GET");
      return { ownerId: null, sessionId: null, role: "locator", expiresAt: deadline, numeric: {
        tokenHash: sha3(token),
        credentialId: null,
        studentId: null,
        version: null
      }, storageWrite: false };
    };
    const verifyIdentity = async (v, r) => {
      must5(r === request && raw && v.auth.current === true);
      const c = {
        ownerId: v.auth.ownerId,
        sessionId: v.auth.sessionId,
        role: v.role,
        expiresAt: v.role === "student" ? v.expiresAt : deadline,
        numeric: v.numeric ?? null,
        storageWrite: true
      };
      if (identity2) must5(JSON.stringify(identity2) === JSON.stringify(c));
      else identity2 = c;
      await raw.query(scopeOwner, [c.ownerId]);
    };
    const wrapped = { transaction: (action) => repository.transaction(async (legacy, ports) => {
      must5(!raw);
      raw = ports;
      const executePublicationV2 = async (sql, args, signal) => {
        const o = operations3.get(sql);
        must5(o && !signal?.aborted && now() < deadline);
        let r;
        try {
          r = unwrapEnvelope(await ports.query(o.safeSql, [encodeArguments(args)]));
        } catch {
          ports.poison();
          fail14();
        }
        if (o.id === "numeric-session" && r.rows.length === 1) located = r.rows[0].payload;
        return clean(r);
      };
      const query = async (sql, args = []) => {
        if (sql === LABEL_READ.sql) {
          must5(identity2?.role === "student" && located && args.length === 1 && typeof args[0] === "string" && args[0].length <= 4096);
          const labelArgs = JSON.parse(Buffer.from(args[0], "base64").toString("utf8"));
          must5(Array.isArray(labelArgs) && labelArgs.length === 4 && labelArgs[0] === identity2.ownerId && labelArgs[1] === located.classId && labelArgs[2] === identity2.sessionId && /^\d{4}-\d{2}-\d{2}$/.test(labelArgs[3]));
          try {
            return await ports.query(sql, args);
          } catch {
            ports.poison();
            fail14();
          }
        }
        must5(oldReads.has(sql) && args.length === oldReads.get(sql).parameters.length);
        if (sql === currentSession) must5(args.every((v) => typeof v === "string" && /^[a-f0-9-]{36}$/.test(v)));
        else if (sql === ingressSql) must5(typeof args[0] === "string" && /^[a-f0-9-]{36}$/.test(args[0]) && Number.isSafeInteger(args[1]) && args[1] > Math.floor(now() / 1e3) && args[1] <= Math.floor(now() / 1e3) + 32);
        else must5((typeof args[0] === "string" && /^[a-f0-9-]{36}$/.test(args[0]) || Array.isArray(args[0]) && args[0].length === 1 && /^[a-f0-9-]{36}$/.test(args[0][0])) && (Array.isArray(args[0]) ? args[0][0] : args[0]) === (identity2?.ownerId ?? located?.ownerId) && Number.isSafeInteger(args[1]) && args[1] >= 1 && args[1] <= 2001 && (args.length === 2 || args.length === 3 && Number.isSafeInteger(args[2]) && args[2] >= 1 && args[2] <= 2097152));
        return ports.query(sql, args);
      };
      return action(legacy, Object.freeze({ query, beforeCommit: ports.beforeCommit, canonicalReadMode: () => "serial", executePublicationV2 }));
    }) };
    const options = { ...canonical2, onVerifiedIdentity: verifyIdentity };
    return { repository: wrapped, canonical: options, admission: admission2 };
  };
  return Object.freeze({
    async handle(request) {
      const a = assemble(request);
      return await createInactivePublicationV2FiniteBridge({
        executionMode: "hosted",
        runtimeCapability,
        enabled: true,
        origin,
        catalogSha256: publicationV2FiniteCatalogSha256,
        repository: a.repository,
        verifyAdmission: a.admission,
        canonical: a.canonical,
        now,
        budgetMs: transactionMs
      })(request);
    }
  });
}

// drafts/n88-student-portal/web-entry.mjs
function createWebEntry(options) {
  if (!Buffer14.isBuffer(options.ingressKey) || options.ingressKey.length !== 32) throw Error("n88_ingress_configuration");
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
  const legacy = composeService(options, adapter);
  let publication2;
  const publicationEnabled = options.publicationRuntime?.enabled === true;
  const service = async (r) => {
    if (!publicationEnabled || !isPublicationV2Path(r.path)) return legacy(r);
    publication2 ??= createHostedPublicationV2Runtime({
      ...options.publicationRuntime,
      acquire: options.acquire,
      origin: options.origin,
      canonical: {
        rollout: options.rollout,
        teacher: { authUrl: options.authUrl, apiKey: options.apiKey, fetch: options.fetch },
        numeric: { keys: /* @__PURE__ */ new Map([["v1", options.numericKey]]), activeKeyVersion: "v1", reservationKey: options.reservationKey },
        verifyIngress: adapter.verifyIngress
      }
    });
    return (await publication2).handle(r);
  };
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
        const time3 = wire.get("x-n88-time"), nonce = wire.get("x-n88-nonce"), source = wire.get("x-n88-source"), signature = wire.get("x-n88-signature");
        if (!/^\d{10}$/.test(time3 || "") || Math.abs(Math.floor(now() / 1e3) - Number(time3)) > 15 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(nonce || "") || !/^[a-f0-9]{64}$/.test(source || "") || !/^[a-f0-9]{64}$/.test(signature || "")) return privateResponse(401);
        const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(request.body, 24576, abort.signal)));
        if (!envelope || Object.keys(envelope).sort().join(",") !== "body,headers,method,path" || !ROUTE.test(envelope.path) && !(publicationEnabled && typeof envelope.path === "string" && envelope.path.startsWith("/api/n88/") && isPublicationV2Path(envelope.path.slice("/api/n88".length))) || !["GET", "POST"].includes(envelope.method) || !Array.isArray(envelope.headers) || envelope.headers.length !== FORWARDED.length || !envelope.headers.every((v) => typeof v === "string" && v.length <= 8200)) return privateResponse(400);
        const { path, method } = envelope, h = new Headers(FORWARDED.map((n, i) => [n, envelope.headers[i]]));
        const cookie2 = h.get("cookie") || "";
        if (cookie2.length > 4096 || (cookie2.match(/(?:^|;\s*)__Secure-n88-student=/g) || []).length > 1 || (h.get("authorization") || "").length > 8200 || h.get("sec-fetch-site") && h.get("sec-fetch-site") !== "same-origin" || h.has("content-encoding")) return privateResponse(400);
        if (method === "POST" && (h.get("origin") !== options.origin || h.get("content-type") !== "application/json" || h.get("x-n88-csrf") !== "1")) return privateResponse(401);
        const bytes2 = decodeBytes(envelope.body);
        if (bytes2.length > 4096) return privateResponse(413);
        const expected = await mac(options.ingressKey, signingText({ origin: options.origin, path, method, headers: h, bodyHash: await sha(bytes2), time: time3, nonce, source }));
        if (!timingSafeEqual3(Buffer14.from(expected, "hex"), Buffer14.from(signature, "hex"))) return privateResponse(401);
        let body = {};
        if (bytes2.length) body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes2));
        if (!body || Array.isArray(body) || typeof body !== "object" || method === "GET" && bytes2.length) return privateResponse(400);
        const r = { path: path.slice("/api/n88".length), method, body, headers: Object.fromEntries(["cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"].map((n) => [n, h.get(n) || ""])) };
        if (publicationEnabled && isPublicationV2Path(r.path)) {
          r.headers.authorization = h.get("authorization") || "";
          r.signal = abort.signal;
          if (r.path.startsWith("/student/publication-v2/read")) r.body = null;
        }
        envelopes.set(r, { authorization: h.get("authorization"), signal: abort.signal, time: time3, nonce, source });
        try {
          const result2 = await service(r);
          return Response.json({
            status: result2.status,
            body: result2.body,
            cookie: result2.headers?.["Set-Cookie"] || null,
            ...wire.get("x-n88-read-phase-version") === "1" && path === "/api/n88/student/read" && method === "GET" && result2.status === 200 && validateReadPhases(result2.readPhases) ? { readPhases: result2.readPhases } : {}
          }, { headers: PRIVATE_WEB_HEADERS });
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
        }, 18e3);
      })]);
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  };
}

// drafts/n88-student-portal/activation/database-transport.mjs
import { createHash as createHash16 } from "node:crypto";
function databaseConfig(readEnv) {
  const url = readEnv("N88_DATABASE_URL"), db = new URL(url), user = decodeURIComponent(db.username);
  const direct = user === "n88_backend" && db.hostname === "db.xlrubcwjqktzzunrvuns.supabase.co";
  const session = user === "n88_backend.xlrubcwjqktzzunrvuns" && db.hostname === "aws-0-ap-south-1.pooler.supabase.com";
  const ca = readEnv("N88_DATABASE_CA_CERT");
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || session) || !["", "5432"].includes(db.port) || db.pathname !== "/postgres" || !db.password || db.search || db.hash || typeof ca !== "string" || createHash16("sha256").update(ca.replaceAll("\r\n", "\n")).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") throw Error("n88_database_configuration");
  return { connectionString: url, ssl: { ca, rejectUnauthorized: true, servername: db.hostname, minVersion: "TLSv1.2" }, max: 2, connectionTimeoutMillis: 5e3, idleTimeoutMillis: 1e4, statement_timeout: 3e3, query_timeout: 4e3, application_name: "n88-private-server", allowExitOnIdle: true };
}
async function assertRestrictedTransport(client) {
  const r = (await client.query("select session_user as login,current_user as role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl")).rows[0];
  const flags5 = { loginExact: r?.login === "n88_backend", roleExact: r?.role === "n88_backend", upstreamSsl: r?.ssl === true, clientTlsAuthorized: client.connection?.stream?.authorized === true };
  if (Object.values(flags5).some((v) => v !== true)) {
    const e = Error("n88_transport_invariants");
    e.safeReadiness = flags5;
    throw e;
  }
  return flags5;
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
  const key3 = (n) => {
    const s = required(n);
    if (!/^[a-f0-9]{64}$/.test(s)) throw Error("n88_key_configuration");
    return Buffer15.from(s, "hex");
  };
  if (required("N88_SERVICE_REVISION") !== deployment_inactive_default.serviceRevision) throw Error("n88_service_readback_missing");
  const secretKey = key3("N88_HMAC_KEY"), ingressKey = key3("N88_INGRESS_KEY"), numericKey = key3("N88_NUMERIC_KEY"), reservationKey = key3("N88_RESERVATION_KEY");
  if (new Set([secretKey, ingressKey, numericKey, reservationKey].map((k) => k.toString("hex"))).size !== 4) throw Error("n88_separate_keys_required");
  if (secretKey.equals(ingressKey)) throw Error("n88_separate_keys_required");
  const recoveryActiveKeyVersion = required("N88_RECOVERY_ACTIVE_VERSION");
  const versions = required("N88_RECOVERY_VERSIONS").split(",");
  if (versions.length > 8 || new Set(versions).size !== versions.length || versions.some((v) => !/^[A-Za-z0-9_-]{1,40}$/.test(v))) throw Error("n88_configuration");
  const recoveryKeys = new Map(versions.map((v) => [v, key3("N88_RECOVERY_KEY_" + v)]));
  const ca = required("N88_DATABASE_CA_CERT").replaceAll("\r\n", "\n");
  if (createHash17("sha256").update(ca).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") throw Error("n88_database_ca_configuration");
  const pool = new pg.Pool(databaseConfig(readEnv));
  pool.on("error", () => {
  });
  let waiting = 0;
  const acquire = async (measure = async (_name, action) => action()) => {
    if (waiting >= 8) throw Error("n88_pool_capacity");
    waiting++;
    let client;
    try {
      client = await measure("pool", () => pool.connect());
      await measure("boundary", async () => {
        await assertRestrictedTransport(client);
        await assertPrivateDatabaseSession(client);
      });
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
      publicationRuntime: readEnv("N88_PUBLICATION_V2_ENABLED") === "true" ? { enabled: true, assertTransport: assertRestrictedTransport } : void 0,
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
import { Buffer as Buffer16 } from "node:buffer";
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
    const u = new URL(request.url), time3 = request.headers.get("x-n88-time"), nonce = request.headers.get("x-n88-nonce"), sig = request.headers.get("x-n88-signature"), key3 = readEnv("N88_HMAC_KEY");
    if (u.origin !== readEnv("N88_AUTH_URL") || u.pathname !== "/functions/v1/n88-student-portal/readiness" || u.search || request.method !== "POST" || request.headers.get("content-type") !== "application/json" || request.headers.has("content-encoding") || !/^[a-f0-9]{64}$/.test(key3 ?? "") || !/^\d{10}$/.test(time3 ?? "") || Math.abs(Date.now() / 1e3 - Number(time3)) > 15 || !/^[a-f0-9-]{36}$/.test(nonce ?? "") || !/^[a-f0-9]{64}$/.test(sig ?? "")) return privateResponse(401);
    const body = new TextDecoder().decode(await readBytes(request.body, 2, AbortSignal.timeout(2e3)));
    if (body !== "{}") return privateResponse(401);
    const expected = await mac(Buffer16.from(key3, "hex"), JSON.stringify(["n88-readiness-v1", u.origin, u.pathname, time3, nonce, await sha(new TextEncoder().encode(body))]));
    if (!timingSafeEqual4(Buffer16.from(expected, "hex"), Buffer16.from(sig, "hex"))) return privateResponse(401);
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
    const canonical2 = new URL(origin);
    canonical2.pathname = publicPath + u.pathname.slice(local.length);
    canonical2.search = u.search;
    return new Request(canonical2, request);
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
