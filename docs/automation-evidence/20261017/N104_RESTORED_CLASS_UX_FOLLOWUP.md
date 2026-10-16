# N104 restored-class UI follow-up after N36 — AI implementation

Task: `continuous-n104-post-extension-restored-owner-class-journey-20261017`  
Run: `578aa07f-9d72-45b2-ba45-1036247a8ca9`  
Base: `a1e593d4fba7a415155256a2ddb222650cc89237`. Exact candidate is the worker result/commit containing this evidence.

## Observed problem and correction

Read the current canonical N104/N36 ledger notes, activated card, operating contract, previous genuine-receipt evidence and current restored-owner binding. The previous c9c02a delivery does not establish PO acceptance; N104 remains OPEN.

The baseline check serves the exact base versions of the affected application modules over owned HTTP, with the actual application DOM/CSS. A genuine begin/update/finalizeAccountRestore fixture produces a registry receipt **without ownerId**, a matching device receipt **with ownerId**, and the genuine restored-account boot descriptor. No JWT is manufactured; the existing synthetic transport/session fixture is reused, with all external requests locally fulfilled or blocked.

Distinct current defects reproduced at 390px:

- An inaccessible explicitly requested teaching is silently discarded by the central Koshoof route. Restoring the valid owner context and repainting on the same route does not restore its selection.
- Re-entering an explicit teaching URL can reuse another manually selected teaching because route initialization is cached across unmounts. The candidate's first denied-DOM run exposed this additional problem; it was corrected rather than weakening the denial assertion.
- Empty class hub actions disappear without an explanation, while Students still renders buttons whose handler rejects with only the generic toast.

The hub now retains the requested teaching internally through temporary denial, reinitializes an explicit URL on a new visit, and clears inherited selection on a context-free visit. It never selects or renders a denied class. A valid original guard result is still required before recovery can render its import UI. `afterPaint` stops before extension receipt/listener setup in a denied view. Existing async binding/current-owner checks remain intact.

Hub, Students and Koshoof share one small accessible status with a next step and return link. It discloses only account-verification, expired-lease, archived/closed-context or ownership-match categories; it never formats exception text, account IDs, database identifiers or private URLs. A stale paste/add click that loses permission repaints the contextual status instead of leaving inert controls and a generic toast. The status has no mutation/repair action.

`assertClassOperationsAccess`, `assertClassImportAccess`, restore/provenance/device/database/Auth/session/lease/term guards are unchanged. No Auth/RLS/schema, Sync, scoring, real data, deletion/restore, service or startup dependency change. No offline-calendar hold disabled.

## Affected verification

- `node tests/n104-post-n36-restored-class-browser.mjs --baseline`: PASS as a reproduction of the broken base, not Product acceptance. Evidence: local `test-results/n104-post-n36/baseline.json`.
- `node tests/n104-post-n36-restored-class-browser.mjs`: 36 PASS records at 320/390/768/1280. Initial and real document reload each read owner/database/device/registry/routing together in the current ready document. First clicks open empty and populated classes, actual Add/Paste sheets cancel without saving, Students → contextual Koshoof → advanced file control, export/import and browser back work. Twelve bounded notifications/repaints preserve select coordinates and route; the select's actual afterPaint listener still works. Twenty-four denied/recovery cases exercise foreign owner, mismatched device restore receipt, archived section, closed term, mismatched session and expired lease. Denied DOM contains one contextual status, no class/import controls, no private identifiers, and issues no requests. Stale rendered paste controls also reject before opening a sheet. Recovery reopens the requested class only after the valid context returns. All Product stores except device/profile/legacy meta remain byte-identical through navigation/cancel and denied checks; synthetic service commits = 0 and page errors = 0.
- Canonical direct extension URL enters the actual current N36 afterPaint handler at each width. Loopback correctly rejects installed-extension transport, displays the existing fallback and clears the nonce without data changes. Full installed MV3 transfer and official portals **NOT_RUN** here; unchanged prior N36 transport evidence is retained, not relabeled as new acceptance.
- `node --test tests/n104-class-operations.test.mjs tests/n104-post-n36-restored-class.test.mjs tests/n101-context-local.test.mjs tests/n58-fresh-account-read-guards.test.mjs tests/n36-confirmed-bundle-names.test.mjs tests/n108-xlsx-export.test.mjs`: 14/14 PASS. Existing claim/restored/provisioned owner-negative checks retained. The added independent real-store restored matrix rejects 17 session, readiness, foreign-class/parent/database and registry/device-receipt boundaries, including after feedback is read; valid resets are checked between cases. Import mapping/confirmation, calendar parent guards and Excel/CSV injection/zero/missing-value/export checks pass.
- Node syntax checks on four changed application files and two new scripts; `git diff --check`: PASS. Screenshots inspected at 320px ownership denial and 1280px expired lease: readable RTL status/action, no overflow.

Machine evidence: `tests/n104-post-n36-restored-class-browser.json`, with actual source SHA256 values, measurements, task/run identity and owned browser lease cleanup. Screenshots stay in local `test-results/n104-post-n36/`.

## Preserved failures and limits

The initial broader affected Node invocation reported **16 PASS / 2 FAIL**:

1. `tests/n36-extension-direct-handoff.test.mjs`, “installable ZIP and provenance manifest match every shipped runtime byte”: FAIL at `categories-popup.js`, physical Windows checkout CRLF versus packaged LF. The archive/manifest and every extension source are unchanged from base. Read-only normalized comparison confirms their text matches; no Git/global settings or package bytes were changed to hide the failure. The other three protocol/privacy tests in this file PASS.
2. `tests/n36-koshoof-discoverability.test.mjs`: FAIL on the old per-class card source regex. That assertion and `teachings.js` are unchanged from base; the same regex fails against `git show a1e593…:src/views/teachings.js`. Actual current guarded class-to-central-hub DOM is covered above. These old tests are outside the card's writable scope and remain FAIL; no result was changed to PASS.

The first candidate browser attempt passed initial 320px then read Auth too early after reload (`Cannot read properties of null (reading 'id')`). The harness now waits for boot removal and current-document account readiness before the same-document checkpoint. A subsequent denied-DOM failure exposed the stale route cache described above, which was corrected. The extended stale-click harness initially expected assigning the same URL hash to trigger a new paint; its navigation helper now explicitly repaints an unchanged route. The first added Node matrix used an invalid synthetic database label; it now selects the genuine deterministic foreign-owner database name, preserving the negative ownership check. None of these intermediate failures is Product acceptance evidence.

No Preview, real account/student read/write, extension install, official portal control, push, integration, deployment, provider or Production check was performed. Sole controller/publisher owns those delivery steps and exact immutable/served parity. The two unchanged legacy N36 failures remain visible for that decision. The PO's authentic restored-account retest is still outstanding; N104 is not CLOSED.

The shared browser phase lease is acquired with the exact active card/run and released after owned browser/context/server cleanup in finally. Owned loopback port: 49124. No user browser/profile, queue/status, other locks/processes or global config changed.

## Saved-session continuation — validation scope blocker

Continuation run: `ace76421-7c49-4dde-9e96-788e2de1c8c5`.
Preserved Product candidate: `b02e8cabef131e812f2ebdd9bf55bc98cc3020b5`.
The prior LOCAL_READY result was rejected: `Candidate validation: An affected check must pass and no recorded check may fail`. Returning LOCAL_READY with those two FAIL records was incorrect. They remain FAIL; the continuation does not suppress, rename or relabel them.

Fresh read-only reconciliation verified a clean worktree at the saved candidate, matching current activated card/run, and exact equality of all five recorded browser application-source SHA256 values. The existing 36 PASS browser records, zero page errors, released browser lease and 14/14 scoped Node result are reused under their original run identity. No test, Preview or browser was repeated, and no new phase resources were acquired.

The concrete repair is a bounded test-harness correction, but the current card omits both necessary paths:

- `tests/n36-extension-direct-handoff.test.mjs`: compare the shipped ZIP entries and manifest hashes against the canonical tracked Git source bytes, with a separate comparison of checkout text allowing only Git's CRLF/LF conversion. Preserve archive hash/size, file-set, version, every file hash and real content-change rejection. Do not normalize or rebuild the shipped archive, modify global Git configuration, or merely drop byte-identity checks. This addresses the evidenced checkout conversion while retaining package provenance.
- `tests/n36-koshoof-discoverability.test.mjs`: replace the superseded per-class `class-card__koshoof` source expectation with assertions for the existing central Classes → Koshoof entry and the central hub's guarded class selection, retaining the distinct class-hub Koshoof/report tools. The saved actual-DOM checks already exercise current class navigation and owner denial; they are not replaced by a source-text acceptance claim. Do not add obsolete Product links/CSS merely to satisfy the old regex.

These are read-only prepared correction requirements, not applied changes or passing tests. Neither omitted test path is authorized by the fresh card's `allowedPaths`. No extension source/package, Product UI or global configuration needs changing for this repair. The worker cannot expand its own card, alter the validator, omit the failures to pass validation, or invoke a substitute maintenance role.

Result: BLOCKED on the missing test-file scope. Retry only after the approved maintenance helper, during its separately guarded inactive-worker/idle-publisher window, adds these exact two paths to this same card and the controller resumes the saved session. Preserve the Product candidate/base and original evidence; then apply the two narrow test corrections and rerun those affected checks. Reuse unchanged UI evidence. No queue/status/lock changes, push or deployment occurred in this continuation.
