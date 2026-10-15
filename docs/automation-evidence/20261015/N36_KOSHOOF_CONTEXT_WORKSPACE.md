# N36 — contextual class-scoped koshoof workspace

Task: `continuous-n36-contextual-koshoof-hub-20261015`  
Run: `4b93857e-4598-4fe3-abdd-c0e0c0d42b4e`  
Base: `67e0f71a54b5374cd1fccbb74f4b6d9666944b56`

## Result

`#/teaching/:id/koshoof`, `?import=1` and `?export=1` load a named `koshoofView` export from the existing grades module. The workspace renders only the original transfer panel, two peer navigation actions and one short introduction. It contains no gradebook matrix. The gradebook has two small links next to grade distribution and no embedded transfer panel. Hub and empty/populated roster links target the same workspace. Each applicable teaching card has one quiet, separately clickable الكشوف link, with explicit class/subject accessible naming. Existing empty-hub paste/manual actions stay in a responsive two-by-two group.

This reuses one transfer state and the original file, mapping, review, atomic-confirmation, recovery, CSV/template and Noor handlers. Account access additionally reuses `setupBinding` (authenticated session, actual Sync ownership guard, current workspace/teaching owner, archive/context and writable lease). All workspace action delegates recheck access. Invalid access discards the transfer binding; no navigation performs an apply. Mode navigation replaces the current entry, so Back reaches the initiating class/roster/gradebook/list rather than cycling modes; direct entry falls back to its known teaching. Focus moves to the selected mode and returns to a contextual entry on Back.

Advanced Madrasati content is disclosed as the existing reviewed JSON-bundle Preview, with the explicit no-save/no-direct-connection explanation. Noor remains a manual 40/60 preparation under disclosure, never a claimed direct Noor upload.

## Design rationale

Apply [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) by putting the transfer task in a dedicated class context and leaving advanced formats behind disclosure. Apply [Material contextual action guidance](https://m3.material.io/components/app-bars/) through relevant local actions and a restrained toolbar. These informed ordinary layout choices; no design dependency was introduced.

## Affected verification

Command: `node tests/n36-koshoof-context-browser.mjs`.

Machine evidence: `tests/n36-koshoof-context-browser.json`, including run/base, individual checks, source SHA-256 values and owned cleanup. Actual source app DOM, delegated event handlers, account store and CSS served over task-owned `http://127.0.0.1:49366`; canonical `withIsolatedLocalBrowser`, disposable contexts, blocked external traffic and Service Workers, no personal browser/profile or real data.

The matrix covers 320/390/768/1280, light/dark, empty/populated hub/roster, Classes and gradebook entries, both direct workspace modes, exclusive panels, template versus populated downloads, names-only versus names-and-grades review, zero and upper-cap review, retained review across mode navigation with cleared consent, keyboard mode activation, focus/Back, 44px contextual controls and page overflow. Navigation/review/cancellation leaves the full database checkpoint and outbox unchanged, with zero IDB write calls and zero service calls after synthetic preparation. Actual application denial screens cover foreign Auth, foreign teaching, archived/unknown teaching and invalid writable lease; stale roster/hub handlers are also refused.

Screenshots: `test-results/n36-koshoof-context/`. Inspected the 320px empty-hub four-action layout, 320px import, 390px dark export and 1280px import. Screenshots are local evidence; generated PNGs are not added to source control.

Offline support uses existing cached modules: router, grades, students, teachings and both styles are already in `sw.js`; the new hash route adds no fetchable module. The test asserts this shell coverage. This does not claim Service Worker/offline-cache/live Sync certification; the isolated helper intentionally blocks Service Workers.

Syntax: `node --check` for changed JS/test files. `git diff --check` passes. Direct base-versus-working comparisons confirm `readTransferMappings` through `transferExport`, all original transfer action handlers, and grade-transfer/parser/export, store and Sync ownership modules are unchanged. Reuse the unchanged scoring/atomicity/CSV/Noor/owner proofs in `tests/n90-grade-ux-standalone.json`; its old gradebook-panel routing assumptions are superseded by the focused workspace evidence, not claimed rerun.

## Delivery boundary

Local synthetic result only. No real students, portal, cloud schema/Auth/RLS, live service or Production mutation. Exact candidate commit is returned by the worker; independent controller owns integration, deterministic build, Cloudflare and immutable/Production evidence. N36's actual Madrasati extraction/save umbrella remains open.
