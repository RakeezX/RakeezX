# N44 config readiness — AI source-only qualification

Task: `continuous-n44-config-readiness-public-dependency-20261025`

Run: `2826b3bf-ecec-45bb-8863-d06922271cd3`
Base and observed origin/main: `defc74f81c7d1edfc3a2b1f51bcb0f6255143f0b`.

Read canonical operating contract, activated card, N44 ledger row and affected sources. Causal intake SHA256 verified against `artifacts/ops-supervisor-v4/intake-evidence/po-20261025-n44-config-readiness-causal-source-consult.json`: `f9bcd74d353d2c3c2ae647086f7814c4809ba41e9e74ad29f24049c359cde826`.

## Bounded result

The gateway preserves the actual configuration response status and a finite phase from the same request. Phases distinguish transport, HTTP rejection, response read/size, decode, shape, deadline and completed classification. No response is inferred when transport failed; UNKNOWN remains UNKNOWN. Non-2xx bodies are never read. Config exceptions are replaced with a fixed error and finite receipt; no bodies, raw messages, headers, URLs, tokens, emails or stacks enter the public outcome. Default gateway configuration callers still receive the original success body; other gateway operations retain their ACK/error behavior.

Runtime retains only this receipt behind its existing generation/current-owner/session/workspace/device/lease/consent guards. Invalidation, new attempts and disposal clear it. A mismatched snapshot permanently discards the old observation. Late responses cannot install an observation in another context. HTTP200 disabled remains `configuration_disabled`, distinct from `request_unavailable` and malformed ready schema. Readiness, subscription, authorization, delivery and arrival remain separate.

Ordinary notification settings now have a collapsed current-local-account/workspace/device identity section outside source/reminder choices. It uses the existing `currentNotificationContext`, including actual mounted ownership guard and Auth checks; localStorage alone or caller IDs cannot establish identity. The wording explicitly does not claim service approval. One collapsed finite configuration result is available independently of reminder choices. There is no copy control, extra request, startup dependency or new Product action. Existing source identity, verification, cleanup receipts and UNKNOWN guards remain intact. Workspace deactivation clears private DOM synchronously; storage/Auth/store validation also removes an obsolete diagnostic.

## Affected checks

`node --test tests/n44-config-readiness-20261025.test.mjs` — PASS.

- `n44_config_actual_http_and_finite_phase`: actual HTTP app document, source CSS, normal settings renderer and existing handlers, real runtime and gateway; controlled HTTP200 disabled and valid-ready schema; HTTP401/403/429/503; transport, response read/size, malformed JSON, shape and actual gateway abort deadline. Exactly one config attempt per case, no inspection-triggered consent/register/project/send; non-2xx body read is forbidden by assertion. Opening details does not request again or expose the private sentinel. Rendered layout has no overflow at390px.
- `n44_config_prewindow_identity_context_isolation`: real synthetic account fixture/provisioning receipt and runtime ownership guard; editable lease; zero sources; visible exact current owner/workspace/device. Owner/session/workspace/device/lease/consent changes discard the receipt, and genuine storage-event view validation clears its DOM. Restoring a former context does not revive that receipt. Workspace deactivation clears identity; delayed response, absent context and disposal cannot reveal it or request again.
- `n44_config_empty_approval_disabled_normal_ui`: controlled HTTP200 `{status:'disabled'}` traverses the actual gateway/runtime/settings, renders normal unavailable text, with no activation control, context read, source, registration, consent or send. Valid-ready is a controlled schema/native-port fixture, not a backend-success or approval-policy proof. No real PostgreSQL case or current compiled-native execution was performed by this child.

Existing focused client safeguards — PASS5/5: `node --test --test-name-pattern="payload|explicit_consent|owner/workspace|cleanup failures|action independently" tests/n44-push-preparation.test.mjs`.

Existing first three gateway tests in `tests/n44-client-binding.unit.mjs` executed unchanged with the absolute actual gateway import (excluding unrelated provider-crypto static imports) — PASS3/3: newer-tab cleanup identity, failed HTTP200 ACK and expired/backend context guards.

`node --check` for the three changed modules and scoped test, plus `git diff --check` — PASS. No full Vite build or blanket suite. Canonical isolated-local-browser helper used the active synthetic card and owned fresh disposable context; only its explicit ephemeral loopback server was allowed, Service Workers/external requests blocked. Existing native ports are synthetic; no user's browser/profile was attached. Owned browser/context and server closed in finally; no shared live-browser/integration/live-mutation lease was acquired.

Harness failures retained: first run reached deadline then failed on unavailable Playwright `clock.uninstall`; corrected to supported `resume`. Next run failed owner mutation because mounted workspace is immutable; corrected arrangement uses mock Auth and genuine `activateWorkspace`, preserving the guard. Final affected scenario passes. An optional gateway-prefix shell command initially failed quoting before any test; corrected stdin module invocation passes3/3. None of these was a live attempt or a service rejection.

## Reused evidence and actual limits

Original immutable custodian `a0d00348162060058859c833371e45ee3a787f57`, `tests/n44-current-closed-page-followup-20261024/normal-ui-fresh-document-8cfe376e.json`: same-Chrome fresh ordinary document recovered six pupils, one class and Sync green, but showed config-load failure and no activation. Protected custody comparison, source3/window3/registration8/send3 were not performed. This observed failure remains unresolved; no actual HTTP status/cause is invented.

The verified causal intake cites original compiled native `5319f95973ab000ec9f6961da212eb40daeadd9f:drafts/n44-push/activation/reviewed-eight-74844af7/edge.mjs`: after genuine ingress/Auth/private session admission, approvalNULL yields native status200/body disabled, unwrapped by existing carrier to browser HTTP200. This source fact plus controlled normal UI qualification distinguishes intentional disarm from the observed load exception. It is not a new real-PG/current-service success claim. Config preview does not require source/consent/registration; ready/opt-in still requires the exact approved window and unchanged historical policy gates.

Reuse unchanged original `reviewed-eight-pg-74844af7.json` fifteen registration/frontdoor guards and `normal-ui-preflight-40c37185.json` twenty-eight association checks from that custodian, including their limits and original failures. Reuse public `8e40465a5a1b4edadc71a42c8454c41d5a80e938` normal UI reminder/source/cleanup/owner evidence recorded in `N44_NORMAL_UI_CUSTODY_DEPENDENCY.md`; changed configuration/identity seams have the new actual-app checks above. No backend/native/carrier/policy/crypto/registration implementation was changed or rerun. Reuse is bounded to unchanged behavior, not a claim the old whole-source hashes still match the three edited modules.

## Original custodian order and publication boundary

1. Original custodian first verifies exact current account/workspace/device custody, Sync and observer prerequisites before a window. The new identity is local mounted-context evidence, not fresh backend admission or protected equality by itself.
2. Original custodian alone performs the one approved ordinary source3 creation and canonical ACK under the original exact-source policy, then approved window3 before READY/opt-in. Existing prior consumed/revoked histories, registration/send caps and server approval gates remain binding. This child does not arm a window, create source data, register or send.
3. Sole publisher integrates only the three public modules, this scoped test and evidence; it verifies actual served asset bytes. No whole private branch integration, native upload, pin/carrier replacement, provider operation, Auth/RLS/SQL/schema/migration or queue/ledger change belongs to this child.
4. After actual source publication, original custodian observes ordinary current-account config outcome under its exact authority. Publishing this diagnostic alone does not fix or identify the unknown backend cause. Parent stays PARKED; OS arrival and Product acceptance remain unproven. Independent N88 private scope remains separate.

## Exact public preimages and targets

Git blob identities below use the observed base and normalized candidate bytes. Final candidate SHA is returned by the worker result; no circular self-hash is asserted for this evidence document.

| Path | Base blob | Candidate blob | Candidate SHA256 (LF) |
| --- | --- | --- | --- |
| `src/lib/notification-push-gateway.js` | `99cd3445d3b8e63b9a5158db8f303023db13a305` | `cfcad50ad2b6623384c552c5d5f502f1df385996` | `fbad7d3258a709e68a8e4305a09b35736b7e219d2007dda601d49136f2bc8763` |
| `src/lib/notification-push-runtime.js` | `ee71001a49b359432fd72af20e5b1ee129a3a974` | `b11082b9da60e2fc6da2eda3bddf452720af5607` | `bf5ce44ea090ae490bb36f95fef6a748641883a7e4e20888066a456223577b7a` |
| `src/views/notification-settings.js` | `f9cc8512f628a82b738e0af842c541205bd23c44` | `c802845becee830df5577a73882e09b52f3bc7da` | `9fde398387a179f8fd581057da794a2b5e4819cf309e3e73c5cfdcb795e5cb6f` |
| `tests/n44-config-readiness-20261025.test.mjs` | `NEW` | `61eea40712c6935b73947fe7e29b53b3344e4975` | `bc31edb34400ea1085baece85207a2e67a13ec654b8c55e17fe3ecb697a055ec` |
