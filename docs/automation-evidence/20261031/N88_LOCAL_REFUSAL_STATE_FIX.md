# N88 local refusal state correction

AI-authored candidate for task `continuous-n88-local-refusal-state-20261031`, run
`95eba80d-6966-4087-b2ef-70a66567f32f`.
Base: `bea7b8b9b9766bd3ee45e5ad75d465b191b737bf`.
Authority: activated card and canonical N88 ledger note
`PO-20261031-FUNCTIONAL-CORRECTION` (source hash
`4cf6cde916b79579d8e693bb670cf4d81c9e0be8b3c8f217aa066ba7e5c8cc16`).
Card explicitly uses gpt-6.1-sol / medium; ordinary Standard runner, Fast disabled.

## Reproduction and correction

Before editing either production module, ran:

```text
node tests/n88-local-refusal-state-20261031.test.mjs --reproduce
REPRO PASS: real local snapshot refusal, zero mutations, clean refresh [], issuance remains incorrectly blocked
```

The actual mounted class view first reads a synthetic roster. A subsequent failed
read through the real client invalidates its snapshot while the mounted view
retains its last confirmed list. Clicking issuance then throws synchronously
before `call()`. There are zero mutation requests and no stored hint. A clean list
with empty reconciliation still leaves issuance disabled in the original view.
This proves this specific frontend defect, not the cause of historical server or
code-count incidents. The first harness attempt waited on the button inside closed
details; opening the actual management summary corrected that test setup before
the successful baseline reproduction. No application guard was relaxed.

The client now mints sanitized errors in synchronous mutation preparation only,
and privately records their identity in a WeakMap. Its exported classifier returns
only null or frozen `{state:'not_started',reason}` with finite reasons `busy`,
`review_required`, `stale_context`, `unavailable`. It trusts no transport error
properties. Issuance, selective rotate/revoke, visibility and shared reservation
preparation preserve their synchronous method contracts. The boundary ends before
`call()`; even its deferred context refusal remains unclassified.

The mounted `perform()` clears displayed secrets and requires an explicit fresh
review after a trusted refusal, with “لم تبدأ العملية. راجع الحالة الحالية قبل
المحاولة.” It leaves any earlier uncertainty unchanged. Unclassified failures
still set uncertainty. No hint/journal cleanup, reservation replacement, automatic
command replay or list-as-ACK behavior was added. Guidance and terminal resolution
behavior remain unchanged.

## Affected verification

`node tests/n88-local-refusal-state-20261031.test.mjs` exited 0, reporting:

- **PASS n88_local_refusal_does_not_create_unknown**: actual mounted DOM/handlers
  and source CSS over loopback HTTP; real snapshot refusal, zero writes, clean
  empty reconciliation and restored issuance after explicit refresh. Also tests
  malformed issuance/selective/visibility inputs, unavailable context and a busy
  client during an in-flight command; errors keep finite public codes/messages.
- **PASS n88_prior_unknown_and_storage_journal_preserved**: seeded valid prior
  UNKNOWN hint and terminal journal survive byte-for-byte, including a refusal
  through the mounted visibility form; no new mutation. Failed storage writes,
  readback mismatch and context drift after reserve prevent request. Whatever
  reservation bytes were written remain intact and continue to block issuance.
- **PASS n88_dispatched_and_forged_errors_remain_unknown**: timeout, thrown
  transport error, non-OK and malformed ACK each make one mutation request, retain
  the hint/unknown through refresh and prohibit replacement issuance. Forged
  `not_started` properties remain untrusted. A later genuine local refusal cannot
  settle earlier mounted uncertainty, even with empty reconciliation. Context
  drift after entering `call()` stays unclassified and retains the hint even when
  its deferred fence prevents request. Arbitrary lookalike errors classify null.

No page errors. Computed source CSS confirms the actual 44px issuance control.
The final coverage run passed all three checks; the subsequent production-source
change was indentation only. `node --check` passed for both affected modules and
the new test; `git diff --check` passed. No full build or broad suite was run.

Used the canonical `withIsolatedLocalBrowser` helper and existing class-fixture
document pattern, fresh disposable Chromium context, task-owned loopback port
53188, fabricated memory-only service/storage, blocked external requests and
Service Workers. Browser/contexts and owned Vite server closed in finally on all
attempts. No shared live-browser lease was needed under the approved isolation
exception; existing engine isolation evidence was not rerun as Product proof.

## Actual limits and release coordination

Only the two original modules, the focused test and this evidence are changed.
No new startup dependency, `sw.js` change, account, real student/code/phone,
external service/database operation, live install or V2 permission workaround.
All original V2 helper denials, owner boundaries and installer evidence remain.

This is local readiness only. The independent controller/publisher owns integration
and Production verification; this worker neither pushes nor deploys. Existing
cached clients receive the complete N44/N88 wave only after the separately activated
`continuous-n44-n88-offline-fix-release-20261031` advances the shared SW cache after
both repairs are published. Offline rollout, real device/service acceptance and
parent Product closure are not claimed here.
