# N107 maximum ACK continuation recovery — AI-authored

## Follow-up: one confirmation through delayed ACKs — 19 October

Task `continuous-n107-single-confirm-auto-completion-20261019`, run `65c7275e-bcd9-4398-b849-c321f804364b`, base `20b94d3b6afef72b9c6b75f769c5989f2b86add4`.

The latest PO result confirms **28 names and 31 grades saved successfully after manual continuation**. The earlier maximum/receipt repair below is retained, not repeated or described as still broken. This follow-up removes the normal second click: the previous creation wait expired after six seconds even while the owned Sync pass was progressing.

The existing foreground continuation now requests one normal coordinator pass and subscribes to store, Sync and account events. It advances only when the existing canonical-parent/default/name and reviewed-grade guards succeed, then uses the existing maximum ACK and durable grade receipt paths. A single 90-second deadline (capped by review expiry) bounds pending creation; there is no sleep, polling loop, timer-dispatched grade or manufactured ACK. Offline stops waiting with a same-request recovery message. Normal pending ACK retains the busy state without a manual continuation button. Compact phase status now precedes the preview. Subscriptions/deadline/offline listener are removed on completion, cancellation, context change or timeout.

No operation identity, saved continuation format, reload consent, cancellation disposition, owner/term/review guard or grade engine was changed. Reload keeps the saved identity and existing explicit resume boundary; max/grade transport uncertainty still uses its original request recovery controls. No new startup resource: both the view and `src/lib/sync.js` already belong to `sw.js`'s shell.

Affected verification: `node tests/n107-1019-single-confirm.mjs` **2/2 PASS**, current failures **0**, using the canonical isolated helper and actual app DOM/handlers/source CSS at owned `http://127.0.0.1:49749` in fresh synthetic account contexts:

- `n107_one_confirmation_delayed_ack_final_receipt_no_duplicate`: one UI confirmation, creation ACK held beyond the former six-second cutoff, separately held real maximum and grade transports, same teaching identity, exactly28 names/31 grades, five defaults/one class/one grade command and durable receipt. Zero/blank semantics and untouched19/0 retained. Reload reads owner/database/provisioning receipt and durable grades in the same document.
- `offline_cancel_during_creation_wait`: actual offline event exposes manual recovery while preserving identity; explicit cancellation removes the continuation. Later genuine creation ACK cannot resurrect continuation or send maximum/grades; saved owned names/class remain.
- `tests/n107-1019-single-confirm.json` binds source/CSS/harness hashes and preserves the initial harness race failure (send lock observed before HTTP handler arrival). The corrected harness waits for service-arrival events; this is not an application failure relabelled as PASS.
- Actual390px screenshots `tests/fixtures/n107-1019/single-confirm-pending.png` and `single-confirm-complete.png` inspected: real phase above preview, and final28/31 receipt. Syntax checks for view/harness and `git diff --check` PASS. Existing unchanged owner/max/cancel/reload safeguards retain the prior evidence below; no broad suite or repeated hosted Preview.

Observed/fetched origin/main `c6c8a4285e341a2d7cd784d0e5311ac58cb63a0a` had no changes from this base in the affected application files. Canonical helper closes owned contexts/browser in finally; harness closes its owned server/connections and releases held fixture responses in finally. This isolated phase needs no shared live-browser lease. No real account/student mutation, service administration, queue/ledger edits, push or deploy. Independent publisher integration/Production verification and PO acceptance remain unrun here.

The following is preserved evidence for the preceding maximum ACK repair.

Task: `continuous-n107-max-ack-continuation-recovery-20261019`  
Run: `fbb7555d-ba95-4224-80ab-8272f89e693b`  
Candidate base: `80d7a264596cb38c1856796c0c30c23dbbb6b49f`

The PO19October report supersedes the previous synthetic passing result. No private CSV, real account, school service, SQL, Auth/RLS, schema, messages or hosted fixture was used. The reproduction uses three fabricated pupils, two default grade columns, homework10→20, zero/blank cells and untouched existing marks19/0. Tests exercise the actual application DOM, handlers, CSS, account store, provisioning provenance, offline lease, owner guard, outbox and normal mocked mutation/grade receipts over task-owned loopback HTTP.

## Reproduced causes and correction

The atomic score-domain snapshot overwrote the reviewed optimistic maximum with canonical10 while the original max20 command remained in Outbox. A normal full Sync after an unavailable maximum transport reproduced this disposition: item.max10, saved stage.max20, original locked mutation, unchanged teaching/term/revision. Resume/cancel then hit `Import maximum reviewed context changed`. The prior immediate-success/lost-after-commit fixture did not expose the unavailable-before-commit plus canonical snapshot sequence.

The snapshot now keeps the exact active import-maximum overlay, while retaining the actual canonical preimage/revision separately. Other canonical business fields remain visible to the preservation/CAS guards. Snapshot readback never manufactures ACK. Already-persisted erased overlays recover in the existing `confirmImportMaximums` transaction only when the owned original envelope, original revision, non-max fields, all preserved scores and absence of competing item commands still match. The original mutation is reused; genuine max ACK still precedes fresh grade review and durable grade receipt. Arbitrary drift remains blocked.

A second reproduced inconsistency was a fresh device's missing year/term selection: app selectors accepted their existing fallback but the send guard compared raw null IDs. The transaction now uses the same fallback rules; a valid explicit different year/term continues to block. Failed maximum preconditions become a truthful blocked request, rather than throwing through unrelated Sync. Pending/error counts remain visible; foreground maximum requests no longer keep the background scheduler requesting unsendable work.

## Explicit cancellation and recovery

The normal store cancellation path is owner/database/session/lease bound and atomic against the saved continuation. It retires only that continuation's unsent or terminal-rejected maximum requests as `superseded`, preserving identity, original envelope, rejection and disposition audit. It restores only its unchanged unaccepted max overlay, preserving unrelated fields and every score. Accepted maxima remain accepted. An uncertain sent request gets one bounded same-envelope receipt recovery per explicit cancel action. If unavailable, the checkpoint remains, no grades dispatch, and the UI tells the teacher to resume or retry cancellation when Sync is available. No background retry is introduced.

The send-lock transaction cannot resurrect a request whose cancellation won the race. A pending/rejected grade batch keeps its continuation and its existing receipt-retry/rejected-disposition controls; cancellation cannot silently hide it. Grade receipt recovery after reload now reports the actual saved grade count from the same acknowledged batch. No mass Outbox deletion, global reset, forged receipt, timeout extension or migration is used.

## Custom subject

The existing new-class file flow offers `أخرى` and a bounded subject-name field. The same class/subject resolver creates or reuses its canonical subject, with the same single preview and consent. Preview subject naming follows the resolver's built-in aliases, persisted names and whitespace normalization, so canonical creation does not invalidate the approved continuation. No second importer or competing defaults are added.

## Affected verification

- `node --test tests/n107-1019-state.mjs`: **4/4 PASS** — persisted legacy erased-overlay recovery with genuine same-ID ACK and unchanged marks; cancellation of both intact/erased unsent overlays; item/owner drift refusal; cancellation winning the send-lock race without any transport or request resurrection.
- `node tests/n107-1019-browser.mjs`: **9/9 PASS**, current failures **0** — fallback selection; custom subject; built-in alias; lost max ACK/reload and identical replay; accepted max plus lost grade receipt/reload; terminal rejected max cancellation; unavailable max/cancel/recovery; valid different term/foreign owner; item business drift during async grade preflight. Both max and grade receipts use the actual durable owned commands. Reload checkpoints verify owner/database/provisioning receipt in the same document as their data reads. A bounded idle observation also confirms no repeated snapshot/transport loop for the retained foreground request.
- `tests/n107-1019-browser.json` binds actual source, CSS and harness SHA256s and retains development failures separately. Earlier failures include the old selector in the harness, an assertion before asynchronous preview rendering, the missing recovered grade-count UI, rejected-overlay cancellation, and the reproduced snapshot erasure. They are not relabelled as successful attempts.
- `tests/fixtures/n107-1019/custom-subject-preview.png`: actual390px source-CSS preview inspected; one compact preview with fabricated custom subject, exact maximum impact and zero/blank values.
- Syntax checks for the four changed application modules and two scoped test modules, and `git diff --check`: PASS.
- Existing unchanged name matching, ambiguity/read-only/auto/lower-max/absent-pupil protections retain the evidence in `../20261018/N107_NAME_MATCH_FILE_MAXIMUM.md`; the old broad28-case, N36 and SQL suites were not rerun.

`subject-catalog.js`, `class-import-center.js`, `store.js` and `sync-v2.js` are already in `sw.js`'s application shell. No new startup resource or Service Worker edit is needed; no offline certification is claimed.

Read-only `git ls-remote`/fetch observed main `1372ceddb8cd85b1554bb7f95f3b2c0ad49cf772` during completion. Its diff from the supplied base contains no changes to the affected application files. The candidate retains its supplied base; integration belongs to the independent publisher.

The canonical isolated-local-browser helper validated this active synthetic task/run and used fresh owned contexts, loopback-only requests, blocked external requests and Service Workers. It closes its owned browser/contexts in finally; the unique127.0.0.1:49739 server closes its owned connections/server in finally. This approved isolated phase does not reserve the shared live-browser lease. No user browser/profile, queue/status/ledger, controller lock, maintenance lock, global configuration, push or deployment was touched. This is local readiness, not Production evidence or PO acceptance.
