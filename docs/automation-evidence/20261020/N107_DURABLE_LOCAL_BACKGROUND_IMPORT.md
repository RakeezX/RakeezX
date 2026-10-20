# N107 durable local import and background confirmation

Task: continuous-n107-durable-local-import-background-sync-20261020  
Run: 5853408a-7cd2-4fe9-8fd1-b8eb965afaf7  
Base: 5cb89ad317150927d7cb1148a5e2c0b7ce2a80be

The PO changed completion to durable device storage. The import now saves a separate owner/database-bound reviewed plan before displaying «حُفظ على هذا الجهاز؛ جارٍ المزامنة». It permits navigation and the next import. Cloud confirmation is a distinct status, written atomically with canonical grade receipt adoption and exact outbox removal. Browser closure can suspend execution; the next same-owner account startup resumes persisted plans.

Plans retain consumed columns, original review/maximum intent, academic context and created identities in existing owner-device IndexedDB. They contain no credentials and add no telemetry, RPC or backend schema. One origin/database Web Lock serializes background execution across tabs. Parent revisions, original review semantics, maximum receipt context, existing outbox cleanliness and owned request fences remain authoritative. Changed/deleted context becomes review-needed; an unknown grade result retains its original durable mutation ID. Existing maximum continuation is used as a serialized execution slot and its progress is copied back to the independent plan. Cancellation uses the existing receipt-aware cancellation path; unknown grade commands cannot be discarded.

## Affected verification

`node tests/n107-local-background-1522-20261020/browser.mjs` passed on actual app DOM/handlers/source CSS over task-owned loopback HTTP, fresh disposable contexts and actual owner-scoped IndexedDB, with intercepted synthetic service dependencies only:

- Two small reviewed imports save locally while creation ACK is held; navigation and another same-owner tab do not lose or overwrite plans. Required canonical maximums precede two distinct grade commands, each adopted once.
- Reload preserves the reviewed intent. A committed-but-lost grade response recovers with the same mutation ID (two attempts, one logical command).
- An injected IndexedDB plan transaction abort displays no local-success status and persists no plan.
- Workspace/owner retirement during a held grade response hides private plans, prevents grade adoption and preserves the exact outbox command.

`node tests/n107-local-background-1522-20261020/offline.mjs` passed: account startup installs the coordinator; its module and direct dependencies are included in the existing offline shell. This is an affected dependency inventory, not Service Worker/offline-cache certification.

Syntax checks passed for all six affected source files. `git diff --check` passed. Exact source SHA-256 values and finite results are in `tests/n107-local-background-1522-20261020/result.json`; rendered evidence is `local.png`.

Original failure artifacts remain: the first composition exposed an unnecessary coordinator refresh racing local teaching creation and the form-scoped status disappearing after file clearance; both were corrected. `tab-fixture-failure.json` records a harness boot/identity setup failure; the second-tab coordinator now initializes the actual modules in a same-origin document without a competing Demo app boot. The main rendered app remains the UI target.

Prior transport/owner/width-two and parser/scoring evidence is reused, not rerun. The immutable prior NO_CHANGE diagnostic and actual 18-second report remain unchanged. No hosted timing, real account success, publication or Product closure is claimed. Review-needed plans remain locally visible for safe recovery/cancellation; a changed review is never silently approved.
