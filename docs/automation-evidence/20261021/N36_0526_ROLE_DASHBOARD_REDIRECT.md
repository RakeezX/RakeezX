# N36 — AI candidate 0.5.27, selected teacher dashboard redirect

Task: `continuous-n36-0526-role-dashboard-redirect-20261021`
Run: `8c023762-485c-47fc-a4da-55014f38ac5c`
Base: `e04c0fdb72f3d618628f70ebf292052fa513076c`

## Bounded result

The actual PO 0.5.26 report identified an issued gateway teacher-role command followed by a different-path teacher dashboard, new document and loading status, with zero staged/observed rows. No actual destination token is retained here. The former settlement rejected this destination immediately.

The runner now accepts only the exact same-origin `/SchoolManagment/Actions/Teacher/<32-hex>` shape, optional trailing slash and no query, during an issued, unexpired, already single-use role-command navigation from the selected teacher card. The opaque dashboard segment is not compared with roleTargetId or SchoolId and is not exported in diagnostics. While loading, the old binding remains and no destination reader runs. A completed new top document is then bound and the existing reader verifies positive teacher role, selected school and coherent observed SchoolId links. The original source post-read document/route guards remain; an additional receiver authority check follows the read. Exact planned destinations and the existing Schools return remain accepted. No uncertain command is replayed.

Only background navigation settlement, version metadata, release documentation and the exact download href/label change. No permissions, Auth, SQL, grades, Sync, receiver implementation or real account data changes.

## Affected checks

- `node --experimental-vm-modules tests/n36-0526-role-dashboard-redirect-20261021/browser.mjs`: **PASS, 27 scenarios**. Actual popup DOM/handlers/CSS and injected source readers over task-owned loopback HTTP; actual background ESM; synthetic Chrome API and receiver authority boundary. Fresh disposable contexts through the canonical isolated-local-browser helper; no shared browser lease required for this eligible synthetic task. The owned server and contexts close in finally.
- Immutable 0.5.26 ZIP SHA256 `401ecb8996b93526ab59e24aa8f3e502d15f4492bf0973baf28d8550675cb74e` is verified against its manifest and all baseline background modules load from that archive. It reproduces SOURCE_CONTEXT_CHANGED at source-navigation-settle with teacher-role-command → teacher-dashboard, different-path, no query, new document, loading; accepted Start and zero collected/transferred rows.
- Corrected delayed-complete dashboard succeeds; an extra wake while loading still performs no destination read and retains the old document. A fabricated dashboard ID, roleTargetId and observed SchoolId are deliberately distinct. Optional trailing slash, existing Schools return and ordinary exact read target pass.
- Negative cases: query including bare `?`, nonhex/unknown dashboard, login, foreign origin, same document, repeated/unissued/expired command, missing selected context/single-use evidence, mismatched or ambiguous school, mismatched or ambiguous SchoolId, nonteacher role, owner rejection before/after reading, post-read path/document change and initial wrong document. They stop without transport delivery or uncertain navigation replay. The unchanged diagnostic allowlist intentionally renders AMBIGUOUS_SCHOOL_CONTEXT as `unknown`; the actual runner retains the precise denial.
- Copy-safe-report is clicked on the actual popup in every denial case; copied JSON excludes fabricated route tokens, origin, school names, document IDs and arbitrary injected secrets. `source-denial.png` was visually inspected: readable RTL popup, truthful stopped-source message, no success claim.
- `node tests/n36-0526-role-dashboard-redirect-20261021/package.mjs`: **PASS**. 0.5.27 ZIP/source SHA256 and size parity for all 29 existing package entries; exact href/label replacement only; unchanged permissions/hosts/CSP; all older versioned packages immutable; unchanged receiver/source readers/route policy/store/offline shell; affected JavaScript syntax. `git diff --check`: PASS.

Raw evidence and executable checks are in the same task-specific tests directory. The browser JSON preserves earlier harness failures: an inherited hardcoded reader count (gateway uses five pre-navigation reads), an invalid attempt to mutate the already-loaded navigation instead of restoring a saved checkpoint, and an assertion expecting a code outside the existing copy allowlist. Those harness issues were corrected without relaxing Product guards. A separate byte equality probe found historical ZIP CRLF versus Git LF only (normalized source equal); the final baseline loads archive bytes directly. The original application failure remains a required expected reproduction.

## Package and remaining gates

0.5.27 ZIP SHA256: `e149e38d5e4ee5141b1d9a922742a9f5b48ccb3b0bc2299950bfc15b44429a05` (137994 bytes). The app download link names 0.5.27. Package manifest lists exact runtime hashes; older ZIPs/manifests are unchanged.

Unchanged receiver/profile/collection evidence is reused from the existing background and package checks named in package.json. This qualification is not native MV3 acceptance or a real Madrasati run. No real student/teacher data was read and no receiver data was written. The independent controller/publisher must publish and verify the exact served package/link before the existing guarded stable updater verifies all 29 files in the stable runtime folder. This worker does not update that folder, push, deploy, reload a user browser, or claim those gates passed. One later manual user diagnostic is still required to establish actual source acceptance. N36 remains open.
