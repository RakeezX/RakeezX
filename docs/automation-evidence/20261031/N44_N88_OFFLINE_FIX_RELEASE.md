# N44/N88 shared offline fix release — local candidate

AI-authored, 2026-10-31. Task `continuous-n44-n88-offline-fix-release-20261031`,
run `93892e7d-7d57-4756-a7d3-2dcdd454a2c4`.
Base and freshly fetched `origin/main`: `160d116a368f7219ddabd225064c2cedf56bbe10`.
Authority: activated card and latest canonical N44/N88
`PO-20261031-FUNCTIONAL-CORRECTION` notes. Explicit task model/effort are
gpt-6.1-sol / medium, ordinary Standard runner with Fast disabled.

## Original prerequisite publications

Read both original attempt results and original publisher `receipt.json` files
under `artifacts/ops-supervisor-v4/` in the canonical repository:

| Parent task | Candidate | Original published revision | Publisher verified at (UTC) |
| --- | --- | --- | --- |
| `continuous-n44-stale-projection-http-20261031` | `1cbdecc4eb193bae9961501a600fe18562701584` | `5e5fe4266927082b0ce828555e5e4f06beb4d603` | 2026-10-30T21:25:53.017Z |
| `continuous-n88-local-refusal-state-20261031` | `b7d1b643221aec7377b2fa315cf4d33e3c43d417` | `160d116a368f7219ddabd225064c2cedf56bbe10` | 2026-10-30T21:28:08.042Z |

Receipt paths are `delivery/<parent-task>/receipt.json`. Original results are
`attempts/<parent-task>/<run>/result.json`, with runs
`9b8abb69-a965-46d4-b2ef-b2a0cb3d8a1b` (N44) and
`95eba80d-6966-4087-b2ef-70a66567f32f` (N88).
Both receipts record provider SUCCESS with the provider head matching the
published revision and passing immutable/Production asset evidence. This worker
reused those receipts; it did not repeat provider or live checks.

## Bounded change and actual verification

- **PASS `offline_release_contains_both_verified_fixes`:** after `git fetch
  origin main`, HEAD equals observed `origin/main` above. `git merge-base
  --is-ancestor` succeeds for both original published revisions and both
  candidates against that main. The gateway, class client and class view Git
  blobs match their respective original published revisions exactly. Both repairs
  and other inherited main changes are preserved.
- **PASS `offline_shell_generation_and_precache_preserved`:** derive the current
  numeric VERSION from the actual base and advance exactly once, from
  `rakeezx-v100` to `rakeezx-v101`. A scoped assertion compares the complete worker
  before/after with only that VERSION declaration masked: every other byte is
  identical. All 206 existing SHELL entries remain unchanged; gateway
  `./src/lib/notification-push-gateway.js`, class client
  `./src/lib/student-portal-class-client.js` and class view
  `./src/views/student-portal-class.js` are present in SHELL and on disk. Cache
  generation cleanup, push and consent behavior are unchanged.
- **PASS syntax/diff:** `node --check sw.js` and `git diff --check` succeed.
  Inspected the exact worker diff: one VERSION line only.

## Delivery boundary

LOCAL_READY preparation only. The independent original publisher must integrate
this candidate and verify the served `sw.js` with generation 101 (or explicitly
reconcile a later main advance). No push, deploy, browser/server phase, live
account, service/database change, real data mutation or message occurred here.
Unchanged Product suites, Preview campaigns and device trials were not repeated.
This prepares this fix wave's shared cache rollout; it does not certify real
offline/device behavior, hosted V2 installation, two-phone acceptance, PO
acceptance or closure of either N44/N88 umbrella. Existing blockers remain.
