# N126 — bounded F09 local Portfolio Preview integration

Task: `continuous-n126-f09-verified-portfolio-preview-20261027`
Run: `9ded171f-cbeb-43c9-a2ea-09e6aa03d204`
Base: `e67ce41bc55319b88a4628a36d9e704c64fa7fb3` (HEAD and observed local `origin/main` matched before the change).
Source: `codex/po-portfolio-design-preview-20261025`, exact commit `ef876c30b468e019d24447ddfaad7ab1879f4180`.
Authority: activated N126 card and latest canonical N126 Product Ledger row, PO 2026-10-27. N71 remains CLOSED; pending cloud scope and its actual prior tool/security denial remain excluded.

## Result

Selectively extracted only the named source blobs using `git show <exact SHA>:<path>`; no branch merge or directory copy. The route `#/reports/portfolio-preview` loads through the existing app workspace boot and shell. Added its descriptor in allowed `src/app.js`; `src/router.js`, its 39 existing entries, Reports and navbar remain unchanged. The normal parent is Reports. No live navigation link was added.

All eleven criteria and 36 editable template examples remain intact, with multiple selected witnesses, custom text, hide/restore, ordered annual FULL print, truthful recorded/template/personal provenance, local owner/year IndexedDB image blobs and one-file portable archive. Preview explicitly says this browser/year/device only, no cloud sync or unified Rakeez backup. Public share and QR remain disabled.

Reconciled against current `store.js` APIs (including `assertLeaseWritable`), `dom.js`, `repaint.js` and `report-print.js` without changing them. Ministry module and original artwork already matched both base and source, so they cause no candidate diff. SW shell includes every new JS module and CSS; existing ministry entries remain. Incremented current SW generation 87 to 88; install/fetch/notification logic remains unchanged.

Two bounded source adaptations:
- View: explicit browser/year wording; remove the linked Preview stylesheet on unmount, because its print `@page`/body rules must not leak into core Reports. Reload/re-entry loads it again.
- Local storage: retain a monotonic tombstone on whole-draft local removal. Stale revisions, including revision zero predating first save/delete, cannot resurrect text/images through save or archive restore. Only a deliberate fresh revision can replace the tombstone. Local witness deletion still removes unreferenced image blobs atomically and permits session undo.

## Actual affected checks

- **PASS — annual print/selection:** actual application over `http://127.0.0.1:54126`, canonical isolated browser helper, synthetic Demo. Selected and edited template/personal witnesses across criteria, attached photos, generated the complete ordered annual PDF, matched PDF page count to DOM page numbers and checked visible content fits above footers. Product store state remained byte-for-byte JSON-equal; sharing/QR disabled. Annual scenario rerun on final source to retain a PDF artifact.
- **PASS — local image persistence/archive:** text, criterion names/inclusion and original image restore after full reload; deleting a photo removes its stored blob. Actual UI archive download/import/explicit confirmation restores its original content in a clean separate context. Strengthened clean-context check verifies decoded image `naturalWidth=1` and **every original PNG byte** from IndexedDB after reload.
- **PASS — ownership/conflict/tombstones:** actual IndexedDB synthetic owner/year isolation, stale-tab rejection, foreign/tampered archive rejection, cancel without replacement, newer edits blocking a pending older import, witness delete/undo/final delete with image cleanup. Added transaction-level `fake-indexeddb` tombstone regression: stale revisions 0/previous rejected, stale archive apply rejected, mismatched owner read/write rejected, deliberate current-revision save succeeds.
- **PASS — current-main integration:** existing `tests/offline-route-graph.test.mjs` traverses real app/router imports and confirms every reachable module is in SW shell; all 39 existing router entries remain. Added real UI check: unsupported DEV legacy scope has no Portfolio editor; Demo entry shows Preview/browser/year labels, no navbar link, then core Reports expands its existing grade group, notification settings renders, stylesheet is removed on exit and restored on re-entry. No notification permission/device registration was requested.
- **PASS — units:** initial targeted six Portfolio test files plus current offline graph: 29/29. After adding tombstone coverage, affected local-draft and graph checks: 6/6; total unique unit/graph tests **30**. No blanket suite or Vite build.
- **PASS — rendered checks:** nine focused annual/persistence/archive/isolation scenarios, mobile image/layout scenario, and current-main entry/noninterference scenario: **11 distinct passing scenarios**. Canonical helper created disposable contexts, blocked Service Workers and non-loopback requests; no personal browser/profile/credentials or remote fixture. This is not live account, SW runtime-cache, cloud or Production certification.
- **PASS — syntax/scope:** `node --check` on app, SW and all imported JS; `git diff --check`; all changed files checked against card allowlist. New F09 runtime modules have no service/network call or Product mutation entry.

Commands: `node --test tests/portfolio-design-preview.test.mjs tests/portfolio-annual-plan.test.mjs tests/portfolio-smart-evidence.test.mjs tests/portfolio-evidence-templates.test.mjs tests/portfolio-local-draft.test.mjs tests/portfolio-local-archive.test.mjs tests/offline-route-graph.test.mjs`; final affected repeat `node --test tests/portfolio-local-draft.test.mjs tests/offline-route-graph.test.mjs`. UI uses `node node_modules/@playwright/test/cli.js test --config tests/portfolio-design-preview.config.mjs --grep <the named affected scenarios>`.

Final retained annual PDF (ignored local test output): `node_modules/.cache/portfolio-preview-e2e/n126-1793051162060/portfolio-design-preview.e-2d95d--one-ordered-printable-file/complete-annual-portfolio.pdf`; 268524 bytes; SHA-256 `491b58266b3d31bc5dbc5a6c4e4e928deecdf2dbe80601ee71853d7f5aeefdcd`. Canonical helper owns browser/context finally cleanup; Playwright owns unique-port server lifecycle. Port 54126 had no listener after completion.

## Preserved harness failures and corrections

Initial harness registration failed before UI: `worker fixture "browser" cannot depend on a test fixture "baseURL"`; attempted scope override also rejected because browser is registered worker-scoped. Corrected by a separately named test-scoped `isolatedBrowser` fixture, without changing canonical isolation policy or launching the default browser.

New entry regression initially expected `[data-workspace-gate]` in Vite DEV. Actual DOM showed existing development legacy bootstrap; source `workspace-routing.js` explicitly permits that DEV path. Corrected expectation checks the actual scope is unsupported/null and no editor exists. Its next run expected a class row visible before expanding the existing Reports `<details>`; actual DOM showed the unchanged collapsed grade group. Added the normal summary click. Corrected entry scenario passed. No Product guard was disabled, no service/tool denial was retried. Expected warnings about intentionally blocked SW registration are not SW runtime certification.

## Source blob provenance / reusable unchanged evidence

The original F09 local draft and portable backup notes at source commit document prior Playwright coverage. Reuse is limited to identical blobs below; adapted behavior has new checks above. No claim that the historical branch was an integration base or that its full cloud/service work was ported.

| Path | Source Git blob | Candidate Git blob | Disposition |
| --- | --- | --- | --- |
| `src/lib/ministry-brand.js` | `28f009f746d4bbed184ef5f132d305b546974a93` | `28f009f746d4bbed184ef5f132d305b546974a93` | identical |
| `assets/brand/ministry-of-education.png` | `950c21ffb15d8b0a6c8d8b8fd6120fb292777400` | `950c21ffb15d8b0a6c8d8b8fd6120fb292777400` | identical |
| `src/views/portfolio-design-preview.js` | `f24662673351683a3ad5c51b0a0615f54add5598` | `808738b6334dd46bbc2ee4faf781625c8fcce91c` | adapted below |
| `src/styles/portfolio-design-preview.css` | `9698785ead4b9f070b5631c25b094261b336b4f4` | `9698785ead4b9f070b5631c25b094261b336b4f4` | identical |
| `src/lib/portfolio-design-preview.js` | `f2b0ba312933a0d62b93a5731fe798cff58c9aa8` | `f2b0ba312933a0d62b93a5731fe798cff58c9aa8` | identical |
| `src/lib/portfolio-annual-plan.js` | `0ec86bb53f8b15488f8301afb45bca28e9134a1a` | `0ec86bb53f8b15488f8301afb45bca28e9134a1a` | identical |
| `src/lib/portfolio-smart-evidence.js` | `17b1decdda163d21a1cb0a382769a982b7b0f6d3` | `17b1decdda163d21a1cb0a382769a982b7b0f6d3` | identical |
| `src/lib/portfolio-evidence-templates.js` | `47d4f78b22c2968b63397752029d865d653763f1` | `47d4f78b22c2968b63397752029d865d653763f1` | identical |
| `src/lib/portfolio-local-draft.js` | `6796c592858960fb7a6ece4532602e5a0b2e4636` | `b1c1c05e849f7686ed8ae82ba56336578fc49c04` | adapted below |
| `src/lib/portfolio-local-state.js` | `1896823a2ee0ebc3823a99aa89c3a0d870276129` | `1896823a2ee0ebc3823a99aa89c3a0d870276129` | identical |
| `src/lib/portfolio-local-archive.js` | `78b782d4512a603bab803e40c53754c7d95a0efc` | `78b782d4512a603bab803e40c53754c7d95a0efc` | identical |

## Scope and delivery boundary

No changes to N44 notification modules, `src/lib/cloud.js`, `src/lib/db.js`, Product `sync-v2`, `backup-v2`, `export.js`, store, router, report-print, Supabase migrations/functions, queue, active worker/session or controller state. No SQL/Auth/RLS/Storage/provider operations, real accounts/student changes, push, deploy or public collector calls. Source-only local readiness; independent publisher owns integration/build/provider/served evidence. No claim of Production, Product acceptance, full F09 cloud completion or reopening N71.
