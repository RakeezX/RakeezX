# N44 existing config phase — AI source-only qualification

Task: `continuous-n44-existing-config-phase-public-dependency-20261025`
Run: `47a28f9b-b24d-4f46-92c7-4446135a956d`
Base: `cd3246b9d75fcede23d53dc1c56dde058fbd4e69`

Read the canonical operating contract, activated card, current N44 Product row, D-107 and affected sources. Verified intake artifact SHA256 `6a7fc97852b17b2809d4efe8e1acfd6cc53c9ef3d5720f1a8a9e598a2e56f563`. The activated card explicitly chooses the bounded body parser over the intake's earlier proposed carrier-header deployment. No new header or carrier change is required or implemented.

## Source facts and bounded change

Inspected immutable `5319f95973ab000ec9f6961da212eb40daeadd9f:drafts/n44-push/activation/reviewed-eight-74844af7/edge.mjs`: the runtime-failure module has a closed 19-phase enum. `requestFailure` uses an HTTP200 private envelope with logical status503 and body `{error:'unavailable',phase,...optional private identity}`. The exact original enum is copied explicitly into the existing public gateway, rather than accepting a regex or arbitrary server string:

`configuration`, `configuration_origin`, `configuration_revision`, `configuration_policy`, `configuration_transport`, `configuration_crypto`, `configuration_provider`, `connect`, `identity`, `set_role`, `private_session`, `source`, `ingress`, `query`, `deadline`, `registration_input`, `registration_auth`, `registration_protect`, `registration_repository`.

Inspected immutable original custodian `49d7bb702734784caa4fb4c3f3826d45472d15cb:drafts/n44-push/activation/region-6e7ccaaf/n44-india.prepared.mjs`: the existing carrier validates the envelope then returns its body at the envelope HTTP status. Its manifest source digest is `0a324c5e4538b5184f0ff460f9c0a907eafd35e2f423ed970145db70919882bc`. The intake reports installed native source `696f71d09cd655a2b87ce461f1d963a2a3912fb7`; this child made no service readback or deployment.

Only the fixed `POST /api/n44/push/config` action, actual HTTP503, JSON media type and still-valid context enter the optional parser. The existing `web-protocol.mjs` bounded stream algorithm is reused locally with a strict 2048-byte limit, abort cancellation and fatal UTF-8 decoding. This avoids a new startup module dependency. Overflow cancels without retaining the overflowing chunk. Invalid JSON, array/null/primitive shape, wrong error, unknown phase, or prototype-looking keys (including nested extras) retain no service phase. All other fields are discarded; no parsed-body spread, identity, raw error, header, token, URL, ID, SQL or stack reaches the receipt.

The existing receipt remains HTTP503/client phase `http`; only a valid optional `servicePhase` string is appended. An abort keeps the existing client `deadline` phase and no service phase. Runtime explicitly constructs the receipt and revalidates the optional enum, behind the existing request generation and owner/session/workspace/device/lease/consent guards. The settings renderer appends one optional coarse service phase inside the same disclosure. Current local identity stays outside choices. No extra diagnostic packet, copy control, request, retry, focus handler, permission, consent, registration, projection or send is added. HTTP200 disabled remains the ordinary disabled result.

This deliberately narrows the previous implementation-specific assertion that *every* non-2xx response body must remain unread. The exception applies only to this exact JSON config503 response, with bounded parse-and-discard. The privacy requirement remains intact. The prior public evidence is historical and is not relabelled as exercising the new exception.

## Affected checks

`node --test tests/n44-existing-config-phase-20261025.test.mjs` — PASS (final run, exit0).

- `n44_existing_phase_bounded_exact_config503_only`: direct gateway guards preserve no-read behavior for HTTP400/401/403/404/413/429/500/502/504, non-JSON/missing media types, stale contexts, and other exposed read/update/project/authorize actions at503. Tests check fixed POST, 2048-byte acceptance, byte-based multibyte overflow rejection/cancellation, read failure, fatal UTF-8, and malformed/prototype/shape handling. The actual HTTP app exercises all 19 original phases and 13 malformed/unknown/read/deadline/disabled scenarios.
- `n44_existing_phase_no_identity_or_raw_body_disclosure`: actual gateway → runtime → normal settings DOM over loopback HTTP with source CSS. Valid bodies deliberately contain private sentinel identity/token/stack/URL fields; snapshots and rendered DOM omit the sentinel and identity field. Only the exact phase is shown. There is exactly one config disclosure, no button/copy action inside it, no extra source UI, and no overflow at390px. Expanding the actual summary handler preserves a single config attempt.
- `n44_existing_phase_context_and_single_attempt`: existing synthetic provisioned-account fixture, actual mounted ownership guard, matching owner/provisioning receipt/context, editable lease and zero sources. Owner, session, workspace, device, lease and consent changes discard the phase and clear its DOM; restoring the prior context cannot revive it. A real HTTP partial body is held after the gateway acquires its reader; workspace deactivation occurs before completion and the late phase cannot populate a receipt. Absent context and disposal remain empty. Every scenario has one config attempt and zero permission/consent/register/project/send effects.

Reused existing application helpers `openReadyServedDemo`, `prepareAccount`, and synthetic native ports from `n44-confirmed-projection-20261024/runtime.mjs`; no native/PG harness was built. The canonical `withIsolatedLocalBrowser` validated this active synthetic card/run and created a fresh disposable browser context for a uniquely allocated ephemeral loopback server. External requests and real Service Workers were blocked. This is the approved isolated phase, without a shared live-browser lease. Browser/context and owned server closed in `finally`; no user profile or unrelated process was touched.

`node --check` on all three changed modules and the scoped test; `git diff --check` — PASS. No full build, provider check or broad suite was run.

Harness failures retained: initial other-action test omitted the required preferences port, so `update` failed before fetch (0 rather than1 calls); supplied the synthetic port. The next two runs passed all HTTP-backed phase cases but failed the immediate read-error DOM assertion because the already-open disclosure was blindly toggled closed; changed the harness to open only when closed. No Product guard was relaxed. The final complete scenario also adds a positive assertion that the late HTTP body reader is active before context deactivation. No live fixture or request was spent.

## Reused evidence and delivery boundary

Reuse unchanged public config/identity evidence from candidate `4871a684ad0ea77d9ab032d60076c975ae5ac51c`, published source `1933b65dd1c90978e07b1375ffc33bd2cad1a01a`, documented in `N44_CONFIG_READINESS_PUBLIC_DEPENDENCY.md`. New checks above cover the changed exception and affected seams. Original `reviewed-eight-pg-74844af7.json` fifteen frontdoor/registration guards and `normal-ui-preflight-40c37185.json` twenty-eight association guards remain unchanged evidence with their original limits and failures; they were not rerun or promoted into new live proof.

The historical identity-matched normal request still means actual HTTP503/client phase `http`, with cause UNKNOWN. A missing service phase cannot prove a carrier failure: native has generic early branches too. A received `query`, `connect` or `ingress` phase remains coarse, not SQL, lock, TLS, identity, source-drift or repair evidence. The separate root's read-only metadata observation reportedly found plain-text `N44_ENABLED=true`; this child did not repeat that operation or issue a current-request probe.

This is a five-file public source/test/document candidate only. The sole publisher owns integration and served-source verification; this worker does not push or deploy. Original custodian `49d7bb702734784caa4fb4c3f3826d45472d15cb` remains PARKED until the actual published source and its next separately authorized normal observation. No native/pin/carrier/provider/SQL/Auth/RLS/account/source/window/registration/send operation, queue/ledger edit, Product closure, live causal finding or OS-arrival claim is included. N88 remains disjoint. Final exact candidate SHA is returned in the worker result, avoiding a circular document self-hash.
