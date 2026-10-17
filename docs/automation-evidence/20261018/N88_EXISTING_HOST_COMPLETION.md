# N88 existing-host completion — source-only candidate

AI-authored; task `continuous-n88-existing-host-auth-and-current-state-20261018`,
run `5c01ec9b-e0cc-478e-8033-515690fc31f0`.

The missing local server bindings are implemented. This is **LOCAL source readiness
for an INACTIVE artifact**, not service activation, Production evidence, PO acceptance
or Product CLOSED. No real account, key, roster, session row or provider mutation was
accessed. Generic frontend publishing does not apply the proposed SQL or deploy Edge.

## Ancestry and actual scope

Started clean at card base / observed origin/main
`faa3cd5c32895148d5220ec9b34dd3f07a82cb5e`; remote main matched at the initial read.
Merged exact saved `51f2c62e53dd710cde755acba03b8d409794f43b` ancestry before new work,
then completed substantive new code in that merge candidate. Its historical HTTP,
SQL and failure evidence is retained verbatim. The original publisher's terminal
`VERIFICATION_ASSET_MISSING` history was not retried/edited; **51f2 was not deployed**.
The later read-only remote check observed main
`55bc032b49cea2a27e38c97170b870de64098b0a`, with no intersecting task source changes.
The original publisher still owns integration of this new candidate with current main.

New source includes the official concrete Auth/claims/session verifier; exact private
SQL/helper/role proposals; current-owner FK/row locks and revision lineage; actual
Supabase Web Request composition and bounded pg pool; a disabled Cloudflare signed
ingress with fixed upstream URL and durable replay protection; function-local pinned
packages/lockfiles; and focused fabricated native PG/Node/Deno checks. No frontend,
Auth flow, startup dependency, Service Worker, date policy or real service changed.
The external inputs and single activation sequence are enumerated once in
[drafts/n88-student-portal/ACTIVATION.md](../../../drafts/n88-student-portal/ACTIVATION.md).
There is no remaining injected current-session/introspection or hosting logic port.

## Actual affected checks

`node tests/n88-existing-host.mjs` — PASS, recorded in
`tests/n88-existing-host.result.json` (exact timestamps and source hashes therein):

- `n88_concrete_current_session_verifier_and_existing_host_entry`: actual existing
  application client -> signed Cloudflare gateway -> Web Request entry -> service ->
  restricted-role PostgreSQL 17.6, with only provider/network/canonical fixtures.
  Official AuthClient verifies ES256/JWKS and provider-verified HS256; verified
  issuer/audience/expiry/iat/nbf/role/user/session must match. Fresh user verification,
  current/expired/revoked/foreign session checks, negative signature/metadata/user
  checks, provider deadline and pre-commit expiry guard pass. Actual publish/issue/
  claim/read, stable PIN/entry into second term, rotate/revoke, cookie/privacy and
  tamper/replay/direct-ingress rejection pass. The upstream path is fixed dispatch;
  bearer/cookie/private path and response cookie remain body-only there.
- `n88_targeted_canonical_lifecycle_guards_without_unrelated_owner_write_blocking`:
  while an ACTUAL teacher request holds its canonical transaction, another owner's
  student/enrollment UPDATE and student INSERT commit without taking N88's lock.
  Ten target membership insert/restore/transfer, source/parent lifecycle and Auth
  session-delete operations get expected `55P03`, with real PK/FK and enabled source
  RLS/private-role policies. Owner row caps and denied direct backend Auth/source
  writes pass. Revision lineage prevents archive/restore between reads from reviving
  a session; source restore requires republication. Invalid claim spends its durable
  budget without canonical lookup. Missing source yields expected `42P01` and denial.

`node tests/n88-existing-host.mjs --deno-executable <pinned local Deno 2.2.12>` —
PASS in `tests/n88-existing-host.deno.result.json` (22:54:56Z–22:55:10Z). This separate
compatibility check runs the actual Web entry/AuthClient/ES256/WebCrypto/service/pg
against its own restricted local PG fixture under Deno, including publish, random
1000..9999 issue, claim and read. Network permission is loopback-only and process
environment is sanitized. It is not a hosted TLS/device proof. Unchanged Node journey
was reused rather than replayed for this runtime check.

`npm exec --yes --package=deno@2.2.12 -- deno check --frozen --config
supabase/functions/n88-student-portal/deno.json
supabase/functions/n88-student-portal/index.ts` — PASS. Deployable entry typechecks
with a v4 integrity lock, including its pinned automatic Node type-resolution alias.
No global Deno/config/ACL/tool policy changed.

`node tests/n88-existing-host-config.mjs` — PASS in
`tests/n88-existing-host.source-checks.json`: disabled config access only, malformed/
admin-role/SSL override/same-key rejection, lazy direct/Supavisor host composition
without network, exact npm/Deno runtime package integrity parity, affected module
syntax, and unchanged app/startup/SW/root packages. No Vite build or UI claim is made.

The existing 9000-value/PIN constraints, global budget arithmetic, private credential
reservation and unchanged repository uncertainty/rollback evidence are reused from
the prior qualified artifacts. Changed entry, owner synchronization, RLS/role and
session lineage behavior is exercised by the new checks above. Historical prior
required groups are not relabelled as tests of this changed verifier/locking code.

## Original failures and scoped corrections

The initial new journey failed closed. `n88-existing-host.initial-failure.json` and
`n88-existing-host.jwks-fixture-diagnostic.json` preserve it: two independently made
fixture keys had used the same issuer/kid, conflicting with the OFFICIAL SDK's shared
JWKS cache. One issuer now uses one actual fabricated keyset; no cache guard was
disabled. `n88-existing-host.natural-key-fixture-failure.json` retains the later
invalid membership-insert fixture: it collided with the actual natural key of a
tombstone. A real third-section parent now isolates the intended FK-lock assertion.
The response-envelope change also initially exposed an outdated harness assertion
about internal HTTP status; the check now reads the actual wrapped service status.

Deno's Node KeyObject JWK export was unsupported in the test provider; its original
failure is retained in `n88-existing-host.deno.initial-fixture-failure.json`. Only
fixture signing moved to standard WebCrypto. Deno then caught a real missing explicit
Buffer import in runtime preflight, retained in `n88-existing-host.deno.buffer-failure.json`;
that import is fixed and actual Deno execution passed. Frozen lock checking initially
reported the automatic Node-types alias missing; the function-local lock now pins
both that alias and explicit `@types/node@22.12.0` to the SAME integrity-checked node.
No real/tool-denied operation was recreated and no failed acceptance gate was
converted without its concrete correction and affected verification.

## Official primary sources checked (changelog first)

Checked on 18 October 2026. The implementation uses the existing platforms and
pinned `@supabase/auth-js@2.118.0`, `pg@8.23.1`; Node/Deno locks carry integrity hashes.
The local validation tool is pinned Deno 2.2.12 with v4 lock compatibility, not a
claim that this is the exact deployed provider runtime revision.

- [Supabase changelog](https://supabase.com/changelog) and
  [current SDK release](https://github.com/supabase/supabase-js/releases/tag/v2.118.0).
- [Verified getClaims API](https://supabase.com/docs/reference/javascript/auth-getclaims),
  [fresh getUser API](https://supabase.com/docs/reference/javascript/auth-getuser),
  [session IDs/sign-out and session lifetime semantics](https://supabase.com/docs/guides/auth/sessions).
- [Edge dependencies/Node API support](https://supabase.com/docs/guides/functions/dependencies),
  [Postgres connectivity](https://supabase.com/docs/guides/functions/connect-to-postgres),
  [runtime limits](https://supabase.com/docs/guides/functions/limits),
  [upstream pg runtime support](https://github.com/supabase/server/blob/main/docs/postgres.md),
  [pg TLS configuration](https://node-postgres.com/features/ssl).
- [Cloudflare provider IP and Worker-subrequest semantics](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
  [provider Request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/),
  [PostgreSQL row lock semantics](https://www.postgresql.org/docs/17/explicit-locking.html).
- [Supabase runtime release](https://github.com/supabase/edge-runtime/releases/tag/v1.77.1),
  [Deno Node compatibility](https://docs.deno.com/runtime/fundamentals/node/),
  [dependency lockfiles](https://docs.deno.com/examples/dependency_lockfile_tutorial/).

## Cleanup and unrun boundary

Each native phase acquired only its integration lease, verified the new cluster's
marker/data-directory/PID/birth/executable, and stopped only that owned PG process
in finally. Pool clients, reservations and Deno child work ended. Lease release and
PG STOPPED facts are in the result JSONs. Owned STOPPED directories are intentionally
retained under ignored fixture paths; no recursive cleanup, user process, browser,
controller/maintenance lock, STOP or queue/status file was touched.

`hosted_service_app_device_and_production_verification = NOT_RUN`.
No hosted migration, function deployment, provider/private log readback, real Auth
verification, UI/device certification, student-page wiring or live student access
activation is claimed. Those physical prerequisites remain explicitly outside this
source-only card, not tasks assigned to the generic frontend publisher.
