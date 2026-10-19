# N36 — saved roster visibility / compact helper

**Current result: LOCAL_READY for the scope-corrected visible-roster publication.** Run `95f25fda-ca21-4909-90bf-d60a74e2732c` continues the original AI candidate `11a3bc87281ac138b2865706e809c986c9b5a860`. The activated card now permits both exact view paths and explicitly keeps the rejected automatic no-tab operation inactive. Current evidence is below; the original failures and narrower NOT_RUN remain preserved.

Task: `continuous-n36-saved-roster-visible-clean-helper-20261019`
Run: `efd53688-e0dd-4cd4-9621-d2f0570487c7`
Base / observed origin/main: `0b4e841ca9447373add29c0a62876494a81ecdb8`

**Original result: BLOCKED because that activated card omitted the actual destination view and receiver/download view.** No queue, ledger, live account, service, schema, Production or updater mutations were performed in that attempt.

## New failure reproduced in the real application

Read the canonical 19 October N36 row, especially PO-20261019-1719. The new 303-name / 10-class result is local saved evidence, not SOURCE_CHANGED and not extraction failure. The 146 queued commands cannot be equated with 303 names or server ACKs. No real names, school tabs or owner account were inspected.

`tests/n36-actual-1719/journey.mjs` reuses the existing account/service/receiver helpers and installed-extension synthetic harness. Only the completed source snapshot is fabricated: two names in خامس 1. The actual MV3 transport, encrypted worker claim, receiver DOM/handlers, actual ownership/lease guard, store transactions, IndexedDB, source CSS and actual `#/classes` route execute. It uses an owned loopback HTTP server with synthetic HTTPS interception, a fresh disposable browser/profile, and the shared browser lease. No file navigation. Every non-fixture request is aborted; the recorded Supabase auth URL was an aborted synthetic boot attempt, not a service read. Cleanup and lease release are recorded in `journey.json`.

Observed gates (original evidence is retained):

- PASS: local receipt 2 new + 0 existing; one section, two students, two enrollments, five pending owner-bound commands, zero server ACKs.
- FAIL: immediately opening the actual classes route renders **zero class cards**.
- PASS: after actual document reload, re-establish owner/database/provisioning receipt/lease and read the data in that same new document. The same identities and five pending commands survive.
- FAIL: classes still render **zero class cards** after reload.
- PASS: retry preserves all section/student/enrollment IDs and outbox rows without duplicates.
- PASS: actual receiver entry rejects a different session owner, leaving the complete DB unchanged.

Root cause: `saveAutomaticNames` in `src/views/class-import-center.js` deliberately creates a section and enrollments without a teaching when the names-only source has no subject. `src/views/teachings.js` implements `#/classes` and renders only `store.teachings()`; its student links/cards also require a teaching identity. `store.sections()` and `sectionRoster()` can see the saved rows, but the list never projects these section-only rosters. This explains the observed failure without discarding saved records, inventing a subject or mistaking a local receipt for remote acknowledgement. The exact real account state has not been inspected, so no claim is made about any additional account-specific factor.

## Bounded changes prepared

- One purpose line and short primary Start; secondary cancel.
- Diagnostics, manual JSON/CSV/category tools and Noor remain contextual/collapsed. Existing element IDs/handlers and capabilities are preserved.
- Manual tools explain that the automatic adapter imports names/classes only, not teacher/principal/region/timetable fields.
- Zero excluded rows plus an unproven terminal/optional missing link no longer produce the misleading “تعذّر جمع … استُبعد 0” warning. Coverage uncertainty remains in the existing coverage/status copy. Actual excluded counts and other unresolved-page warnings remain visible.
- Immutable local package `0.5.15` prepared. ZIP SHA-256: `c65a7c92deb60c7b01113733f3045ccc83d8dd46e1420961eb39abe6ea4de817`. All 25 ZIP entries match the manifest and source bytes; prior 0.5.14 assets are unchanged. Extraction/pager/protocol/worker bytes are unchanged, so their previous proofs are reused.

Rendered run-page inspection is in `compact-runner.png`; actual application failure is in `saved-but-hidden.png`. The UI journey ran before the metadata-only version bump. The subsequent rollback of speculative preflight code restored the original transport worker and Start preflight; package assertions prove those original bytes. This does not change the tested destination, receipt or compact-copy behavior. No repeated extraction/pager/full-app/build suite was run.

Checks: `node tests/n36-actual-1719/package.mjs --prepare`, `node tests/n36-actual-1719/copy-check.mjs`, scoped JS syntax, and `git diff --check` PASS. The first package reuse assertion exposed CRLF-only bytes in the restored worker; restoring its exact original LF bytes fixed the harness comparison. The first journey harness attempt's speculative readiness guard returned APP_NOT_READY; that guard was removed, and the recorded successful reproduction used the original receiver route loading. `harness-initial-not-ready.json` preserves that failure.

## Exact retry conditions / missing scope

The approved inactive-card maintenance helper must add:

1. `src/views/teachings.js` — the actual class list; the supplied allowed `src/views/classes.js` does not exist. Expose current-owner/year section-only rosters and their real students using their existing identities, with guarded selection of a subject if needed. Do not synthesize teachings/subjects, relax ownership or change durable ACK semantics.
2. `src/views/class-import-center.js` — actual automatic receiver, retained batch receipt/mapping UI, and sole website download link currently targeting 0.5.14. Needed to connect the destination and advance the official link to the prepared version.

Preserve this exact candidate/session/base and existing PASS/FAIL evidence; only the controller may resume after a material scope correction. No unchanged retry. Do not publish the partial package while roster visibility and the website link remain unresolved. The current minute updater remains untouched at 0.5.14; advancing to the new package requires the independent publisher's verified release.

The no-Rakeez-tab open/wait/resume feature is **NOT implemented or certified** in this candidate. A command to add/run that installed synthetic preflight scenario was rejected before execution with `rejected: blocked by policy` (`CreateProcess`, `exec_command`). No reason beyond that policy message was supplied. It was not retried through another tool/surface. Speculative opening/waiting implementation was reverted to the original fail-closed Start preflight; no unverified capability is packaged. This exact rejected test operation remains unavailable; a later run must not recreate it to bypass the refusal. A materially safer permitted scenario or explicit authorized resolution of the policy boundary is required for that separate gate.

Required combined gate `n36_local_saved_visible_same_owner_year_and_compact_ready_preflight`: **FAIL** (visibility reproduced; no-tab preflight NOT_RUN). Product acceptance, provider checks, website delivery, stable-folder advancement and Production are NOT_RUN.

## Scope-corrected continuation — 19 October

The current canonical Product note also confirms the lists remain empty **after** actual Sync completes. This is not explained by waiting for ACK. The latest observed `origin/main` was `d6f58fae91e084b9d82ed769fd946474ff713ee6`; its affected Product source is unchanged from the supplied base (intervening work is N120 and the exact card correction). No rebase, integration or unrelated source edits were performed.

Implemented in the now-authorized paths:

- `src/views/teachings.js` includes current-year sections without an assignment in the current term. Their cards open the actual saved pupil roster directly, using existing CSS and identities. Academic ordering and unique pupil counts include these cards. No automatic subject, teaching, student, enrollment or Sync mutation is needed to make them visible.
- `store.readCurrentSectionRoster` applies the existing account/workspace/database/provisioning/lease guard and rejects foreign section/student/enrollment rows, other years, archived/deleted sections. Deleted pupils are not projected. Local ownerless rows retain the receipt-bound workspace provenance already used by the existing import.
- The explicit “إضافة مادة لهذا الفصل” continuation reuses the existing subject sheet; section grade/label stay fixed. A selected existing subject creates its teaching on the same section. The new entry carries its owner/year/term/section checks through the existing durable transaction, while the generic handler retains its previous behavior when no additional guard is supplied.
- Website download now points to `0.5.15`. A normal first-party link in the extension offers manual opening/sign-in. The original fail-closed no-tab preflight is unchanged; no automatic opening/resume implementation, execution or certification is claimed.

`tests/n36-actual-1719/visible-journey.json` is the new actual installed-extension/receiver/list/roster evidence. It preserves the same bounded two-name / one-class completed-source fixture and performs no source extraction/pager replay. It records PASS for immediate visibility, visible same-owner/year post-reload roster, unchanged pending commands while remote ACK is delayed, retry identity preservation, explicit subject-sheet open/cancel without writes, deliberate subject continuation to the normal roster without student/enrollment/grade changes, and owner/year/archive/tombstone/lease negatives. Actual source CSS screenshots: `saved-visible.png` and `saved-visible-reload.png` (visually inspected). The fresh-document checkpoint re-establishes owner/database/receipt/lease before reading post-reload records. All owned browser/profile/server resources and the shared browser phase lease are released.

Original `journey.json` FAIL gates and `saved-but-hidden.png` are retained. The new harness's first immediate DOM assertion raced the asynchronous repaint after restore; a bounded wait for the actual card fixed that assertion. Its next cancel selector matched both close controls; selecting the exact visible Cancel button fixed that harness ambiguity. Both original failures remain in `visible-journey-initial-render-wait.json` and `visible-journey-cancel-selector.json`. No Product guard was relaxed to pass either check.

Final unpublished 0.5.15 package SHA-256: `560423af3ea6ad75b56d427b7d5858b6c09570f84077d7dccba65e30139f1b31` (110405 bytes). `package.json` verifies all 25 entries, unchanged extraction/pager/transport bytes, immutable 0.5.14 assets, source syntax, manual official link and current website download consistency. The earlier preparation package receipt is preserved in `package-pre-scope-repair.json`; final package source text uses Git's LF bytes. Earlier compact-render/copy evidence is reused, rather than replaying it. No new startup module dependency or offline-shell change was introduced.

The required check label `n36_local_saved_visible_same_owner_year_and_compact_ready_preflight` is satisfied **within the corrected card's narrower publication scope**: actual visible roster + reload + retry + existing ready receiver ownership/lease preflight, with compact-copy evidence reused. The explicitly excluded automatic no-tab scenario remains **NOT_RUN**, including its original `rejected: blocked by policy` denial; it has not been retried or rephrased. Manual first-party link opening/sign-in is left for user review.

No Product closure or actual personal-account acceptance is claimed. Provider/Production delivery and stable-folder advancement remain NOT_RUN for this worker; the independent controller/publisher and existing minute updater own those phases. No queue/status/ledger, service, real-record, global configuration or other-owner resource mutations were made.
