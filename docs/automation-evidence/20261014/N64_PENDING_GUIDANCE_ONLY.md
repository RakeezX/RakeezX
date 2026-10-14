# N64 — settings presentation only

Task: `continuous-n64-pending-guidance-viewonly-20261014`  
Run: `56921269-afd2-45a9-b0ec-fe056992abea`  
Base: `60b9197354e8656df739a4e7ee30b9016aeec3c1`

The existing `cloud.updateCurrentUserEmail(nextEmail)` call and owner mismatch guard remain. Only settings presentation now keeps the sheet open while sending (unless explicitly dismissed), prevents duplicate submission/sheets, retains sending/error guidance on the page, and gives persistent Arabic dual-confirmation/spam/current-email instructions outside the collapsible profile. Local state is bound to the rendered owner; stale-sheet submission after an owner switch makes no request. No view state is persisted.

## Affected verification — PASS

- `node --check src/views/settings.js`: syntax passed.
- `node tests/n64-presentation-scope.mjs`: only allowed paths; existing email-call expression/imports retained; shared cloud/Auth, router, app, DOM, store and Sync unchanged.
- `node tests/n64-presentation-browser.mjs`: actual HTTP-served application, source CSS, settings handlers, shared modal and existing `bootSettings` fixture; fresh owned Chromium contexts at 1280×900 and 390×900. Delayed synthetic response shows sending in the open sheet; repeated submit events produce one call. Cancel before submit produces zero calls. Escape during sending restores local controls while the request remains outstanding; edit stays disabled. Pending response leaves current email displayed and guidance visible even when profile details collapse. Failed synthetic response stays readable in the sheet, restores retry, and persists on the page after dismissal/repaint. About dialog, keyboard trap/focus restoration and local sound controls work. Owner switch clears guidance/error and rejects stale-sheet submission without a third call.
- Five synthetic rejected v2 outbox entries retain exact serialized contents; existing operational summary still reports `rejectedCount: 5` after the affected flow.

All service requests use the existing helper's synthetic route fulfillment; the email PUT is a delayed/error synthetic adapter. A test-only served cloud-module export changes the in-memory fixture owner, without any endpoint call or session persistence. No real credentials/account, email send, provider operation or remote live request. Canonical `withIsolatedLocalBrowser` restricts the origin to `http://127.0.0.1:19664`, blocks Service Workers/external requests and owns disposal. The local Vite server closes in `finally`; this approved isolated phase does not acquire the shared browser lease.

Fixture warnings preserved: blocked Service Worker/update/cache checks and automatic Sync `Incomplete cloud read: invalid page or exact count` from the unchanged generic settings service stub. These are not Sync/offline/Service Worker acceptance passes; no shared implementation or fixture helper was changed to hide them.

The broader refused callback/token/session/Auth-return correction and responsiveness diagnosis are explicitly unimplemented. No one-time link read, template change, live lifecycle verification, push or deployment. N64 remains open; local readiness covers this bounded presentation slice only. The independent controller/publisher owns integration and Production evidence.
