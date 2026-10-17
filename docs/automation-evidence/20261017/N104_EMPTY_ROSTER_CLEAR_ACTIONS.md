# N104 empty roster clear actions — local evidence

AI implementation, 2026-10-17. Task `continuous-n104-empty-roster-clear-actions-20261017`, run `255e13e0-c992-4f29-b579-d5c9d4c7820e`. Base and observed origin/main: `aa6a1843c5102add77d61d1a3777c7916e376bb7`. Read canonical operating contract and latest N104 PO12:48 ledger note. Work stayed in this isolated worktree; no canonical dirty file reset, queue edit, push, deploy, real account read or live mutation.

Both empty Teaching hub and Students now display **لا يوجد طلاب في الفصل** and the concise three-way guidance. Their DOM order is **لصق الأسماء**, **إضافة طالب يدويًا**, **استيراد الطلاب**. Import is primary; secondary actions have calm existing surface/border tokens. Three equal columns on desktop become separate full-width rows on mobile, with matching icons and at least 44px targets. The obsolete quick hint, dangling aria-describedby and FAB are removed. Empty Students has no redundant header actions; populated Students retains one labelled entry per existing paste/manual/Koshoof capability with bounded responsive wrapping.

## Actual affected checks

`node tests/n104-empty-roster-actions-browser.mjs` — PASS, 9 cases: both empty pages and populated Students at 320/390/1280. Actual application index, DOM, delegated handlers, source CSS and existing synthetic account helpers served over task-owned `http://127.0.0.1:49134`. The real restore registry finalizer is used (ownerless registry receipt plus owner-bound device receipt), actual class access guards remain enabled. Each first click opens the existing paste-only sheet / one-person form, or the existing contextual Koshoof hub with the current owned teaching selected. Both sheets cancel; all non-device/profile/meta IndexedDB stores match the pre-click checkpoint, including students, enrollments, scores and outbox. No remote service commit; zero page errors. No public collector or official portal certification.

Canonical `withIsolatedLocalBrowser` validated active card/run/activation and owned fresh disposable contexts, blocked Service Workers and non-loopback requests, and closed its contexts/browser in finally. Task-owned server also closed in finally. This approved synthetic phase uses no shared browser lease or user profile. No running task-owned server/browser remains.

`node --check` — PASS for both changed views and browser harness. `git diff --check` — PASS. No full Vite build or blanket suite.

Guard reuse: `tests/n104-post-n36-restored-class-browser.json` retains its previous denied/recovered owner, receipt, archived/closed-term, wrong-session and expired-lease cases; not rerun. Exact normalized source comparison confirms `assertClassOperationsAccess`, `classOperationsStatus` and `assertClassImportAccess` unchanged from delivered `06e455f9e8c5ea071f6c0207383ff63e04c4fe6d`; both view action maps unchanged from this task base. The later base's independent numbering/import transaction changes are outside this UI edit and are not recertified by this report. N36 extension transport and old36 evidence reused, no broad whole-feature retest or edits to class-import-center.js.

## Corrected local failures retained

The first harness invocation failed before browser launch because Windows Node rejects a `C:/...` ESM import specifier (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); corrected to the canonical helper's relative module import. The initial UI run passed both empty pages at320 but failed the populated horizontal-overflow assertion. Adding a wrapper alone still left header actions intrinsically wide. Read-back of actual DOM geometry showed a358px actions group in a320px viewport. Scoped header flex wrapping plus a bounded two-column populated group corrected the issue; the final 9 cases pass. A final secondary-border style change was inspected and verified against the same focused scenarios. Original failures were layout/harness defects, not tool-policy denials; no security rule was altered.

## Screenshots

Visually inspected final hub/Students empty screenshots at320/390/1280 and populated toolbar screenshots (populated styles unchanged by final secondary-border edit). Separate aligned buttons, consistent icons, no overlap/FAB and no horizontal overflow. Local ignored screenshot artifacts, hashes below; machine-readable case details and source hashes are in `tests/n104-empty-roster-actions-browser.json`.

- `test-results/n104-empty-roster/320-hub.png` — SHA256 `a95d7c34424801fc2e51911104890dba964bd7571fc0ee334a41279fd26c5820`
- `test-results/n104-empty-roster/320-students.png` — SHA256 `b063769b9177143f0cab5071c6a74616be05d6357e2eb4c13ae70a71bd011774`
- `test-results/n104-empty-roster/320-populated.png` — SHA256 `88debf20d4216c0c2adeeaa82a982b25abb3ef988f3c0754ce78920f4d31894e`
- `test-results/n104-empty-roster/390-hub.png` — SHA256 `ddb18eb241f90c4c1655a7ca4e9f80d8ec8e9a594512284d3eb478945a57d01c`
- `test-results/n104-empty-roster/390-students.png` — SHA256 `3f7ad5c6ab8e4abbf2347df554dadb86ccc4e28a51902933a99e2f1b76d3ac8f`
- `test-results/n104-empty-roster/390-populated.png` — SHA256 `801ff51aa903e40681be102170e599a650e62af3b9f230bcdbfa3f754d26f02c`
- `test-results/n104-empty-roster/1280-hub.png` — SHA256 `a45b033049ef2d53e58021031f26fd609e46f6ff1379d742bd01bbf6d8654a60`
- `test-results/n104-empty-roster/1280-students.png` — SHA256 `31636e8f0bb5ced609bf91d845dcc91c32f39dad191c1297bfeab4ae5a88d04a`
- `test-results/n104-empty-roster/1280-populated.png` — SHA256 `b3ef7c8039db946ebf26894cec36995907b8c2fc35b77e39f9e7bd4f02354ed9`

Local candidate readiness only. Independent controller/publisher owns integration and provider/served Production proof. N104 remains open for actual PO acceptance; no Product CLOSED or personal-account acceptance claimed.
