# N36 — 0.5.27 MyStudents settle repair → 0.5.28 (AI)

Task: `continuous-n36-0527-my-students-settle-20261021`
Run: `a54b83f0-4082-4c46-b00e-5c4bb84faf40`
Base: `ebb8aa4daf5c71f255941c9ffb71fae91c18a155`
Authority: activated N36 card and latest canonical Product row `[PO-20261021-N36-ACTUAL-0527-MY-STUDENTS]`. Local synthetic preparation only; controller/publisher owns integration and Production. No queue/status changes.

## Result and cause

**LOCAL_READY; actual school import remains unverified.** The immutable published .27 ZIP reproduced the reported sequence: Start accepted, 303 fabricated rows staged/observed, exact same-origin MyStudents path and query, completed new top document, then `TEACHER_TRANSITION_UNRESOLVED`, zero transfers. The report reader returned retryable `ROSTER_LINKS_PENDING`; the background runner used the navigation deadline for content discovery and checked that deadline before another read. Unlike the archived 0.5.23 reader, it never converted the verified missing-link timeout to `ROSTER_LINKS_UNAVAILABLE`.

0.5.28 separates the issued navigation window from a **fixed 20-second optional-read window**, established only after the exact complete/new MyStudents destination is verified. The saved destination document and original read deadline survive background realm restart. Alarms target the bounded phase deadline; even a delayed alarm crossing the former navigation deadline performs a guarded final read rather than treating missing roster links as a role transition. It never reissues navigation or guesses a route.

The unavailable result requires the original route/query/SchoolId, same bound new document, positive teacher and matching labelled selected school evidence, and current app owner/session/batch authority. Failed reads now receive post-read URL/document/app checks too. The final absent-link conversion rechecks teacher/school after the failed read. Unsupported relevant roster links stop, including when another supported link or a visible roster table is present; a missing verified-read checkpoint does not bypass the navigation deadline. No timeout exemption applies to an unissued navigation or a source that has not completed verification.

An absent optional link does not manufacture coverage. Existing independently proven terminal report pagination, zero remaining report routes and no other student warning can still establish complete coverage. Missing pagination retains partial coverage and `complete:false` in both envelopes; the finite popup explicitly warns that names may be missing. Only the 303 available rows cross the unchanged receiver in source-bound batches of **300 + 3**, with exact receipts. Review/consent, Auth, ownership guards, receiver, grades, Sync, storage and date policies are unchanged.

## Affected evidence

Artifacts are in `tests/n36-0527-my-students-settle-20261021/`.

- `browser.json`: **35 synthetic cases PASS**, real popup DOM, handlers, source readers, report fetch/parser and CSS over owned HTTP; background ESM and Chrome/transport boundary fabricated. Both supported starts pass: teacher dashboard and selected teacher-card role page. Exact immutable .27 failure remains recorded. Negatives cover different/new-again/old document, query/path/origin/login, missing/conflicting teacher/school/SchoolId, unsupported/unsafe links, unissued navigation, post-read drift and mismatched receipt totals. No uncertain command replay or transfer after denied contexts.
- `receiver.json`: **7 actual-app scenarios PASS**, using existing synthetic account/service and worker helpers with real ownership/session/batch guards, actual serialized claims/outcomes, IndexedDB and rendered UI. Complete and unproved-pagination paths save 303 unique fabricated names through two unique actions with receipts 300 + 3. Calendar, scores and owner-bound outbox are preserved. Owner/session/receiver document/missing batch/receiver route changes stop with no delivery or durable changes. Fresh ESM realm resumes the saved verified navigation; native MV3 termination is not claimed.
- Actual in-app 0.5.28 link click downloaded the expected ZIP hash without navigating. `actual-download-link.png` was visually inspected. `partial-result.png` shows the actual popup's partial warning and enabled new Start/disabled cancel; it was visually inspected. Copy diagnostics contain finite route categories/counts, no fabricated names, SchoolIds, URL or document identifier.
- `package.json`: **PASS**, 29 runtime entries with byte/size/SHA256 parity against the source manifest; exact href/version label replacement only; previous ZIPs/manifests immutable; permissions/hosts/CSP, receiver/data/route/date/popup CSS assets unchanged. Changed JS syntax and `git diff --check` pass. No full build was needed for this extension/runtime/link scope.
- `resources.json`: canonical isolated local browser finally cleanup completed; both owned servers closed in finally; subsequent TCP probes on **49738 and 49739** returned `ECONNREFUSED`. Approved local/synthetic browser exception used; no shared live-browser lease, credentials, personal profile or live source.

### Harness corrections and reused evidence

Original failed attempts remain in each JSON's `previousFailures`. The first fabricated alphabet included Arabic tatweel, causing normalized duplicate names (293 staged); Latin letter suffixes made all 303 inputs valid and unique. VM session values were corrected to serialize into the receiving realm, preserving actual protocol prototype validation rather than weakening it. The Playwright node-removal call and expected unsafe-link error were corrected to their actual API/route contract. The existing worker helper's deliberate collect guard pause must be released again after a fresh realm; that correction enabled the real transfer path. Its external sender fixture omitted the now-required top-frame `frameId:0`; the scoped caller now supplies that real Chrome boundary field. No Product guard was disabled and no real service/tool denial occurred. Missing batch correctly produces `BATCH_EXPIRED`, not the fixture's initially expected `APP_CHANGED`.

An intermediate unchanged-runtime invocation reused its five passing real-app cases while the two remaining cases ran. The final validation also rejects unsupported links beside a supported link or a visible roster table; all 35 source/popup cases and all 7 real-app scenarios were then rerun against the final bytes. Final `receiver.json.reusedChecks` is empty. Future `--remaining` reuse requires the same runtime fingerprint. Existing unchanged unknown-receipt/expiry/teacher-redirect evidence remains in `tests/n36-actual-handoff-limit-20261020/browser.json`, `tests/n36-background-no-popup-20261020/browser.json` and `tests/n36-0526-role-dashboard-redirect-20261021/browser.json`; it is not represented as newly executed.

Commands executed:

```text
node --experimental-vm-modules tests/n36-0527-my-students-settle-20261021/browser.mjs
node tests/n36-0527-my-students-settle-20261021/package.mjs --prepare
node --experimental-vm-modules tests/n36-0527-my-students-settle-20261021/receiver.mjs
node --experimental-vm-modules tests/n36-0527-my-students-settle-20261021/receiver.mjs --remaining
node tests/n36-0527-my-students-settle-20261021/checks.mjs
git diff --check
```

## Immutable candidate assets and remaining delivery

- ZIP: `assets/extensions/rakeez-teacher-import-helper-0.5.28.zip`
- SHA256: `8d2240620198941fe5fef74cb736db7b77a4183b4802541c4d8635dda82bd843`
- Bytes: **138742**, runtime entries: **29**
- Source manifest: `assets/extensions/rakeez-teacher-import-helper-0.5.28.manifest.json`
- Runtime evidence fingerprint: `780f0e007cba4a12d13af7a1319253983c5f7048265904d79a8486f502dd394c`

**NOT_RUN:** integration/push/deploy, provider/served Production ZIP and link verification, stable-folder parity/update, native Chrome reload, real Madrasati collection/import/save. The independent publisher must verify Production bytes before the existing stable updater checks all 29 files against those bytes. The later PO manual .28 diagnostic remains required. No Product CLOSED or Production success is claimed.
