# N03 fast-track handoff — D-079/D-080

Baseline: `861006d5bfb30ed30125ff10a81110c0b2d89f7c` (exact local `origin/main` at intake). I created `codex/n03-d079-d080-storage-gate` from detached HEAD; another process then switched this shared worktree to `n03-fasttrack-d079-d080` at the same SHA. No commit was made by this pass.

## Authority and source

- Newer PO instruction in this ticket authorizes N03 Product implementation and sets Education Department in **Settings > بياناتك only**. It supersedes the older `NOT_AUTHORIZED` and optional wording in committed docs for this ticket. WA-REFINEMENT-0440-2 remains the visual/interaction authority; Product/main remains runtime/data authority.
- The final Work handoff hash matches `26b1015ae2391e5ea4207981e94056797b9488d5cd15b2f74eac1e73bc14c32f`. All **100/100** paths in `docs/work-approvals/WA-REFINEMENT-0440-2.manifest.json` match their SHA-256 hashes, including all N03 source, directory, evidence and screenshots.
- The 47-name catalog staged here is the exact 2026-09-30 Work snapshot (`6b76b6548703f139faea7a340054d29f09349aa4ea109e1e7b43baa741d29ef8`). It is a dated input, not a live Ministry dependency or a silently approved permanent refresh policy. The source spelling `إدرة التعليم بمحافظة مهد الذهب` is preserved.

## Storage finding and exact gate

**HIGH-RISK SCHEMA/SUPABASE GATE.** Current Product cannot safely persist the selection as account profile data without a new schema and server-contract change:

- `rakeezx.profile` has explicit scalar columns and no education-department field or general structured profile payload (`0001_core_schema.sql`, later profile migrations).
- `complete_account_profile(text,text,text,text)` and `account_contract()` accept/return only the existing profile fields (`0032_account_profile_access_foundation.sql`, `20260924003436_beta_new_account_provisioning.sql`). Server `profile_status` also drives fresh-account provisioning; changing it to require N03 would block general use.
- Sync V2 client/server profile field maps are allowlists (`src/lib/sync-v2.js`, migration `0032`). A local IndexedDB-only value would be lost or diverge across account devices, backup/restore and sync. Reusing another existing text column would corrupt its meaning.

No migration was authored or applied. No Supabase/live data, main, Preview, or Production was mutated. Product UI was not wired to a value it cannot durably save.

## Surface/contract matrix

| Approved outcome | Current candidate | State |
| --- | --- | --- |
| Exact searchable official-name directory | Frozen catalog and pure search/membership helpers staged; not runtime wired | GAP at storage gate |
| Settings > بياناتك only; selected, incomplete, postpone/change/remove | Current Settings profile inspected; no Product control introduced | GAP at storage gate |
| Required for profile completion; general use continues | Existing server `READY` controls provisioning, so N03 needs a separate nonblocking completion indicator | RUNTIME-CONFLICT if mapped to server `profile_status` |
| Demo parity | Current Demo profile is isolated; same Settings control should use its local profile once Product persistence is defined | GAP at storage gate |
| No onboarding, automatic Calendar change, live Ministry dependency | No such code changed | MATCHED |

## Narrow implementation after explicit high-risk authorization

1. Approve an additive, owner-bound `education_department` profile field and the dated catalog packaging/freshness policy. Keep existing applied migrations immutable. Decide whether to store exact official name or a stable catalog key; define behavior for later renames/retired entries and previously completed accounts.
2. In a **new** authorized migration, update profile storage, owner/RLS and Sync V2 allowlist, account contract response, and safe profile update path. Keep server provisioning `profile_status` and fresh-account access behavior intact. Verify owner isolation, invalid-value rejection, offline/reload/second-device convergence, and backup/restore with synthetic accounts in disposable infrastructure.
3. Wire only Settings > بياناتك to the approved Work picker: searchable exact names, keyboard/focus handling, selected/incomplete state, `إكماله لاحقًا`, change/remove. Compute N03 completion separately from account provisioning. Apply the same shared UI to Demo with local-only data and no Product cloud calls. Do not touch onboarding or Calendar.
4. Use the verified Work golden states at 1440/390/320, RTL, light/dark. N58 owns the Heavy Window, so browser/Vite/build/Build Meta, focused persistence flow, Preview and PO Product review remain queued. Run risk-selected data/auth/sync gates before Preview; do not treat this staged branch as Preview-ready.

## Local checks

`node --test tests/education-department-directory.test.mjs` and `git diff --check` are the permitted light checks. Record their final results with the candidate commit. No Vite, browser, build or live mutations.

## Continuation — isolated local Product candidate (2026-10-03)

The later PM instruction explicitly authorizes **local** N03 Product implementation. The earlier storage-gate stop above records the prior state; it is superseded for local source work. The live schema/Supabase, Preview and Production gates remain closed.

- The proposed additive migration is `supabase/migrations/20261003000000_n03_education_department.sql`. It adds a nullable `profile.education_department` with a foreign key to the exact frozen 47-name catalog, extends the Sync V2 profile map with an independent conflict group, and adds `profile.educationDepartment` to the owner-derived account contract. It leaves readiness, provisioning, Auth fields and the four-argument completion RPC intact. No applied migration is edited.
- Runtime packages the same dated catalog in `src/data/education-departments-2026-09-30.json`. Settings > بياناتك offers search and exact selection, selected/incomplete state and clearing/postponement. The profile store and Sync V2 carry the value across account devices; Demo uses the same local profile UI while Owner Guard keeps it cloud-isolated. No onboarding, Calendar, or Ministry call is added.
- Profile data completeness is a Settings presentation state. It does not change `profile_status`, provisioning, account access, or general app routing. A later catalog update needs a separate Product decision and migration.
- Focused source, profile, Demo, and disposable PGlite migration/owner tests pass. Browser, offline/reload/second-device flow, full affected Sync/Auth suites, build/Build Meta, Preview and Production remain queued behind the N58 Heavy Window and explicit live gate.

**Next PO live gate:** review and explicitly authorize this exact candidate SHA and migration for applying to live Supabase, including adoption of the dated exact-name catalog as the initial server validation set. Then run the high-risk schema/Sync release gates on synthetic/disposable accounts before any Preview or Production promotion. Applying the migration, live data mutation, and deployment are not authorized by this local continuation.

## Data correctness refresh before live gate (2026-10-04)

The dated central source snapshot remains in `review/n03/official-departments-2026-09-30.json` with its original `إدرة التعليم بمحافظة مهد الذهب` entry. The packaged catalog and still-unapplied N03 migration now use the Mahd Education Department's institutional spelling, `إدارة التعليم بمحافظة مهد الذهب`. This is the only name correction; the other 46 names and the schema/Sync contract are unchanged. Exact local gate results and the new candidate SHA are recorded in `test-results/evidence/N03-D079-D080/`.
