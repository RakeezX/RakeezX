# N107: width-two independent new-student creation

Task `continuous-n107-width-two-after-owned-context-20261020`  
Run `44d64481-ed7b-49ab-a4a0-d598f5e2cee4`  
Base `8bf1fee99a177435eda66f3de2da95d2935aad48`.

**LOCAL_READY.** Runtime Sync may overlap exactly two independent, never-sent new-student CREATE RPCs. It joins both durable outcomes before moving to another pair or command. The same-delay local actual-app trace reduced the student-request phase from **1674.20ms to930.69ms** (about44%). This is a synthetic phase result, not a hosted or whole-import speed measurement. **18 seconds remains the last actual hosted measurement.** The initial total-time observer failed; its original FAIL is retained and the candidate-only repair below now supplies a valid local duration without replaying the A/B pair.

## Harness correction after candidate validation rejection

Current run `6f3ddb17-a21f-4caf-ae90-1a5884f868f5`; original candidate `c223154cd83394c16a10cd160432eb765b7191a9` preserved. The prior result was rejected because it included the failed optional total-time check. This is a concrete harness correction, not deletion or reclassification of that failure.

Inspection found the new success observer matched encoding-corrupted Arabic prose. The actual application already exposes `[data-import-success]`; the repaired observer now uses that ASCII DOM marker and requires a finite positive click-to-success interval. No Product source changed in this repair.

`node tests/n107-independent-create-20261020/app-timing.mjs --candidate-only` **PASS**, zero current failures: one candidate-only actual-app synthetic run captured **3257ms** from actual click to rendered success, max2,28 names/31 durable grades, one grade receipt and preserved enrollment/max/grade ACK ordering. This is a local fixture duration, **not** a hosted result or a new whole-flow comparison. The original single A/B pair was not repeated. Existing independent-create and unchanged context safety evidence is reused.

Original `app-timing.json` remains byte-for-byte unchanged, including its FAIL and missing totals. Original `qualification.json` is preserved as `qualification-initial.json`. Current `qualification.json` records the new run and the genuinely passing repaired check; no historical failure is represented as a passing execution. The canonical isolated helper and owned loopback server closed in finally. Syntax and whitespace checks PASS; no deployment, queue/status or live-data changes.

The following section preserves the original implementation record, including its then-unresolved timer failure. That specific harness limitation is superseded by the candidate-only repair above; the missing **baseline** whole-flow duration remains unmeasured, and hosted18s remains unchanged.

## Authority and prerequisite reuse

Read canonical operating contract, active card/current N107 row and affected source; applied rakeez-ticket-router/evidence-manifest. Base includes the delivered N107 owned-context prerequisite (candidate8f01b296, publication8ead5110) and subsequent N125 revision-validation dependency. No earlier source was copied over them. `cloud.js` and existing owner/session/database/lease fencing are unchanged. Reuse the saved actual caller/default-RPC/owned-IDB context and same-owner refresh proofs from `N107_OWNED_CONTEXT_QUALIFICATION.md`; do not repeat the old two-layer NO_CHANGE diagnostic. Earlier diagnostic candidates002715/61cdec and their original NOT_RUN speed gates remain historical, untouched. No provider read, SQL/Auth/service/schema operation or real data was used.

## Bounded implementation

Only `src/lib/sync-v2.js` and one runtime opt-in in `src/lib/sync.js` change. Other engine users retain the serial default.

The scheduler considers only two adjacent snapshot entries, with the same owner, different IDs and available mutation budget. Eligibility requires protocolV2, store/entity students, CREATE, pending, base revision0, no prior attempt or envelope lock, matching record/server/canonical IDs, no bootstrap/repair ownership and no competing same-student identity/alias command. Student-to-student or request-ID dependencies exclude pairing. Each sibling re-reads live outbox state, checks ownership and the existing authoritative-parent dependency function, and verifies that its local student is still nondeleted and unacknowledged. The atomic markAttempt transaction rechecks eligibility against current Outbox before locking.

Each sibling uses the **existing** markAttempt, immutable owned-context fence, default generic RPC, reconcileReceipt atomic prepare and failure/rejection persistence. A paired receipt must identify that exact student and owner; unexpected canonical remapping remains an uncertain retained request, never a sibling adoption. Promise.allSettled is used for exactly this pair, not the Outbox. Both outcomes settle before subsequent work; no unbounded worker pool, new RPC, transport policy, timers, retries or UI actions were added. Additional active scheduling memory holds only this pair; the existing Outbox snapshot is unchanged.

Existing-student PATCH, unknown/failed/previously sent requests, same-ID chains, enrollment/roll-number, class/subject/teaching, max/score/grade, profile/calendar/delete/Restore and all other commands remain serial. An unknown request retains its original durable identity for the existing serial recovery path. Context retirement stops new pair starts and prevents receipt adoption; successful siblings are individually durable and recoverable. No pre/post-pull, authoritative max ACK or genuine grade receipt requirement was removed. N36/N117 and accepted contracts remain intact.

## Targeted boundary proof

`node tests/n107-independent-create-20261020/boundary.mjs <scenario>` uses the existing synthetic account setup, actual `store.importStudents`, runtime coordinator, actual default cloud request wrapper and Product DB adapter backed by isolated fake IndexedDB. Every fetch is intercepted. Scenarios are fresh processes, with owned timers drained/DB/channel closed and globals restored in finally:

- **order PASS:** second student response completes before the first; max2; third begins after both finish. Every nonstudent mutation asserts zero student requests in flight.
- **lost PASS:** first sibling commits but loses its response; its same locked request remains while successful sibling is removed. Explicit next pass sends the identical mutation ID/body and adopts the cached receipt. Exactly three created student identities; no duplicate.
- **same-id PASS:** a durable patch successor sharing one student's identity excludes that create from overlap. The competing create and patch each run serially; only two other distinct creates may overlap.
- **owner/lease PASS:** retire the actual owner or runtime lease while both requests are held. Both original envelopes remain, and third student's attempt count stays0. No later student start or receipt adoption occurs through the changed boundary. Broader refresh/foreign-DB proof is reused from the unchanged context guard.

The first lease fixture assertion used IndexedDB key ordering to identify the third queued request; it was corrected to actual mutation sequence order. Its original assertion FAIL remains in `development-failures.json`, not converted into an application PASS. The lost-response Sync error is expected and its recovery is asserted.

## One actual-app controlled A/B pair

`app-timing.mjs` reuses the saved N10728-name/31-grade single-confirm application fixture and canonical `withIsolatedLocalBrowser`. Fresh contexts load actual app DOM, handlers and source CSS over owned `http://127.0.0.1:49761`, with no credentials/profile/Service Workers/external requests. Server and browser resources close in finally; no shared live-browser lease is used for this eligible synthetic loopback phase.

Both variants use the same current application/engine and **35ms fixed delay per service request**. Before serves the actual `sync.js` with only its new runtime flag setfalse; after serves it unchanged with flagtrue. This isolates scheduling rather than undoing the published context/N125 fixes. No lookalike page, file navigation, hosted fixture or old whole-import suite was used.

Both reached actual one-click success and passed the existing durable result assertions: one teaching, five items,28 unique enrollments,31 unique grades, imported zero/blank semantics, preserved untouched19/0, one grade command and genuine receipt, continuation cleared. The service asserts no student overlap with dependent commands. Saved traces show:

| Same dependency | Before | After |
| --- | ---: | ---: |
| Student requests |28|28|
| Enrollment requests |28|28|
| Max in-flight student RPCs |1|2|
| Student RPC phase |1674.20ms|930.69ms|
| Grade receipts |1|1|

Both traces retain all student ACKs before enrollment requests, all enrollment ACKs before maximum request, and maximum ACK before grade request. Success is asserted only through the actual app/store31-score receipt checks.

**Original harness status remains FAIL** for its final optional whole-flow timing comparison: the new click/success observer returned no usable total, so totalMs isnull in both records. We did not replay the browser pair to restate the same phase proof, and do not claim an end-to-end time. `app-timing.json` preserves that exact failure and raw successful phase traces. The harness now omits the unsupported total assertion for future legitimate runs; it was not rerun. `trace-proof.mjs` independently validates the already-saved35ms request counts, peak widths, student-phase reduction and ACK ordering; `trace-proof.json` records the narrower **PASS**. It does not erase the original FAIL or relabel unavailable timing as success.

The later student-receipt identity check and bounded index bookkeeping preserve this recorded valid-receipt scheduling path; final targeted store tests exercise them. No second browser pair was spent.

## Result and delivery boundary

Required `n107_independent_new_student_width_two_proven_safe` **PASS** through the targeted changed-boundary scenarios. Required `n107_same_dependency_wait_benefit_and_ack_order` **PASS** for the same-delay **student phase**, supported by preserved real application trace and separate read-only validator. Optional whole-import timing capture **FAIL / unmeasured**, retained explicitly. Syntax and whitespace checks PASS. `qualification.json` binds task/run/base, checks and final source/harness hashes.

No new startup import/module, build/PWA/browser matrix, full parser/Sync/Auth/scoring/SQL suite, provider polling, push, deploy or queue/status change. The sole publisher owns integration and served-source verification. N107 remains open for actual acceptance; neither hosted18s improvement nor N125 incident attribution/closure is inferred from this result.
