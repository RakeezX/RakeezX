# N64 ordinary account email status page — local candidate

Task: `continuous-n64-account-email-status-page-20261018`
Run: `68be00d0-2ba9-4a83-9cea-8bdc30ee77ee`
Base: `e597351809935528fd208302b65190da1d21e5d6`

The settings email section links to `#/settings/email-status`. This ordinary account view uses the existing shell, RTL, source CSS and `cloud.verifyCurrentAuthIdentity(expectedOwnerId)`. Only its fresh same-owner result populates email details. Pending guidance explains both confirmations and both mailboxes/spam; focus/visible return and reload read current server truth. A matching known pending address may complete through the existing `verifiedEmailFeedback`; opening/reloading a page with only the approved current email does not announce success. Current/completed guidance explicitly leaves actual sign-in and data results unobserved.

No callback, bootstrap, query/token parsing, provider template, redirect, confirmation-link destination, email-request or resend/cancel changes. No new persistent intent, credentials or storage. Settings verification behavior is unchanged; its only diff is the ordinary account link. New view/CSS and all existing JS dependencies are included in the offline shell. This checks shell membership, not Service Worker/offline execution certification.

## Affected verification

- `node tests/n64-email-status-ui.mjs`: PASS in fresh isolated Chromium contexts on owned HTTP loopback port 19868, at 390 and 1280. Existing `bootSettings` seeds the actual account store; actual router, DOM, event handlers and CSS are exercised. Computed source styling, RTL and no horizontal overflow are asserted.
- Pending, fresh matching completion, return deduplication, reload current/no false success, neutral HTTP failure, actual cloud wrong-owner rejection, late unmount, synchronous owner/session clearing, late old-session response and no-session neutrality: PASS at both widths. Twelve Auth reads per width, all `GET /auth/v1/user`; no Auth writes or other Auth endpoints. Existing app read RPC POST transports (account contract, owner marker and capability reads) remain synthetic and allowlisted; mutation endpoints fail the test. External network is intercepted; no live service/account/email/data operation is certified or performed.
- `node --test tests/n64-bounded-verification.test.mjs tests/n64-confirmed-email-state.test.mjs`: 3 PASS, 0 FAIL. These preserve actual cloud deadline, coalescing, stale owner/token/logout/body timeout/retry and matching-address semantics.
- `node --check` on the new view, settings, router and sw.js: PASS. `git diff --check`: PASS. No full build, Auth/SQL suite or live proof replay.
- Visual inspection: pending mobile and completed desktop screenshots show readable original application layout; desktop card explicitly overrides the settings two-column layout. Four actual-app screenshots are under `tests/fixtures/n64-email-status/`.
- Browser/context and server cleanup run in `finally`; no listener remained on owned port 19868 after completion. The canonical isolated-browser helper supplies this approved non-shared local phase; no global browser lease is taken.

Detailed results and source SHA-256 identities: `tests/n64-email-status-evidence.json`. Cloud and feedback helper have no candidate diff. Prior email-change browser evidence is retained as historical unaffected evidence; it is not a claim that this run sent or changed email. Prior liveness evidence's recorded cloud hash (`992bf9…`) differs from the actual source (`df9fc3…`, also byte-identical to committed d675429). Therefore its hash gate was not asserted as PASS: the existing targeted liveness unit check above was run against the current source instead. No unchanged live/browser liveness phase was repeated.

## Preserved local iteration findings

The initial test incorrectly classified existing POST-based read RPCs as mutations; after inspecting their existing cloud entry points, the harness allowlists only those named read endpoints and continues rejecting mutations. The intentional HTTP-500 fixture also produces the expected browser console resource error; only that exact message is filtered. Initial desktop inspection caught the inherited settings two-column grid, corrected with page-specific block layout. An attempted reuse assertion exposed the prior cloud evidence hash mismatch described above; the final evidence records that mismatch rather than replacing the old evidence. Existing synthetic fixture emits baseline incomplete Sync-read and blocked-Service-Worker warnings; this is not a Sync/offline acceptance claim.

Local readiness only. Independent controller/publisher still owns integration, build, release and served-asset verification. No Production, email-target navigation, actual new-email sign-in, PO acceptance or N64 umbrella completion is claimed.
