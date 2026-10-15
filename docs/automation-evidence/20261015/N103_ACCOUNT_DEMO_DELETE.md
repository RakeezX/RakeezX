# N103 account-local demo package deletion — candidate, UI phase blocked

Task: `continuous-n103-account-demo-class-delete-20261015`  
Run: `3fbbbbd3-8561-4d63-85b8-c7bc955310b5`  
Base: `9ea9bc4335b2ebab66fd8b11b99de78f9c41e9c4`

The actual Classes delete dialog now reviews the exact persisted package for account workspaces. Confirmation binds the mounted workspace object, database, lease/owner, selected teaching, class scope, full manifest and owned rows. The existing standalone demo route and N77 real-class route retain their guards. The legacy demo action uses the same two-step dialog. Success toast/repaint requires successful deletion.

Account deletion uses existing IndexedDB applyBatch with productWrite guard and synchronous transactional prepare. It verifies the manifest and rows again inside that transaction, tombstones only the recorded package-prefixed rows, and removes only that manifest entry. It does not call a service, create an outbox command, infer a cascade or use store.save's optimistic memory update. Memory is refreshed/broadcast only after commit. Missing/duplicate/foreign/changed manifests, ordinary IDs, wrong package prefixes, missing rows, shared dependencies (including nested retained reports), archived sections, closed terms and archived years fail closed. Existing owner lease and transaction lifecycle guards remain active. Pre-existing manifests carry no owner field: ownership derives from the currently mounted claimed account database and valid owner lease; any explicit foreign owner is refused.

## Actual checks

`node --test tests/n103-demo-account-delete.test.mjs tests/n77-delete.test.mjs tests/n77-legacy-delete-guard.test.mjs`: **14/14 PASS** on the changed Product source. Five N103 tests exercise actual store creation and fake IndexedDB account fixtures, exact persisted tombstones and manifest, other-package/ordinary-student/grade/outbox byte preservation, preview/cancel-equivalent zero writes, malformed ownership/IDs, stale row/manifest/scope, owner switch, shared enrollment and nested retained report, archived/closed context, atomic transaction guard failure and unchanged memory/disk, plus standalone demo success and account refusal of the standalone route. Nine existing N77 tests remain unchanged and pass. Refreshing persisted state does not resurrect the deleted package; actual new-document UI reload remains unrun.

`node --check` passed for both changed Product files and the browser harness. `git diff --check` passed.

## Concrete blocker and continuation

Browser lease acquisition returned exactly `BUSY browser; the recorded owner must finish or be factually recovered`. A subsequent read-only status still identified task `continuous-n104-account-class-roster-koshoof-liveness-20261015`, worker PID `21968`, process birth `2026-10-15T16:03:50.0703420Z`, owner token `890a048f-6666-464b-a89e-84b7fa34191c`. Its lease was not touched. No N103 browser, context or loopback server was started; no owned phase resource remains.

The card's liveMutation/liveAuthorizationRef makes the non-shared isolated helper ineligible. The prepared browser harness instead acquires/releases the canonical shared phase lease and uses existing served-demo readiness/context helpers, fresh disposable contexts, loopback-only requests and blocked Service Workers. It loads the actual index, application modules, Classes handlers and source CSS. It prepares synthetic account data using the existing N73 fixture, creates two packages through the actual Add demo button and plans cancel, stale confirmation, exact delete, current-document owner/DB reload checkpoint and archived/read-only checks at 320/390/1280. This harness is syntax-checked but **NOT RUN**, and therefore neither rendered UI nor its layout/interaction/reload assertions are claimed PASS.

After the existing owner releases the shared browser lease, resume the saved N103 session/candidate and run `node tests/n103-demo-delete-browser.mjs`. Resolve any actual failure before LOCAL_READY. No repeat of the unchanged passing Node tests is needed unless their relevant source changes. Do not publish this blocked candidate as locally certified. Production integration, immutable provider/served evidence and PO testing are NOT RUN and belong to the independent controller/publisher. No real account/data mutation, service operation, migration, push, deployment or queue/status update was performed.
