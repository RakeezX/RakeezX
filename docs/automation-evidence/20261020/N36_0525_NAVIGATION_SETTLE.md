# N36 — first-navigation diagnostic, 0.5.25 → 0.5.26

AI implementation: `continuous-n36-0525-navigation-settle-20261020`, run `4299270a-7965-49a2-9cda-f37715cccfff`.

Base `10a98fcbec350030c5b72a1ea9132cab196a9ae2`; fresh `git fetch origin main` observed the same full SHA. Read the activated card, canonical operating contract and latest canonical N36 row (PO-20261020-N36-0525-ACTUAL). No queue/status edits, push, publication, service/account access or personal browser control.

## Actual evidence preserved

The PO's manually activated **0.5.25** has a ready popup, Start accepted, zero staged/observed and stops with `SOURCE_CONTEXT_CHANGED`, `failurePhase=source`, `failureStep=source-navigation-settle`, `failureJobPhase=navigation`. This passed the earlier pre-read point, but does not identify the planned route or actual observed destination. The actual redirect/cause remains unknown. The earlier **0.5.24** zero-collection SOURCE_CONTEXT_CHANGED result and its diagnosis remain in `N36_0524_SOURCE_CONTEXT.md`; receiver/owner/303-student/profile/Sync evidence remains unchanged and is not claimed as proof of current official-source success.

## First issued navigation and bounded result

`readAutomaticTeacherPage('home')` returns visible verified links. `consumePage` queues them, holding gateway school metadata until the selected teacher-card transition settles. `readNext` rechecks the source and receiver, validates the next route, uses the bound report fetch for exact student-report routes, and otherwise checkpoints one navigation with its from URL/document, target, kind, issued flag and deadline before `tabs.update`. The next wake enters `settleNavigation`. There is no new navigation or uncertain command replay in this change.

Settle accepts the exact validated target, or the existing exact selected teacher-role command redirect to `/Dashboards/Schools` (optional trailing slash, no query). It then binds the destination document and runs the existing actual reader/school/teacher checks. The source/report/route policies and all accepted destinations remain unchanged. Nothing in the actual report proves an additional legitimate redirect, so **no alternate redirect was added**.

A separate synthetic gap was demonstrated: 0.5.25 accepted the exact planned route when the Chrome boundary still reported the old documentId. 0.5.26 rejects that condition with SOURCE_BINDING_CHANGED before reading destination data. The existing selected role return requires a new document too; an old dashboard document is NAVIGATION_UNCONFIRMED. This safeguard is not presented as the cause or solution of the PO's actual mismatch.

## Private finite diagnostic

During the owned, issued, deadline-bound settle readback, the existing stopped aggregate can now retain seven finite fields:

- `navigationPlannedKind`: home/role/gateway/metadata/classes/students/timetable, or unknown.
- `navigationPlannedRoute` and `navigationObservedRoute`: fixed categories schools-gateway, teacher-role-command, teacher-dashboard, my-students, teacher-schedule, student-report, teacher-report, login-or-auth, other-path, other-origin or invalid.
- `navigationRelation`: exact-route, different-path, different-query, different-origin or invalid.
- `navigationQuery`: none/present/unknown; never a key or value.
- `navigationDocument`: same/new/missing; never a document identifier.
- `navigationStatus`: loading/complete/unknown.

The route classifier is diagnostic only, never an authorization check. Its categories do not certify teacher access or school identity. The durable view contains only those categories; the popup's existing copy control revalidates every field against fixed enums. No full URL, path segment, origin, query key/value, name, school/account token, documentId, contents, stack or free text is added to the report. Initial/new Start resets these fields; successful settle removes them. ROLE_SWITCH_REPEATED is retained as a finite refusal code instead of unknown. Copy remains the only collection mechanism: no automatic transmission, new UI collection step, permission, persistent storage or receiver write.

## Affected checks

`node --experimental-vm-modules tests/n36-0525-navigation-settle-20261020/browser.mjs` — **PASS, 16 scenarios**. Uses actual popup DOM, Start/reopen/copy handlers and source CSS plus actual injected source readers over `http://127.0.0.1:49636`. Actual background-runner ESM runs in fresh VM realms; Chrome APIs, document descriptors and receiver boundary are synthetic. It does not certify native MV3 or real portal/receiver ownership.

- `n36_0525_first_navigation_exact_route_and_document`: exact first destination and existing teacher-role gateway return reach verified new-document checkpoints. Both base and candidate reproduce the PO's rejection class using a changed query at first settle; candidate additionally copies planned metadata/teacher-report versus observed teacher-report/different-query/new. Base accepts the fabricated old document at an exact target; candidate refuses it. Popup can close during navigation and reopen with the stopped diagnostic.
- `n36_0525_genuine_wrong_source_school_owner_still_denied`: unknown path, unknown query key, login, foreign origin, old document, old role-return document, changed school, repeated role command, initial wrong document and receiver-owner refusal at Start/settle remain denied. The repeated command is never issued. First-route mismatches have zero staged/observed, exactly one navigation, no destination reader and no delivery; no uncertain replay. Changed school is refused by the actual reader. Owner tests prove honoring the synthetic transport refusal; unchanged real receiver guards reuse prior evidence.
- Safe-copy checks reject arbitrary token/URL-like values, omit loopback origin, names, IDs and private fixture markers. `source-denial.png` was visually inspected at 445×324; stopped source wording and existing top-left copy control remain readable.

`node tests/n36-0525-navigation-settle-20261020/package.mjs --prepare` — **PASS**, `n36_0526_diagnostics_package_and_link_exact`. Exactly 29 runtime entries match working source SHA256/bytes, with no extra ZIP files. Manifest permissions/hosts/CSP match base, with only 0.5.25 → 0.5.26 version changed. The application view differs only in its download href/version label. Immutable 0.5.25 ZIP/manifest and unchanged receiver/store/Sync/source reader/collector/route/popup/date assets are preserved. Changed JS syntax passes. `git diff --check` passes.

Archive: `rakeez-teacher-import-helper-0.5.26.zip`, 137329 bytes, SHA256 `401ecb8996b93526ab59e24aa8f3e502d15f4492bf0973baf28d8550675cb74e`.

The original package comparison failure is retained in `package-failure.json`: LF Git content was compared to Windows CRLF working content. The corrected content assertion normalizes line endings only; ZIP/source hash and byte comparisons remain exact. Runtime files use the checkout's CRLF convention. No failed Product gate was relabeled.

The canonical isolated-browser helper verified this active synthetic card/run, allowed only the owned loopback origin, blocked Service Workers/external requests, and closed its fresh owned contexts/browser in finally. The task server closed in finally; a subsequent port-specific check found no listener on 49636. This approved isolated phase needs no shared live-browser lease. No unrelated processes/resources were touched.

## Remaining uncertainty and delivery boundary

Useful diagnostic candidate is locally qualified. **Actual observed destination/cause and real-source success remain unproved.** After independent publisher verification and the existing stable updater's exact parity step, one updated user report through the existing safe-copy control is needed before considering an additional exact legitimate redirect. Do not guess a bypass or programmatically inspect the user's school browser.

Provider/served asset verification, Production, stable-folder parity, Chrome reload and real-source acceptance are **NOT_RUN** by this worker. The controller/publisher owns delivery; the existing stable updater follows verified publication. N36 remains open; no Product acceptance or closure is claimed.
