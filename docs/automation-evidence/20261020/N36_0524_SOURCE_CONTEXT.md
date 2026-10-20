# N36: before-collection source context, 0.5.24 → 0.5.25

AI implementation for task `continuous-n36-0524-source-context-before-collection-20261020`, run `211464d6-8a2b-4961-b030-a572f09d0685`.

Base: `a6b3998bd5fad914082dd2269685d20d813be950`. A fresh `git fetch origin main` observed `d635e5c9a41c5ce46dafcf6eb04d17722feac0a9`; its only differences from the assigned base were two unrelated N88 ops source cards. Affected Product source matches the assigned base. Integration remains with the independent publisher.

## Actual evidence and diagnosis limits

The two supplied actual 0.5.24 reports show `SOURCE_CONTEXT_CHANGED`, stopped/error, zero staged/observed and a ready receiver. They contain no source descriptor or guard step. **The actual failing branch and actual Madrasati resolution remain unknown.** There was no portal automation/read, personal browser attachment, account mutation, provider operation or new permission. Previous HANDOFF_DOCUMENT_OR_ROUTE/TTL/303-student/profile/CSV/Noor evidence is not a proof of this fix.

The three exact 0.5.24 background-runner sites were:

| Site | Old decision | Focused reproduced condition |
| --- | --- | --- |
| source pre-read, line 31 | `tabs.url !== j.sourceURL` | Same document receives a fragment after the Start binding and before its first read; zero reads, SOURCE_CONTEXT_CHANGED. |
| source post-read, line 49 | `tabs.url !== j.sourceURL` | Fragment changes during the first reader; one read, SOURCE_CONTEXT_CHANGED. |
| navigation settle, line 90 | `tabs.url !== n.target && !redirected` | The first exact owned destination has a fragment; SOURCE_CONTEXT_CHANGED. |

Start still verifies the explicitly active tab/window, approved origin/route and one top frame. It now binds the executing document's URL and documentId together. Source pre/post guards read back the current top document and reject an unknown document before source extraction; readers remain targeted to the bound documentId. Only the fragment may differ after existing route validation; path/query values/order/case/slash are not normalized or dropped. The verified authoritative URL is retained for subsequent source fetch binding. Stale tabs metadata cannot override a bound document. A genuine path/query/document mismatch still stops the job.

During a saved, issued, deadline-bound navigation, readback must identify the exact planned destination or the existing teacher-role redirect to the exact dashboard path with no query. The new document is bound before source verification, with existing school/role/receiver guards. The prior comparison also rejected an exact role redirect returning to the original dashboard URL with a new document (`NAVIGATION_UNCONFIRMED`, a separate synthetic finding). This now requires a new document plus the exact owned role transition; an unchanged starting document is not treated as success, and no uncertain navigation/role command is replayed. No new destination or host permission was added.

## Safe diagnostic and result behavior

The existing top-left copy control now exports finite `failureStep` values `source-start`, `source-pre-read`, `source-post-read`, `source-navigation-settle`, alongside `failureJobPhase` and `startPhase`. Source errors during Start survive in the durable stopped view and on reopening. A failed new Start does not borrow an older job's failure. URLs, queries, IDs, names, document contents and context tokens are excluded. Finite source refusal codes such as SCHOOL_CONTEXT_CHANGED are now retained instead of becoming unknown. Source route/document refusal wording describes that condition instead of suggesting the user closed both tabs. No popup layout/CSS or inactive manual/Noor entry changed.

## Affected verification

- `node --experimental-vm-modules tests/n36-0524-source-context-20261020/browser.mjs`: PASS, 17 scenarios. Actual popup DOM/Start/copy handlers/CSS and injected source readers over owned loopback HTTP; actual background runner ESM in fresh VM realms, synthetic Chrome APIs and receiver transport. The canonical isolated-browser helper restricts requests to this loopback origin, blocks Service Workers and closes owned contexts/browser in finally; the task-owned HTTP server also closes in finally. No shared live-browser lease was used or required for this approved isolated phase.
- Baseline 0.5.24 fails all three fragment scenarios; 0.5.25 reaches the first necessary planned transition with one navigation, closed popup, exact new document and zero deliveries/students. Stale metadata and the exact role redirect pass. Genuine wrong document/path/query/school, receiver-owner refusal and expired job remain stopped. The owner case verifies the runner honors the transport refusal; unchanged real receiver ownership logic is reused, not recertified by that mock.
- Diagnostics from the actual rendered popup exercise all four source steps and job phases. Arbitrary URL/token-like enum input is excluded. `source-denial.png` was visually inspected at 445×324: the source refusal and top-left copy control are visible. No new screenshot matrix.
- `node tests/n36-0524-source-context-20261020/package.mjs --prepare`: PASS. 29-file 0.5.25 ZIP has exact source/file hashes/sizes; manifest permissions/hosts/CSP unchanged; the download href and label are the only import-view change; immutable 0.5.24 ZIP/manifest and unaffected receiver/collection/selection/route/date/popup assets remain unchanged. Changed JS syntax and `git diff --check` pass.

Raw results: `tests/n36-0524-source-context-20261020/browser.json` and `package.json`. Prior failures are preserved in browser.json: a missing finite SCHOOL_CONTEXT_CHANGED diagnostic (corrected), a fixture deadline injection that changed only the serialized copy instead of the running clock (corrected to advance the synthetic clock), and an intermittent fixture VM dependency-linking race (corrected by letting one root linker resolve cached module promises). These are distinct materially corrected checks, not unchanged blocker retries.

## Delivery boundary

Source-local candidate only. Publication, provider/served-asset verification, native Chrome reload, real Madrasati acceptance and stable-folder physical parity are NOT_RUN here. The independent controller/publisher owns delivery, then the existing stable updater installs after verified publication and records physical parity once. No queue/status files were changed. N36 is not CLOSED or Product accepted.
