# N36 — first-party bundle preview and reviewed local plan

- Task: `continuous-n36-rakeez-bundle-receiver-20261014`
- Run: `a4aaa3d0-0802-4be0-acc8-ed3373a03ae0`
- Base: `5cbc527bbac62a0ac334091fe7de35e8d7aa5a6d`
- Worktree: `C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n36-rakeez-bundle-receiver-20261014`

## Delivered local scope

The account settings “البيانات والمساعدة” group opens **استيراد بيانات مدرستي** using the existing settings action and sheet lifecycle. The receiver is dynamically imported only on that action. It accepts the existing version 1 JSON file or pasted JSON, shows all six teacher/school/principal/classes/students/timetable categories, permits field edits and category exclusion, and shows current versus proposed values. The source controls collapse after a successful parse; the sheet retains its height and review scroll offset. Existing names-only import and grade-transfer flows are untouched.

The teacher explicitly selects an existing active year/term and unique current class/subject identities. Timetable references require an existing unique teaching assignment. Missing values, times, periods and mappings remain unresolved; no new classes, subjects or times are invented. Existing student names are manual-review hints, never definitive identity or an automatic addition. Duplicate current class labels are unavailable as mapping targets. Time edits use the approved central adapter and were exercised through its actual mounted picker.

Confirmation creates an in-memory reviewed plan; an additional explicit button downloads it. Both copy and export say it has **not been applied**. The plan includes source/plan versions, actual owner/workspace/lease-generation binding, selected year/term, a SHA-256 of the guarded current state and allowlisted reviewed proposals/references. It contains no Auth token, source URL, or private current-value snapshot. It is a local review artifact, not a bearer credential or apply authorization. There is no Product write, Outbox enqueue, import service call or automatic transfer.

Current values are read after actual account readiness, authenticated owner guard and current offline lease checks. Deactivation, navigation, changed owner, invalid lease or stale current state erases/closes the receiver. Actions recheck the full state binding, including after asynchronous file reads and hashing. Store/Auth subscriptions watch changes; a bounded lightweight owner/lease timer also catches expiry without repeatedly cloning a whole roster. Cleanup removes owned listeners/timer and discards bundle/plan.

## Schema source

Read-only canonical source: `.worktrees/continuous-n36-private-browser-package-20261013/extensions/rakeez-teacher-import-helper/categories.js`.

SHA-256: `d3be1185177b1044a77fdd38bf8147b91aeaa01efce62c04a70b5bbf994bc82a`.

The initial source-only equivalence check passed by feeding the fixture through that module's `bundle()` and comparing the consumer result with the recorded fixture. Extension tests and official browser-page access were not repeated. The permanent test uses the recorded fixture so normal repository tests do not depend on a sibling private worktree.

The consumer enforces the exact schema/version/category/provenance/field allowlists; 100000 UTF-8 bytes, 300 rows/category and 600 total rows; single teacher/school/principal records; conservative text/name/time grammars; and duplicate row/slot rejection. Prototype keys, unknown fields (including phone, nationalID, tokens and sourceURL), unsupported versions, markup and invalid values are rejected. Missing allowlisted fields can be reviewed but block plan creation until explicitly resolved or the category is excluded. Rendering uses the existing escaped `html` helper; no evaluation, arbitrary-page listener or raw payload HTML insertion exists.

## Actual affected checks

Commands:

- `node --test tests/n36-receiver-limits.test.mjs` — **3/3 PASS**.
- `node tests/n36-receiver-browser.mjs` — **9/9 affected browser results PASS**.
- `node --check` on the receiver library/view, settings and `sw.js` — **PASS**.
- `git diff --check` — **PASS**.

| Required check | Actual evidence |
| --- | --- |
| `n36_real_account_bundle_preview` | Actual application HTTP DOM/handlers/source CSS in fresh synthetic **account** contexts at 390 and 1280. Reused account preparation and served-Demo readiness helpers; actual claimed workspace, IndexedDB, owner guard and lease. Version 1 native file, six groups, current/proposed text, field edits, exclusion, explicit mappings and downloaded owner-bound plan. Stable sheet height and no horizontal overflow. All IndexedDB stores, including device/profile/student/score/timetable/Outbox, equal the before checkpoint. Service-call count unchanged. |
| `n36_owner_switch_cancel_no_mutation` | Cancel and app navigation remove receiver. Actual A→B Auth mismatch closes it and blocks reopening another owner's current workspace. Invalidated actual lease closes it. Current-state change closes on the next guarded action. All DB/Outbox snapshots unchanged. Actual current markup-like fixture text renders literally with zero injected image nodes/execution. |
| `n36_validated_plan_and_source_limits` | Actual paste/file UI rejects unexpected fields, prototype keys, duplicate rows and oversized files. Missing time/period blocks plan, then explicit approved adapter/period edits resolve them. Duplicate current class names cannot be mapped. Unit cases additionally cover unknown versions/provenance, private fields, names/markup, role/category/slot ambiguity, byte/row/total limits and empty selection. Downloaded plan remains `applied:false`, with version, actual owner, year/term, state digest and review-only student-match marker. |
| `n36_receiver_offline_shell` | Actual installed application SW (`rakeezx-v62`) caches the receiver library/view/CSS **before its first interaction**. Fresh synthetic account context then goes offline; settings → first receiver open → parse → map → reviewed plan works with actual source CSS. No additional service call or DB/Outbox change. |

Raw bounded artifacts are in `test-results/n36-receiver/evidence.json`, with viewport screenshots `review-390.png`, `review-1280.png`, `category-390.png`, `category-1280.png` and `offline-first-preview.png`. Final run reports zero external requests and zero page exceptions. Browser phase used the canonical shared `browser` lease because it includes actual Service Worker installation/offline checks; `ACQUIRED browser` and ownership-matched `RELEASED browser` were observed. Fresh nonpersistent contexts were closed, owned browser terminated normally and owned ephemeral-port HTTP server closed in `finally`. No user browser/profile or unknown process was touched.

### Preserved harness failure

During the added stale-state scenario, `locator.uncheck: Timeout 12000ms exceeded` occurred at `[data-import-category="teacher"]` **after** its click handler correctly removed the receiver. Playwright's uncheck postcondition was waiting on the removed control. The harness now uses a normal actual click followed by a detached-receiver assertion. No guard or acceptance condition was removed. The corrected full affected scenario passed; the original failure is retained here rather than described as an application PASS.

## Delivery and remaining Product gates

Observed `origin/main` advanced during work to `19242ac34b26b0fba08dc301c92650d02389ebef` (scoped ops N90 reconciliation). `git diff HEAD origin/main -- src/views/settings.js sw.js` was empty: no affected settings/SW movement. The supplied actual candidate base remains the SHA above. Candidate files are limited to the activated paths. No queue/status file, extension worktree, store/cloud/sync/app/grade file, SQL, Auth, migration or service function was modified.

**N36 full account apply: OPEN / NOT_RUN. Official teacher-page DOM/private extension trial: OPEN / NOT_RUN.** This candidate implements only the useful first-party preview/plan layer. No live account or school data was accessed. It does not close N36 or certify its separate apply service. Production/integration/provider verification and PO acceptance were not performed; they belong to the independent controller/publisher. No push or deployment was attempted.
