# N64 — settings layout and collapse stability

Task: `continuous-n64-stable-settings-layout-20261014`  
Run: `a307ec98-cdd4-4f57-a80f-76ec440e51e6`  
Base: `b47a0ababa135a10b2e0bcb097b813b156b7063b`

## Observed cause and bounded correction

The actual base application, pending `pending@example.test`, current `teacher@example.test`, and five rejected synthetic v2 outbox rows reproduced a layout jump. After the user collapsed profile details, one Sync-summary refresh plus repaint reopened them because `profileExpanded || attention` forced `open` on every render. Actual paint counter advanced 4 → 5; no infinite repaint, exception or stuck inert overlay was observed in this baseline. The Appearance section's viewport top changed:

| Viewport | Collapsed top | After repaint | Shift |
| --- | ---: | ---: | ---: |
| 1280×900 | 317.140625 | 818.890625 | +501.75px |
| 390×900 | 411.421875 | 1240.734375 | +829.3125px |

Profile expansion now uses attention only for the initial default, then preserves the user's collapse/expand choice through paints. Existing invalid-field reveal behavior and its narrow `aria-invalid` MutationObserver remain. Route unmount resets presentation state and removes owned listeners. No app scheduler, focus implementation, modal lifecycle or route materialization code changes were needed.

The current email is explicitly labeled current. Pending status, sending and error messages sit inside its email field, before Access. Concise pending status explains that the current address remains authoritative; a native contextual details disclosure reveals existing dual-confirmation/spam instructions. Disclosure state survives repaint. Collapsed profile retains the existing summary attention status. There is no local-only cancel/resend action.

## Affected checks

- **PASS — n64_actual_repaint_or_jitter_reproduction:** `node tests/n64-stability-browser.mjs --baseline` ran before Product edits using the actual base app over HTTP. Measurements above. The committed baseline mode can serve immutable base settings/CSS through the same application harness. Corrected `node tests/n64-stability-browser.mjs` preserves collapse with **zero** Appearance shift: 290.390625 → 290.390625 at 1280px and 347.171875 → 347.171875 at 390px, paint counter 4 → 5.
- **PASS — n64_pending_message_email_context:** actual DOM ancestry places pending status and disclosure in `.settings-email-field`. Current address remains `teacher@example.test`. Instructions expand in context and survive repaint. The actual app/source CSS has no horizontal overflow at either width.
- **PASS — n64_buttons_focus_modal_stable:** actual settings handlers: three email open/close cycles, unchanged-current input validation, new-address input without submit, Escape, Tab wrapping from final enabled submit to dialog close, opener focus restoration, About and sound controls, scrolling, delayed synthetic account-contract read, three same-owner Auth subscriber notifications, and same-document Backup → Settings route materialization. App is inert while modal is open and usable after closing. Equivalent notifications settle; paint count remains unchanged over a subsequent 700ms idle observation. The delayed read and same-owner notifications leave the user-collapsed profile closed. Re-entry retains current email/pending status. No page or console errors. A preliminary harness assertion incorrectly expected Tab from Cancel to wrap, despite an enabled submit following it; corrected to test the actual final control. No Product modal/guard was changed for that harness correction.
- **PASS — n64_no_auth_or_sync_semantics_change:** `node tests/n64-stability-scope.mjs` verifies allowed paths, exact unchanged settings action block and email-sheet function, and untouched cloud/Auth, router, app, DOM, store, Sync, account contract, workspace routing and offline shell. Browser check compares all five rejected rows byte-for-byte, reports `rejectedCount: 5`, and verifies the legitimate visible rejected Sync alert. `node --check src/views/settings.js` passes.

Reuse unchanged Auth request/duplicate/owner/error evidence from `N64_PENDING_GUIDANCE_ONLY.md` (run `56921269-afd2-45a9-b0ec-fe056992abea`); exact action/sheet equivalence establishes the unchanged implementation. Reuse N101 context prevention/ownership proofs in `N101_CONFIRMED_CONTEXT.md` (original proof run `b5cb864d-2289-478a-a29e-c331c45e4f24`, final report SHA-256 `b4046e7ee972fe7c69a2aac8e759f13a46844f8eed435c8444216d6682da2eff`); store/Sync/context code is unchanged. No broad suite or repeated Preview.

## Isolation, cleanup and limits

Existing `bootSettings` seeds a claimed synthetic account/workspace and fulfills service requests. Test-only served exports invoke existing same-owner subscribers; the paint counter only observes the actual app. No auth/owner/Sync guard is disabled. Canonical `withIsolatedLocalBrowser` validates this active task/run, permits only `http://127.0.0.1:19764`, blocks Service Workers and external traffic, and closes its fresh owned browser/contexts in `finally`. Vite owns this unique local port and closes in outer `finally`. This approved non-shared phase needs no global browser lease; no shared resource was acquired or touched.

Unchanged fixture warnings remain: blocked Service Worker checks and automatic Sync `Incomplete cloud read: invalid page or exact count` from the generic settings stub. No Sync/cloud/offline certification is claimed. Five rejected entries and the alert remain; they were not repaired or suppressed.

This corrects the demonstrated reopen/layout jump, not every possible freeze. Cancellation/resend and the refused callback/token/session/Auth-return scope remain unimplemented; N64 remains open. No live account/email/provider operation, queue/status edit, push or deployment. Independent controller/publisher owns frontend integration and Production verification.
