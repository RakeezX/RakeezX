# N44 existing-host completion â€” local inactive source

AI-authored. Task `continuous-n44-existing-host-auth-context-and-scheduler-20261018`,
run `a7060142-87f7-4876-af30-bcb92ca2796b`, base
`7537657e8351fb7cb314a53ac4027c0976b3cf45`.

The useful server prerequisite is implemented: existing Supabase Edge WebRequest
entry, existing-zone Cloudflare ingress, official SDK current teacher/session
verification, transactional private context/CAS/event writers, canonical source
and calendar/date projection, durable distributed ingress limits, and independently
signed bounded due/cleanup scheduler. Existing crypto/protector/repository/sender
are composed with actual implementations. There is no future Auth/context/scheduler
implementation port and no requirement for a new Node/TLS host.

Everything remains inactive. No hosted SQL/Auth/RLS/service configuration, real
account/source/student reads/writes, real provider send, live job, push subscription
prompt, app/SW wiring, push/deployment or queue/status edit occurred. N44 is OPEN;
source readiness is not Production usability or Product acceptance.

## Affected verification

- `node tests/n44-existing-host.mjs`: 12/12 cases PASS using owned native
  PostgreSQL 17.6 and restricted `n44_backend`, Node 24.19.0.
- Same journey via existing Deno 2.2.12: 12/12 PASS, cached/frozen runtime,
  external networking denied, only the explicit owned loopback PG port allowed.
  Actual AuthClient ES256/WebCrypto/JWKS/fresh-user handling, Cloudflare and Edge
  WebRequest handlers, private SQL and audited encrypted sender were exercised.
  Auth/ingress/provider inputs were fabricated; six provider attempts were mock
  requests with observed durable `sending` receipts before bytes were released.
- Coverage includes teacher context/read/CAS/register; forged/foreign/stale Auth;
  source/parent soft-delete/restore and child hard-delete; current lesson/calendar/
  timing; concurrent duplicate schedulers; keyset pagination; timeout -> durable
  uncertainty/no replay; consent revision retirement; a revoked Auth session on
  a second active device with an UNUSED send budget -> suppressed/zero attempts;
  provider timeout; private role/anonymous denial; distributed peer limit and
  public receipt saturation with reserved bounded scheduler cleanup.
- `node tests/n44-existing-host-config.mjs`: PASS. Disabled construction reads
  only its flag; admin DB usernames, SSL overrides, reused/malformed keys,
  invalid origins/revision denied; direct/Supavisor lazy pools close without
  network; npm/Deno pins/integrities agree, old crypto transitives unchanged;
  affected syntax passes; root packages/browser/SW/N88 source diffs are empty.
- `deno check --frozen --config supabase/functions/n44-notifications/deno.json
  supabase/functions/n44-notifications/index.ts`: PASS. Deno 2.2's checker needs
  a type-only wildcard specifier alias locked to existing `@types/node` 22.12.0.
  The runtime npm graph/integrities are IDENTICAL before/after that alias;
  `tests/n44-existing-host.type-lock.json` records both lock hashes and the equal
  graph hashes. Runtime receipts retain their original pre-alias lock hash;
  no unchanged PG/runtime replay was used to restate the metadata correction.
  The same artifact records removal of a blank EOF line from Cloudflare source;
  bytes before trailing whitespace are identical to the tested source.
- `git diff --check`: PASS. Canonical lease acquisition/release and exact owned
  PostgreSQL PID absence are recorded; stopped checkpoint directories are retained
  under the task fixture ignore, never committed or recursively removed.

Evidence: `tests/n44-existing-host.result.json`,
`tests/n44-existing-host.deno.result.json`,
`tests/n44-existing-host.source-checks.json`, and
`tests/n44-existing-host.type-lock.json`.

Prior 18-case crypto and corrected 16-case boundary evidence is reused by matching
component/test hashes only. New PG hooks, Web entry and portable point validation
are qualified by the above journeys. Deno's missing `ECDH.convertKey` and panic
from an intermediate invalid-point native guard are preserved in
`tests/n44-existing-host.compatibility-failures.json` and original timestamped
failure receipts. Final validation uses pinned audited noble-curves 1.9.7 before
native sender ECDH. No global/prototype/security-policy patch or new runtime was
used. Publisher lease contention and original route/RLS failures were retained,
then corrected within this scope; no other owner's resource was changed.

## Exact remaining external operations

The full operation sequence, role grants, three private SQL proposal filenames,
readback queries, all configuration/key names, inactive function configuration,
route/cron activation controls and later app/SW entry calls are in
`drafts/n44-push/ACTIVATION.md`. `readback.inactive.sql` is metadata-only; it has
not been executed against a hosted service. The generic frontend publisher does
not apply these SQL files, deploy the Edge function or provision keys.

The controller may integrate this exact inactive source candidate through its
single publisher. Actual hosted migration/helper/role/secret/function/route and
provider readiness require their separate exact authority/readback; later browser
wiring requires its affected owner/Sync/offline/UI checks. No live service
readiness, OS delivery or PO acceptance is claimed here.
