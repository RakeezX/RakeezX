# N36 — AI implementation: bind source school before transfer, 0.5.32

Task: `continuous-n36-0531-source-school-binding-before-transfer-20261021`

Run: `87fa9b2d-da18-439b-b928-58b190d9fdb9`

Base: `96e123e73399616d4820da421618734d60c61521`

## Observed cause and bounded repair

The immutable 0.5.31 ZIP (SHA256 `ffb5638b256928678b318311aa097f5eb8f908639efef879c57939fded5d31e8`) reproduces the actual reported failure through its serialized worker/selection/source-adapter and popup runtime over synthetic HTTP. Start is accepted with teacher-dashboard, semantic-dashboard, navigation/action/read markers **2/3/2**. A unique observed SchoolId is present, but no `.school-name` or explicit school label exists. `home` therefore omits `readProof`; `read-proof` refuses at source-pre-read with `UNCONFIRMED_TEACHER_ROLE` before the school check. Staged/observed/added rows, navigation and receiver deliveries are all zero. Separate immutable cases cover a badge with no SchoolId, and both absent: the old failure alone cannot diagnose which input is missing.

0.5.32 establishes a preliminary proof only in the complete positive teacher document with the observed validated SchoolId. Without a school name it permits bounded same-origin, read-only GET of exact observed MyInfo/MyStudents/supported report links. Metadata/menu discovery takes priority while unbound; arbitrary headings, guessed routes, identifiers, iframe content and fetched-page crawling do not provide school identity. Explicit source fields, labelled tables/definition fields or the report school column bind the name. The selected teacher-card school remains a consistency constraint and cannot alone mark the context bound.

No receiver envelope is created or delivered until school name, SchoolId and read proof are bound. Missing school evidence stops with `SCHOOL_CONTEXT_UNCONFIRMED`; conflicts stop with `SCHOOL_CONTEXT_CHANGED`. Continuation tests stage 300 rows before a later empty or conflicting school field, then refuse with zero deliveries. Every GET preserves role, source route/document and app owner/session/batch checks before, during and after the read. Live report anchors are revalidated; pagination/menu-discovered reports retain provenance from the validated inert response. Other setup reads remain unavailable while school binding is preliminary. Existing 300-row transfer limits, exact receipts, review/coverage consent, profile field guards, date adapters and receiver/store rules remain unchanged.

Safe copied diagnostics add only the fixed `schoolBindingState` enum and boolean `schoolBadgePresent`, `schoolIdPresent`, `readProofPresent`. No school name, URL, identifier, proof string or account/document identity enters those diagnostics. School refusals have specific Arabic popup explanations.

## Affected verification

Evidence directory: `tests/n36-0531-source-school-binding-20261021/`.

| Check | Actual result |
| --- | --- |
| `n36_actual_0531_full_runtime_semantic_dashboard_unbound_school_reproduction` | PASS — immutable .31 failure above, plus independently absent SchoolId cases |
| `n36_0532_source_school_binding_and_zero_transfer_negatives` | PASS — 70 actual popup/source HTTP scenarios; 27 direct reader/diagnostic cases; 25 actual app/store receiver journeys |
| `n36_0532_supported_setup_300_plus_3_receipts_package_link_diagnostics` | PASS — actual UI/IndexedDB saved receipts 300+3, selected-card/direct dashboard, explicit-field and report binding, complete/partial coverage, teacher/principal/school/class-subject/timetable, ownership and unchanged grades/years; real app link download matches prepared ZIP |
| Production publication and stable 29-file folder parity | NOT_RUN — independent controller/sole publisher owns these phases after this candidate |
| Native extension install / real Madrasati import and account save | NOT_RUN — pending PO manual .32 trial; no real portal/account access |

Commands used:

```powershell
node tests/n36-0531-source-school-binding-20261021/package.mjs --prepare
node --experimental-vm-modules tests/n36-0531-source-school-binding-20261021/browser.mjs
node --experimental-vm-modules tests/n36-0531-source-school-binding-20261021/receiver.mjs
node tests/n36-0531-source-school-binding-20261021/proof-cases.mjs
node tests/n36-0531-source-school-binding-20261021/checks.mjs
```

The browser tests reuse the canonical `withIsolatedLocalBrowser` helper, actual popup DOM/handlers/CSS, serialized source readers, actual application receiver/store and existing account fixtures. Chrome APIs and the account service are synthetic boundaries; the existing fixture substitutes only the receiver protocol origin for loopback. No personal browser, saved cookies, Service Worker, credentials, external requests or native-MV3 compatibility claim. Ports **49852/49853/49854** are task-owned; each server closes in `finally`, and the canonical helper disposes owned contexts/browser. Result JSON records server closure. This active synthetic loopback-only phase does not require the shared live-browser lease. No integration or live-mutation phase was entered.

Changed JS syntax and exact single application href/label replacement pass. Manifest permissions/hosts/CSP, historical packages, receiver/ownership/grade/Sync/store/date assets and offline shell are unchanged. Unaffected prior proofs are reused; no full Vite build or broad audit was needed. Screenshots `supported-result.png`, `partial-result.png`, `role-result.png` and `actual-download-link.png` exercise the real rendered interfaces; the completed popup and application download page were visually inspected.

One final aggregation failure is preserved in `checks.json`: a worker-added README paragraph after packaging changed its source hash. That paragraph was removed, restoring the exact original README bytes. The tested executable files, ZIP and final runtime fingerprint did not change; no UI rerun was needed for that restoration.

## Prepared delivery identity

- Versioned ZIP: `/assets/extensions/rakeez-teacher-import-helper-0.5.32.zip`
- ZIP SHA256: `600532ddac600a66f9b0bc8b6be50b4ea4a4f72352f71c95376296a7719f35b6`
- ZIP size: **143808 bytes**; manifest contains the same **29 paths**, all matching source/ZIP bytes.
- Runtime fingerprint: `3d82165b239072de1866605332574f80365a6c4f83c0ddbb82653d4085c94e94`
- Companion manifest: `/assets/extensions/rakeez-teacher-import-helper-0.5.32.manifest.json`
- Actual application download href/label points to .32 and its downloaded bytes match this ZIP on synthetic HTTP.

These are prepared local artifacts, not a public deployment claim. The controller/sole publisher must integrate and verify served Production assets, then use the existing stable updater and verify all 29 files. No push, deploy, stable install, queue/status mutation, Auth/SQL/permission change, real teacher/student mutation or Product CLOSED claim occurred. Actual school success remains pending the PO manual .32 result.
