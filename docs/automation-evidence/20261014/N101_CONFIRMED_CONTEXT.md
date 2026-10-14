# N101 confirmed-context prevention — local candidate evidence

Task: continuous-n101-confirmed-context-prevention-20261014
Run: b5cb864d-2289-478a-a29e-c331c45e4f24
Base: ae581ea2b48ec45beb73c7249ab941edbcbf14ab
Observed origin/main: 1fc460c33699199c3defeb1e8eec205e85dd9fc5; its only movement since this base is an unrelated ops card. No Product source drift or whole-file N58 promotion.

The confirmed diagnostic is prevented for **new** sessions. Existing five rejected intents and the historic six remain untouched. Their recovery is **STILL_PENDING**. N101 and the N58 umbrella remain open; no live account, provider SQL/Auth/RLS, service operation, migration, publication or Production acceptance occurred.

## Bounded implementation

Only store.js and sync-v2.js change Product code. New session saves prepare detached creation-time year/term/preset/kind/source/label. The same selected day is used by session eligibility and materialization, ignoring an inactive preset's custom exception; the existing general Calendar read interface stays intact. Unknown selection or missing parents aborts preparation before memory/outbox writes. Same-batch valid parents work. Truly unselected legacy years retain their native contextless exception; explicit historical generation remains available. Automatic generation stays today-only and future dates stay projections.

Creates wait for owner-bound year and term authority and a completed calendar-selection acknowledgement. Only its canonical field revision is inserted when the envelope is locked for first dispatch. Rejected envelopes are never relabeled, remapped, rebased or resent by this change. Locked retries retain their exact revision and recover the existing native receipt after a preset switch. Ordinary edits to already-created sessions do not depend on the current preset; recorded provenance remains immutable.

The narrow mechanism was compared with 4fa6fb8b98415a42dd0a835bfdd7038ab65b8979. No new startup dependency: existing sw.js already caches store.js, sync-v2.js and calendar-presets.js. Cloud, initial restore, workspace routing/provisioning, grade-transfer, score-copy and sw.js remain byte-equivalent to base after newline normalization (preserves N98/N100/N90/N101 boot paths).

## Actual affected proof

| Check | Result | Evidence |
| --- | --- | --- |
| n101_context_required_reproduced | PASS | Immutable base app served through Vite over loopback HTTP; actual schedule form → addSlot/ensureSessionsForDate → owner-bound outbox/JSON → native PostgreSQL: exact 22023/N58_SESSION_CONTEXT_REQUIRED. Independent query finds zero session and zero receipt for that rejected synthetic ID. |
| n101_context_revision_wire_and_ack | PASS | Five actual schedule forms create today periods 1–5 with G/remote/custom/creation label. Every child initially sends zero requests while selection is pending. Actual year receipt revision **3**, not a counter, appears on each serialized envelope and native applied receipt. Separate term-revision delay, direct ensureSession and an explicit historical range create also acknowledge. |
| n101_history_owner_rejected_entries_unchanged | PASS | Two fresh isolated contexts; delayed CORE_V2 restore, same-document owner/DB/receipt checkpoints and reload. Native immutable-context denial and B RLS/not_found denial; client wrong-owner dispatch sends zero requests. Tombstone, cancel, repeat/no-duplicate, weekday/future projection and future-clipped range checks. Unknown/missing selection fails before queue. Lost native response returns synthetic 503 after commit, then byte-identical mutation/envelope/receipt recovery after G→W. Existing-session edit after switch acknowledges without changing context. All 11 synthetic rejected rows remain identical. Actual DOM/CSS RTL at 390/1280px, no overflow or page errors. |

Native PostgreSQL 17.6 loads the three immutable N58 SQL sources only into its owned disposable local cluster, alongside current local schema prerequisites. No SQL file or hosted service is changed. N58 guard readback body MD5: 6fc9fcdf35f78d0ae295fe61a833f70d. N58 primary source SHA-256: e330bbb554d86bdce73f5e702daa8f45624b1ee19de45ed74403db062855fe06.

Final native report: test-results/n101-context-fixed-1791949729153.json
SHA-256: b4046e7ee972fe7c69a2aac8e759f13a46844f8eed435c8444216d6682da2eff
Reused base failure proof: test-results/n101-context-baseline.json
SHA-256: 6581de6fe626f9901d8ba4e28fe9eede1917e445dec1d727e14d6f35136f83e7. Baseline serving uses immutable Git BASE source via the Vite loader; its report's filesystem hashes describe the harness worktree, not the served BASE override.

Normalized final Product source hashes: store.js e7e3e9be79498c584c808f758f0df7d3932d18ecd6e02d34f9de92083f183f55; sync-v2.js 758b39e119b9b3541ce8bfaf58559fc158ca8c896fd4dea7ced1dce8be3eb7d3.

Focused node checks: **27/27 PASS** (n101-context-local.test, calendar-preset, session-auto, session-auto-lifecycle, sessions-generator). Earlier affected session/Sync client run: **56/56 PASS**, reused for unchanged generic Sync cases. Syntax for all four changed JS test/Product files, git diff --check, existing shell coverage and unchanged boot-source assertions PASS. No full Vite build or new global suite.

## Preserved failures and limitations

An earlier broad calendar-reader change failed existing null/default and unscoped-custom display expectations; it was narrowed back to session creation/eligibility. Initial direct-date restriction broke permitted legacy historical creation and was corrected. The original calendar-view preview fixture still tries to queue a session whose term does not exist; its old assertion fails under the required fail-closed rule. The same preview is certified in n101-context-local.test.mjs with valid foreign year/term parents, and a separate negative test proves the complete invalid batch leaves memory and durable stores unchanged. The old fixture was not changed or mislabeled PASS.

The initial expanded sync-v2-runtime run did not complete: its existing synthetic environment lacked localStorage and left automatic retry timers running. Only the two identified owned node processes were stopped; that expanded run is not counted as PASS. Native authenticated UI/ownership evidence and the focused completed runs above provide this card's affected gates. Earlier native harness failures (private absorb API, BASE route precedence, numeric versus IndexedDB lexical ordering, and checking a slot before its session transaction completed) were corrected; the four-session timing failure is retained in test-results/n101-context-fixed-1791948913917.json. Subsequent reports use distinct filenames.

The canonical isolated browser helper validated this running local task and bounded its fresh contexts. Unique owned loopback Vite/PG servers stopped, both contexts closed, disposable cluster removed in finally. No shared live-browser phase, external requests, real accounts/data, queue/status writes, unknown-process cleanup, push or deploy. Service Worker execution was deliberately blocked; its existing registration warnings do not constitute offline-cache certification.
