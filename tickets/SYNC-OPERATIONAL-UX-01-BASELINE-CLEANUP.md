# Sync UX promotion baseline cleanup

Approved waiver: ticket 0080, scoped only to SYNC-OPERATIONAL-UX-01.
Production baseline: `cc025aea1e867f94a91ddb8dd6a392e189c84c04`.
Frozen reconciled patch: `134e16c3facc2398c863aaaa4a8f138eb46366d5c636a01514a6e0b86d46a650`.

Both items remain **PRE-EXISTING / NON-BLOCKING FOR SYNC-OPERATIONAL-UX-01**.
Neither waived test is marked PASS, fixed, skipped, or weakened by this promotion.

## PWA-RELEASE-ASSERTION-CLEANUP-01

Status: OPEN; dedicated test-contract cleanup required.

- Case: `tests/sync-v2-release.test.mjs:201`, “PWA release v10 precaches Sync V2 and the subject catalog while preserving the update lifecycle”.
- Assertion: line 205 expects `/const VERSION = 'rakeezx-v10'/`; actual worker version is `rakeezx-v15` on both trees.
- Signature: `ERR_ASSERTION`, operator `match`, identical expected expression and worker content after normalizing Git checkout line endings only.
- Observed behavior: identical newer worker/update lifecycle; `sw.js` is unchanged by the candidate.
- Fresh paired verification reproduced the same failure. Normalized failure signature SHA256: `8ad0d455bfd57cbf01f9fec37de340b359e955b2616db3559cb116a042d5d3c0`.
- Future cleanup must validate the current release lifecycle without masking genuine worker regressions.

## SYNC-MANUAL-RETRY-BASELINE-01

Status: OPEN; intermittent baseline assertion needs isolated diagnosis.

- Case: `tests/sync-v2-runtime.test.mjs:237`, “V2 coordinator performs quiet automatic sync and manual retry without V1 dispatch”.
- Assertion: line 271, `manual retry cancels the scheduled wait and retries immediately`.
- Recorded baseline and reconciled candidate failure signatures are identical: `ERR_ASSERTION`, operator `strictEqual`, actual `false`, expected `true`.
- Observed failed behavior on both trees: the immediate `syncAll({ full: false })` result is false. This waiver does not assert that failed attempts reconciled successfully.
- Fresh paired observations both return true, status `synced`, with an empty synthetic outbox. The earlier failure remains evidence of an intermittent baseline issue, not a repaired test.
- `src/lib/sync.js`, `src/lib/sync-v2.js`, `src/lib/db.js`, cloud/auth, store, models, runtime tests, and the app's manual Sync command handler are unchanged. Command remains `syncAll({ full: true })` for the real UI action.
- No changes to retry semantics, runtime eligibility, queued envelopes, mutation ordering, server execution, or history retention. Approved presentation omits retry as a remedy for rejected work; it does not alter the runtime contract.
- Future cleanup must diagnose the intermittent false return and test scheduling before selecting any fix. No retry/runtime fix is authorized by this UI ticket.

## Waiver equivalence and promotion evidence

A: identical named failing cases. B: identical assertions, error codes, operators and actual/expected values. C: identical observed failure behavior, plus identical fresh paired retry observations. D: asserted runtime/data contracts unchanged. E: no regression delta found in those contracts.

The side-by-side observer reads only synthetic IndexedDB state and leaves assertions intact. Historical raw command evidence from the prior gate supplies both retry failure signatures; no failure was manufactured to force reproduction.

Focused unchanged-candidate gates: Sync Operational UX browser 3/3, corrected legacy Sync UX 1/1, Teacher Center 3/3, Support/contextual link 4/4, operational summary/two-device 2/2, Build Meta 4/4; all PASS. Single Production build PASS; diff check PASS. Responsive 320/390/412/1280/1440, light/dark, RTL, keyboard/focus and overflow checks included.

Production print isolation, attendance ordering fixes, Student Lifecycle/reinstatement safety, Support privacy/notification runtime and Build Meta generation are preserved. No DB/schema/migration, Sync/data, or Work-Active modification.

Product status: **PRODUCTION REVIEW — TEMPORARY STABILITY OBSERVATION; NOT CLOSED**.
