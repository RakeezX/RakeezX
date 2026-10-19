# N111 — mobile class confirmation

- Task: `continuous-n111-mobile-delete-single-confirm-20261019`
- Run: `ab7de6cb-b95c-4d31-8559-5c47004f2b87`
- Base/current observed origin/main at start: `80d7a264596cb38c1856796c0c30c23dbbb6b49f`
- Authority: activated synthetic N111 card and PO19October note on the current N111 ledger row. No live records, service changes, queue edits, push or deployment.

## Change

Only the final class-delete button in `src/views/teachings.js` gains touch activation. A stationary, completed, single-finger tap invokes its existing click handler and cancels the browser compatibility click. Cancelled touches, drags, releases outside the button and long presses do not trigger this path. Mouse and keyboard retain the existing click handler. The synchronous disabled guard, review step, scope/workspace checks, owner validation, server ACK, errors and store deletion semantics are unchanged.

## Affected proof

`node tests/n111-1019-mobile-confirm.mjs` — PASS. Results: `tests/n111-1019-mobile-confirm.json`.

The canonical isolated browser helper served the actual application modules, handlers, DOM and source CSS over a task-owned ephemeral loopback HTTP server in fresh 390×844 Chromium touch contexts. External traffic and Service Workers were blocked; browser/contexts/server closed in finally. The approved isolated synthetic phase requires no shared live-browser lease.

- Immutable base reproduces two taps when the first touch's compatibility click is deliberately suppressed. The first tap leaves all stores unchanged; the second completes deletion. The candidate handles that same event-loss condition with one tap. This controlled reproduction establishes the event dependency; it does **not** establish the original phone/browser's precise cause. Unmodified Chromium's native baseline tap already worked.
- Existing account fixture and real account UI/store/cloud ownership guard: first confirm creates exactly one guarded commit. A held synthetic receipt keeps the dialog open and Product records unchanged. Duplicate activation while busy is ignored. ACK then tombstones the selected class, teaching, item and score; other grades, students, history and outbox remain unchanged.
- Review/back/cancel, touchcancel and drag are read-only. Foreign current Auth owner rejects before commit with all stores unchanged.
- Missing ACK warns and re-enables confirmation while preserving Product rows and durable intent. Enter retries the same mutationId and closes only after a valid receipt.
- `node --check src/views/teachings.js`, `node --check tests/n111-1019-mobile-confirm.mjs`, and `git diff --check` — PASS.

## Preserved limitations and harness correction

The installed WebKit attempt did not reach application readiness: `locator.waitFor: Timeout 30000ms exceeded`, waiting for `.boot` to detach in `openReadyServedDemo`. It is not a WebKit UI PASS and was not retried. Chromium supplied the bounded affected proof; no physical-phone certification is claimed.

`tests/n111-1019-initial-harness-failure.json` preserves the initial negative-case failure: returning a foreign identity from the synthetic Auth response after preview allowed the existing durable delete intent to be recorded before Auth verification rejected the commit. The original test incorrectly expected the device checkpoint to remain unchanged. The final owner-negative fixture switches the current Auth user to a foreign owner, exercising the existing pre-commit ownership guard; the separate missing-ACK case explicitly expects durable intent retention. No Product guard was changed to satisfy either case.

N77/N91 accepted proofs and deletion/store/schema behavior were not rerun or changed. Local readiness only; the independent controller/publisher owns integration and Production evidence, and PO acceptance remains separate.

## Saved-session reconciliation — d66bc796-761d-49d8-855e-84ad495ef956

The previous candidate `d05e17f173721b4da8d24fbd8467950c3ee147e8` was committed with a clean worktree. Its final result was rejected because an additional WebKit diagnostic was listed as FAIL among delivery checks. The activated card requires `n111_mobile_delete_confirmation_first_tap_exactly_once`, which passed using the actual Chromium application; it does not require WebKit certification. This reconciliation reports the required affected proof and safeguards using their original evidence, and preserves the unsuccessful optional WebKit attempt above as a limitation. It neither changes that failure to PASS nor claims WebKit coverage.

Product source, fixtures and scenario assertions remain unchanged. The test runner now requires `N111_RUN_ID` instead of embedding the retired attempt identity; a missing value fails before resources open. Future explicitly needed execution uses `$env:N111_RUN_ID='<activated runId>'; node tests/n111-1019-mobile-confirm.mjs`. No browser rerun or new live phase was needed for this metadata-only correction. Original result JSON and initial harness failure remain intact with their original run identities. The final required Product check reuses the successful original evidence rather than asserting a new execution.
