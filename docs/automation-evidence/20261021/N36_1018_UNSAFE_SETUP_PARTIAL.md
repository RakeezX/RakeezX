# N36 optional unsafe setup recovery — AI, 21 October 2026

Task: `continuous-n36-1018-unsafe-setup-partial-20261021`

Run: `a12841fa-8aaf-4ea6-a297-bed06b462096`

Base: `0bca7554e60adca6b19ad804e4370874d9f5676b`

The PO's actual 0.5.34 observation remains distinct from all synthetic variants: 303 staged/observed students, school bound, collect stopped with `UNSAFE_SETUP_LINK`, no transfer. The actual setup kind and rejection subreason are unknown. Timing buckets do not identify either.

## Bounded implementation

Only classified optional setup rejection is recoverable. Routes, exact visible-anchor checks (including all inline handlers and non-GET controls), source document/teacher proof and receiver ownership/session/batch guards remain strict. No unsafe/unobserved setup URL is requested, no source navigation is added, and fetched response links are not followed. `base[href]` rejects the inert response before setup fields or links are read; authentication and role rejection retain priority.

A metadata rejection may be held while the roster is still being collected. It never grants transfer: the final gate additionally requires the actual report and a single explicit roster school matching the bound school, alongside existing SchoolId/readProof and app guards. Missing/conflicting school or identity drift still stops. Rejected classes are not replaced with a synthetic successful setup category. Student pagination/coverage logic, 300-row envelopes, receipt protocol, owner/data/store code, 90-second pre-row budget and 8-second GET cap are unchanged.

The actual popup/CSS displays the affected setup category as unavailable and states that student coverage comes from roster pages independently of partial setup fields. Diagnostics add only fixed `setupKind` and `setupRejectReason` enums; no URL, identifier, HTML or school/student name.

## Evidence and original failures

All runtime evidence is under `tests/n36-1018-unsafe-setup-partial-20261021/`. It uses the existing actual popup/handlers/CSS, serialized content readers, background/collector/handoff modules, actual application receiver and IndexedDB/store with a fabricated account service, over task-owned loopback HTTP and fresh isolated contexts. No real account or portal was automated.

`baseline-0534.json` verifies the immutable public 29-file ZIP SHA256 `70ed0905ed3a04ccdbb7872daf4d0fd5f56071d56ebe85af9e9db68f77f23ffd` and reproduces all four setup gates. The primary onclick fixture runs in both DOM orders; every case stops in collect with 303 staged/observed, bound school, and zero transfers. A deliberately unsupported identifier tests route-shape rejection; it is not evidence authorizing a new identifier/route shape. Route gates remain unchanged.

`candidate-classes-final.json` proves both DOM orders, all four reasons, post-GET live-anchor removal/unsafe mutation, and unchanged incomplete student-page semantics, with two 300+3 saved receipts. `candidate-timetable-final.json` proves the corresponding timetable cases. `candidate-metadata.json` proves metadata rejection before roster binding and later successful 300+3 receipts. `negative-after-final.json` and `negative-before-between.json` retain exact identity/context failures with zero transfer and unchanged synthetic stores.

Original harness failures are preserved, never relabeled PASS: initial generated source omitted a fixture return; an unsupported `/Other/` link was correctly skipped at selection; diagnostic text matching incorrectly treated the allowed `observed` counter key as sensitive; the initial clipboard assertion assumed fallback rather than a successful copy; a timetable fixture omitted the independent school/teacher proof and paused at the fixture's intentional guard hold. Corrected timetable fixtures supply explicit synthetic role/school evidence without weakening Product guards. `edge-controls-original-failure.json` records the receipt-summary serializer failure after eight actual runtime cases printed PASS; an unknown receipt legitimately has no setup details.

Later resource/startup timeouts are separately retained in their original artifacts. They do not invalidate the earlier affected proofs, prove a Product failure, or certify the timed-out scenario. After owned concurrent checks drained, serialized checks passed in `serial-critical.json`, `serial-unknown-receipt.json`, `strict-anchor-controls.json`, `safe-setup.json` and `serial-metadata.json`. The original failed results remain unchanged. The corrected summary treats absent unknown-receipt setup details as absent, without changing any acceptance assertion.

## Final local result

`checks.json` consolidates 5 immutable .34 reproductions and 51 .35 full-runtime cases. Of these, 21 fail-closed identity/school/auth/student-route cases transfer nothing. The uncertain-receipt case reports zero confirmed worker additions, preserves the actual first 300 saved records, and never sends the remaining 3; its owned job is cancelled for cleanup. Reimport produces two existing 300+3 receipts and unchanged student records. Years, scores and affected owner isolation remain protected by the actual receiver/store checks; existing receiver code is unchanged.

The serialized 640-tile/100ms-script-delay case completes with 303 saved students, 300+3 receipts and partial classes setup in **60.641 seconds**, with **480,493** style calls and a periodic pending-GET guard. No budget was increased. Unverified student pagination still produces its original partial coverage; independent complete/partial/unknown coverage checks prove setup warnings cannot change those results. The prior 0.5.34 8-second native timeout/abort evidence is reused with the timeout, cancellation, page/byte limits and receiver implementation unchanged.

The actual 430px popup warning was visually inspected. `diagnostics.json` exercises all 12 kind/reason pairs and rejects arbitrary URL/query/HTML/name values. `download.json` exercises the actual application download anchor/handler over HTTP, verifies its .35 label and native downloaded bytes, and leaves navigation unchanged.

Prepared archive: `assets/extensions/rakeez-teacher-import-helper-0.5.35.zip`, **146,711 bytes**, SHA256 **025fb2a896fb6027789575c0cd35ff4cfd9e3740b55137b81e7880a79ea71aef**. `package.json` proves exact local ZIP/source/manifest parity for the existing 29 paths and unchanged extension permission/CSP boundary and old archives. Only manifest version/README metadata changed after the runtime proof; `certified-runtime.json` binds all 27 executable/style/HTML inputs. The app link changes only its versioned href and visible version label. Affected syntax and Git whitespace checks pass; no blanket build was needed.

Every final browser/server result records owned finally cleanup. `resource-cleanup.json` independently observes zero listeners on the task's 49918–49930 ports. These loopback-only synthetic checks use the canonical isolated helper, require no global live-browser lease, block Service Workers/external requests, and never attach to a user's browser.

## Delivery boundary

No push/deploy, queue/status mutation, stable-folder update, external receiver, real school mutation, Auth/SQL/grades/Sync change or Product closure is authorized here. Production archive/link and installed 29-file stable parity belong to the independent publisher. Actual portal acceptance remains pending.
