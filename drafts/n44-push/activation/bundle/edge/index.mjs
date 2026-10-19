// drafts/n44-push/node-globals.mjs
import { Buffer as Buffer2 } from "node:buffer";
import process2 from "node:process";
if (!globalThis.Buffer) globalThis.Buffer = Buffer2;
if (!globalThis.process) globalThis.process = process2;

// drafts/n44-push/activation/private-error-boundary.mjs
import { Buffer as Buffer3 } from "node:buffer";

// drafts/n44-push/activation/error-boundary-contract.json
var error_boundary_contract_default = {
  version: 1,
  encoding: "bound-base64-pg-text-v1",
  controls: [
    "begin",
    "begin isolation level read committed",
    "commit",
    "release savepoint n44_owner",
    "rollback",
    "rollback to savepoint n44_owner",
    "savepoint n44_owner",
    "set local idle_in_transaction_session_timeout='10000ms'",
    "set local idle_in_transaction_session_timeout='15000ms'",
    "set local lock_timeout='1000ms'",
    "set local lock_timeout='3000ms'",
    "set local statement_timeout='3000ms'",
    "set local statement_timeout='6000ms'",
    "set local synchronous_commit=on"
  ],
  sources: [
    {
      file: "drafts/n44-push/postgres-repository.mjs",
      sha256: "37cb45217b9528d73b0e80f3e2dcb7b59eb903430156cc79705afc9d04c380bd"
    },
    {
      file: "drafts/n44-push/backend.mjs",
      sha256: "eb63b4cb6461f960ac99c13c7c747d3f4a1cd1df64bb6c05a798bbac32711ad2"
    },
    {
      file: "drafts/n44-push/auth-verifier.mjs",
      sha256: "929daab85fdb140afcb52e65e3b443e91341b8ef477f807f6278b807b63d364b"
    },
    {
      file: "drafts/n44-push/canonical-source.mjs",
      sha256: "97866ec71f64a16402824088c9714c066037422d84a186005307138250820355"
    }
  ],
  operations: [
    {
      sql: "delete from n44_push_draft.budgets where owner_id=$1 and budget_key=$2",
      name: "boundary_9e1807d6f453dbedb9809f39",
      parameters: [
        "uuid",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.contexts where (owner_id,workspace_id,device_id) in\n      (select c.owner_id,c.workspace_id,c.device_id from n44_push_draft.contexts c where c.owner_id=$1 and c.session_expires_at_ms<$2\n       and not exists(select 1 from n44_push_draft.registrations r where r.owner_id=c.owner_id and r.workspace_id=c.workspace_id and r.device_id=c.device_id)\n       and not exists(select 1 from n44_push_draft.events e where e.owner_id=c.owner_id and e.workspace_id=c.workspace_id and e.device_id=c.device_id)\n       order by c.workspace_id,c.device_id limit 100)",
      name: "boundary_4d3cee78bbdb4f757213f84a",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.contexts where owner_id=$1 and workspace_id=$2 and device_id=$3",
      name: "boundary_8d32ef84bf2998c8aec71bd2",
      parameters: [
        "uuid",
        "text",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.deliveries where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4",
      name: "boundary_1f67d69c789e10b899db588c",
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
      sql: "delete from n44_push_draft.endpoint_claims where owner_id=$1 and fingerprint=$2 and registration_id=$3",
      name: "boundary_a100b221e6220eb46733c104",
      parameters: [
        "uuid",
        "text",
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.events where owner_id=$1 and expires_at_ms<$2",
      name: "boundary_697dbe22cb8ee13cb70e0454",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5",
      name: "boundary_f12b405d648c662c0a1bf70b",
      parameters: [
        "uuid",
        "text",
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
      sql: "delete from n44_push_draft.ingress_nonces where nonce in(select nonce from n44_push_draft.ingress_nonces where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)",
      name: "boundary_f4119f9243f2c69562d54a9a",
      parameters: [
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.ingress_rates where key in(select key from n44_push_draft.ingress_rates where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)",
      name: "boundary_958d83492a17880874f4d951",
      parameters: [
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "delete from n44_push_draft.registrations where owner_id=$1 and registration_id=$2",
      name: "boundary_0963bbb5e4e36d2618b76f49",
      parameters: [
        "uuid",
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "DELETE"
    },
    {
      sql: "insert into n44_push_draft.budgets (owner_id,budget_key,bucket,count,expires_at_ms) values ($1,$2,$3,$4,$5) on conflict (owner_id,budget_key) do update set bucket=excluded.bucket,count=excluded.count,expires_at_ms=excluded.expires_at_ms",
      name: "boundary_72b37da672df631cd5ffdf89",
      parameters: [
        "uuid",
        "text",
        "bigint",
        "integer",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.contexts (owner_id,workspace_id,device_id,active,session_id,session_revision,session_expires_at_ms,consent_revision,push_consent,preferences) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (owner_id,workspace_id,device_id) do update set active=excluded.active,session_id=excluded.session_id,session_revision=excluded.session_revision,session_expires_at_ms=excluded.session_expires_at_ms,consent_revision=excluded.consent_revision,push_consent=excluded.push_consent,preferences=excluded.preferences",
      name: "boundary_2d3d6a94c46add59c6218ca9",
      parameters: [
        "uuid",
        "text",
        "text",
        "boolean",
        "text",
        "text",
        "bigint",
        "text",
        "boolean",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.deliveries (owner_id,workspace_id,device_id,event_id,registration_id,kind,action_path,expires_at_ms,attempts,state,started_at_ms,next_at_ms) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (owner_id,workspace_id,device_id,event_id) do update set registration_id=excluded.registration_id,kind=excluded.kind,action_path=excluded.action_path,expires_at_ms=excluded.expires_at_ms,attempts=excluded.attempts,state=excluded.state,started_at_ms=excluded.started_at_ms,next_at_ms=excluded.next_at_ms",
      name: "boundary_57d83ba2323270546aa35a7a",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "uuid",
        "text",
        "text",
        "bigint",
        "smallint",
        "text",
        "bigint",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.endpoint_claims(fingerprint,owner_id,registration_id) values ($1,$2,$3)",
      name: "boundary_571c1a4b4896750f1651fee0",
      parameters: [
        "text",
        "uuid",
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.events values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      name: "boundary_08b402c7cddf335f98d6f8b1",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "bigint",
        "bigint",
        "jsonb"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values($1,$2,$3) on conflict do nothing returning nonce",
      name: "boundary_2c43bf7a0025aee704aaf82a",
      parameters: [
        "uuid",
        "text",
        "bigint"
      ],
      output: [
        {
          name: "nonce",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.ingress_rates(key,bucket,count,expires_at_ms,kind) values($1,$2,1,$3,$5)\n   on conflict(key) do update set bucket=excluded.bucket,count=case when ingress_rates.bucket=excluded.bucket then ingress_rates.count+1 else 1 end,expires_at_ms=excluded.expires_at_ms\n   where ingress_rates.bucket<>excluded.bucket or ingress_rates.count<$4 returning count",
      name: "boundary_20790036fac6c275f03edd5b",
      parameters: [
        "text",
        "bigint",
        "bigint",
        "integer",
        "text"
      ],
      output: [
        {
          name: "count",
          type: "integer",
          oid: 23
        }
      ],
      effect: false,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.owner_clock(owner_id,high_water_ms) values ($1,0) on conflict (owner_id) do nothing",
      name: "boundary_57d6dbe5ee3c94681d78bab0",
      parameters: [
        "uuid"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "insert into n44_push_draft.registrations (owner_id,registration_id,workspace_id,device_id,session_id,session_revision,consent_revision,state,expires_at_ms,sealed,fingerprint,binding_fingerprint) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (owner_id,registration_id) do update set workspace_id=excluded.workspace_id,device_id=excluded.device_id,session_id=excluded.session_id,session_revision=excluded.session_revision,consent_revision=excluded.consent_revision,state=excluded.state,expires_at_ms=excluded.expires_at_ms,sealed=excluded.sealed,fingerprint=excluded.fingerprint,binding_fingerprint=excluded.binding_fingerprint",
      name: "boundary_833ceede5c0a62e801d753b1",
      parameters: [
        "uuid",
        "uuid",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "bigint",
        "text",
        "text",
        "text"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "INSERT"
    },
    {
      sql: "select (extract(epoch from (($1::date+$2::time) at time zone $3))*1000)::bigint::text as ms",
      name: "boundary_350c9c4a986b92433b3dd0eb",
      parameters: [
        "date",
        "time without time zone",
        "text"
      ],
      output: [
        {
          name: "ms",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4",
      name: "boundary_93cef969458b6f604774a29e",
      parameters: [
        "uuid",
        "text",
        "text",
        "text"
      ],
      output: [
        {
          name: "owner_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "event_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_kind",
          type: "text",
          oid: 25
        },
        {
          name: "source_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_stamp",
          type: "text",
          oid: 25
        },
        {
          name: "due_at_ms",
          type: "bigint",
          oid: 20
        },
        {
          name: "expires_at_ms",
          type: "bigint",
          oid: 20
        },
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
      sql: "select * from n44_push_draft.events where owner_id=$1 order by workspace_id,device_id,event_id limit 101",
      name: "boundary_4c02517c5dfbdffd1c5b454c",
      parameters: [
        "uuid"
      ],
      output: [
        {
          name: "owner_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "event_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_kind",
          type: "text",
          oid: 25
        },
        {
          name: "source_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_stamp",
          type: "text",
          oid: 25
        },
        {
          name: "due_at_ms",
          type: "bigint",
          oid: 20
        },
        {
          name: "expires_at_ms",
          type: "bigint",
          oid: 20
        },
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
      sql: "select budget_key,bucket::text as bucket,count,expires_at_ms::text as expires_at_ms from n44_push_draft.budgets where owner_id=$1 limit $2",
      name: "boundary_7336f6d16dcf854f092f8756",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "budget_key",
          type: "text",
          oid: 25
        },
        {
          name: "bucket",
          type: "text",
          oid: 25
        },
        {
          name: "count",
          type: "integer",
          oid: 23
        },
        {
          name: "expires_at_ms",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select distinct source_stamp from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5",
      name: "boundary_fccb5d5603d6024dad280c6a",
      parameters: [
        "uuid",
        "text",
        "text",
        "text",
        "text"
      ],
      output: [
        {
          name: "source_stamp",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select e.*,r.registration_id from n44_push_draft.events e\n   join n44_push_draft.registrations r on r.owner_id=e.owner_id and r.workspace_id=e.workspace_id and r.device_id=e.device_id\n   left join n44_push_draft.deliveries d on d.owner_id=e.owner_id and d.workspace_id=e.workspace_id and d.device_id=e.device_id and d.event_id=e.event_id\n   where e.due_at_ms<=$1 and e.expires_at_ms>$1 and r.state='active' and r.expires_at_ms>$1\n   and (d.state is null or d.state='retry' and d.next_at_ms<=$1)\n   and (e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id)>($2,$3::uuid,$4,$5,$6,$7::uuid)\n   order by e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id limit $8",
      name: "boundary_ed6266829f26128220d17b4f",
      parameters: [
        "bigint",
        "bigint",
        "uuid",
        "text",
        "text",
        "text",
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "owner_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "event_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_kind",
          type: "text",
          oid: 25
        },
        {
          name: "source_id",
          type: "text",
          oid: 25
        },
        {
          name: "source_stamp",
          type: "text",
          oid: 25
        },
        {
          name: "due_at_ms",
          type: "bigint",
          oid: 20
        },
        {
          name: "expires_at_ms",
          type: "bigint",
          oid: 20
        },
        {
          name: "payload",
          type: "jsonb",
          oid: 3802
        },
        {
          name: "registration_id",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select event_id from n44_push_draft.events where owner_id=$1 limit 101",
      name: "boundary_b7889ac22eace9e5a9d26592",
      parameters: [
        "uuid"
      ],
      output: [
        {
          name: "event_id",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select fingerprint,registration_id from n44_push_draft.endpoint_claims where owner_id=$1 limit $2",
      name: "boundary_0657f8ea1df759451545fc97",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "fingerprint",
          type: "text",
          oid: 25
        },
        {
          name: "registration_id",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms",
      name: "boundary_023fe46060e1428d8c69aecf",
      parameters: [],
      output: [
        {
          name: "now_ms",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select high_water_ms::text as high_water_ms from n44_push_draft.owner_clock where owner_id=$1 for update",
      name: "boundary_357fab36c862af9b35603721",
      parameters: [
        "uuid"
      ],
      output: [
        {
          name: "high_water_ms",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select key from n44_push_draft.ingress_rates where kind=$1 limit 2049",
      name: "boundary_09d8680e5bc700fdfd80e133",
      parameters: [
        "text"
      ],
      output: [
        {
          name: "key",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select n44_push_draft.read_source($1::uuid,$2::text,$3::text) as source",
      name: "boundary_e5608f0030522cd46dc1e398",
      parameters: [
        "uuid",
        "text",
        "text"
      ],
      output: [
        {
          name: "source",
          type: "jsonb",
          oid: 3802
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2",
      name: "boundary_9f189e29d3d1075a21008022",
      parameters: [
        "text",
        "bigint"
      ],
      output: [
        {
          name: "nonce",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select owner_id from n44_push_draft.owner_clock where next_cleanup_ms<=$1 order by next_cleanup_ms,owner_id limit $2 for update skip locked",
      name: "boundary_cb6b899cd42acdb1d185e923",
      parameters: [
        "bigint",
        "bigint"
      ],
      output: [
        {
          name: "owner_id",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select owner_id from n44_push_draft.owner_clock where owner_id=$1 for update",
      name: "boundary_eaec15024b66e2fdb8d82ac8",
      parameters: [
        "uuid"
      ],
      output: [
        {
          name: "owner_id",
          type: "uuid",
          oid: 2950
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select pg_advisory_xact_lock(44001,hashtext($1))",
      name: "boundary_8c5c3b9f064a030860af0a50",
      parameters: [
        "text"
      ],
      output: [
        {
          name: "pg_advisory_xact_lock",
          type: "void",
          oid: 2278
        }
      ],
      effect: false,
      voidResult: true,
      command: "SELECT"
    },
    {
      sql: "select pg_advisory_xact_lock(44002,hashtext($1))",
      name: "boundary_60c5663ba998b06c67fa4941",
      parameters: [
        "text"
      ],
      output: [
        {
          name: "pg_advisory_xact_lock",
          type: "void",
          oid: 2278
        }
      ],
      effect: false,
      voidResult: true,
      command: "SELECT"
    },
    {
      sql: "select registration_id,workspace_id,device_id,session_id,session_revision,consent_revision,state,expires_at_ms::text as expires_at_ms,sealed,fingerprint,binding_fingerprint from n44_push_draft.registrations where owner_id=$1 limit $2",
      name: "boundary_08270c0bd4eb5e36c5b58065",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "registration_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "session_id",
          type: "text",
          oid: 25
        },
        {
          name: "session_revision",
          type: "text",
          oid: 25
        },
        {
          name: "consent_revision",
          type: "text",
          oid: 25
        },
        {
          name: "state",
          type: "text",
          oid: 25
        },
        {
          name: "expires_at_ms",
          type: "text",
          oid: 25
        },
        {
          name: "sealed",
          type: "text",
          oid: 25
        },
        {
          name: "fingerprint",
          type: "text",
          oid: 25
        },
        {
          name: "binding_fingerprint",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)",
      name: "boundary_ad31702f95cafad7fa108a0b",
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
        },
        {
          name: "not_after_ms",
          type: "bigint",
          oid: 20
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select workspace_id,device_id,active,session_id,session_revision,session_expires_at_ms::text as session_expires_at_ms,consent_revision,push_consent,preferences::text as preferences from n44_push_draft.contexts where owner_id=$1 limit $2",
      name: "boundary_768e347f711092582bf45865",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "active",
          type: "boolean",
          oid: 16
        },
        {
          name: "session_id",
          type: "text",
          oid: 25
        },
        {
          name: "session_revision",
          type: "text",
          oid: 25
        },
        {
          name: "session_expires_at_ms",
          type: "text",
          oid: 25
        },
        {
          name: "consent_revision",
          type: "text",
          oid: 25
        },
        {
          name: "push_consent",
          type: "boolean",
          oid: 16
        },
        {
          name: "preferences",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "select workspace_id,device_id,event_id,registration_id,kind,action_path,expires_at_ms::text as expires_at_ms,attempts,state,started_at_ms::text as started_at_ms,next_at_ms::text as next_at_ms from n44_push_draft.deliveries where owner_id=$1 limit $2",
      name: "boundary_fa37dbfb7c54ef1196b0e5fb",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [
        {
          name: "workspace_id",
          type: "text",
          oid: 25
        },
        {
          name: "device_id",
          type: "text",
          oid: 25
        },
        {
          name: "event_id",
          type: "text",
          oid: 25
        },
        {
          name: "registration_id",
          type: "uuid",
          oid: 2950
        },
        {
          name: "kind",
          type: "text",
          oid: 25
        },
        {
          name: "action_path",
          type: "text",
          oid: 25
        },
        {
          name: "expires_at_ms",
          type: "text",
          oid: 25
        },
        {
          name: "attempts",
          type: "smallint",
          oid: 21
        },
        {
          name: "state",
          type: "text",
          oid: 25
        },
        {
          name: "started_at_ms",
          type: "text",
          oid: 25
        },
        {
          name: "next_at_ms",
          type: "text",
          oid: 25
        }
      ],
      effect: false,
      voidResult: false,
      command: "SELECT"
    },
    {
      sql: "update n44_push_draft.owner_clock set high_water_ms=$2 where owner_id=$1",
      name: "boundary_bb27477c2541b2ec5f1428a1",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    },
    {
      sql: "update n44_push_draft.owner_clock set next_cleanup_ms=$2 where owner_id=$1",
      name: "boundary_34c39487076c19af0100723c",
      parameters: [
        "uuid",
        "bigint"
      ],
      output: [],
      effect: true,
      voidResult: false,
      command: "UPDATE"
    }
  ],
  migration: {
    path: "supabase/migrations/20261018191000_n44_private_error_boundary_staged.sql",
    sha256: "e38579bfac4987c6aee47d4ec26e6ba0aae6ef9f4f1c827b8d0faaef5a857e83"
  }
};

// drafts/n44-push/activation/error-boundary-identities.json
var error_boundary_identities_default = [
  {
    name: "boundary_023fe46060e1428d8c69aecf",
    definition: "6b7ba7d24e9cce0f49c256a1b3a1b2da72a2bd6d8957b2af54b3bd00da6dfe8a",
    arguments: "",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0657f8ea1df759451545fc97",
    definition: "c9f6423c42991ed64400e2cb2839db1a161408b446967ebfab02ffac21e36e4b",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_08270c0bd4eb5e36c5b58065",
    definition: "0dab7d29ed1e00d0f82c38903b9f63397a86387df370bb947c488cfdf295f866",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_08b402c7cddf335f98d6f8b1",
    definition: "48c55b0f90a0ba9b80786e7563afabd5331b43700af6b6860284242d9506495d",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_0963bbb5e4e36d2618b76f49",
    definition: "6704818c21e61d24bd31cc39ca998bd5b4c2a7b16bd1d9378d13817007c9578c",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_09d8680e5bc700fdfd80e133",
    definition: "764153b014af270a0821983c4c538d13938071a42a79d6b0b3febcd7e89ce5c3",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_1f67d69c789e10b899db588c",
    definition: "879a719ec4f18038a4b1476b9b11a746768cb990624e66a4c39ac05436af38c0",
    arguments: "p1 text, p2 text, p3 text, p4 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_20790036fac6c275f03edd5b",
    definition: "8db65360da73c8b97ae1ec65d57e0b3510f2988f20e322e86885f07399d88e7f",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_2c43bf7a0025aee704aaf82a",
    definition: "642c30eecdcef523e8b2a7142a4eb6816448c83dfcf3b5a1afd0320d54010609",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_2d3d6a94c46add59c6218ca9",
    definition: "0842058d676aa11144e0e90ee31ab6e9802f27728f24a107dfb465d3475f48a7",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_34c39487076c19af0100723c",
    definition: "4b8ce2718f376ddd41a7f72fb1cd145f6fbf8bb090e762c723efaa2549cfa05f",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_350c9c4a986b92433b3dd0eb",
    definition: "b7ec7f7a06181d8849d6245f9fde9cf54f52130e827bc19455f6089c91c4e5f4",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_357fab36c862af9b35603721",
    definition: "f46e2b6b1b93196e81ca4492940bb6172eda7e2f5d9ee7eba3dc69880467c8fd",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_4c02517c5dfbdffd1c5b454c",
    definition: "0888da3efd3d1f45c7ae91412d48e7bad0f7898828a7190b3f9fd2a3697c4f92",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_4d3cee78bbdb4f757213f84a",
    definition: "11ae2f873cceaee441ca17e31d34b51f7c0930e724c52e1b687df174606b50ec",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_571c1a4b4896750f1651fee0",
    definition: "8c48ae2a00f29cf7916b871fb2745c450ed7c11077a8be375bdf73a3441c8840",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_57d6dbe5ee3c94681d78bab0",
    definition: "a041154032c9dead6a4580344057b5377b672623adfe9619e106616a719962da",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_57d83ba2323270546aa35a7a",
    definition: "f38050eeb33d2ce054b05042e0f838e7446288777cc55f2ba4a60c205257cdc7",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_60c5663ba998b06c67fa4941",
    definition: "d168ece5f15bc2ddcd27ca22d8d2d1198244b4ee66eee4051e67c7c17c66df9f",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_697dbe22cb8ee13cb70e0454",
    definition: "83a96bfc271a769e857ae7abba92d686286bfb4fcd6e5cade4d0193012d7ce30",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_72b37da672df631cd5ffdf89",
    definition: "3d448724473f44286e8fa45346e11550ae2b70d4ccddec99bf3638c450ab0754",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_7336f6d16dcf854f092f8756",
    definition: "bac0350c7d9e21eb403c882faef77cde13f0980ae875d5b406b470987e5e9b15",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_768e347f711092582bf45865",
    definition: "20b9afc9240ce140fc7e90da626360f1a648196030ec6d98d8d3f70894f36305",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_833ceede5c0a62e801d753b1",
    definition: "a652fc6ecc26875c5ac0b4426cf8b5d048cd4c6e3483542dbe1b5ca33ca25b28",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text, p9 text, p10 text, p11 text, p12 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8c5c3b9f064a030860af0a50",
    definition: "b9e31640bd0a199f61f8601a4e1c1ae99c37084f38f5fe51ed450e054b795e10",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_8d32ef84bf2998c8aec71bd2",
    definition: "47b1fecfe6f9f7e851a51ac9aee5a5cb671eb190eb7ffa73038559f5f4c4a71a",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_93cef969458b6f604774a29e",
    definition: "6654410b53244ab822bea950e876643902e178e361a6d5fc308b92a72ae28e56",
    arguments: "p1 text, p2 text, p3 text, p4 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_958d83492a17880874f4d951",
    definition: "e0a757b6955b8852a4a7eff87b25531586ee1de5ddd5b1a1cf07d630c83cd6a1",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_9e1807d6f453dbedb9809f39",
    definition: "4d81625006d47f5a9c149d87b4c25f9b2721a5327a08d7a07dc97db2c6f02ff4",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_9f189e29d3d1075a21008022",
    definition: "f4e274f73b116ee085e3f24c2bda924655fb849f667663d3136bf3fb2280c299",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_a100b221e6220eb46733c104",
    definition: "b9ebf10f2af7802d20a09d50372c16be32faf6de89676d26d3fa62a0f0ce03aa",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_ad31702f95cafad7fa108a0b",
    definition: "c748072917110f4b38a8e8039cd889e509c38b9318e5f1dbbdbdacb1aa38f605",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_b7889ac22eace9e5a9d26592",
    definition: "e5a08b064271fb43a0b234bbfca633dfd03156d2af4de7daebd55183cfb245a0",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_bb27477c2541b2ec5f1428a1",
    definition: "fe51fa1db070aa369e3c4bead685d7cac733763a937cf158498b76fa088b5238",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_cb6b899cd42acdb1d185e923",
    definition: "53fdc29597d19464166f65c0ed95a86c4952bb81bbf419bf8e08858cf3387309",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_e5608f0030522cd46dc1e398",
    definition: "e0c9d2497567ff3e51c1f87d06423748f11e7688bda8dae5ac10cf5f8f692355",
    arguments: "p1 text, p2 text, p3 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_eaec15024b66e2fdb8d82ac8",
    definition: "de0186de5483860bad38aaeabcb5887a18ebbff8f5fe950dd61ac161ac2ef32e",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_ed6266829f26128220d17b4f",
    definition: "2d2ebdbc6e97ef728e01ed2a07fd2f9ba1ea637496610e2557afb5c18b5a7e77",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_f12b405d648c662c0a1bf70b",
    definition: "b8dd7f0dbeec25531739960199897cb9ad9631adb316c6ab4a6c6169db1fe152",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_f4119f9243f2c69562d54a9a",
    definition: "52cf917d65f7d86feed3fe31db37f16cbfd040652c107d69600062b74411ca9e",
    arguments: "p1 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fa37dbfb7c54ef1196b0e5fb",
    definition: "1a1c845e0931caf143733c4b962be21a1d6bb35e87f3e58030739d1a2d4933d4",
    arguments: "p1 text, p2 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  },
  {
    name: "boundary_fccb5d5603d6024dad280c6a",
    definition: "cbc64c00ecd24a9828880e98bc29917626a3d25c04494afaf9c174aee242870a",
    arguments: "p1 text, p2 text, p3 text, p4 text, p5 text",
    definer: false,
    owner: "postgres",
    config: [
      "search_path=pg_catalog"
    ],
    acl: [
      "n44_backend:EXECUTE",
      "postgres:EXECUTE"
    ]
  }
];

// drafts/n44-push/activation/private-error-boundary.mjs
var fail = () => {
  throw Error("n44_database_unavailable");
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
    where n.nspname='n44_push_draft' and p.proname like 'boundary_%' order by p.proname`;
async function assertVerifiedBoundary(client) {
  verified.delete(client);
  const r = await client.query(boundaryCatalogSql);
  if (error_boundary_identities_default.length !== operations.size || JSON.stringify(r.rows) !== JSON.stringify(error_boundary_identities_default)) fail();
  verified.add(client);
}
function pgText(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Buffer3.isBuffer(value)) return "\\x" + value.toString("hex");
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return "{" + value.map((v) => v === null ? "NULL" : Array.isArray(v) ? pgText(v) : '"' + pgText(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"').join(",") + "}";
  fail();
}
async function privateQuery(client, sql, values = []) {
  if (!verified.has(client) || !Array.isArray(values)) fail();
  if (controls.has(sql)) {
    if (sql.startsWith("select set_config")) {
      if (values.length !== 3 || values.some((v) => typeof v !== "string" || !/^\d{1,5}$/.test(v) || Number(v) < 1 || Number(v) > 6e4)) fail();
    } else if (values.length) fail();
    return client.query(sql, values);
  }
  const op = operations.get(sql);
  if (!op || values.length !== op.parameters.length) fail();
  const wire = values.map((v, i) => encodeBoundaryParameter(v !== null && typeof v === "object" && !Buffer3.isBuffer(v) && !(v instanceof Date) && !Array.isArray(v) && ["json", "jsonb"].includes(op.parameters[i]) ? JSON.stringify(v) : v));
  const result2 = await client.query(`select * from n44_push_draft.${op.name}(${wire.map((_, i) => "$" + (i + 1) + "::text").join(",")})`, wire);
  if (op.effect) {
    const count = result2.rows?.[0]?.affected;
    if (result2.rows?.length !== 1 || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) fail();
    return { ...result2, command: op.command, rowCount: Number(count), rows: [] };
  }
  if (op.voidResult) return { ...result2, rows: result2.rows.map(() => ({ [op.output[0].name]: "" })) };
  return result2;
}
var encodeBoundaryParameter = (value) => value === null ? null : Buffer3.from(pgText(value), "utf8").toString("base64");

// drafts/n44-push/session-policy.mjs
var N44_SERVICE_REVISION = "n44-browser-service-v2";
function supportedSessionPolicy(profile, now = Date.now(), sourceSha) {
  return !!(profile && Object.keys(profile).sort().join(",") === "activatedAt,approvalId,approvalState,inactivityTimeoutSeconds,metadataSha256,observedAt,policyChangeRule,serviceRevision,serviceSourceSha,singleSessionPerUser,timeboxSeconds,v" && profile.v === 2 && profile.approvalState === "active" && /^[a-f0-9]{64}$/.test(profile.approvalId) && profile.serviceRevision === N44_SERVICE_REVISION && /^[a-f0-9]{40}$/.test(sourceSha ?? "") && profile.serviceSourceSha === sourceSha && profile.policyChangeRule === "disable-retire-before-auth-policy-change" && profile.timeboxSeconds === null && profile.inactivityTimeoutSeconds === null && profile.singleSessionPerUser === false && /^[a-f0-9]{64}$/.test(profile.metadataSha256) && Number.isSafeInteger(profile.observedAt) && Number.isSafeInteger(profile.activatedAt) && profile.observedAt > 0 && profile.activatedAt >= profile.observedAt && profile.activatedAt - profile.observedAt <= 864e5 && profile.activatedAt <= now + 12e4);
}
var policySessionRevision = (sessionId, profile) => sessionId + ":" + profile.approvalId;

// drafts/n44-push/existing-host.mjs
import { Buffer as Buffer8 } from "node:buffer";
import pg from "pg";
import { p256 as p2562 } from "@noble/curves/nist.js";

// drafts/n44-push/subscription-protector.mjs
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// drafts/n44-push/provider-policy.mjs
import { p256 } from "@noble/curves/nist.js";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

// drafts/n44-push/shared.mjs
var LIMITS = Object.freeze({
  devices: 3,
  registrationWritesPerHour: 6,
  sendsPerHour: 6,
  sendsPerDay: 20,
  ownerSendsPerDay: 40,
  attempts: 3,
  retryBaseMs: 6e4,
  uncertainMs: 3e4,
  registrationMs: 30 * 864e5,
  receiptMs: 864e5,
  jobs: 100
});
var result = (status) => Object.freeze({ status });
var id = (value) => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
var uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function record(value, keys) {
  return value && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === keys.length && keys.every((key) => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d?.enumerable && Object.hasOwn(d, "value");
  });
}
function principal(value, now) {
  return value && [value.ownerId, value.sessionId, value.sessionRevision].every(id) && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now;
}
function current(context, auth, now) {
  return context?.active === true && context.sessionId === auth.sessionId && context.sessionRevision === auth.sessionRevision && context.sessionExpiresAt > now;
}
var deliveryKey = (workspaceId, deviceId, eventId) => JSON.stringify([workspaceId, deviceId, eventId]);
function rate(tx, key, now, windowMs, ceiling) {
  const bucket = Math.floor(now / windowMs);
  const row = tx.get("budgets", key);
  const count = row?.bucket === bucket ? row.count : 0;
  if (count >= ceiling) return false;
  tx.set("budgets", key, { bucket, count: count + 1, expiresAt: (bucket + 1) * windowMs });
  return true;
}

// drafts/n44-push/registration.mjs
function validateSubscription(raw, approvedOrigins = []) {
  if (!record(raw, ["endpoint", "keys"]) || !record(raw.keys, ["p256dh", "auth"]) || typeof raw.endpoint !== "string" || raw.endpoint.length > 2048 || typeof raw.keys.p256dh !== "string" || typeof raw.keys.auth !== "string" || !/^B[A-P][A-Za-z0-9_-]{85}$/.test(raw.keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(raw.keys.auth)) return null;
  if (!raw.keys.p256dh.startsWith("B") || !/[AEIMQUYcgkosw048]$/.test(raw.keys.p256dh) || !/[AQgw]$/.test(raw.keys.auth)) return null;
  try {
    const url = new URL(raw.endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port || url.href !== raw.endpoint || !url.pathname.startsWith("/") || !/^[a-z][a-z0-9.-]*\.[a-z]{2,}$/.test(url.hostname) || !approvedOrigins.includes(url.origin)) return null;
    return Object.freeze({ endpoint: url.href, keys: Object.freeze({ ...raw.keys }) });
  } catch {
    return null;
  }
}
function createRegistrationBoundary({
  verifySession,
  repository,
  protect,
  clock,
  approvedOrigins = [],
  receipt = false
}) {
  const origins = Object.freeze([...approvedOrigins]);
  return Object.freeze({
    async register(transport, body) {
      try {
        if (!record(body, ["registrationId", "workspaceId", "deviceId", "sessionRevision", "consent", "subscription"]) || !uuid(body.registrationId) || ![body.workspaceId, body.deviceId, body.sessionRevision].every(id) || !record(body.consent, ["revision", "push"]) || body.consent.push !== true || !id(body.consent.revision)) return result("rejected");
        const sub = validateSubscription(body.subscription, origins);
        if (!sub) return result("rejected");
        body = structuredClone(body);
        const auth = await verifySession(transport);
        if (!principal(auth, clock()) || auth.sessionRevision !== body.sessionRevision) return result("rejected");
        const secret = await protect(sub);
        if (!secret || typeof secret.sealed !== "string" || secret.sealed.length < 1 || secret.sealed.length > 8192 || !/^[a-f0-9]{64}$/.test(secret.fingerprint) || !/^[a-f0-9]{64}$/.test(secret.bindingFingerprint)) return result("rejected");
        return await repository.atomic(auth.ownerId, (tx) => {
          const now = tx.time(clock());
          const ctx = tx.context(body.workspaceId, body.deviceId);
          if (!principal(auth, now) || !current(ctx, auth, now) || ctx.consentRevision !== body.consent.revision || ctx.pushConsent !== true) return result("rejected");
          const previous = tx.get("registrations", body.registrationId);
          const acknowledged = (r) => receipt ? Object.freeze({ status: "registered", registrationId: r.registrationId, expiresAt: r.expiresAt }) : result("registered");
          if (previous) return previous.state === "active" && previous.expiresAt > now && previous.workspaceId === body.workspaceId && previous.deviceId === body.deviceId && previous.sessionId === auth.sessionId && previous.sessionRevision === auth.sessionRevision && previous.consentRevision === ctx.consentRevision && previous.fingerprint === secret.fingerprint && previous.bindingFingerprint === secret.bindingFingerprint ? acknowledged(previous) : result("rejected");
          const live2 = tx.rows("registrations").filter((r) => r.state === "active" && r.expiresAt > now);
          if (live2.length >= LIMITS.devices || live2.some((r) => r.deviceId === body.deviceId && r.workspaceId === body.workspaceId) || !rate(tx, "register", now, 36e5, LIMITS.registrationWritesPerHour)) return result("limited");
          if (!tx.claimEndpoint(secret.fingerprint, body.registrationId)) return result("rejected");
          tx.set("registrations", body.registrationId, {
            registrationId: body.registrationId,
            workspaceId: body.workspaceId,
            deviceId: body.deviceId,
            sessionId: auth.sessionId,
            sessionRevision: auth.sessionRevision,
            consentRevision: ctx.consentRevision,
            state: "active",
            expiresAt: Math.min(now + LIMITS.registrationMs, ctx.sessionExpiresAt, auth.backgroundExpiresAt ?? auth.expiresAt),
            fingerprint: secret.fingerprint,
            bindingFingerprint: secret.bindingFingerprint,
            sealed: secret.sealed
          });
          return acknowledged(tx.get("registrations", body.registrationId));
        });
      } catch {
        return result("unavailable");
      }
    },
    async revoke(transport, body) {
      try {
        if (!record(body, ["registrationId", "workspaceId", "deviceId"]) || !uuid(body.registrationId) || ![body.workspaceId, body.deviceId].every(id)) return result("rejected");
        body = structuredClone(body);
        const auth = await verifySession(transport);
        if (!principal(auth, clock())) return result("rejected");
        return await repository.atomic(auth.ownerId, (tx) => {
          const now = tx.time(clock());
          if (!principal(auth, now)) return result("rejected");
          const r = tx.get("registrations", body.registrationId);
          if (!r) return result("revoked");
          if (r.workspaceId !== body.workspaceId || r.deviceId !== body.deviceId || r.sessionId !== auth.sessionId || r.sessionRevision !== auth.sessionRevision) return result("rejected");
          if (r.state !== "active") return result("revoked");
          tx.releaseEndpoint(r.fingerprint, r.registrationId);
          tx.set("registrations", r.registrationId, { ...r, state: "revoked", sealed: null, fingerprint: null, bindingFingerprint: null });
          for (const job of tx.rows("deliveries")) if (job.registrationId === r.registrationId && !["sent", "uncertain", "dead"].includes(job.state)) tx.set(
            "deliveries",
            job.key,
            { ...job, state: job.state === "sending" ? "uncertain" : "suppressed" }
          );
          return result("revoked");
        });
      } catch {
        return result("unavailable");
      }
    }
  });
}

// drafts/n44-push/provider-policy.mjs
var policies = /* @__PURE__ */ new Map([
  ["https://fcm.googleapis.com", /^\/(?:wp|fcm\/send)\/[A-Za-z0-9_:-]{1,1900}$/]
]);
var fail2 = () => {
  throw Error("n44_crypto_unavailable");
};
function approvedProviderOrigins(origins = []) {
  if (!Array.isArray(origins) || origins.some((s) => !policies.has(s)) || new Set(origins).size !== origins.length) fail2();
  return Object.freeze([...origins]);
}
function decode64(s, length) {
  if (typeof s !== "string" || s.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(s)) fail2();
  const b = Buffer.from(s, "base64url");
  if (b.toString("base64url") !== s || length !== void 0 && b.length !== length) fail2();
  return b;
}
function validatePoint(s) {
  const point = decode64(s, 65);
  if (point[0] !== 4) fail2();
  const parsed = p256.Point.fromHex(point);
  parsed.assertValidity();
  if (!Buffer.from(parsed.toBytes(false)).equals(point)) fail2();
  return point;
}
function trustedSubscription(raw, origins) {
  const sub = validateSubscription(raw, origins);
  if (!sub) fail2();
  const u = new URL(sub.endpoint);
  if (u.search || !policies.get(u.origin)?.test(u.pathname)) fail2();
  validatePoint(sub.keys.p256dh);
  decode64(sub.keys.auth, 16);
  return sub;
}
function publicAddress(address, family) {
  try {
    if (typeof address !== "string" || isIP(address) !== family || ![4, 6].includes(family) || address.includes("%") || address === "168.63.129.16") return false;
    const ip = ipaddr.parse(address);
    if (ip.range() !== "unicast") return false;
    return family === 4 || ip.match(ipaddr.parseCIDR("2000::/3"));
  } catch {
    return false;
  }
}

// drafts/n44-push/subscription-protector.mjs
var fail3 = () => {
  throw Error("n44_crypto_unavailable");
};
var kid = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(s);
var fp = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
var same = (a, b) => fp(a) && fp(b) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
var canonical = (sub, vapidKeyId) => JSON.stringify([vapidKeyId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]);
var aad = (e) => Buffer.from(JSON.stringify(["n44-subscription", e.v, e.kid, e.hkid, e.vapidKeyId, e.fingerprint, e.bindingFingerprint]));
function createSubscriptionProtector({
  providerOrigins = [],
  activeKeyId,
  sealingKeys,
  fingerprintKeyId,
  endpointHmacKeys,
  bindingHmacKeys,
  activeVapidKeyId
} = {}) {
  const origins = approvedProviderOrigins(providerOrigins);
  function ring(input) {
    if (!(input instanceof Map) || input.size < 1 || input.size > 8) fail3();
    const out = /* @__PURE__ */ new Map();
    for (const [name, key] of input) {
      if (!kid(name) || !Buffer.isBuffer(key) || key.length !== 32) fail3();
      out.set(name, Buffer.from(key));
    }
    return out;
  }
  const seals = ring(sealingKeys), endpoints = ring(endpointHmacKeys), bindings = ring(bindingHmacKeys);
  if (!kid(activeVapidKeyId) || !seals.has(activeKeyId) || !endpoints.has(fingerprintKeyId) || !bindings.has(fingerprintKeyId) || endpoints.size !== bindings.size || [...endpoints.keys()].some((k) => !bindings.has(k))) fail3();
  for (const [left, right] of [[seals, endpoints], [seals, bindings], [endpoints, bindings]])
    for (const a of left.values()) for (const b of right.values()) if (timingSafeEqual(a, b)) fail3();
  let closed = false;
  const check = (signal) => {
    if (closed || signal?.aborted || !origins.length) fail3();
  };
  const fingerprints = (sub, hkid, vapidKeyId) => ({
    fingerprint: createHmac("sha256", endpoints.get(hkid)).update("n44-endpoint\0").update(sub.endpoint).digest("hex"),
    bindingFingerprint: createHmac("sha256", bindings.get(hkid)).update("n44-binding\0").update(canonical(sub, vapidKeyId)).digest("hex")
  });
  return Object.freeze({
    protect(raw, { signal } = {}) {
      try {
        check(signal);
        const sub = trustedSubscription(raw, origins);
        const e = {
          v: 1,
          kid: activeKeyId,
          hkid: fingerprintKeyId,
          vapidKeyId: activeVapidKeyId,
          ...fingerprints(sub, fingerprintKeyId, activeVapidKeyId)
        };
        const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", seals.get(activeKeyId), iv);
        cipher.setAAD(aad(e));
        const plaintext = Buffer.from(JSON.stringify(sub));
        let ciphertext;
        try {
          ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        } finally {
          plaintext.fill(0);
        }
        const sealed = JSON.stringify({
          ...e,
          iv: iv.toString("base64url"),
          ciphertext: ciphertext.toString("base64url"),
          tag: cipher.getAuthTag().toString("base64url")
        });
        check(signal);
        return Object.freeze({ sealed, fingerprint: e.fingerprint, bindingFingerprint: e.bindingFingerprint });
      } catch {
        fail3();
      }
    },
    // Only the private sender calls open, after consuming a committed capability.
    open(sealed, expected, { signal } = {}) {
      let plaintext;
      try {
        check(signal);
        if (typeof sealed !== "string" || Buffer.byteLength(sealed) > 8192) fail3();
        const e = JSON.parse(sealed);
        if (!record(e, ["v", "kid", "hkid", "vapidKeyId", "fingerprint", "bindingFingerprint", "iv", "ciphertext", "tag"]) || JSON.stringify(e) !== sealed || e.v !== 1 || !kid(e.kid) || !kid(e.hkid) || !kid(e.vapidKeyId) || !seals.has(e.kid) || !endpoints.has(e.hkid) || !bindings.has(e.hkid) || !same(e.fingerprint, expected?.fingerprint) || !same(e.bindingFingerprint, expected?.bindingFingerprint)) fail3();
        const decipher = createDecipheriv("aes-256-gcm", seals.get(e.kid), decode64(e.iv, 12));
        decipher.setAAD(aad(e));
        decipher.setAuthTag(decode64(e.tag, 16));
        plaintext = Buffer.concat([decipher.update(decode64(e.ciphertext)), decipher.final()]);
        const sub = trustedSubscription(JSON.parse(plaintext.toString("utf8")), origins);
        const actual = fingerprints(sub, e.hkid, e.vapidKeyId);
        if (!same(actual.fingerprint, e.fingerprint) || !same(actual.bindingFingerprint, e.bindingFingerprint)) fail3();
        check(signal);
        return Object.freeze({ subscription: sub, vapidKeyId: e.vapidKeyId });
      } catch {
        fail3();
      } finally {
        plaintext?.fill(0);
      }
    },
    close() {
      closed = true;
      for (const ring2 of [seals, endpoints, bindings]) {
        for (const key of ring2.values()) key.fill(0);
        ring2.clear();
      }
    }
  });
}

// drafts/n44-push/audited-sender.mjs
import webpush from "web-push";
import { createECDH, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { checkServerIdentity } from "node:tls";
import { performance } from "node:perf_hooks";

// src/lib/notification-center.js
var MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
var validEventId = (value) => typeof value === "string" && /^[a-zA-Z0-9_:%.-]{1,240}$/.test(value);

// src/lib/notification-push-core.js
function safePushAction(value) {
  if (typeof value !== "string" || value.length > 800) return null;
  const match = /^\/teaching\/([^/?#]+)\/(items|attendance\?session=([^/?#]+))$/.exec(value);
  if (!match) return null;
  for (const segment of [match[1], match[3]].filter(Boolean)) {
    try {
      const decoded = decodeURIComponent(segment);
      if (!decoded || decoded.length > 180 || /[\s/\\?#%\u0000-\u001f\u007f]/u.test(decoded) || [".", ".."].includes(decoded) || encodeURIComponent(decoded) !== segment) return null;
    } catch {
      return null;
    }
  }
  return value;
}
function normalizePushPayload(value, now) {
  if (!Number.isFinite(now) || !value || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const keys = ["id", "kind", "expiresAt", "actionPath"];
  if (Reflect.ownKeys(value).length !== keys.length || keys.some((key) => !Object.getOwnPropertyDescriptor(value, key)?.enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))) return null;
  const { id: id2, kind, expiresAt, actionPath } = value;
  if (!validEventId(id2) || !["lesson", "due"].includes(kind) || !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + MAX_EVENT_AGE_MS || !safePushAction(actionPath) || kind === "lesson" !== actionPath.includes("/attendance?session=")) return null;
  return Object.freeze({ id: id2, kind, expiresAt, actionPath });
}
function normalizePushEnvelope(value, now) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(",") !== "binding,event,expiresAt,v" || value.v !== 1 || typeof value.binding !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.binding) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 30 * 864e5) return null;
  const event = normalizePushPayload(value.event, now);
  return event ? Object.freeze({ v: 1, binding: value.binding, expiresAt: value.expiresAt, event }) : null;
}

// drafts/n44-push/committed-permit.mjs
var permits = /* @__PURE__ */ new WeakSet();
function issueCommittedPermit(value) {
  const copy2 = structuredClone(value);
  Object.freeze(copy2.payload);
  if (copy2.binding) Object.freeze(copy2.binding);
  Object.freeze(copy2);
  permits.add(copy2);
  return copy2;
}
function consumeCommittedPermit(value) {
  if (!value || !permits.has(value)) return false;
  permits.delete(value);
  return true;
}

// drafts/n44-push/audited-sender.mjs
var fail4 = () => {
  throw Error("n44_sender_unavailable");
};
var unsafeKeyLogAtImport = process.env.ECE_KEYLOG === "1";
var unsafeDiagnostics = () => unsafeKeyLogAtImport || process.env.ECE_KEYLOG === "1" || process.execArgv.some((s) => s.startsWith("--tls-keylog")) || /(?:^|\s)--tls-keylog(?:[=\s]|$)/.test(process.env.NODE_OPTIONS ?? "");
function createAuditedSender({
  enabled = false,
  providerOrigins = [],
  protector,
  vapidKeys,
  clock = Date.now,
  resolve = lookup,
  httpsRequest = request
} = {}) {
  const origins = approvedProviderOrigins(providerOrigins);
  if (enabled !== true) return Object.freeze({ send: async () => "uncertain", close() {
  } });
  const credentials = /* @__PURE__ */ new Map();
  try {
    if (unsafeDiagnostics()) fail4();
    if (!origins.length || typeof protector?.open !== "function" || typeof clock !== "function" || typeof resolve !== "function" || typeof httpsRequest !== "function") fail4();
    if (!(vapidKeys instanceof Map) || vapidKeys.size < 1 || vapidKeys.size > 8) fail4();
    for (const [keyId, vapid] of vapidKeys) {
      if (typeof keyId !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(keyId)) fail4();
      validatePoint(vapid?.publicKey);
      const secret = decode64(vapid?.privateKey, 32), pair = createECDH("prime256v1");
      try {
        pair.setPrivateKey(secret);
        if (!timingSafeEqual2(pair.getPublicKey(), decode64(vapid.publicKey, 65))) fail4();
      } finally {
        secret.fill(0);
      }
      const subject = new URL(vapid.subject);
      if (vapid.subject.length > 512 || !["mailto:", "https:"].includes(subject.protocol) || subject.username || subject.password || subject.hash || subject.hostname === "localhost" || subject.protocol === "mailto:" && !/^[^\s?]+@[^\s?]+$/.test(subject.pathname)) fail4();
      credentials.set(keyId, Object.freeze({ subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }));
    }
  } catch {
    fail4();
  }
  const active = /* @__PURE__ */ new Set();
  let closed = false;
  return Object.freeze({
    async send(permit, { signal, deadlineMs = 1e4 } = {}) {
      if (!consumeCommittedPermit(permit)) return "uncertain";
      const controller = new AbortController();
      active.add(controller);
      let timer, req, res, done = false;
      const start = performance.now();
      const abort = () => controller.abort();
      try {
        if (closed || unsafeDiagnostics() || signal?.aborted || !Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 1e4) return "uncertain";
        const payload = normalizePushPayload(permit.payload, clock());
        if (!payload) return "uncertain";
        const allowedExpiry = Math.min(payload.expiresAt, permit.binding?.expiresAt ?? Infinity);
        const milliseconds = Math.min(deadlineMs, allowedExpiry - clock());
        if (milliseconds < 1) return "uncertain";
        timer = setTimeout(abort, milliseconds);
        signal?.addEventListener("abort", abort, { once: true });
        const check = () => {
          if (closed || controller.signal.aborted || performance.now() - start >= milliseconds || clock() >= allowedExpiry) fail4();
        };
        check();
        const opened = protector.open(permit.sealed, permit, { signal: controller.signal });
        const signing = credentials.get(opened?.vapidKeyId);
        if (!signing) fail4();
        const sub = trustedSubscription(opened.subscription, origins);
        const url = new URL(sub.endpoint);
        const cancel = new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(Error("n44_sender_unavailable")), { once: true }));
        const answers = await Promise.race([Promise.resolve().then(() => resolve(url.hostname, { all: true, verbatim: true })), cancel]);
        check();
        if (!Array.isArray(answers) || answers.length < 1 || answers.length > 16 || answers.some((a) => !publicAddress(a.address, a.family))) fail4();
        const pinned = Object.freeze({ address: answers[0].address, family: answers[0].family });
        const ttl = Math.floor((allowedExpiry - clock()) / 1e3);
        if (ttl < 1) fail4();
        const wire = permit.binding ? normalizePushEnvelope({ v: 1, binding: permit.binding.id, expiresAt: permit.binding.expiresAt, event: payload }, clock()) : payload;
        if (!wire) fail4();
        const details = webpush.generateRequestDetails(sub, JSON.stringify(wire), {
          vapidDetails: signing,
          TTL: ttl,
          contentEncoding: "aes128gcm",
          urgency: "normal"
        });
        if (details.endpoint !== sub.endpoint || details.method !== "POST" || !Buffer.isBuffer(details.body)) fail4();
        check();
        details.headers.TTL = Math.min(ttl, Math.floor((allowedExpiry - clock()) / 1e3));
        if (details.headers.TTL < 1) fail4();
        return await new Promise((resolveOutcome) => {
          const finish = (outcome) => {
            if (done) return;
            done = true;
            controller.signal.removeEventListener("abort", stop);
            resolveOutcome(outcome);
            res?.destroy();
            req?.destroy();
          };
          const stop = () => finish("uncertain");
          controller.signal.addEventListener("abort", stop, { once: true });
          if (controller.signal.aborted) {
            stop();
            return;
          }
          try {
            const options = {
              protocol: "https:",
              hostname: url.hostname,
              port: 443,
              path: url.pathname,
              method: "POST",
              headers: details.headers,
              servername: url.hostname,
              rejectUnauthorized: true,
              checkServerIdentity,
              minVersion: "TLSv1.2",
              agent: false,
              autoSelectFamily: false,
              family: pinned.family,
              maxHeaderSize: 8192,
              signal: controller.signal,
              // The actual connection never performs a second DNS resolution.
              lookup(host, opts, callback) {
                if (host !== url.hostname || controller.signal.aborted || !publicAddress(pinned.address, pinned.family)) {
                  callback(Error("n44_sender_unavailable"));
                  return;
                }
                if (opts?.all) callback(null, [{ ...pinned }]);
                else callback(null, pinned.address, pinned.family);
              }
            };
            req = httpsRequest(options, (response) => {
              res = response;
              try {
                check();
              } catch {
                finish("uncertain");
                return;
              }
              const code = response.statusCode;
              finish([201, 202].includes(code) ? "accepted" : code === 404 || code === 410 ? code : code === 429 ? "not_accepted_retryable" : "uncertain");
            });
            req.on("error", () => finish("uncertain"));
            req.on("socket", (socket) => socket.once("secureConnect", () => {
              if (socket.authorized !== true || socket.remoteAddress !== pinned.address) finish("uncertain");
            }));
            check();
            req.end(details.body);
          } catch {
            finish("uncertain");
          }
        });
      } catch {
        return "uncertain";
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        controller.abort();
        req?.destroy();
        res?.destroy();
        active.delete(controller);
      }
    },
    close() {
      closed = true;
      for (const c of active) c.abort();
      credentials.clear();
    }
  });
}

// drafts/n44-push/runtime-gateway.mjs
import { createServer } from "node:http";
import { performance as performance2 } from "node:perf_hooks";

// src/lib/notification-state.js
function notificationCategoryAllowed(event, preferences2) {
  return event.critical === true || !["lesson", "due"].includes(event.kind) || preferences2?.[event.kind] !== false;
}
var LESSON_LEAD_MINUTES = [5, 10, 15, 20, 30, 45, 60];
var DUE_STAGES = [3, 2, 1, 0];

// drafts/n44-push/postgres-repository.mjs
var DAY = 864e5;
var receipts = LIMITS.registrationWritesPerHour * 24 * Math.ceil((LIMITS.registrationMs + LIMITS.receiptMs) / DAY);
var SNAPSHOT_LIMITS = Object.freeze({
  contexts: receipts + LIMITS.devices,
  registrations: receipts,
  deliveries: LIMITS.jobs,
  budgets: 2 * receipts + 2
});
var fail5 = () => {
  throw new Error("n44_repository_unavailable");
};
var must = (condition) => {
  if (!condition) fail5();
};
var ownerUUID = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
var integer = (value) => {
  must(typeof value === "number" || typeof value === "bigint" || typeof value === "string" && /^(0|[1-9][0-9]{0,15})$/.test(value));
  const n = Number(value);
  must(Number.isSafeInteger(n) && n >= 0);
  return n;
};
var fp2 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var clone = (value) => structuredClone(value);
var exact = (value, keys) => must(record(value, keys));
var ctxKey = (w, d) => JSON.stringify([w, d]);
var fields = {
  contexts: ["workspaceId", "deviceId", "active", "sessionId", "sessionRevision", "sessionExpiresAt", "consentRevision", "pushConsent", "preferences"],
  registrations: ["registrationId", "workspaceId", "deviceId", "sessionId", "sessionRevision", "consentRevision", "state", "expiresAt", "sealed", "fingerprint", "bindingFingerprint"],
  deliveries: ["key", "registrationId", "workspaceId", "deviceId", "payload", "expiresAt", "attempts", "state", "startedAt", "nextAt"],
  budgets: ["bucket", "count", "expiresAt"]
};
var columns = {
  contexts: ["workspace_id", "device_id", "active", "session_id", "session_revision", "session_expires_at_ms", "consent_revision", "push_consent", "preferences"],
  registrations: ["registration_id", "workspace_id", "device_id", "session_id", "session_revision", "consent_revision", "state", "expires_at_ms", "sealed", "fingerprint", "binding_fingerprint"],
  deliveries: ["workspace_id", "device_id", "event_id", "registration_id", "kind", "action_path", "expires_at_ms", "attempts", "state", "started_at_ms", "next_at_ms"],
  budgets: ["budget_key", "bucket", "count", "expires_at_ms"]
};
var primary = {
  contexts: ["workspace_id", "device_id"],
  registrations: ["registration_id"],
  deliveries: ["workspace_id", "device_id", "event_id"],
  budgets: ["budget_key"]
};
var queries = Object.fromEntries(Object.keys(columns).map((table) => {
  const cols = columns[table], pk = primary[table];
  return [table, {
    read: `select ${cols.map((c) => /(_ms|^bucket$)/.test(c) ? `${c}::text as ${c}` : c === "preferences" ? "preferences::text as preferences" : c).join(",")} from n44_push_draft.${table} where owner_id=$1 limit $2`,
    put: `insert into n44_push_draft.${table} (owner_id,${cols.join(",")}) values (${["owner_id", ...cols].map((_, i) => `$${i + 1}`).join(",")}) on conflict (owner_id,${pk.join(",")}) do update set ${cols.filter((c) => !pk.includes(c)).map((c) => `${c}=excluded.${c}`).join(",")}`,
    remove: `delete from n44_push_draft.${table} where owner_id=$1 and ${pk.map((c, i) => `${c}=$${i + 2}`).join(" and ")}`
  }];
}));
function preferences(p) {
  exact(p, ["lesson", "due", "lessonMinutes", "dueDays", "timezone", "quiet"]);
  must(typeof p.lesson === "boolean" && typeof p.due === "boolean" && LESSON_LEAD_MINUTES.includes(p.lessonMinutes));
  must(Array.isArray(p.dueDays) && p.dueDays.length <= DUE_STAGES.length && new Set(p.dueDays).size === p.dueDays.length && p.dueDays.every((d) => DUE_STAGES.includes(d)));
  must(typeof p.timezone === "string" && p.timezone.length <= 100);
  new Intl.DateTimeFormat("en", { timeZone: p.timezone });
  if (p.quiet !== null) {
    exact(p.quiet, ["start", "end"]);
    must([p.quiet.start, p.quiet.end].every((n) => Number.isInteger(n) && n >= 0 && n < 1440));
  }
  must(Buffer.byteLength(JSON.stringify(p)) <= 2048);
}
function validate(table, key, r) {
  exact(r, fields[table]);
  must(Buffer.byteLength(JSON.stringify(r)) <= 16384);
  if (table === "contexts") {
    must([r.workspaceId, r.deviceId, r.sessionId, r.sessionRevision, r.consentRevision].every(id));
    must(key === ctxKey(r.workspaceId, r.deviceId) && typeof r.active === "boolean" && typeof r.pushConsent === "boolean");
    must(integer(r.sessionExpiresAt) === r.sessionExpiresAt);
    preferences(r.preferences);
  } else if (table === "registrations") {
    must(uuid(key) && key === r.registrationId && [r.workspaceId, r.deviceId, r.sessionId, r.sessionRevision, r.consentRevision].every(id));
    must(["active", "revoked", "dead"].includes(r.state) && integer(r.expiresAt) === r.expiresAt);
    must(r.state === "active" ? fp2(r.fingerprint) && fp2(r.bindingFingerprint) && typeof r.sealed === "string" && Buffer.byteLength(r.sealed) > 0 && Buffer.byteLength(r.sealed) <= 8192 : r.fingerprint === null && r.bindingFingerprint === null && r.sealed === null);
  } else if (table === "deliveries") {
    exact(r.payload, ["id", "kind", "expiresAt", "actionPath"]);
    must([r.workspaceId, r.deviceId].every(id) && uuid(r.registrationId));
    must(typeof key === "string" && key.length <= 650 && key === r.key && key === deliveryKey(r.workspaceId, r.deviceId, r.payload.id));
    const parsed = JSON.parse(key);
    must(Array.isArray(parsed) && parsed.length === 3 && JSON.stringify(parsed) === key);
    must(typeof r.payload.id === "string" && /^[a-zA-Z0-9_:%.-]{1,240}$/.test(r.payload.id) && ["lesson", "due"].includes(r.payload.kind));
    must(typeof r.payload.actionPath === "string" && r.payload.actionPath.length >= 1 && r.payload.actionPath.length <= 800);
    must([r.expiresAt, r.startedAt, r.nextAt, r.attempts].every((n) => integer(n) === n) && r.payload.expiresAt === r.expiresAt && r.startedAt < r.expiresAt);
    must(r.attempts <= LIMITS.attempts && ["sending", "retry", "sent", "uncertain", "suppressed", "dead"].includes(r.state) && (r.attempts > 0 || r.state === "suppressed"));
  } else {
    must(key === "register" || key === "owner-day" || /^(hour|day):[A-Za-z0-9_.:-]{1,180}$/.test(key));
    must([r.bucket, r.count, r.expiresAt].every((n) => integer(n) === n) && r.count >= 1 && r.count <= LIMITS.ownerSendsPerDay);
    const window = key === "register" || key.startsWith("hour:") ? 36e5 : DAY;
    const cap = key === "register" ? LIMITS.registrationWritesPerHour : key === "owner-day" ? LIMITS.ownerSendsPerDay : key.startsWith("hour:") ? LIMITS.sendsPerHour : LIMITS.sendsPerDay;
    must(r.count <= cap && Number.isSafeInteger((r.bucket + 1) * window) && r.expiresAt === (r.bucket + 1) * window);
  }
  return r;
}
function decode(table, r) {
  exact(r, columns[table]);
  let row, key;
  if (table === "contexts") {
    must(typeof r.preferences === "string" && Buffer.byteLength(r.preferences) <= 2048);
    row = {
      workspaceId: r.workspace_id,
      deviceId: r.device_id,
      active: r.active,
      sessionId: r.session_id,
      sessionRevision: r.session_revision,
      sessionExpiresAt: integer(r.session_expires_at_ms),
      consentRevision: r.consent_revision,
      pushConsent: r.push_consent,
      preferences: JSON.parse(r.preferences)
    };
    key = ctxKey(row.workspaceId, row.deviceId);
  } else if (table === "registrations") {
    row = {
      registrationId: r.registration_id,
      workspaceId: r.workspace_id,
      deviceId: r.device_id,
      sessionId: r.session_id,
      sessionRevision: r.session_revision,
      consentRevision: r.consent_revision,
      state: r.state,
      expiresAt: integer(r.expires_at_ms),
      sealed: r.sealed,
      fingerprint: r.fingerprint,
      bindingFingerprint: r.binding_fingerprint
    };
    key = row.registrationId;
  } else if (table === "deliveries") {
    key = deliveryKey(r.workspace_id, r.device_id, r.event_id);
    row = {
      key,
      registrationId: r.registration_id,
      workspaceId: r.workspace_id,
      deviceId: r.device_id,
      payload: { id: r.event_id, kind: r.kind, expiresAt: integer(r.expires_at_ms), actionPath: r.action_path },
      expiresAt: integer(r.expires_at_ms),
      attempts: integer(r.attempts),
      state: r.state,
      startedAt: integer(r.started_at_ms),
      nextAt: integer(r.next_at_ms)
    };
  } else {
    key = r.budget_key;
    row = { bucket: integer(r.bucket), count: integer(r.count), expiresAt: integer(r.expires_at_ms) };
  }
  return [key, validate(table, key, row)];
}
function encode(table, key, r) {
  if (table === "contexts") return [r.workspaceId, r.deviceId, r.active, r.sessionId, r.sessionRevision, r.sessionExpiresAt, r.consentRevision, r.pushConsent, JSON.stringify(r.preferences)];
  if (table === "registrations") return fields.registrations.map((f) => r[f]);
  if (table === "deliveries") return [r.workspaceId, r.deviceId, r.payload.id, r.registrationId, r.payload.kind, r.payload.actionPath, r.expiresAt, r.attempts, r.state, r.startedAt, r.nextAt];
  return [key, r.bucket, r.count, r.expiresAt];
}
function keyValues(table, key, row) {
  if (table === "contexts") return [row.workspaceId, row.deviceId];
  if (table === "deliveries") return [row.workspaceId, row.deviceId, row.payload.id];
  return [key];
}
var inWork = false;
function createPostgresRepository({ acquire, prepare = async () => ({}) }) {
  must(typeof acquire === "function");
  function run(ownerId, work, writer) {
    must(!inWork && ownerUUID(ownerId) && typeof work === "function" && work.constructor?.name !== "AsyncFunction");
    return execute(ownerId, work, writer);
  }
  async function execute(ownerId, work, writer) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let c, begun = false, committed = false, broken = false, retry = false;
      try {
        c = await acquire();
        must(c && typeof c.query === "function" && typeof c.release === "function");
        await c.query("begin isolation level read committed");
        begun = true;
        await c.query("set local statement_timeout='6000ms'");
        await c.query("set local lock_timeout='3000ms'");
        await c.query("set local idle_in_transaction_session_timeout='10000ms'");
        await c.query("set local synchronous_commit=on");
        await c.query("insert into n44_push_draft.owner_clock(owner_id,high_water_ms) values ($1,0) on conflict (owner_id) do nothing", [ownerId]);
        const lock = await c.query("select high_water_ms::text as high_water_ms from n44_push_draft.owner_clock where owner_id=$1 for update", [ownerId]);
        must(lock.rows.length === 1);
        exact(lock.rows[0], ["high_water_ms"]);
        const db = await c.query("select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms");
        must(db.rows.length === 1);
        exact(db.rows[0], ["now_ms"]);
        let highWater = Math.max(integer(lock.rows[0].high_water_ms), integer(db.rows[0].now_ms));
        const state = {}, original = {};
        let bytes = 0;
        for (const table of Object.keys(columns)) {
          const loaded2 = await c.query(queries[table].read, [ownerId, SNAPSHOT_LIMITS[table] + 1]);
          must(loaded2.rows.length <= SNAPSHOT_LIMITS[table]);
          state[table] = /* @__PURE__ */ new Map();
          for (const raw of loaded2.rows) {
            const [key, row] = decode(table, raw);
            must(!state[table].has(key));
            state[table].set(key, row);
            bytes += Buffer.byteLength(JSON.stringify(row));
            must(bytes <= 32 * 1024 * 1024);
          }
          original[table] = clone(state[table]);
        }
        const loaded = await c.query("select fingerprint,registration_id from n44_push_draft.endpoint_claims where owner_id=$1 limit $2", [ownerId, SNAPSHOT_LIMITS.registrations + 1]);
        must(loaded.rows.length <= SNAPSHOT_LIMITS.registrations);
        const claims = /* @__PURE__ */ new Map();
        for (const row of loaded.rows) {
          exact(row, ["fingerprint", "registration_id"]);
          must(fp2(row.fingerprint) && uuid(row.registration_id) && !claims.has(row.fingerprint));
          const r = state.registrations.get(row.registration_id);
          must(r?.state === "active" && r.fingerprint === row.fingerprint);
          claims.set(row.fingerprint, row.registration_id);
        }
        for (const r of state.registrations.values()) if (r.state === "active") must(claims.get(r.fingerprint) === r.registrationId);
        const oldClaims = clone(claims);
        const extension = await prepare(c, ownerId, state);
        let open = true;
        const guard = () => must(open);
        const tableMap = (table) => {
          guard();
          must(Object.hasOwn(fields, table) && (writer || table !== "contexts"));
          return state[table];
        };
        const tx = Object.freeze({
          time(now) {
            guard();
            highWater = Math.max(highWater, integer(now));
            return highWater;
          },
          sourceEvent(...args) {
            guard();
            return clone(extension.sourceEvent?.(...args) ?? null);
          },
          context(w, d) {
            guard();
            must(id(w) && id(d));
            return clone(state.contexts.get(ctxKey(w, d)) ?? null);
          },
          get(table, key) {
            return clone(tableMap(table).get(key));
          },
          rows(table) {
            return clone([...tableMap(table).values()]);
          },
          entries(table) {
            return clone([...tableMap(table).entries()]);
          },
          set(table, key, row) {
            const map = tableMap(table);
            validate(table, key, row);
            map.set(key, clone(row));
            must(map.size <= SNAPSHOT_LIMITS[table]);
          },
          delete(table, key) {
            tableMap(table).delete(key);
          },
          claimEndpoint(fingerprint, rid) {
            guard();
            must(fp2(fingerprint) && uuid(rid));
            const old = claims.get(fingerprint);
            if (old && old !== rid) return false;
            claims.set(fingerprint, rid);
            return true;
          },
          releaseEndpoint(fingerprint, rid) {
            guard();
            must(fp2(fingerprint) && uuid(rid));
            if (claims.get(fingerprint) === rid) claims.delete(fingerprint);
          }
        });
        let value;
        try {
          inWork = true;
          value = work(tx);
          if (value && typeof value.then === "function") {
            Promise.resolve(value).catch(() => {
            });
            fail5();
          }
          value = clone(value);
        } finally {
          inWork = false;
          open = false;
        }
        await extension.beforeCommit?.();
        bytes = 0;
        for (const table of Object.keys(columns)) {
          must(state[table].size <= SNAPSHOT_LIMITS[table]);
          for (const [key, row] of state[table]) {
            validate(table, key, row);
            bytes += Buffer.byteLength(JSON.stringify(row));
            must(bytes <= 32 * 1024 * 1024);
          }
        }
        for (const [fingerprint, rid] of claims) {
          const r = state.registrations.get(rid);
          must(r?.state === "active" && r.fingerprint === fingerprint);
        }
        for (const r of state.registrations.values()) if (r.state === "active") must(claims.get(r.fingerprint) === r.registrationId);
        for (const [fingerprint, rid] of oldClaims) if (claims.get(fingerprint) !== rid)
          await c.query("delete from n44_push_draft.endpoint_claims where owner_id=$1 and fingerprint=$2 and registration_id=$3", [ownerId, fingerprint, rid]);
        for (const table of ["deliveries", "budgets", "registrations", "contexts"]) {
          for (const [key, row] of original[table]) if (!state[table].has(key)) await c.query(queries[table].remove, [ownerId, ...keyValues(table, key, row)]);
        }
        for (const table of Object.keys(columns)) {
          for (const [key, row] of state[table]) if (original[table].has(key) && JSON.stringify(row) !== JSON.stringify(original[table].get(key))) await c.query(queries[table].put, [ownerId, ...encode(table, key, row)]);
          for (const [key, row] of state[table]) if (!original[table].has(key)) await c.query(queries[table].put, [ownerId, ...encode(table, key, row)]);
        }
        for (const [fingerprint, rid] of claims) if (oldClaims.get(fingerprint) !== rid)
          await c.query("insert into n44_push_draft.endpoint_claims(fingerprint,owner_id,registration_id) values ($1,$2,$3)", [fingerprint, ownerId, rid]);
        await c.query("update n44_push_draft.owner_clock set high_water_ms=$2 where owner_id=$1", [ownerId, highWater]);
        await c.query("commit");
        committed = true;
        return value;
      } catch (e) {
        const definitive = ["40001", "40P01"].includes(e?.code) && e?.severity === "ERROR";
        let rolledBack = false;
        if (c && begun && !committed) {
          try {
            await c.query("rollback");
            rolledBack = true;
          } catch {
            broken = true;
          }
        }
        retry = definitive && rolledBack && attempt === 0;
        broken ||= !definitive;
        if (!retry) fail5();
      } finally {
        if (c) {
          try {
            await c.release(broken ? new Error("n44_repository_unavailable") : void 0);
          } catch {
          }
        }
      }
      if (!retry) fail5();
    }
    fail5();
  }
  return Object.freeze({
    atomic: (ownerId, work) => run(ownerId, work, false),
    // Trusted canonical writer preparation ONLY. Not HTTP/client authorization.
    writeContexts: (ownerId, work) => run(ownerId, work, true)
  });
}

// drafts/n44-push/delivery.mjs
function quietNow(preferences2, now) {
  try {
    if (!preferences2 || typeof preferences2.timezone !== "string") return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: preferences2.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(now));
    const minute = Number(parts.find((p) => p.type === "hour").value) * 60 + Number(parts.find((p) => p.type === "minute").value);
    const q = preferences2.quiet;
    if (q === null) return false;
    if (!q || ![q.start, q.end].every((v) => Number.isInteger(v) && v >= 0 && v < 1440)) return null;
    return q.start === q.end || (q.start < q.end ? minute >= q.start && minute < q.end : minute >= q.start || minute < q.end);
  } catch {
    return null;
  }
}
function eligible(tx, r, payload, now, recompute) {
  const ctx = tx.context(r.workspaceId, r.deviceId);
  if (r.state !== "active" || r.expiresAt <= now || !current(ctx, r, now) || ctx.pushConsent !== true || ctx.consentRevision !== r.consentRevision) return false;
  const p = ctx.preferences;
  if (!p || !LESSON_LEAD_MINUTES.includes(p.lessonMinutes) || !Array.isArray(p.dueDays) || p.dueDays.some((day) => !DUE_STAGES.includes(day)) || typeof p.lesson !== "boolean" || typeof p.due !== "boolean" || !notificationCategoryAllowed(payload, p) || quietNow(p, now) !== false) return false;
  const fresh = normalizePushPayload(recompute(tx, r, payload.id, now, p), now);
  return fresh && ["id", "kind", "expiresAt", "actionPath"].every((k) => fresh[k] === payload[k]);
}
function createDeliveryBoundary({ repository, clock, recompute, sender = null, envelope = false }) {
  return Object.freeze({
    async deliver(ownerId, registrationId, raw) {
      try {
        if (!sender) return result("disabled");
        const input = normalizePushPayload(raw, clock());
        if (!id(ownerId) || !id(registrationId) || !input) return result("rejected");
        const permit = await repository.atomic(ownerId, (tx) => {
          const now = tx.time(clock());
          const payload = normalizePushPayload(input, now);
          if (!payload) return result("expired");
          const r = tx.get("registrations", registrationId);
          if (!r) return result("suppressed");
          const key = deliveryKey(r.workspaceId, r.deviceId, payload.id);
          let job = tx.get("deliveries", key);
          if (job && (job.expiresAt !== payload.expiresAt || job.registrationId !== registrationId || job.payload.kind !== payload.kind || job.payload.actionPath !== payload.actionPath)) return result("conflict");
          if (job?.state === "sending") {
            if (now >= job.startedAt + LIMITS.uncertainMs) tx.set("deliveries", key, { ...job, state: "uncertain" });
            return result("duplicate");
          }
          if (job && job.state !== "retry") return result("duplicate");
          if (!job && tx.rows("deliveries").length >= LIMITS.jobs) return result("limited");
          const suppress = () => tx.set("deliveries", key, job ? { ...job, state: "suppressed" } : {
            key,
            registrationId,
            workspaceId: r.workspaceId,
            deviceId: r.deviceId,
            payload,
            expiresAt: payload.expiresAt,
            attempts: 0,
            state: "suppressed",
            startedAt: now,
            nextAt: now
          });
          if (!eligible(tx, r, payload, now, recompute)) {
            suppress();
            return result("suppressed");
          }
          if (job && now < job.nextAt) return result("backoff");
          if ((job?.attempts ?? 0) >= LIMITS.attempts) return result("exhausted");
          if (!rate(tx, `hour:${r.deviceId}`, now, 36e5, LIMITS.sendsPerHour) || !rate(tx, `day:${r.deviceId}`, now, 864e5, LIMITS.sendsPerDay) || !rate(tx, "owner-day", now, 864e5, LIMITS.ownerSendsPerDay)) {
            suppress();
            return result("limited");
          }
          job = {
            key,
            registrationId,
            workspaceId: r.workspaceId,
            deviceId: r.deviceId,
            payload,
            expiresAt: payload.expiresAt,
            attempts: (job?.attempts ?? 0) + 1,
            state: "sending",
            startedAt: now,
            nextAt: now
          };
          tx.set("deliveries", key, job);
          return {
            key,
            attempt: job.attempts,
            sealed: r.sealed,
            payload,
            fingerprint: r.fingerprint,
            bindingFingerprint: r.bindingFingerprint,
            ...envelope ? { binding: { id: r.registrationId, expiresAt: Math.min(r.expiresAt, tx.context(r.workspaceId, r.deviceId).sessionExpiresAt) } } : {}
          };
        });
        if (permit.status) return permit;
        let outcome;
        try {
          outcome = await sender.send(issueCommittedPermit({
            sealed: permit.sealed,
            payload: permit.payload,
            fingerprint: permit.fingerprint,
            bindingFingerprint: permit.bindingFingerprint,
            ...permit.binding ? { binding: permit.binding } : {}
          }));
        } catch {
          outcome = "uncertain";
        }
        return await repository.atomic(ownerId, (tx) => {
          const now = tx.time(clock()), job = tx.get("deliveries", permit.key);
          if (!job || job.attempts !== permit.attempt || job.state !== "sending") return result("uncertain");
          let state = outcome === "accepted" ? "sent" : outcome === "not_accepted_retryable" ? "retry" : outcome === 404 || outcome === 410 ? "dead" : "uncertain";
          const r = tx.get("registrations", registrationId);
          if (state === "dead" && r) {
            tx.releaseEndpoint(r.fingerprint, registrationId);
            tx.set("registrations", registrationId, { ...r, state: "dead", sealed: null, fingerprint: null, bindingFingerprint: null });
          }
          if (state === "retry" && (!r || !eligible(tx, r, job.payload, now, recompute) || job.attempts >= LIMITS.attempts || now >= job.expiresAt)) state = "suppressed";
          const nextAt = now + LIMITS.retryBaseMs * 2 ** (job.attempts - 1);
          if (state === "retry" && nextAt >= job.expiresAt) state = "suppressed";
          tx.set("deliveries", permit.key, { ...job, state, nextAt });
          return result(state);
        });
      } catch {
        return result("unavailable");
      }
    },
    async cleanup(ownerId) {
      try {
        if (!id(ownerId)) return result("rejected");
        return await repository.atomic(ownerId, (tx) => {
          const now = tx.time(clock());
          for (const r of tx.rows("registrations")) {
            const ctx = tx.context(r.workspaceId, r.deviceId);
            if (r.state === "active" && (r.expiresAt <= now || !current(ctx, r, now) || ctx.pushConsent !== true || ctx.consentRevision !== r.consentRevision)) {
              tx.releaseEndpoint(r.fingerprint, r.registrationId);
              tx.set("registrations", r.registrationId, { ...r, state: "revoked", sealed: null, fingerprint: null, bindingFingerprint: null });
            }
            if (r.expiresAt + LIMITS.receiptMs <= now) tx.delete("registrations", r.registrationId);
          }
          for (const job of tx.rows("deliveries")) {
            if (job.expiresAt + LIMITS.receiptMs <= now) tx.delete("deliveries", job.key);
            else if (job.state === "sending" && now >= job.startedAt + LIMITS.uncertainMs)
              tx.set("deliveries", job.key, { ...job, state: "uncertain" });
          }
          for (const [key, budget] of tx.entries("budgets")) if (budget.expiresAt <= now) tx.delete("budgets", key);
          return result("cleaned");
        });
      } catch {
        return result("unavailable");
      }
    }
  });
}

// drafts/n44-push/runtime-gateway.mjs
var fail6 = () => {
  throw Error("n44_unavailable");
};
function parseBody(text, maxBytes = 12288) {
  if (typeof text !== "string" || Buffer.byteLength(text) > maxBytes) fail6();
  let i = 0;
  const ws = () => {
    while (/[\x20\x09\x0a\x0d]/.test(text[i] ?? "x")) i++;
  };
  function string() {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === "\\") i++;
      else if (c === '"') return JSON.parse(text.slice(start, i));
    }
    fail6();
  }
  function value(depth) {
    if (depth > 12) fail6();
    ws();
    if (text[i] === '"') {
      string();
      return;
    }
    const open = text[i];
    if (open === "{" || open === "[") {
      i++;
      ws();
      const end = open === "{" ? "}" : "]";
      const keys = /* @__PURE__ */ new Set();
      if (text[i] === end) {
        i++;
        return;
      }
      for (; ; ) {
        if (open === "{") {
          if (text[i] !== '"') fail6();
          const key = string();
          if (keys.has(key)) fail6();
          keys.add(key);
          ws();
          if (text[i++] !== ":") fail6();
        }
        value(depth + 1);
        ws();
        if (text[i] === end) {
          i++;
          return;
        }
        if (text[i++] !== ",") fail6();
        ws();
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!token) fail6();
    i += token[0].length;
  }
  value(0);
  ws();
  if (i !== text.length) fail6();
  return JSON.parse(text);
}

// drafts/n44-push/private-runtime.mjs
function createPrivatePushPorts({ enabled = false, providerOrigins = [], ...material } = {}, { clock, resolve, httpsRequest } = {}) {
  if (enabled !== true) return Object.freeze({
    protect() {
      throw Error("n44_crypto_disabled");
    },
    sender: Object.freeze({ send: async () => "uncertain" }),
    close() {
    }
  });
  if (!(material.vapidKeys instanceof Map) || !material.vapidKeys.has(material.activeVapidKeyId))
    throw Error("n44_crypto_unavailable");
  const protector = createSubscriptionProtector({ providerOrigins, ...material });
  let sender;
  try {
    sender = createAuditedSender({ enabled: true, providerOrigins, protector, vapidKeys: material.vapidKeys, clock, resolve, httpsRequest });
  } catch {
    protector.close();
    throw Error("n44_crypto_unavailable");
  }
  return Object.freeze({
    protect: (...args) => protector.protect(...args),
    sender,
    close() {
      sender.close();
      protector.close();
    }
  });
}

// drafts/n44-push/web-entry.mjs
import { Buffer as Buffer6 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual3 } from "node:crypto";

// drafts/n44-push/backend.mjs
import { randomUUID, createHmac as createHmac2 } from "node:crypto";

// drafts/n44-push/auth-verifier.mjs
import { Buffer as Buffer4 } from "node:buffer";
import { AuthClient } from "@supabase/auth-js";
var uuid2 = (s) => typeof s === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
var fail7 = () => {
  throw Error("n44_auth_configuration");
};
function createTeacherVerifier({ authUrl, apiKey, fetch: send = globalThis.fetch, authDeadlineMs = 2e3, now = Date.now }) {
  const url = new URL(authUrl);
  if (url.origin !== authUrl || url.protocol !== "https:" || !apiKey || typeof send !== "function" || !Number.isInteger(authDeadlineMs) || authDeadlineMs < 20 || authDeadlineMs > 5e3) fail7();
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
      if (expired || abort.signal.aborted) throw Error("n44_auth_unavailable");
    };
    try {
      const boundedFetch = async (target, init = {}) => {
        fence();
        const u = new URL(target);
        if (u.origin !== authUrl || ![issuer + "/user", issuer + "/.well-known/jwks.json"].includes(u.href) || init.method && init.method !== "GET") fail7();
        const pending = send(u.href, { ...init, redirect: "error", cache: "no-store", credentials: "omit", signal: abort.signal });
        const response = await Promise.race([pending, new Promise((_, reject) => abort.signal.addEventListener("abort", () => reject(Error("n44_auth_unavailable")), { once: true }))]);
        let n = 0;
        const parts = [];
        const reader = response.body?.getReader();
        if (reader) try {
          for (; ; ) {
            fence();
            const { done, value } = await reader.read();
            if (done) break;
            n += value.length;
            if (n > 65536) throw Error("n44_auth_unavailable");
            parts.push(value);
          }
        } finally {
          await reader.cancel().catch(() => {
          });
          reader.releaseLock();
        }
        fence();
        return new Response(Buffer4.concat(parts), { status: response.status, headers: response.headers });
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
      if (c.iss !== issuer || !(c.aud === "authenticated" || Array.isArray(c.aud) && c.aud.length === 1 && c.aud[0] === "authenticated") || c.role !== "authenticated" || !uuid2(c.sub) || !uuid2(c.session_id) || c.is_anonymous === true || !Number.isSafeInteger(c.exp) || c.exp <= sec || !Number.isSafeInteger(c.iat) || c.iat > sec || c.iat >= c.exp || c.nbf !== void 0 && (!Number.isSafeInteger(c.nbf) || c.nbf > sec)) return null;
      const current2 = await query("select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
      fence();
      const matches = (result2) => result2.rows.length === 1 && result2.rows[0].user_id === c.sub && result2.rows[0].session_id === c.session_id;
      if (!matches(current2)) return null;
      const fresh = await auth.getUser(token);
      fence();
      const user = fresh.data?.user;
      if (fresh.error || !user || user.id !== c.sub || user.is_anonymous === true || user.deleted_at || user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > now())) return null;
      if (c.exp <= Math.floor(now() / 1e3)) return null;
      beforeCommit?.(async () => {
        if (c.exp <= Math.floor(now() / 1e3)) throw Error("n44_auth_expired");
        const result2 = await query("select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)", [c.sub, c.session_id]);
        if (!matches(result2)) throw Error("n44_auth_expired");
      });
      const notAfter = current2.rows[0].not_after_ms === null ? Infinity : Number(current2.rows[0].not_after_ms);
      if (notAfter !== Infinity && !Number.isSafeInteger(notAfter)) return null;
      return Object.freeze({
        ownerId: c.sub,
        sessionId: c.session_id,
        sessionRevision: c.session_id,
        expiresAt: c.exp * 1e3,
        backgroundExpiresAt: Math.min(now() + 30 * 864e5, notAfter)
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      abort.abort();
      parentSignal?.removeEventListener("abort", cancel);
    }
  };
}

// drafts/n44-push/canonical-source.mjs
import { Buffer as Buffer5 } from "node:buffer";
import { createHash } from "node:crypto";

// src/models.js
function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
var isWeekend = (iso) => [5, 6].includes(weekday(iso));
var CALENDAR_KIND = {
  study: { label: "\u064A\u0648\u0645 \u062F\u0631\u0627\u0633\u0629", teaching: true },
  exam: { label: "\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A", teaching: true },
  event: { label: "\u0641\u0639\u0627\u0644\u064A\u0629", teaching: true },
  remote: { label: "\u0639\u0646 \u0628\u064F\u0639\u062F", teaching: true },
  holiday: { label: "\u0625\u062C\u0627\u0632\u0629", teaching: false },
  suspension: { label: "\u062A\u0639\u0644\u064A\u0642 \u062F\u0631\u0627\u0633\u0629", teaching: false },
  national: { label: "\u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0648\u0637\u0646\u064A", teaching: false },
  founding: { label: "\u064A\u0648\u0645 \u0627\u0644\u062A\u0623\u0633\u064A\u0633", teaching: false }
};
var isTeachingDay = (kind) => CALENDAR_KIND[kind]?.teaching ?? true;
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

// src/lib/calendar-presets.js
var GENERAL_1448_1449_PRESET_ID = "sa-general-1448-1449";
var WESTERN_1448_1449_PRESET_ID = "sa-western-1448-1449";
var CALENDAR_PRESETS = Object.freeze([
  // التقويم أ: جميع مناطق المملكة
  Object.freeze({
    id: GENERAL_1448_1449_PRESET_ID,
    name: "\u062A\u0642\u0648\u064A\u0645 \u062C\u0645\u064A\u0639 \u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0645\u0645\u0644\u0643\u0629",
    country: "Saudi Arabia",
    region: "general",
    regionLabel: "\u062C\u0645\u064A\u0639 \u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0645\u0645\u0644\u0643\u0629",
    subtitle: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0645\u0627 \u0639\u062F\u0627 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629",
    coverage: ["\u062C\u0645\u064A\u0639 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0628\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0645\u0627 \u0639\u062F\u0627 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629"],
    hijriStart: 1448,
    hijriEnd: 1449,
    label: "1448\u20131449 \u0647\u0640",
    gregorianLabel: "2026\u20132027 \u0645",
    academicYearStart: "2026-08-23",
    endOfYearVacationStart: "2027-06-24",
    nextAcademicYearStart: "2027-08-22",
    terms: [
      { index: 1, name: "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u0623\u0648\u0644", startDate: "2026-08-23", endDate: "2027-01-07", status: "active" },
      { index: 2, name: "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u062B\u0627\u0646\u064A", startDate: "2027-01-17", endDate: "2027-06-24", status: "upcoming" }
    ],
    holidays: [
      { startDate: "2026-09-23", endDate: "2026-09-26", label: "\u0625\u062C\u0627\u0632\u0629 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0648\u0637\u0646\u064A", kind: "national" },
      { startDate: "2026-10-25", endDate: "2026-10-25", label: "\u0625\u062C\u0627\u0632\u0629 \u0646\u0647\u0627\u064A\u0629 \u0623\u0633\u0628\u0648\u0639 \u0645\u0637\u0648\u0644\u0629", kind: "holiday" },
      { startDate: "2026-11-20", endDate: "2026-11-28", label: "\u0625\u062C\u0627\u0632\u0629 \u0627\u0644\u062E\u0631\u064A\u0641", kind: "holiday" },
      { startDate: "2026-11-29", endDate: "2026-11-29", label: "\u0625\u062C\u0627\u0632\u0629 \u0646\u0647\u0627\u064A\u0629 \u0623\u0633\u0628\u0648\u0639 \u0645\u0637\u0648\u0644\u0629", kind: "holiday" },
      { startDate: "2027-01-08", endDate: "2027-01-16", label: "\u0625\u062C\u0627\u0632\u0629 \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u0639\u0627\u0645", kind: "holiday" },
      { startDate: "2027-02-19", endDate: "2027-02-22", label: "\u0625\u062C\u0627\u0632\u0629 \u064A\u0648\u0645 \u0627\u0644\u062A\u0623\u0633\u064A\u0633", kind: "founding" },
      { startDate: "2027-02-26", endDate: "2027-03-13", label: "\u0625\u062C\u0627\u0632\u0629 \u0639\u064A\u062F \u0627\u0644\u0641\u0637\u0631", kind: "holiday" },
      { startDate: "2027-04-11", endDate: "2027-04-11", label: "\u0625\u062C\u0627\u0632\u0629 \u0646\u0647\u0627\u064A\u0629 \u0623\u0633\u0628\u0648\u0639 \u0645\u0637\u0648\u0644\u0629", kind: "holiday" },
      { startDate: "2027-05-07", endDate: "2027-05-22", label: "\u0625\u062C\u0627\u0632\u0629 \u0639\u064A\u062F \u0627\u0644\u0623\u0636\u062D\u0649", kind: "holiday" }
    ]
  }),
  // التقويم ب: مكة المكرمة • المدينة المنورة • جدة • الطائف
  Object.freeze({
    id: WESTERN_1448_1449_PRESET_ID,
    name: "\u062A\u0642\u0648\u064A\u0645 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629 \u2022 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629 \u2022 \u062C\u062F\u0629 \u2022 \u0627\u0644\u0637\u0627\u0626\u0641",
    country: "Saudi Arabia",
    region: "western",
    regionLabel: "\u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629 \u2022 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629 \u2022 \u062C\u062F\u0629 \u2022 \u0627\u0644\u0637\u0627\u0626\u0641",
    subtitle: "\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629",
    coverage: ["\u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", "\u062C\u062F\u0629", "\u0627\u0644\u0637\u0627\u0626\u0641"],
    hijriStart: 1448,
    hijriEnd: 1449,
    label: "1448\u20131449 \u0647\u0640",
    gregorianLabel: "2026\u20132027 \u0645",
    academicYearStart: "2026-08-30",
    endOfYearVacationStart: "2027-07-01",
    nextAcademicYearStart: "2027-08-29",
    terms: [
      { index: 1, name: "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u0623\u0648\u0644", startDate: "2026-08-30", endDate: "2027-01-07", status: "active" },
      { index: 2, name: "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u062B\u0627\u0646\u064A", startDate: "2027-01-17", endDate: "2027-07-01", status: "upcoming" }
    ],
    holidays: [
      { startDate: "2026-09-23", endDate: "2026-09-26", label: "\u0625\u062C\u0627\u0632\u0629 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0648\u0637\u0646\u064A", kind: "national" },
      { startDate: "2026-10-25", endDate: "2026-10-25", label: "\u0625\u062C\u0627\u0632\u0629 \u0646\u0647\u0627\u064A\u0629 \u0623\u0633\u0628\u0648\u0639 \u0645\u0637\u0648\u0644\u0629", kind: "holiday" },
      { startDate: "2026-11-20", endDate: "2026-11-28", label: "\u0625\u062C\u0627\u0632\u0629 \u0627\u0644\u062E\u0631\u064A\u0641", kind: "holiday" },
      { startDate: "2027-01-08", endDate: "2027-01-16", label: "\u0625\u062C\u0627\u0632\u0629 \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u0639\u0627\u0645", kind: "holiday" },
      { startDate: "2027-02-19", endDate: "2027-02-22", label: "\u0625\u062C\u0627\u0632\u0629 \u064A\u0648\u0645 \u0627\u0644\u062A\u0623\u0633\u064A\u0633", kind: "founding" },
      { startDate: "2027-02-26", endDate: "2027-03-13", label: "\u0625\u062C\u0627\u0632\u0629 \u0639\u064A\u062F \u0627\u0644\u0641\u0637\u0631", kind: "holiday" },
      { startDate: "2027-04-30", endDate: "2027-05-22", label: "\u0625\u062C\u0627\u0632\u0629 \u0639\u064A\u062F \u0627\u0644\u0623\u0636\u062D\u0649", kind: "holiday" }
    ]
  })
]);
var OFFICIAL_CALENDAR_OPTIONS = Object.freeze([
  Object.freeze({
    id: GENERAL_1448_1449_PRESET_ID,
    presetId: GENERAL_1448_1449_PRESET_ID,
    name: "\u062A\u0642\u0648\u064A\u0645 \u062C\u0645\u064A\u0639 \u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0645\u0645\u0644\u0643\u0629",
    shortName: "\u062C\u0645\u064A\u0639 \u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0645\u0645\u0644\u0643\u0629",
    subtitle: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0645\u0627 \u0639\u062F\u0627 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629",
    status: "active",
    statusLabel: "\u0645\u0639\u062A\u0645\u062F \u0631\u0633\u0645\u064A\u0627\u064B",
    coverage: ["\u062C\u0645\u064A\u0639 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0628\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0645\u0627 \u0639\u062F\u0627 \u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629"],
    description: "\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062F\u0631\u0627\u0633\u064A \u0627\u0644\u0648\u0632\u0627\u0631\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0644\u0639\u0627\u0645 1448\u20131449 \u0647\u0640 \u0644\u0643\u0627\u0641\u0629 \u0645\u0646\u0627\u0637\u0642 \u0648\u0645\u062D\u0627\u0641\u0638\u0627\u062A \u0627\u0644\u0645\u0645\u0644\u0643\u0629 (\u064A\u0628\u062F\u0623 23 \u0623\u063A\u0633\u0637\u0633 2026 \u0645 \u0648\u064A\u0634\u0645\u0644 4 \u0625\u062C\u0627\u0632\u0627\u062A \u0645\u0637\u0648\u0644\u0629 \u0648\u0625\u0636\u0627\u0641\u064A\u0629)."
  }),
  Object.freeze({
    id: WESTERN_1448_1449_PRESET_ID,
    presetId: WESTERN_1448_1449_PRESET_ID,
    name: "\u062A\u0642\u0648\u064A\u0645 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629 \u2022 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629 \u2022 \u062C\u062F\u0629 \u2022 \u0627\u0644\u0637\u0627\u0626\u0641",
    shortName: "\u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629 \u2022 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629 \u2022 \u062C\u062F\u0629 \u2022 \u0627\u0644\u0637\u0627\u0626\u0641",
    subtitle: "\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629",
    status: "active",
    statusLabel: "\u0645\u0639\u062A\u0645\u062F \u0631\u0633\u0645\u064A\u0627\u064B",
    coverage: ["\u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", "\u062C\u062F\u0629", "\u0627\u0644\u0637\u0627\u0626\u0641"],
    description: "\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u0648\u0632\u0627\u0631\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0644\u0625\u062F\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629 \u0645\u0631\u0627\u0639\u0627\u0629\u064B \u0644\u062E\u0635\u0648\u0635\u064A\u0629 \u0645\u0648\u0633\u0645\u064A \u0627\u0644\u062D\u062C \u0648\u0627\u0644\u0639\u0645\u0631\u0629 (\u064A\u0628\u062F\u0623 30 \u0623\u063A\u0633\u0637\u0633 2026 \u0645 \u0645\u0639 \u0625\u062C\u0627\u0632\u0629 \u062D\u062C \u0645\u0648\u0633\u0639\u0629 23 \u064A\u0648\u0645\u0627\u064B)."
  })
]);

// src/lib/calendar-runtime.js
var invalid = (reason) => ({ ok: false, reason });
var validId = (id2) => typeof id2 === "string" && id2.trim().length > 0;
var copy = (value) => structuredClone(value);
var live = (records) => records.filter((record2) => !record2.deleted);
var hasKind = (kind) => Object.hasOwn(CALENDAR_KIND, kind);
var isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
function validDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date;
}
var validBounds = (start, end) => validDate(start) && validDate(end) && start <= end;
var validCalendar = (calendar) => calendar?.ok === true && validId(calendar.year?.id) && Array.isArray(calendar.terms) && Array.isArray(calendar.exceptions) && Array.isArray(calendar.preset?.holidays);
function resolveCalendarRuntime(input = {}) {
  if (!isObject(input)) return invalid("invalid-input");
  const { year, terms, presetId, customizations = [] } = input;
  const preset = CALENDAR_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return invalid("unsupported-preset");
  if (!year || !validId(year.id) || year.deleted) return invalid("invalid-year");
  if (year.hijriStart !== preset.hijriStart || year.hijriEnd !== preset.hijriEnd) {
    return invalid("preset-year-mismatch");
  }
  if (!Array.isArray(terms) || terms.some((term) => !term || !validId(term.id) || term.yearId !== year.id || !Number.isInteger(term.index) || term.index < 1 || term.index > 6 || !["active", "upcoming", "closed"].includes(term.status))) return invalid("invalid-terms");
  if (new Set(terms.map((term) => term.id)).size !== terms.length) return invalid("duplicate-term-id");
  const existing = live(terms);
  for (const index of [1, 2]) {
    const matches = existing.filter((term) => term.index === index);
    if (!matches.length) return invalid("missing-official-term");
    if (matches.length !== 1) return invalid("ambiguous-official-term");
  }
  if (new Set(existing.map((term) => term.index)).size !== existing.length) {
    return invalid("ambiguous-term-index");
  }
  if (!Array.isArray(customizations)) return invalid("invalid-customizations");
  const scopes = /* @__PURE__ */ new Set();
  for (const scope of customizations) {
    if (!scope || scope.yearId !== year.id || !validId(scope.presetId)) return invalid("unscoped-customization");
    if (!CALENDAR_PRESETS.some((entry) => entry.id === scope.presetId && entry.hijriStart === year.hijriStart && entry.hijriEnd === year.hijriEnd)) return invalid("unsupported-customization-preset");
    if (scope.deleted) continue;
    if (scopes.has(scope.presetId)) return invalid("ambiguous-customization-scope");
    scopes.add(scope.presetId);
    if (!Array.isArray(scope.termDateOverrides ?? []) || !Array.isArray(scope.exceptions ?? [])) {
      return invalid("invalid-customizations");
    }
    const termIds = /* @__PURE__ */ new Set();
    for (const override of scope.termDateOverrides ?? []) {
      if (!override || !validId(override.termId)) return invalid("invalid-term-override");
      if (override.deleted) continue;
      if (override.presetId != null && override.presetId !== scope.presetId || override.yearId != null && override.yearId !== year.id) return invalid("customization-scope-mismatch");
      const term = existing.find((candidate) => candidate.id === override.termId);
      if (!term) return invalid("unknown-override-term");
      if (!validBounds(override.startDate, override.endDate)) return invalid("invalid-term-bounds");
      if (termIds.has(term.id)) return invalid("ambiguous-term-override");
      termIds.add(term.id);
    }
    const dates = /* @__PURE__ */ new Set();
    const ids = /* @__PURE__ */ new Set();
    for (const day of scope.exceptions ?? []) {
      if (!day || !validId(day.id)) return invalid("invalid-exception");
      if (ids.has(day.id)) return invalid("duplicate-exception-id");
      ids.add(day.id);
      if (day.deleted) continue;
      if (day.presetId != null && day.presetId !== scope.presetId || day.yearId != null && day.yearId !== year.id) return invalid("customization-scope-mismatch");
      if (!validDate(day.date) || !hasKind(day.kind) || day.label != null && typeof day.label !== "string") {
        return invalid("invalid-exception");
      }
      if (dates.has(day.date)) return invalid("ambiguous-exception-date");
      dates.add(day.date);
    }
  }
  const project = (scopePreset, overrides) => {
    const projectedTerms2 = terms.map((term) => {
      if (term.deleted) return copy(term);
      const official = scopePreset.terms.find((entry) => entry.index === term.index);
      const override = overrides.find((entry) => entry.termId === term.id);
      if (!official) return override ? {
        ...copy(term),
        startDate: override.startDate,
        endDate: override.endDate,
        dateSource: "custom"
      } : copy(term);
      return {
        ...copy(term),
        startDate: override?.startDate ?? official.startDate,
        endDate: override?.endDate ?? official.endDate,
        officialStartDate: official.startDate,
        officialEndDate: official.endDate,
        dateSource: override ? "custom" : "official"
      };
    });
    return projectedTerms2;
  };
  const selected = customizations.find((scope) => !scope.deleted && scope.presetId === preset.id);
  const projectedTerms = project(preset, live(selected?.termDateOverrides ?? []));
  for (const scopePreset of CALENDAR_PRESETS.filter((entry) => scopes.has(entry.id) || entry.id === preset.id)) {
    const scope = customizations.find((entry) => !entry.deleted && entry.presetId === scopePreset.id);
    const effective = project(scopePreset, live(scope?.termDateOverrides ?? []));
    const first = effective.find((term) => !term.deleted && term.index === 1);
    const second = effective.find((term) => !term.deleted && term.index === 2);
    if (first.endDate >= second.startDate) return invalid("overlapping-official-terms");
    const bounded = live(effective).filter((term) => validBounds(term.startDate, term.endDate));
    if (bounded.some((term, index) => bounded.slice(index + 1).some((other) => term.startDate <= other.endDate && other.startDate <= term.endDate))) return invalid("overlapping-term-bounds");
  }
  return {
    ok: true,
    year: {
      ...copy(year),
      calendarPresetId: preset.id,
      startDate: preset.academicYearStart,
      endOfYearVacationStart: preset.endOfYearVacationStart,
      nextAcademicYearStart: preset.nextAcademicYearStart
    },
    terms: projectedTerms,
    preset: copy(preset),
    exceptions: copy(live(selected?.exceptions ?? []))
  };
}
function resolveCalendarDate(calendar, date) {
  if (!validCalendar(calendar)) return invalid("invalid-calendar");
  if (!validDate(date)) return invalid("invalid-date");
  const exception = calendar.exceptions.find((day) => day.date === date);
  const official = calendar.preset.holidays.find((day) => day.startDate <= date && date <= day.endDate);
  const kind = exception?.kind ?? official?.kind ?? (isWeekend(date) ? "holiday" : "study");
  return {
    ok: true,
    date,
    yearId: calendar.year.id,
    presetId: calendar.preset.id,
    kind,
    label: exception ? exception.label ?? "" : official?.label ?? "",
    teaching: isTeachingDay(kind),
    source: exception ? "custom" : official ? "official" : "default",
    exceptionId: exception?.id ?? null,
    officialRangeId: !exception && official ? `${calendar.preset.id}:${official.startDate}` : null
  };
}

// drafts/n44-push/canonical-source.mjs
var shift = (date, days) => new Date(Date.parse(date + "T12:00:00Z") + days * 864e5).toISOString().slice(0, 10);
async function readSource(query, owner, kind, id2, preferences2) {
  const result2 = await query("select n44_push_draft.read_source($1::uuid,$2::text,$3::text) as source", [owner, kind, id2]);
  const s = result2.rows[0]?.source;
  if (!s) return null;
  if (Buffer5.byteLength(JSON.stringify(s)) > 262144) throw Error("n44_source_bound");
  const stamp = createHash("sha256").update(JSON.stringify(s)).digest("hex");
  const { year, terms, calendars, days, teaching, section, subject, source } = s;
  if ([year, teaching, section, subject, source].some((r) => !r || r.deleted) || year.status !== "active" || section.status !== "active" || section.yearId !== year.id) return null;
  let term = terms.find((t) => t.id === teaching.termId);
  if (!term || term.deleted || term.status === "closed") return null;
  let calendar;
  if (year.calendarPresetId) {
    calendar = resolveCalendarRuntime({ year, terms, presetId: year.calendarPresetId, customizations: calendars.filter((c) => c.source === "custom" && c.presetId).map((c) => ({
      yearId: year.id,
      presetId: c.presetId,
      deleted: c.deleted,
      termDateOverrides: Object.entries(c.termDateOverrides ?? {}).map(([termId, pair]) => ({ termId, ...pair })),
      exceptions: days.filter((d) => d.calendarId === c.id)
    })) });
    if (!calendar.ok) return null;
    term = calendar.terms.find((t) => t.id === term.id);
    if (!term) return null;
  }
  if (!term.startDate || !term.endDate) return null;
  const inTerm = (date) => date >= term.startDate && date <= term.endDate;
  const wall = async (date, time) => Number((await query("select (extract(epoch from (($1::date+$2::time) at time zone $3))*1000)::bigint::text as ms", [date, time, preferences2.timezone])).rows[0].ms);
  const events = [];
  const add = (payload, dueAt) => {
    if (Number.isSafeInteger(dueAt) && Number.isSafeInteger(payload.expiresAt) && payload.expiresAt > dueAt) events.push({ ...payload, dueAt });
  };
  if (kind === "lesson") {
    const date = source.date, start = source.startTime?.slice(0, 5), end = source.endTime?.slice(0, 5);
    if (!inTerm(date) || !/^\d{2}:\d{2}$/.test(start ?? "") || !/^\d{2}:\d{2}$/.test(end ?? "") || ["cancelled", "cancelled_holiday"].includes(source.status)) return null;
    let day;
    if (calendar) {
      day = resolveCalendarDate(calendar, date);
      if (!day.ok) return null;
    } else {
      const matches = calendars.filter((c) => !c.deleted).map((c) => ({ c, d: days.find((d) => !d.deleted && d.calendarId === c.id && d.date === date) })).filter((x) => x.d);
      day = (matches.find((x) => x.c.source === "custom") ?? matches[0])?.d;
    }
    if (day ? !isTeachingDay(day.kind) : isWeekend(date)) return null;
    const at = await wall(date, start), expiresAt = await wall(date, end);
    if (expiresAt <= at) return null;
    add({ id: `lesson:${encodeURIComponent(id2)}:${date}:${start}:${end}`, kind, expiresAt, actionPath: `/teaching/${encodeURIComponent(teaching.id)}/attendance?session=${encodeURIComponent(id2)}` }, at - preferences2.lessonMinutes * 6e4);
  } else {
    if (source.itemDeleted || source.scoreMode !== "subitems" || !source.dueDate || !inTerm(source.dueDate)) return null;
    for (const stage of preferences2.dueDays) {
      const date = shift(source.dueDate, -stage);
      if (source.startDate && source.startDate > date || !inTerm(date)) continue;
      add({ id: `due:${encodeURIComponent(id2)}:${source.dueDate}:${date}`, kind, expiresAt: await wall(shift(date, 1), "00:00"), actionPath: `/teaching/${encodeURIComponent(teaching.id)}/items` }, await wall(date, "00:00"));
    }
  }
  return { stamp, events };
}
function sourcePayload(event, now) {
  if (!event || event.dueAt > now) return null;
  const { dueAt, ...payload } = event;
  return normalizePushPayload(payload, now);
}

// drafts/n44-push/backend.mjs
var fail8 = () => {
  throw Error("n44_unavailable");
};
var exact2 = (v, keys) => {
  if (!record(v, keys)) fail8();
};
function createBackend({ acquire, authUrl, apiKey, fetch, providerOrigins, crypto: crypto2, rateKey, deliveryEnabled = false, sessionPolicy, serviceSourceSha, now = Date.now }) {
  if (!supportedSessionPolicy(sessionPolicy, now(), serviceSourceSha)) fail8();
  const policy = Object.freeze(structuredClone(sessionPolicy));
  const verify = createTeacherVerifier({ authUrl, apiKey, fetch, now });
  async function transaction(work, signal) {
    const c = await acquire();
    let committed = false;
    const until = now() + 12e3, guards = [];
    const fence = () => {
      if (signal?.aborted || now() >= until || !supportedSessionPolicy(policy, now(), serviceSourceSha)) fail8();
    };
    const query = async (...args) => {
      fence();
      const r = await c.query(...args);
      fence();
      return r;
    };
    try {
      await query("begin");
      await query("set local statement_timeout='3000ms'");
      await query("set local lock_timeout='1000ms'");
      await query("set local idle_in_transaction_session_timeout='15000ms'");
      await query("set local synchronous_commit=on");
      const result2 = await work({ query, beforeCommit: (f) => guards.push(f) }, c);
      for (const g of guards) await g();
      fence();
      await c.query("commit");
      committed = true;
      return result2;
    } finally {
      if (!committed) await c.query("rollback").catch(() => {
      });
      c.release();
    }
  }
  async function prepare(c, owner, state, signal) {
    const q = async (...args) => {
      if (signal?.aborted) fail8();
      const r = await c.query(...args);
      if (signal?.aborted) fail8();
      return r;
    }, events = /* @__PURE__ */ new Map();
    for (const ctx of state.contexts.values()) if (ctx.active) {
      const live2 = await q("select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)", [owner, ctx.sessionId]);
      if (live2.rows.length !== 1 || ctx.sessionExpiresAt <= now() || ctx.sessionRevision !== policySessionRevision(ctx.sessionId, policy)) ctx.active = false;
      else if (live2.rows[0].not_after_ms !== null) ctx.sessionExpiresAt = Math.min(ctx.sessionExpiresAt, Number(live2.rows[0].not_after_ms));
    }
    const stored = await q("select * from n44_push_draft.events where owner_id=$1 order by workspace_id,device_id,event_id limit 101", [owner]);
    if (stored.rows.length > 100) fail8();
    const cache = /* @__PURE__ */ new Map();
    for (const e of stored.rows) {
      const ctx = state.contexts.get(JSON.stringify([e.workspace_id, e.device_id]));
      if (!ctx?.active) continue;
      const key = JSON.stringify([e.source_kind, e.source_id, ctx.preferences]);
      if (!cache.has(key)) cache.set(key, await readSource(q, owner, e.source_kind, e.source_id, ctx.preferences));
      const fresh = cache.get(key);
      if (fresh?.stamp === e.source_stamp) {
        const candidate = fresh.events.find((x) => x.id === e.event_id);
        if (candidate) events.set(JSON.stringify([e.workspace_id, e.device_id, e.event_id]), candidate);
      }
    }
    return {
      sourceEvent(r, eventId, time) {
        return sourcePayload(events.get(JSON.stringify([r.workspaceId, r.deviceId, eventId])), time);
      },
      async beforeCommit() {
        for (const ctx of state.contexts.values()) if (ctx.active) {
          if (ctx.sessionExpiresAt <= now()) fail8();
          const live2 = await q("select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)", [owner, ctx.sessionId]);
          if (live2.rows.length !== 1) fail8();
        }
      }
    };
  }
  const makeDelivery = (signal) => {
    const fence = () => {
      if (signal?.aborted || !supportedSessionPolicy(policy, now(), serviceSourceSha)) fail8();
    };
    const repository = createPostgresRepository({ acquire, prepare: async (...args) => {
      fence();
      const extension = await prepare(...args, signal);
      fence();
      return { ...extension, async beforeCommit() {
        await extension.beforeCommit?.();
        fence();
      } };
    } });
    return createDeliveryBoundary({ repository, clock: now, envelope: true, recompute: (tx, r, event, time) => tx.sourceEvent(r, event, time), sender: { send(permit) {
      if (signal?.aborted) return "uncertain";
      return crypto2.sender.send(permit, { signal });
    } } });
  };
  async function take(query, kind, key, limit) {
    const bucket = Math.floor(now() / 6e4), hash = createHmac2("sha256", rateKey).update(JSON.stringify([kind, key])).digest("hex");
    await query("select pg_advisory_xact_lock(44001,hashtext($1))", [kind]);
    const keys = await query("select key from n44_push_draft.ingress_rates where kind=$1 limit 2049", [kind]);
    if (keys.rows.length >= 2048 && !keys.rows.some((r2) => r2.key === hash)) return false;
    const r = await query(`insert into n44_push_draft.ingress_rates(key,bucket,count,expires_at_ms,kind) values($1,$2,1,$3,$5)
   on conflict(key) do update set bucket=excluded.bucket,count=case when ingress_rates.bucket=excluded.bucket then ingress_rates.count+1 else 1 end,expires_at_ms=excluded.expires_at_ms
   where ingress_rates.bucket<>excluded.bucket or ingress_rates.count<$4 returning count`, [hash, bucket, (bucket + 1) * 6e4, limit, kind]);
    return r.rows.length === 1;
  }
  return Object.freeze({
    async ingress(e, signal) {
      return transaction(async ({ query }) => {
        if (Math.abs(now() - Number(e.time) * 1e3) > 15e3) return false;
        const scope = e.kind === "scheduler" ? "scheduler" : "teacher";
        await query("select pg_advisory_xact_lock(44002,hashtext($1))", [scope]);
        const entries = await query("select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2", [scope, scope === "teacher" ? 4097 : 129]);
        if (entries.rows.length >= (scope === "teacher" ? 4096 : 128)) return false;
        const r = await query("insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values($1,$2,$3) on conflict do nothing returning nonce", [e.nonce, scope, Number(e.time) * 1e3 + 16e3]);
        return r.rows.length === 1 && (scope === "scheduler" ? await take(query, "scheduler", "n44", 30) : await take(query, "global", "n44", 3e3) && await take(query, "peer", e.source, 60));
      }, signal);
    },
    async teacher(path, authorization, body, signal) {
      return transaction(async (ports, c) => {
        const verified2 = await verify(authorization, signal, ports);
        if (!verified2) return { status: "rejected" };
        const auth = { ...verified2, sessionRevision: policySessionRevision(verified2.sessionId, policy) };
        const allowed = await transaction(({ query }) => take(query, "owner", auth.ownerId, 30), signal);
        if (!allowed) return { status: "limited" };
        const local = createPostgresRepository({ acquire: async () => ({
          query(text, values) {
            return text.startsWith("begin") ? ports.query("savepoint n44_owner") : text === "commit" ? ports.query("release savepoint n44_owner") : text === "rollback" ? ports.query("rollback to savepoint n44_owner") : ports.query(text, values);
          },
          release() {
          }
        }) });
        const scope = (b) => {
          if (!id(b.workspaceId) || !id(b.deviceId)) fail8();
        };
        if (path.startsWith("/push/")) {
          if (path === "/push/revoke") {
            exact2(body, ["registrationId", "workspaceId", "deviceId"]);
            scope(body);
            if (!uuid(body.registrationId)) fail8();
            const retired = await local.atomic(auth.ownerId, (tx) => {
              const r = tx.get("registrations", body.registrationId);
              return r && r.workspaceId === body.workspaceId && r.deviceId === body.deviceId && r.state !== "active";
            });
            if (retired) return { status: "revoked" };
          }
          const registration = createRegistrationBoundary({ verifySession: async () => auth, repository: local, protect: crypto2.protect, clock: now, approvedOrigins: providerOrigins, receipt: true });
          return registration[path.endsWith("/register") ? "register" : "revoke"](null, body);
        }
        if (path === "/context/read") {
          exact2(body, ["workspaceId", "deviceId"]);
          scope(body);
          return local.atomic(auth.ownerId, (tx) => {
            const ctx = tx.context(body.workspaceId, body.deviceId);
            if (ctx?.sessionId !== auth.sessionId || ctx.sessionRevision !== auth.sessionRevision || !ctx.active || ctx.sessionExpiresAt <= now()) return { status: "absent", protocol: "n44-browser-v2", expectedRevision: ctx?.consentRevision ?? null };
            const r = tx.rows("registrations").find((r2) => r2.workspaceId === body.workspaceId && r2.deviceId === body.deviceId && r2.sessionRevision === auth.sessionRevision && r2.consentRevision === ctx.consentRevision && r2.state === "active" && r2.expiresAt > now());
            return { status: "current", protocol: "n44-browser-v2", context: ctx, registration: r ? { registrationId: r.registrationId, expiresAt: r.expiresAt } : null };
          });
        }
        if (path === "/context/update") {
          exact2(body, ["workspaceId", "deviceId", "expectedRevision", "preferences", "pushConsent"]);
          scope(body);
          if (typeof body.pushConsent !== "boolean") fail8();
          return local.writeContexts(auth.ownerId, (tx) => {
            const previous = tx.context(body.workspaceId, body.deviceId);
            if ((previous?.consentRevision ?? null) !== body.expectedRevision) return { status: "stale" };
            const ctx = {
              workspaceId: body.workspaceId,
              deviceId: body.deviceId,
              active: true,
              sessionId: auth.sessionId,
              sessionRevision: auth.sessionRevision,
              sessionExpiresAt: Math.min(now() + LIMITS.registrationMs, auth.backgroundExpiresAt),
              consentRevision: randomUUID(),
              pushConsent: body.pushConsent,
              preferences: body.preferences
            };
            tx.set("contexts", JSON.stringify([body.workspaceId, body.deviceId]), ctx);
            for (const r of tx.rows("registrations")) if (r.state === "active" && r.workspaceId === body.workspaceId && r.deviceId === body.deviceId) {
              tx.releaseEndpoint(r.fingerprint, r.registrationId);
              tx.set("registrations", r.registrationId, { ...r, state: "revoked", sealed: null, fingerprint: null, bindingFingerprint: null });
            }
            return { status: "updated", context: ctx };
          });
        }
        if (path === "/events/authorize") {
          exact2(body, ["workspaceId", "deviceId", "consentRevision", "registrationId", "event"]);
          scope(body);
          const event = normalizePushPayload(body.event, now());
          if (!event) return { status: "rejected" };
          let context;
          await local.atomic(auth.ownerId, (tx) => {
            const ctx = tx.context(body.workspaceId, body.deviceId);
            if (!ctx?.active || ctx.sessionId !== auth.sessionId || ctx.sessionRevision !== auth.sessionRevision || ctx.sessionExpiresAt <= now() || !ctx.pushConsent || ctx.consentRevision !== body.consentRevision || ctx.preferences[event.kind] !== true || quietNow(ctx.preferences, now()) !== false) fail8();
            if (!tx.rows("registrations").some((r) => r.registrationId === body.registrationId && r.workspaceId === body.workspaceId && r.deviceId === body.deviceId && r.sessionId === auth.sessionId && r.sessionRevision === auth.sessionRevision && r.consentRevision === ctx.consentRevision && r.state === "active" && r.expiresAt > now())) fail8();
            context = ctx;
          });
          const stored = await ports.query(
            "select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4",
            [auth.ownerId, body.workspaceId, body.deviceId, event.id]
          );
          const row = stored.rows[0];
          if (!row) return { status: "rejected" };
          const fresh = await readSource(ports.query, auth.ownerId, row.source_kind, row.source_id, context.preferences);
          const payload = sourcePayload(fresh?.stamp === row.source_stamp ? fresh.events.find((e) => e.id === event.id) : null, now());
          return { status: payload && ["id", "kind", "expiresAt", "actionPath"].every((k) => payload[k] === event[k]) ? "authorized" : "rejected" };
        }
        if (path === "/events/update") {
          exact2(body, ["workspaceId", "deviceId", "kind", "sourceId", "expectedStamp"]);
          scope(body);
          if (!["lesson", "due"].includes(body.kind) || !id(body.sourceId) || body.expectedStamp !== null && !/^[a-f0-9]{64}$/.test(body.expectedStamp)) fail8();
          let context;
          await local.atomic(auth.ownerId, (tx) => {
            const ctx = tx.context(body.workspaceId, body.deviceId);
            if (!ctx?.active || ctx.sessionId !== auth.sessionId || ctx.sessionRevision !== auth.sessionRevision || ctx.sessionExpiresAt <= now()) fail8();
            context = ctx;
          });
          const q = ports.query, source = await readSource(q, auth.ownerId, body.kind, body.sourceId, context.preferences);
          const old = await q("select distinct source_stamp from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5", [auth.ownerId, body.workspaceId, body.deviceId, body.kind, body.sourceId]);
          if (old.rows.length && old.rows.some((r) => r.source_stamp !== body.expectedStamp)) return { status: "stale", sourceStamp: old.rows.length === 1 ? old.rows[0].source_stamp : null };
          if (!old.rows.length && body.expectedStamp !== null) return { status: "stale" };
          await q("delete from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5", [auth.ownerId, body.workspaceId, body.deviceId, body.kind, body.sourceId]);
          for (const e of source?.events ?? []) {
            if (e.expiresAt <= now()) continue;
            const { dueAt, ...payload } = e;
            await q("insert into n44_push_draft.events values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [auth.ownerId, body.workspaceId, body.deviceId, e.id, body.kind, body.sourceId, source.stamp, dueAt, e.expiresAt, payload]);
          }
          const count = await q("select event_id from n44_push_draft.events where owner_id=$1 limit 101", [auth.ownerId]);
          if (count.rows.length > 100) fail8();
          return { status: "updated", sourceStamp: source?.stamp ?? null };
        }
        return { status: "rejected" };
      }, signal);
    },
    async schedule({ operation, cursor = null, limit = 25 }, signal) {
      if (!deliveryEnabled) return { status: "disabled" };
      const delivery = makeDelivery(signal);
      if (!["due", "cleanup"].includes(operation) || !Number.isInteger(limit) || limit < 1 || limit > 25) fail8();
      if (operation === "cleanup") {
        if (cursor !== null) fail8();
        const owners = await transaction(async ({ query }) => {
          const r = await query("select owner_id from n44_push_draft.owner_clock where next_cleanup_ms<=$1 order by next_cleanup_ms,owner_id limit $2 for update skip locked", [now(), limit]);
          for (const r0 of r.rows) await query("update n44_push_draft.owner_clock set next_cleanup_ms=$2 where owner_id=$1", [r0.owner_id, now() + 6e4]);
          return r.rows;
        }, signal);
        for (const r of owners) {
          if (signal?.aborted) fail8();
          const result2 = await delivery.cleanup(r.owner_id);
          if (result2.status !== "cleaned") fail8();
          await transaction(async ({ query }) => {
            await query("select owner_id from n44_push_draft.owner_clock where owner_id=$1 for update", [r.owner_id]);
            await query("delete from n44_push_draft.events where owner_id=$1 and expires_at_ms<$2", [r.owner_id, now() - 864e5]);
            await query(`delete from n44_push_draft.contexts where (owner_id,workspace_id,device_id) in
      (select c.owner_id,c.workspace_id,c.device_id from n44_push_draft.contexts c where c.owner_id=$1 and c.session_expires_at_ms<$2
       and not exists(select 1 from n44_push_draft.registrations r where r.owner_id=c.owner_id and r.workspace_id=c.workspace_id and r.device_id=c.device_id)
       and not exists(select 1 from n44_push_draft.events e where e.owner_id=c.owner_id and e.workspace_id=c.workspace_id and e.device_id=c.device_id)
       order by c.workspace_id,c.device_id limit 100)`, [r.owner_id, now() - 864e5]);
          }, signal);
        }
        await transaction(async ({ query }) => {
          await query("delete from n44_push_draft.ingress_nonces where nonce in(select nonce from n44_push_draft.ingress_nonces where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)", [now()]);
          await query("delete from n44_push_draft.ingress_rates where key in(select key from n44_push_draft.ingress_rates where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)", [now()]);
        }, signal);
        return { status: "completed", count: owners.length, cursor: null };
      }
      const first = [0, "00000000-0000-0000-0000-000000000000", "", "", "", "00000000-0000-0000-0000-000000000000"];
      if (cursor !== null && (!Array.isArray(cursor) || cursor.length !== 6 || !Number.isSafeInteger(cursor[0]) || cursor.slice(1).some((v) => typeof v !== "string" || v.length > 240))) fail8();
      const rows = await transaction(async ({ query }) => (await query(`select e.*,r.registration_id from n44_push_draft.events e
   join n44_push_draft.registrations r on r.owner_id=e.owner_id and r.workspace_id=e.workspace_id and r.device_id=e.device_id
   left join n44_push_draft.deliveries d on d.owner_id=e.owner_id and d.workspace_id=e.workspace_id and d.device_id=e.device_id and d.event_id=e.event_id
   where e.due_at_ms<=$1 and e.expires_at_ms>$1 and r.state='active' and r.expires_at_ms>$1
   and (d.state is null or d.state='retry' and d.next_at_ms<=$1)
   and (e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id)>($2,$3::uuid,$4,$5,$6,$7::uuid)
   order by e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id limit $8`, [now(), ...cursor ?? first, limit])).rows, signal);
      const outcomes = [];
      for (const e of rows) {
        if (signal?.aborted) fail8();
        outcomes.push((await delivery.deliver(e.owner_id, e.registration_id, e.payload)).status);
      }
      const last = rows.at(-1);
      return { status: "completed", count: rows.length, outcomes, cursor: rows.length === limit ? [Number(last.due_at_ms), last.owner_id, last.workspace_id, last.device_id, last.event_id, last.registration_id] : null };
    }
  });
}

// drafts/n44-push/web-protocol.mjs
var ROUTE = /^\/api\/n44\/(?:context\/(?:read|update)|events\/(?:update|authorize)|push\/(?:register|revoke))$/;
var FORWARDED = Object.freeze(["authorization", "origin", "content-type", "x-n44-csrf", "sec-fetch-site"]);
var decodeBytes = (value) => {
  if (typeof value !== "string" || value.length > 16384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error("n44_envelope");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
};
var hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
async function mac(key, value) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
}
function signingText({ origin, path, method, headers, bodyHash, time, nonce, source }) {
  return JSON.stringify(["n44-ingress-v1", origin, path, method, FORWARDED.map((n) => headers.get(n) || ""), bodyHash, time, nonce, source]);
}
async function readBytes(stream, max = 12288, signal) {
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
      if (signal?.aborted) throw Error("n44_deadline");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) throw Error("n44_body_limit");
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
  vary: "Origin",
  "content-type": "application/json; charset=utf-8"
});
var privateResponse = (status = 503) => new Response('{"error":"unavailable"}', { status, headers: PRIVATE_WEB_HEADERS });

// drafts/n44-push/web-entry.mjs
function createWebEntry(options) {
  const backend = createBackend(options), now = options.now ?? Date.now;
  let running = 0;
  return async (request2) => {
    if (running >= 4) return privateResponse();
    running++;
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15e3);
    const work = async () => {
      try {
        const u = new URL(request2.url), h = request2.headers, schedule = u.pathname === "/functions/v1/n44-notifications/schedule";
        if (u.origin !== options.authUrl || u.search || request2.method !== "POST" || h.get("content-type") !== "application/json" || h.has("content-encoding") || !["/functions/v1/n44-notifications/dispatch", "/functions/v1/n44-notifications/schedule"].includes(u.pathname)) return privateResponse(400);
        const e = { time: h.get("x-n44-time"), nonce: h.get("x-n44-nonce"), source: h.get("x-n44-source") }, sig = h.get("x-n44-signature");
        if (!/^\d{10}$/.test(e.time ?? "") || Math.abs(now() / 1e3 - Number(e.time)) > 15 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(e.nonce ?? "") || !/^[a-f0-9]{64}$/.test(e.source ?? "") || !/^[a-f0-9]{64}$/.test(sig ?? "")) return privateResponse(401);
        const bytes = await readBytes(request2.body, 32768, abort.signal), text = new TextDecoder("utf-8", { fatal: true }).decode(bytes), envelope = parseBody(text, 32768);
        let expected, path, authorization, body;
        if (schedule) {
          if (!recordSchedule(envelope)) return privateResponse(400);
          expected = await mac(options.schedulerKey, JSON.stringify(["n44-scheduler-v1", u.origin, u.pathname, await sha(bytes), e.time, e.nonce, e.source]));
        } else {
          if (!envelope || Object.keys(envelope).sort().join(",") !== "body,headers,method,path" || !ROUTE.test(envelope.path) || envelope.method !== "POST" || !Array.isArray(envelope.headers) || envelope.headers.length !== FORWARDED.length || !envelope.headers.every((v) => typeof v === "string" && v.length <= 8192)) return privateResponse(400);
          const forwarded = new Headers(FORWARDED.map((n, i) => [n, envelope.headers[i]])), raw = decodeBytes(envelope.body);
          if (raw.length > 12288 || forwarded.get("origin") !== options.origin || forwarded.get("content-type") !== "application/json" || forwarded.get("x-n44-csrf") !== "1" || forwarded.get("sec-fetch-site") && forwarded.get("sec-fetch-site") !== "same-origin") return privateResponse(401);
          expected = await mac(options.ingressKey, signingText({ origin: options.origin, path: envelope.path, method: "POST", headers: forwarded, bodyHash: await sha(raw), ...e }));
          path = envelope.path.slice("/api/n44".length);
          authorization = forwarded.get("authorization");
          body = parseBody(new TextDecoder("utf-8", { fatal: true }).decode(raw));
        }
        if (!timingSafeEqual3(Buffer6.from(expected, "hex"), Buffer6.from(sig, "hex"))) return privateResponse(401);
        if (!await backend.ingress({ ...e, kind: schedule ? "scheduler" : "teacher" }, abort.signal)) return privateResponse(429);
        const result2 = schedule ? await backend.schedule(envelope, abort.signal) : await backend.teacher(path, authorization, body, abort.signal);
        if (abort.signal.aborted) return privateResponse();
        const status = result2.status === "unavailable" ? 503 : result2.status === "limited" ? 429 : ["rejected", "stale"].includes(result2.status) ? 400 : 200;
        return schedule ? Response.json(result2, { status, headers: PRIVATE_WEB_HEADERS }) : Response.json({ status, body: result2 }, { headers: PRIVATE_WEB_HEADERS });
      } catch {
        return privateResponse();
      }
    };
    try {
      const pending = work().finally(() => {
        running--;
      });
      return await Promise.race([pending, new Promise((resolve) => abort.signal.addEventListener("abort", () => resolve(privateResponse()), { once: true }))]);
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  };
}
var recordSchedule = (e) => e && Object.keys(e).sort().join(",") === "cursor,limit,operation";

// drafts/n44-push/database-transport.mjs
import { Buffer as Buffer7 } from "node:buffer";
import { createHash as createHash2 } from "node:crypto";
function databaseConfig(readEnv) {
  const url = readEnv("N44_DATABASE_URL"), db = new URL(url), user = decodeURIComponent(db.username);
  const direct = user === "n44_service_login" && db.hostname === "db.xlrubcwjqktzzunrvuns.supabase.co";
  const session = user === "n44_service_login.xlrubcwjqktzzunrvuns" && db.hostname === "aws-0-ap-south-1.pooler.supabase.com";
  const ca = readEnv("N44_DATABASE_CA_CERT");
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !(direct || session) || !["", "5432"].includes(db.port) || db.pathname !== "/postgres" || !db.password || db.search || db.hash || typeof ca !== "string" || createHash2("sha256").update(ca).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") throw Error("n44_database_configuration");
  return { connectionString: url, ssl: { ca, rejectUnauthorized: true, servername: db.hostname, minVersion: "TLSv1.2" }, max: 4, connectionTimeoutMillis: 5e3, idleTimeoutMillis: 1e4, statement_timeout: 3e3, query_timeout: 4e3, application_name: "n44-private-server", allowExitOnIdle: true };
}
async function assertRestrictedIdentity(client) {
  const row = (await client.query("select session_user as login,current_user as role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl")).rows[0];
  const flags = { loginExact: row?.login === "n44_service_login", roleExact: row?.role === "n44_service_login" || row?.role === "n44_backend", upstreamSsl: row?.ssl === true, clientTlsAuthorized: client.connection?.stream?.authorized === true };
  if (Object.values(flags).some((v) => v !== true)) {
    const e = Error("n44_transport_invariants");
    e.safeReadiness = flags;
    throw e;
  }
  return flags;
}

// drafts/n44-push/existing-host.mjs
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
  const explainSafe = r && (r.explain_duration == null || r.explain_duration === "-1" || /^\d+$/.test(r.explain_duration) && Number(r.explain_duration) > 6e3 && r.explain_nested === "off");
  if (result2.rows?.length !== 1 || !r || r.role !== "n44_backend" || !["terse", "default"].includes(r.error_verbosity) || r.error_parameters !== "0" || !["none", "ddl"].includes(r.statements) || r.duration !== "-1" || r.duration_sample !== "-1" || Number(r.transaction_sample) !== 0 || r.transaction_sample == null || ![null, "none"].includes(r.audit) || !explainSafe)
    throw Error("n44_database_unavailable");
  await assertVerifiedBoundary(client);
}
function createExistingHost(readEnv) {
  if (readEnv("N44_ENABLED") !== "true") return Object.freeze({ handle: async () => privateResponse(), close: async () => {
  } });
  const required = (n) => {
    const v = readEnv(n);
    if (typeof v !== "string" || !v) throw Error("n44_configuration");
    return v;
  };
  const authUrl = required("N44_AUTH_URL"), origin = required("N44_PUBLIC_ORIGIN");
  for (const v of [authUrl, origin]) {
    const u = new URL(v);
    if (u.origin !== v || u.protocol !== "https:") throw Error("n44_origin");
  }
  if (required("N44_SERVICE_REVISION") !== "n44-browser-service-v2") throw Error("n44_readback_missing");
  const sessionPolicy = JSON.parse(required("N44_SESSION_POLICY_JSON")), serviceSourceSha = required("N44_SERVICE_SOURCE_SHA");
  if (!supportedSessionPolicy(sessionPolicy, Date.now(), serviceSourceSha)) throw Error("n44_session_policy_readback_missing");
  const transport = databaseConfig(readEnv);
  const key = (n) => {
    const v = required(n);
    if (!/^[a-f0-9]{64}$/.test(v)) throw Error("n44_key_configuration");
    return Buffer8.from(v, "hex");
  };
  const ingressKey = key("N44_INGRESS_KEY"), schedulerKey = key("N44_SCHEDULER_KEY"), rateKey = key("N44_RATE_KEY");
  const raw = JSON.parse(required("N44_CRYPTO_JSON"));
  const ring = (x) => {
    if (!Array.isArray(x) || x.length < 1 || x.length > 8) throw Error("n44_key_configuration");
    return new Map(x.map(([name, value]) => {
      if (!/^[a-f0-9]{64}$/.test(value)) throw Error("n44_key_configuration");
      return [name, Buffer8.from(value, "hex")];
    }));
  };
  const material = { ...raw, sealingKeys: ring(raw.sealingKeys), endpointHmacKeys: ring(raw.endpointHmacKeys), bindingHmacKeys: ring(raw.bindingHmacKeys), vapidKeys: new Map(raw.vapidKeys) };
  const keys = [ingressKey, schedulerKey, rateKey, ...material.sealingKeys.values(), ...material.endpointHmacKeys.values(), ...material.bindingHmacKeys.values()];
  if (new Set(keys.map((v) => v.toString("hex"))).size !== keys.length) throw Error("n44_separate_keys_required");
  for (const v of material.vapidKeys.values()) {
    if (!p2562.utils.isValidPrivateKey(Buffer8.from(v.privateKey ?? "", "base64url"))) throw Error("n44_private_key_configuration");
  }
  const providerOrigins = JSON.parse(required("N44_PROVIDER_ORIGINS_JSON"));
  const crypto2 = createPrivatePushPorts({ ...material, providerOrigins, enabled: true });
  const pool = new pg.Pool(transport);
  pool.on("error", () => {
  });
  let waiting = 0;
  const acquire = async () => {
    if (waiting >= 4) throw Error("n44_pool_capacity");
    waiting++;
    let c;
    try {
      c = await pool.connect();
      await assertRestrictedIdentity(c);
      await c.query("set role n44_backend");
      await assertPrivateDatabaseSession(c);
      return { query: (sql, values) => privateQuery(c, sql, values), release: (e) => c.release(e) };
    } catch {
      c?.release(Error("n44_database_unavailable"));
      throw Error("n44_database_unavailable");
    } finally {
      waiting--;
    }
  };
  try {
    const handle = createWebEntry({ sessionPolicy, serviceSourceSha, acquire, authUrl, origin, apiKey: required("N44_AUTH_API_KEY"), providerOrigins, crypto: crypto2, ingressKey, schedulerKey, rateKey, deliveryEnabled: readEnv("N44_DELIVERY_ENABLED") === "true" });
    return Object.freeze({ handle, async close() {
      crypto2.close();
      await pool.end();
    } });
  } catch {
    crypto2.close();
    void pool.end();
    throw Error("n44_configuration");
  }
}

// drafts/n44-push/readiness-entry.mjs
import pg2 from "pg";
import { Buffer as Buffer9 } from "node:buffer";
import { timingSafeEqual as timingSafeEqual4 } from "node:crypto";
var busy = 0;
var nonces = /* @__PURE__ */ new Map();
async function checkReadiness(readEnv) {
  const source = readEnv("N44_SERVICE_SOURCE_SHA"), profile = JSON.parse(readEnv("N44_SESSION_POLICY_JSON") ?? "null");
  if (!supportedSessionPolicy(profile, Date.now(), source)) throw Error("n44_session_policy_readback_missing");
  const client = new pg2.Client(databaseConfig(readEnv));
  let stage = "connect";
  try {
    await client.connect();
    stage = "identity";
    const identity = await assertRestrictedIdentity(client);
    stage = "set_role";
    await client.query("set role n44_backend");
    stage = "source_boundary";
    await assertPrivateDatabaseSession(client);
    return { status: "ready", ...identity, sourceBoundary: true, source, enabled: readEnv("N44_ENABLED") === "true", deliveryEnabled: readEnv("N44_DELIVERY_ENABLED") === "true" };
  } catch (e) {
    return { status: "unavailable", stage, ...e.safeReadiness ?? {}, code: /^(n44_[a-z_]+|[A-Z][A-Z0-9_]{2,40})$/.test(e.code ?? e.message) ? e.code ?? e.message : "n44_runtime_unavailable", source, enabled: false, deliveryEnabled: false };
  } finally {
    await client.end().catch(() => {
    });
  }
}
async function readinessEntry(request2, readEnv, check = checkReadiness) {
  if (readEnv("N44_READINESS_ENABLED") !== "true" || busy >= 2) return privateResponse();
  try {
    const u = new URL(request2.url), time = request2.headers.get("x-n44-time"), nonce = request2.headers.get("x-n44-nonce"), signature = request2.headers.get("x-n44-signature"), key = readEnv("N44_INGRESS_KEY");
    if (u.origin !== readEnv("N44_AUTH_URL") || u.pathname !== "/functions/v1/n44-notifications/readiness" || u.search || request2.method !== "POST" || request2.headers.get("content-type") !== "application/json" || request2.headers.has("content-encoding") || !/^[a-f0-9]{64}$/.test(key ?? "") || !/^\d{10}$/.test(time ?? "") || Math.abs(Date.now() / 1e3 - Number(time)) > 15 || !/^[a-f0-9-]{36}$/.test(nonce ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "")) return privateResponse(401);
    const body = new TextDecoder().decode(await readBytes(request2.body, 2, AbortSignal.timeout(2e3)));
    if (body !== "{}") return privateResponse(401);
    const expected = await mac(Buffer9.from(key, "hex"), JSON.stringify(["n44-readiness-v1", u.origin, u.pathname, time, nonce, await sha(new TextEncoder().encode(body))]));
    if (!timingSafeEqual4(Buffer9.from(expected, "hex"), Buffer9.from(signature, "hex"))) return privateResponse(401);
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

// supabase/functions/n44-notifications/index.ts
var runtime;
Deno.serve(async (request2) => {
  if (new URL(request2.url).pathname === "/functions/v1/n44-notifications/readiness") return readinessEntry(request2, (name) => Deno.env.get(name));
  try {
    runtime ??= createExistingHost((name) => Deno.env.get(name));
    return await runtime.handle(request2);
  } catch {
    return privateResponse();
  }
});
addEventListener("beforeunload", () => {
  void runtime?.close();
});
