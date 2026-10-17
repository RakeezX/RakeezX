# N36 partial available import — preserved scope blocker

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
