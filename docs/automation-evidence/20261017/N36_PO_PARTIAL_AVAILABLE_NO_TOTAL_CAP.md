# N36 partial available import — 0.5.5 candidate

## Scope correction and implementation — current run

Run `f6a46781-46ef-419d-ba71-457ab0ba7c2f` resumes the exact saved worktree and AI-labelled checkpoint below. The activated PO repair explicitly adds `src/views/teacher-setup-import.js`; the original `card_scope_correction` failure is preserved below rather than relabelled PASS. No queue/status file was changed.

### Current blocker: actual same-class receiver roll-number boundary

The real synthetic Chrome/account/store test successfully transfers 1251 students distributed across owned classes and 350 students in one owned class. An additional same-class 1251-row continuation reaches 900 confirmed names, then the actual store rejects the fourth reviewed 300-row action. The receiver reports 300 new names still unsaved, and the extension correctly retains that exact batch rather than advancing. This failure was preserved and reproduced only to capture its real receiver outcome; it is not a browser transport success or a completed import.

Concrete source: **`src/store.js:3586`** throws `IMPORT_LIMIT` when `next + students.length - 1 > 999`. The same existing file also defines related roll-number validity/count constraints at lines 3275, 3287 and 3311. This file remains outside the repaired card's allowed paths. Changing only the extension, shrinking a batch, suppressing the failure, assigning the tail to a different class or bypassing the receiver guard cannot provide eventual same-class completion beyond that boundary.

The original missing receiver-view path is resolved. The new blocker is the actual store's per-class numbering representation, not an arbitrary source-wide roster gate. The candidate removes the source total gate and works through verified owned-class batches, but unrestricted same-class completion is **not certified**. Do not publish or update the fixed runtime from this blocked checkpoint. A scoped correction must include the actual `src/store.js` numbering/import path and its affected safeguards/contract review before retrying the same-class boundary. No store, Sync, Auth/RLS/schema or real-data change was made here. Preserve this candidate and the exact failed receiver evidence; a new run ID alone is not a correction.

The candidate separates row validity from report coverage. Missing index/next-page/terminal evidence warns about incomplete coverage while vetted visible name/class rows remain reviewable. Unsafe paging links are not followed; invalid or hidden individual rows are excluded. Source collection pauses at a bounded window, and a large visible table is read in sequential slices. There is no product-wide total or page-count gate. Only one exact class batch of at most 300 rows is rendered/transferred at a time; source order and its untransferred tail remain available.

The teacher explicitly acknowledges partial coverage, reviews each batch, chooses an owned class in the actual Rakeez modal and confirms there. Existing owner/Auth/lease/year/term/context guards remain in the same receiver/store entry. A new structured count-only outcome comes from the actual confirmation/readback. Send/claim does not advance a cursor. Failed, unknown, expired or missing receipts leave the same rows pending. Explicit retry invokes a fresh existing-name review; an all-existing acknowledgement performs no new write. The extension binds receipt return to the original receiver tab/nonce and only consumes a successful outcome once. Counts distinguish locally added and previously existing names; neither is server Sync proof.

Continue requires settled receipts for all valid rows in the current window and a fresh source guard. Names are transient; the five-minute window deadline scrubs source rows, selected DOM, cursors and pending transport. Two-minute encrypted one-time handoff remains unchanged in duration. Counts across explicitly continued windows contain no student names; no names are written to durable storage, diagnostics or URLs. No new startup module or offline-shell dependency was introduced.

Local package: `assets/extensions/rakeez-teacher-import-helper-0.5.5.zip`, with per-file hashes in the adjacent manifest. Prior packages are preserved. The installed fixed runtime was not touched. Provider/immutable/served Production parity belongs to the independent controller/publisher and has not been run by this worker. Official-source success requires a new voluntary PO test; N36 remains OPEN.

### Verification record

- Node: 22 affected tests passed across the new partial suite, receiver limits, direct handoff, historical package/popup and complete-class regressions. Earlier total-cap expectations were updated to the superseding PO decision; historical packages are checked against their recorded immutable Git source rather than the new checkout. Owner/protocol/transport limits remain asserted.
- Final Chrome evidence: **27 scenarios passed; same-class 1251 continuation remains FAIL**. The evidence deliberately retains overall `status: FAIL` and the actual receiver failure. Passed cases include all required source sizes distributed across classes, same-class 350, partial/missing pages, duplicates, invalid/hidden fields, unsafe links, absent reports, school/role/session/owner/lease changes, expiry, storage failure/retry, lost receipt/replay and source closure. Unchanged cases were reused only with identical package and application hashes.
- Chrome: current run uses the existing installed-MV3/CDP harness, disposable owned profile, browser phase lease, intercepted synthetic school pages and actual Rakeez HTML/modules/CSS over HTTPS backed by an owned loopback server. Final case status, source/application hashes, retained prior failures and resource release are recorded in `tests/n36-partial-class-import-no-total-cap-browser.json`; no source-text assertion is presented as rendered UI evidence.
- Original exploratory failures are retained in that evidence: semantic hidden presentation was fixed in source CSS; a foreign-tab harness originally cleared synthetic Auth and correctly triggered the ownership guard, then moved before account setup; negative partial-approval clicks were corrected to account for the handler deliberately unchecking the box. No guard was disabled.
- The expiry fixture also left browser document clocks five minutes ahead of the real extension worker and caused a subsequent transport timeout. The harness now resets/resumes its clock after proving expiry. The remaining retry/lost-receipt/source-closure cases passed in a fresh owned context. The original timeout remains in `priorFailures`; it does not replace or erase the independent store-numbering failure in `preservedFailures`.
- Rendered RTL screenshots were inspected at 390px for the actual extension review and Rakeez modal; source widths 320/390/768/1280 and modal horizontal bounds were asserted. These are synthetic UI results, not official school verification.
- ZIP SHA-256: `70d909637801502e01c61439ddec3b0ea6b33ab42912c89b397c38fadf3cd396`; manifest SHA-256: `6593d771baab918e16583c712757a544a94687ea443a3c6b24370a640faeeaa2`.
- Final browser lease is `RELEASED browser`; the owned disposable Chrome/profile and loopback server are closed. Syntax and `git diff --check` passed. No push, deployment, installed-runtime update or real-data access occurred. The candidate is BLOCKED, not LOCAL_READY.

## Historical blocked checkpoint (unchanged facts)

AI-authored checkpoint, 2026-10-17. Product remains OPEN. No Product implementation or release is claimed by this checkpoint.

- Task: `continuous-n36-available-partial-class-import-no-total-cap-20261017`
- Run: `6a6903ef-d44d-4cf2-bd4c-98abf6ac501a`
- Base: `eda13b5ec13266d8b0ca114dd7666bad9c87db6e`
- Worktree: `C:\Users\Abody\Projects\RakeezX\.worktrees\continuous-n36-available-partial-class-import-no-total-cap-20261017`
- Observed remote `refs/heads/main` from `git ls-remote origin refs/heads/main`: same base. The integrated source already contains 0.5.4 and its evidence; the prior worker's worktree was not touched.

## Concrete missing path

Add **`src/views/teacher-setup-import.js`** to this existing card's allowed paths before resuming this exact session/candidate. This is the actual authenticated N12 names-review/confirmation modal, not either of the currently allowed (absent) `src/lib/names-import.js` or `src/lib/import-names.js` paths.

Source inspection:

1. `src/views/class-import-center.js` opens `openTeacherSetupImport` with `initialBundle`, `sourceNotice`, `onClose` and `isContextCurrent`. Its ownership/lease/year/term binding must remain intact.
2. `src/views/teacher-setup-import.js` exposes only those options. Its private `confirmNames` owns `store.confirmNamesImport`, the guarded transaction context, saved result, failure handling and the subsequent fresh names review.
3. That modal keeps `saved.added`, prior existing counts and remaining names private. The `onClose` callback has no receipt argument. A transferred or claimed envelope is not a persisted import receipt.
4. The activated decision explicitly requires per-class receipt-grounded added counts and safe repeated/failed batch continuation. A bounded structured result callback from this actual confirmation entry is needed to connect receipt-aware continuation while preserving its current owner/state/lease guards. It also needs a truthful outcome when all rows already exist, so restart/retry can progress without pretending a new write occurred.

Do not infer success from a handoff claim, parse receipt DOM text, monkey-patch the store, duplicate the authenticated commit flow in an allowed file, or advance a cursor merely because a transport was created. Those alternatives lose the precise failure/ownership binding or introduce a competing import path. The scoped receiver hook should report validated counts and row outcomes only after the existing guarded confirmation/readback; the ephemeral return transport must bind the receiving tab/action and expire with the review.

## Preserved implementation work remaining

No functional source was edited or package generated. Existing complete-only behavior remains unchanged until the complete bounded change is implemented and checked. In particular, removing `SOURCE_ROSTER_LIMIT=1200` alone would leave unbounded memory and would not meet the decision.

After the missing-path correction, implement together:

- Separate trustworthy row/class provenance from coverage warnings; invalid/anonymous/foreign rows remain excluded. Preserve ordering and explicit owned-class remapping in the existing receiver.
- Replace product-wide count/page gates with bounded transient windows and explicit continuation, retaining pending pages/batches without silent loss. Split a single class into reviewed transfers of at most 300 rows.
- Couple batch progress and per-class added counts to actual receiver outcomes; preserve retryable rows on failure and reconcile existing students on every fresh receiver review.
- Preserve original five-minute scrubbing and explicit restart, encrypted one-time two-minute handoff, Auth/owner/lease/year/term guards and no automatic writes.
- Produce 0.5.5 only after affected Node and actual synthetic application/MV3 browser scenarios pass. Keep previous packages unchanged. Controller/publisher owns integration, provider and served parity; fixed installed runtime update follows verified release only.

## Checks actually performed

- PASS: read canonical operating contract, activated matching N36 card/current Product row, source controller/readers/protocol and actual receiver entry. Card activation matches `po-20261012-continuous`.
- PASS: `node --test tests/n36-receiver-limits.test.mjs tests/n36-extension-direct-handoff.test.mjs` — 8 passed, 0 failed. This is baseline protocol/schema/receiver validation only; it does not prove the requested new partial/continuation behavior or rendered UI.
- NOT RUN: new partial imports, receipt-aware batch continuation, >1200 bounded-window cases, changed-source rendered UI, 0.5.5 packaging and release parity. No new behavior exists to certify yet.
- No browser/server phase was entered, no phase lease acquired and no owned processes remain. No school account, real student data, runtime installation, queue/status, main, push or deployment was changed.

## Retry condition

The approved maintenance helper may correct the inactive card to include the exact receiver view path above under its existing idle-worker/publisher and ownership guards. Preserve this base, candidate and saved session; only the controller resumes the worker. This checkpoint does not edit queue state or launch maintenance. A new run ID alone does not resolve the path restriction.
