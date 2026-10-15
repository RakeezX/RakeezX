# N107 — candidate implementation; browser phase BLOCKED

AI-authored implementation and evidence. Task `continuous-n107-central-classes-local-file-import-20261015`, run `d3c03b8f-0bdd-4dba-b907-f1643fb52721`. Base `2b875721e8cee777489d8e99fb2a253065cdbb4e`. Candidate is the commit containing this record; its full identity is returned in the runner result.

Read the canonical operating contract, activated canonical card and current canonical N107 Product row. The worktree ledger predates N107; the canonical row says IN_PROGRESS and limits this change to local teacher-uploaded files. No queue, ledger, service, Auth, schema or real account mutation was performed. No push, Preview or deployment was performed.

## Implemented scope

- Home state A retains primary creation and adds secondary green class import. Other Home states get no extra import action.
- Both Classes states use the same top toolbar: class import, add, central Koshoof, quiet accessible trash icon. Existing two-step delete and owner-scoped Demo deletion implementation are retained. Demo creation moves to the bottom. Cards retain their main link and lose the redundant Koshoof shortcut.
- `#/classes/import` reads actual CSV/XLSX through the existing vetted `readStudentFile`. Source choices explicitly mean uploaded files, including Noor/Madrasati exports, without portal login/network integration.
- Simple columns: `الصف، الفصل، المادة، اسم الطالب`. Student name is optional. Alternative headers near the top are detected; column selection and explicit manual missing grade/section/subject are available. Unknown grades and unsafe labels/subjects block review. Explicit school metadata must match the configured school and may not mix schools.
- Preview groups grade + normalized section + subject alias identity. Repeated/invalid names block that group rather than silently merging students. Same names in different groups remain separate identities. Existing or archived same-year sections are rejected and directed to existing Koshoof for teacher review. Different years remain separate.
- Each explicit final confirmation saves only one selected group through existing subject resolution, section creation, teaching creation/default items, and student import. Other groups say «للمراجعة لاحقًا».
- Private immutable review capabilities bind workspace object/database/provenance, Auth session, active year/term, reviewed class and names. Guards run before steps, after awaits and inside the existing persistence transaction. Persisted class/roster/device-term changes from another tab reject the write. Optional guarded-save callbacks retain existing outbox/lease/owner mechanisms; no raw Product database writes were introduced.
- Partial in-memory receipts retain section/teaching IDs, saved count and pending names. Explicit retries reuse only the saved steps; successful repeat calls create no new outbox, default items or students. Session callback changes stop continuation; a later explicit same-owner review can rebind the current session. Drafts are memory-only, not crash recovery. Switching account/workspace clears visible draft data for owner isolation; existing class collisions remain rejected after reopening.
- Central Koshoof lists only allowed current-term teachings with separate contextual import/export links. It does not promise bulk export.
- Store now statically imports `class-import-file.js`, and router dynamically imports the new view. Both are added to the existing offline shell; cache generation advances v64 → v65. Offline installation/reload still needs the browser check below.

## Actual checks

Executed:

```text
node --test tests/n107-central-entry.test.mjs tests/n107-classes-import-parser.test.mjs tests/n107-classes-import-mutation.test.mjs tests/n12-import.test.mjs tests/n12-import-store.test.mjs tests/n104-class-operations.test.mjs tests/subject-flexibility.test.mjs tests/section-validation.test.mjs
```

Result: **39 PASS, 2 FAIL / 41 tests**. The N107 parser (4), N107 mutation (6), N107 source/route inventory (2), N12 (9), N104 (4), and section validation (10) tests all PASS. Expected injected transaction failures log errors while their rejection/partial-receipt assertions PASS.

The two supplemental `subject-flexibility.test.mjs` failures are at lines 82 and 122: `OFFLINE_LEASE_LIMITED` before subject persistence. A read-only Node loader replayed that suite with the exact base Git blob for `src/store.js`; the **same two failures** occurred (4 PASS / 2 FAIL). This is preserved as FAIL, not converted to PASS or repaired by weakening a lease. The N107 valid-account fixture exercises actual subject resolution, alias reuse, owner-bound outbox and defaults with a genuine synthetic lease.

Source/route inventory checks are **not rendered-UI evidence**. The real-browser harness has been prepared in `tests/n107-classes-import-browser.mjs` but **has not run**. No screenshots or offline-install PASS exists. Intended coverage is actual app HTTP DOM/handlers/CSS at 320/390/768/1280, RTL light/dark, fresh claimed synthetic empty/populated accounts, CSV confirmation/cancel, XLSX mapping, central Koshoof, delete-step cancellation, owner/term/archive/offline expiry and separately installed offline routes. Harness remains unvalidated until its first permitted run.

## Exact blocker and retry condition

Canonical `resource-lease.ps1 -Name browser -Action acquire`, with this canonical task file, run token and `-WaitSeconds 0`, returned the same response twice:

```text
BUSY browser; the recorded owner must finish or be factually recovered
```

Observed lease owner: task `continuous-n106-koshoof-followup-ux-identity-mapping-20261015`, token `ad277a1f-fc36-4411-99ce-7b7542f8b321`, worker PID 8472, birth `2026-10-15T17:59:30.5954960Z`, lease recorded `2026-10-15T18:02:25.3069978Z`. This worker did not alter or reap that lease. This N107 card contains `liveMutation: true` and `liveAuthorizationRef`, so the non-shared isolated-browser exception is ineligible. No browser/server was launched and no browser resource was owned or left behind.

Return **BLOCKED**, preserving this candidate/session. Retry only once the canonical browser lease is released by its owner or factually recovered by the authorized controller. Resume this worktree/session, acquire the phase lease, run and validate the prepared actual-app harness, resolve actual failures in scope, inspect rendered results, release owned resources, and return a new exact candidate. Do not repeat passed unaffected parser/store checks merely to restate contention.

Provider, integration, build metadata, Cloudflare and exact served-asset verification remain exclusively with the controller/publisher after local readiness. This record makes no Product acceptance, deployment or CLOSED claim.
