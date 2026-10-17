# N44 — actual private protector and Web Push sender, source only

Task: `continuous-n44-audited-protector-and-sender-20261018`

Run: `9c9ee4fd-ab29-43ae-b190-84c9dbcb3a6b`

Base: `faa3cd5c32895148d5220ec9b34dd3f07a82cb5e`

Implemented the two missing local ports and their inactive composition. No real
keys/secrets, account/subscription/device, hosted operation, Push send, app/SW
activation, queue mutation, push or deployment occurred. All synthetic key pairs
were generated only in memory. No plaintext keys, request bytes, endpoints,
subscription rows or decrypted fixtures are in proof output. N44 remains open.

## Exact implementation

- `drafts/n44-push/subscription-protector.mjs`: actual OpenSSL P-256 point
  validation; versioned AES-256-GCM envelope; independent seal/endpoint-HMAC/
  binding-HMAC rings; authenticated seal/fingerprint/VAPID IDs; strict lookup,
  tamper/binding denial, old seal reads and bounded owned-key disposal.
- `provider-policy.mjs`: explicit source-grounded FCM production origin/paths,
  disabled unless separately configured; canonical key/endpoint shape and public
  IP classification with reserved/mapped/metadata denial. Other providers deny.
- `committed-permit.mjs` and the small `delivery.mjs` change: carry the committed
  row's fingerprints and mint a frozen, single-use server capability only after
  atomic commit. No change to reservation, owner/current state, budgets, retry,
  uncertainty, cleanup or SQL transitions. The sender rejects copied/replayed
  permits before decryption.
- `audited-sender.mjs`: pinned **web-push 3.6.7**, its **http_ece 1.2.0** encryption
  and per-request VAPID. Per-subscription signing-key lookup/rotation, no newest-key
  fallback. Actual request construction pins validated DNS in the connection
  lookup, retains normal hostname/certificate/SNI checks, rejects redirects and
  bounds TTL/deadline/abort. Only 201/202 acceptance, 404/410 gone and 429 definitive
  rate rejection receive their named results; everything unknown is uncertain.
- `private-runtime.mjs`: concrete usable `createPrivateRuntime(config,ports,material)`
  composition without a listener, scheduler or env discovery. Runtime's original
  dependency preflight remains disabled while genuine service/Auth/current-state/
  ingress/scheduler prerequisites are missing. Defaults need no keys and are off.
- Private package/lock only: **ipaddr.js 2.5.0**, **web-push 3.6.7**, 18 installed
  packages. Root manifest/lock/global config untouched, local node_modules ignored.

See [the exact API, official primary sources, rotation/retention contract and
existing-host inputs](../../../drafts/n44-push/CRYPTO_SENDER.md). Public docs were
checked changelog-first; no project/secret configuration or connected Supabase
service was queried. Installed Node is **v24.19.0**. Dependency audit returned
zero known advisories; no independent security audit is claimed.

## Actual focused checks

`node tests/n44-crypto-sender.mjs` writes the secret-free
[`tests/n44-crypto-sender.result.json`](../../../tests/n44-crypto-sender.result.json)
with source SHA256s, exact run and case outcomes. Both required checks PASS:

| Required check | Actual evidence |
| --- | --- |
| `n44_actual_audited_subscription_protection_and_sender_protocol` | Actual protector → existing authenticated registration boundary → synthetic atomic transaction commit → actual committed-permit issuer → actual sender/library encryption, VAPID and HTTPS options → fabricated transport. Receiver decrypts via http_ece; Node verifies ES256 audience/contact/signature privately. Both current and documented prior FCM paths; actual existing consumer action handler accepts the decrypted minimal payload and denies foreign authorization/expiry. |
| `n44_key_endpoint_dns_commit_timeout_and_uncertain_guards` | Envelope tamper, invalid curve/encodings, key/endpoint swaps, HMAC mismatch, seal and VAPID rotation/unknown IDs, rollback-before-send, owner/context/consent, expired/uncommitted/copied/replayed permit, public/private/mixed/reserved/mapped DNS, rebinding lookup pin, wrong TLS/address, redirects, definitive 429 vs unknown 5xx, deadline during DNS/transport, abort/close/late outcomes, late revoke, completion-commit failure and retention erasure. |

Tests inject DNS and `https.request` only at the named bounded dependency seam;
they execute Product validation, decryption, library encryption/signing and the
actual HTTPS options/connection lookup. They do not replace the new Product
ports with fake protect/send implementations. Test process blocks every actual
`net.Socket.connect` and records **zero network attempts**. Normal TLS options
are asserted, not presented as an actual TLS handshake/provider proof. Owned
requests/responses are destroyed; keys closed, timers cleared. No browser/server
or database process was launched, so no browser/server phase lease was acquired.

The 16-case existing boundary suite was also executed because `delivery.mjs`
changed: **15 PASS, 1 FAIL**. The failure is preserved, not marked PASS, in
[`n44-crypto-sender.boundary-regression.json`](../../../tests/n44-crypto-sender.boundary-regression.json).
Its unchanged `git grep` includes `scripts/**/*.json` task/publication fixtures
and source-only publication tests storing these source paths as data. Those
matches trigger the old expected-no-match assertion at line 260; no application
import was found, and that test's construction subprocess passed. That old test
file is outside the allowed edit scope. Its 15 successful behavior cases are
reused unchanged. The new focused suite executes actual import/construction
with denied side-effect capabilities and scans executable import forms rather
than treating JSON path receipts as imports. This corrected inactivity check
PASS does not erase the old FAIL or weaken a Product ownership guard.

A later focused run correctly rejected one randomly generated synthetic VAPID
scalar whose OpenSSL export omitted leading zero octets. The original 17/18
result is retained in `tests/n44-crypto-sender.original-failure.json`. The fixture
now pads its in-memory scalar to the protocol's fixed 32 bytes (as the upstream
generator does); a deterministic scalar-1 case covers this. Product's strict
32-byte/private-public pair guard is unchanged. The corrected full scenario is
run again before this candidate; the original failure is not rewritten as PASS.

Previously qualified native PostgreSQL/schema/repository/runtime evidence stays
unchanged. Current proof records matching hashes for reused unaffected files;
it explicitly excludes the changed delivery wrapper from hash-equivalent reuse.
No SQL suite, prior hosted proof, UI Preview or accepted in-app check was repeated.
The new memory transaction fixture proves the new composition/commit sequencing,
not hosted RLS, real Auth or PostgreSQL durability. Prior SQL/runtime results
remain separate evidence in their original files/runs.

## Remaining activation inputs and disposition

The next usable artifact is `drafts/n44-push/private-runtime.mjs`, with exact
material maps, named server secret bindings and lifecycle usage in
`CRYPTO_SENDER.md`. It binds implemented ports; it does not ask a later worker
to invent protector/sender logic. Stable HMAC epochs, per-subscription VAPID
IDs, old-key retention and original-only erasure rules are explicit. Any real
configuration/rotation/deletion remains outside this synthetic authority.

No suitable deployed Node service/ingress is established by a static Cloudflare
deployment or existing Supabase project. Existing local Node is proven only as
the synthetic host. The original path must select an already authorized existing
host/ingress and bind actual applied schema/least-privilege service connection,
independent current-session verifier, authoritative serialized context/event
writers, distributed ingress limits and paginated private scheduler/cleanup.
No new host, paid plan, account or API is assumed. Current app/SW/receipt storage,
current-event authorization, supported-provider/device coverage, backup retention
and real service/Production activation require their specific later authority.

`hosted_service_app_device_and_production_verification = NOT_RUN`.
No real DNS/TLS/Push/service/Auth/device acceptance, Production result, PO
acceptance or N44 closure is claimed. The original publisher alone owns source-only
integration and delivery evidence; this worker creates the exact local AI commit.

## Saved-session continuation — candidate validation blocked

Current run: `a656377b-7e73-4477-a733-2a0030874a6e`.
The completed implementation candidate
`b0a95b7bd9fe90222bbba08e0212379e299f2738` is preserved. The controller rejected
the preceding result with `Candidate validation: An affected check must pass and
no recorded check may fail`. The legacy 15/16 boundary-suite result remains FAIL;
the passing replacement check does not make the existing failed check pass.
This continuation therefore reports **BLOCKED**, not LOCAL_READY.

Prepared a concrete correction inside the allowed paths:

- `tests/n44-crypto-sender-import-guard.mjs` supplies the literal executable-import
  guard for the original test, covering static import/export, side-effect import,
  dynamic import, require and HTML script src, including alternate path separators.
  Its qualification detects eight positive import forms, rejects four non-import
  receipt/JSON forms, and checks 230 existing executable app/service/script files.
- `tests/n44-crypto-sender-repair-preflight.mjs` verifies every saved proof source
  hash and the exact original failing harness block, then records the proposed
  import and replacement in `tests/n44-crypto-sender.repair-preflight.json`.
  It confirms the original raw-path grep mismatch read-only. It does not execute
  a transformed/copy suite, remove a check or edit an out-of-scope target.

`node tests/n44-crypto-sender-repair-preflight.mjs` PASS; both new modules pass
syntax checks. The 18-case cryptographic proof is reused from its original run
with all source hashes matching and zero network attempts. No cryptographic,
SQL, browser, Preview, dependency-install or service check was repeated.

**Exact missing write path:** `tests/n44-server-preactivation.test.mjs`.
The current card permits only `tests/n44-crypto-sender*.mjs` and its named fixture
directory, so the original failing assertion at line 260 cannot be repaired here.
The proposed patch adds the new helper import and replaces only the four-line
raw-path grep/assert block with `assertNoPrivatePushImports()`. It keeps the
forbidden-capability construction subprocess and all 15 behavioral tests intact.
The target's source hash and exact old/replacement block are in the preflight
receipt. Historical FAIL receipts are unchanged.

Retry condition: the existing guarded maintenance helper, once this worker is
inactive and publisher idle, adds that exact path to this same card without
changing Product/data authority. The controller resumes this exact saved session
and worktree; the scoped worker applies the prepared harness correction and runs
the corrected original 16-case boundary suite once. Do not requeue unchanged,
omit its failure from a LOCAL_READY result or rerun the completed crypto proof.
No maintenance task/worker was created, and no queue, STOP or lock was touched.
