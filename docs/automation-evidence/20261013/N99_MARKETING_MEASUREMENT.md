# N99 — bounded public marketing measurement

Task: `continuous-n99-umami-minimal-public-20261013`

Run: `dbec2845-95db-428a-b1d9-aa52ad3de531`

Base: `3d5bae2b1b71e4219a015c5cdfe0d0a151524d40`

Result: local candidate only. No push, deployment, dashboard observation or real collector POST.

The audited first-party module sends only `landing_view` after the anonymous public landing paints and `demo_started` after ordinary Demo initialization and the application layout succeed. Auth begins unknown; any pre-existing identity (including malformed credentials), authenticated/partial identity, account workspace, login entry or peer identity change excludes measurement. Eligibility is checked again immediately before fetch. Account entry/page exit/offline cancels pending requests. Each event has a boolean sessionStorage attempt flag and an in-memory boolean; storage refusal fails closed. There is no identifier, UTM forwarding, outbox, retry, third-party script or application dependency on a collector response. HTTPS canonical hostname only; localhost and Preview are disabled. DNT and GPC suppress both events.

Exact JSON, with only the event name varying:

```json
{"type":"event","payload":{"website":"a0f3bd66-07fc-4082-956d-70c17ff621c5","hostname":"rakeezx.com","url":"/","title":"رَكيز المعلم","name":"landing_view"}}
```

Fetch uses `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'` and an abort signal with a 2-second timeout. Responses are neither parsed nor saved. IP/User-Agent remain available to the provider at the network boundary. The public expandable privacy explanation explicitly describes external processing, possible technical/location metrics and a derived session hash, provider-stated US/Germany hosting, and the unverified region of this account. It makes no blanket compliance claim.

No CSP or `_headers` existed at this base. A connect-only meta policy was added to `index.html`, retaining same-origin requests and the existing exact Supabase HTTPS/WSS endpoints, plus only `https://cloud.umami.is`. It introduces no script allowance or wildcard and does not replace any other directive. The new first-party module is included in the existing service-worker shell. Existing service-worker POST/cross-origin bypass remains unchanged, so the collector is never cached or needed for offline boot.

## Affected verification

`node --test tests/n99-marketing.test.mjs tests/n99-public-integration.test.mjs`: **12/12 PASS**, no skips.

| Required check | Actual evidence |
| --- | --- |
| n99_public_only_allowlist | Hardcoded two-event allowlist; duplicate/reloaded-document attempts remain two; DNT/GPC/offline/Preview/localhost, unknown eligibility and storage refusal send zero. Actual app checks also exclude unknown boot identity, malformed credentials, synthetic authenticated account and signed-out internal route. |
| n99_no_sensitive_event_data | Exact outgoing JSON compared structurally; email/campaign query and internal teaching/grades/report/support/backup routes never reach payloads. Browser capture confirms no Cookie/Referer despite an existing synthetic collector-domain cookie; fetch option inspection confirms credential omission. |
| n99_blocked_tracker_is_nonblocking | Unit rejection/synchronous failure/timeout and eligibility race checks; actual browser collector abort leaves successful Demo, blank toast and zero page errors. A pending send aborts when the ordinary login button opens the actual inline OTP form; returning to the landing does not restart it. |
| n99_public_integration | Actual app ESM/handlers/source CSS served by the established N37/Demo HTTP static-server pattern, intercepted under synthetic HTTPS origin in fresh Chromium contexts. Public render dispatch has landing DOM present; successful ordinary Demo dispatch has layout present; failed Demo has zero demo events. Existing `openReadyServedDemo` verifies >100 synthetic students and readiness, and existing `bootSettings` verifies an account workspace with zero analytics. Demo outbox remains empty. |

Syntax: `node --check src/app.js`, `node --check src/lib/marketing-analytics.js`, `node --check sw.js` PASS. `git diff --check` PASS. Exact connect-only CSP, first-party offline-shell inclusion and absence of provider script checked by the scoped suite. No broad build or unrelated suite.

Actual rendered screenshots inspected, including opened privacy details and mobile no-horizontal-overflow assertion:

- [Desktop](../../../tests/n99-landing-desktop.png) — SHA256 `0d178b05ecc7c87d54901f2b5a4adbd1a1a0709281be6ba7b70129a6f379d98f`.
- [Mobile 390×844](../../../tests/n99-landing-mobile.png) — SHA256 `263b476365584b095e567a388a27634fad4668bfc82c4a674046908769eb8104`.

The browser phase lease was acquired for this run and released after tests; the test process closed its owned contexts, browser and ephemeral server in teardown. No queue/status changes or live teacher/student/service mutations.

## Primary documentation and remote limitations

Reviewed 2026-10-13:

- [Sending stats](https://docs.umami.is/docs/api/sending-stats): public collector needs no authentication token; a browser User-Agent is required. **The current page now names `https://gateway.umami.is/api/send`, unlike the activated card's `https://cloud.umami.is/api/send`.** Implementation retains the explicitly supplied cloud endpoint. A read-only `curl.exe -I --max-time 20 https://cloud.umami.is/api/send` returned 405 Method Not Allowed and CORS headers allowing POST and all origins; no redirect was observed. This proves an endpoint response only, not event ingestion. No alternate host, redirect-following or fallback collector was enabled.
- [Tracker configuration](https://docs.umami.is/docs/tracker-configuration): default tracker initializes automatic tracking. No provider tracker is installed here.
- [Sessions](https://docs.umami.is/docs/sessions): provider can derive a session hash from IP, User-Agent and website ID; this is not zero-data processing.
- [Terms](https://umami.is/terms): US/Germany hosting and incorporated DPA; this account's specific processing region was not observed.
- [Pricing](https://umami.is/pricing): Hobby lists 100K monthly events, one website and six months retention. No paid API, key, upgrade or new subscription was used.

All synthetic collector requests were intercepted; real service counts/API/dashboard access remain **NOT OBSERVED**. The independent publisher owns integration, any served CSP/header verification and Production evidence. One ordinary eligible public visit after deployment may establish a real collector response; it must not be represented as a dashboard-count observation or replaced by repeated fake events. The current-doc endpoint discrepancy is recorded for that bounded delivery check.
