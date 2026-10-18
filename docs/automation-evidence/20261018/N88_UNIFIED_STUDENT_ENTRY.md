# N88 universal student entry — inactive source preparation

AI implementation for `continuous-n88-unified-student-entry-view-20261018`, run `5cd15d10-5ebc-4063-8333-ab41fae20236`.
Base and observed remote main: `8ff59100ead8802dec7ebb7f7d4f4d41c2c89f8c` (read-only `git ls-remote origin refs/heads/main`).

## Result and integration boundary

Three independent modules provide `createUnifiedStudentPortalClient`, `projectUnifiedStudentData`, and `mountUnifiedStudentPortal(root,{client,readiness})`. No shared route, runtime, app, worker, teacher screen or activation file was changed. Mount readiness defaults OFF; nothing imports or activates these modules in the current app. No service, SQL, Auth, live fixture or private access operation was performed.

The single normal text field uses numeric input mode and normalizes Arabic/Persian digits and presentation spaces to exactly twelve ASCII digits starting with 1. No credential issuance occurs here. Global uniqueness, cryptographic issuance, stable issuing owner/student binding, rotation/revocation, server-side rate limits and authorization remain responsibilities of the separately composed service.

Transport paths are fixed `/api/n88/student/claim` (POST, only `{code}`), `/read` (GET) and `/end` (POST `{}`). Relative paths, same-origin credentials, no-store, no-referrer, error-on-redirect and mutation CSRF marker are explicit. Server response bodies and transport errors never become diagnostics or error text. Client requests have a 15-second abort deadline; invalidate/dispose prevents late response/body parsing from restoring old data. Client disposal is terminal.

Claim and read require the `n88-student-v3` response. Projection copies only profile name/classLabel; grade id/label/value/max/status and optional explicit total; and explicitly supplied work required/completed/scheduled arrays. Work entries accept id/title and optional instruction/deadline/status. Unknown keys are discarded, malformed known values rejected, strings/arrays bounded, nonnegative finite numeric grades preserved, and null remains null. No hidden section, inferred progress, grade or completion is generated. Status strings are rendered only as escaped published text. Final integration must align these field names with its service response.

The mount installs its own source stylesheet, uses RAKEEZ tokens with standalone fallbacks, and returns ready/refresh/clear/dispose. Clear, hidden document and pagehide immediately remove private content and invalidate pending work. BFCache pageshow rechecks the session. Dispose removes DOM, stylesheet, handlers and timers. No URL credential support, storage, analytics, SDK or teacher owner lookup is introduced. Existing private-entry behavior remains untouched.

## Affected verification

`node tests/n88-unified-entry.mjs` runs the real mount/client/CSS over a bounded task-owned loopback HTTP server using the canonical `withIsolatedLocalBrowser`. Fixture HTML only imports these actual modules and supplies an empty mount root; service responses are fabricated. Fresh contexts are loopback-only, block Service Workers/external requests, and use no real account/profile. This approved isolated phase requires no shared browser lease. Owned browser/context/server cleanup runs in finally.

- `n88_unified_numeric_entry_actual_student_ui_and_allowed_projection`: PASS at 390/1280. One field; numeric normalization/format; A/B own views; omitted sections; null versus zero; RTL; responsive columns; no overflow; readiness OFF sends no requests. Empty-entry screenshots at both sizes were visually inspected. No credential or student-payload screenshot was taken.
- `n88_unified_client_session_failure_revocation_and_private_credential_boundaries`: PASS. Exact paths/methods/body/transport options; invalid code causes no send; generic transport failure; current session; logout; expired/revoked responses; 429 cooldown and retry; 503; stale body-parse and pending UI invalidation; pagehide/dispose; zero persistence writes; no credential/payload diagnostics or query.
- Syntax checks for both source JS modules and `git diff --check`: PASS.

Machine evidence and source SHA256 identities: `tests/n88-unified-entry.result.json`. Screenshots contain only the empty entry and reside in task-named temporary files recorded there. No build or broad regression suite was required for these unregistered modules. Hosted service composition, live authorization, Production delivery and Product acceptance were not tested or claimed.
