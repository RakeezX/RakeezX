# N36 — setup singleton transaction and direct shell receiver

AI-authored local candidate for task `continuous-n36-setup-profile-save-direct-bridge-20261020`, run `3b675661-fb0a-4ca6-851b-9fde523c5ab2`.

Base: `7a68241d47c4501b224ac237a36e9d44c4a377ea` (includes delivered N117). Observed origin/main advanced to `191d9b28862b50fd20248c6e801b3cfb52dac729`; its intervening N64/ops changes have no diff in the affected application/extension/SW paths. N117's required department and initial calendar behavior is preserved.

## Preserved actual failure

The PO's real 0.5.16 journey collected 303 names / 10 classes / 7 pages, then failed with the save toast and `SETUP_PROFILE_SAVE`. Profile/timetable completion, subjects and full journey success were not proved. That journey remains **FAILED**, regardless of publication or this synthetic qualification. No school collection, reinstall request, real account write, SQL/migration/Auth/RLS or live retry was performed.

`tests/n36-actual-save-20261020/reproduction.json` reproduces the exact wrapper/root pair in the actual account store and IndexedDB: `SETUP_PROFILE_SAVE` caused by `SETUP_PROFILE_CHANGED`. A representative persisted older profile omits newly defaulted fields, while `init()` hydrates them into memory. The old raw-JSON comparison mistakes that shape difference for a concurrent edit. This demonstrates the failure mechanism; it is not a readback of the private account's hidden underlying error.

## Bounded correction

- Import compares the persisted **hydrated** singleton with the captured snapshot inside one guarded IndexedDB profile/outbox transaction. Existing different values and real concurrent changes remain conflicts. Memory and notifications update only after commit, without the old `save()` array/singleton mismatch or optimistic notification. Owner, session, lease, academic context, lifecycle and ordinary owner-bound outbox guards remain active.
- One receiver is installed once by the normal app shell. The extension still binds one existing authenticated document on explicit Start, but delivers the one-use nonce to that receiver without opening/navigating to the import page. The worker still verifies exact current URL/document/tab, grant and expiration; manual Noor/recovery remains available. Compact `خامس1` / `سادس7` source labels resolve only to unique canonical destinations in the current year. No dummy subjects, guessed global mapping or overwritten history.
- Exact persisted current-owner/year/term pending batches resume after readiness with fresh validation and a fresh document/session grant. Foreign owners are refused. Cancellation revokes the current document's automatic continuation; a new explicit Start can regrant it. Ambiguous mappings can use the optional recovery view, which only lists actual mapping failures.
- Unknown receipts carry only allowlisted `phase`, `step`, `code`. Profile-wide storage failure stops the batch and reports the setup failure instead of labelling every class unresolved. Names/tokens/source strings are excluded from these diagnostics. Absent source categories and differing existing values retain their existing distinct counts.

## Affected evidence

`node tests/n36-actual-save-20261020/browser.mjs` — **PASS**, actual HTTP application DOM/CSS, store, IndexedDB, extension category/controller handlers and worker module. The canonical isolated local browser helper owns a fresh disposable context, blocks external requests/SW and closes its browser; the test owns port 49526 and closes its server in `finally`. No shared live browser or user profile was used. Only production-origin configuration is translated to the owned loopback origin in the fixture protocol modules; guard implementation is unchanged. Chrome/source/network APIs are synthetic. The previously qualified collected-source boundary supplies two representative classes; the old extraction/pagewalker/303-name suite was not rerun.

Checks cover:

- Successful older-profile hydration; actual IndexedDB quota rollback of profile/outbox without optimistic singleton notification; differing-value and concurrent-record conflicts.
- A committed write with failed postcommit validation remains unknown. Readback/refresh and identical retry add no duplicate command. Foreign account rejects writes.
- Source categories → real extension handlers/worker → app-shell receiver → store: existing canonical classes, subjects, names, principal/school/teacher and timetable, without navigation/new app tab/per-class confirmation. [Rendered actual app](../../../tests/n36-actual-save-20261020/app-shell.png).
- Actual profile storage failure → safe worker receipt/extension report (`profile / transaction / QuotaExceededError`), exact batch retained, no generic all-class mapping failure. Foreign account leaves disk/outbox unchanged. Actual reload plus delayed same-owner hydration automatically resumes; students/enrollments/slots stay byte-identical while missing profile fields complete.
- Wrong origin/tab/document/current route, consumed nonce, expired batch, arbitrary receipt code, changed app session/term and invalid offline lease all reject.

The browser evidence preserves the initial harness failures: the success predicate expected obsolete copy; the diagnostic button was inside collapsed details; clipboard completion required the actual asynchronous fallback. These are not erased or converted into original PASS claims. The separate original Product reproduction remains intact.

`node tests/n36-actual-save-20261020/offline-startup.mjs` — **PASS**. All ten modules newly made eager by the shell receiver already have exact paths in the existing SW SHELL. No added uncached startup dependency and no SW source change. This is local dependency coverage, not live offline-cache certification.

`node tests/n36-actual-save-20261020/package.mjs --prepare` — **PASS**. Established deterministic ZIP workflow produces 0.5.17 once, with 25 exact source/hash/size-bound runtime files. Narrow permissions/CSP, shared protocol, old immutable package and unchanged extraction/lifecycle source identities verified; affected JS syntax passes. ZIP SHA-256: `3eb3338ff482b84329a5623af54b2f7cd48182c37aa6b6cba22e206c70c6dc47`.

## Delivery boundary

Local implementation is ready for the independent publisher. No push, deployment, provider/served check, stable-folder mutation, Chrome reload or Product closure is claimed. Current stable-folder read-only verification matches the existing 0.5.16 receipt and all 25 runtime hashes. Required check `n36_changed_package_and_stable_folder_same_verified_version` remains **NOT_RUN for 0.5.17** until the publisher verifies the immutable/served package and the existing `n36-stable-sync` updater installs and records those exact bytes. This is the existing downstream delivery sequence, not a request for another permission or a substitute deployment. Real logged-in journey success remains unverified.
