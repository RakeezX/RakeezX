# N107 current background queue and compact UI

Task: continuous-n107-current-background-queue-compact-ux-20261020  
Run: 9702c98f-2efb-4e10-9c09-90c89b4b151a  
Base and observed origin/main: 07255db1b962499075bbe2602e8397945ec8df28

## Findings and change

The latest PO report is 186 ms for durable local completion of 28 names / 31 grades. This is an actual reported local-save improvement, not a cloud-confirmation measurement. No new benchmark or hosted timing was performed.

The existing automatic Sync/coordinator completed a representative pair of synthetic imports without manual drains. A second plan waiting for parent receipts was not reproduced as permanently stuck after those receipts. No scheduler/transport rewrite was made. The active UI count incorrectly included terminal confirmed and cancelled records; it now counts only unfinished plans while preserving the original durable records and receipts.

Normal success is reduced to device-save or cloud-confirmation status plus open-class/next-file actions. Background work is one collapsed section with human stage labels and class links. Review-needed/uncertain work stays visible with existing recovery and safe-stop actions. Selecting a new file clears the prior success selection. No outbox entries or plans are cleared for cosmetics.

A durable queued grade could still display an older parent-wait stage because the store device snapshot had not been refreshed. After the existing atomic plan/envelope binding, the store now reads its committed device state, rechecks the exact original context, and notifies presentation before dispatch. Command IDs, request order and receipt adoption are unchanged.

Timing copy remains optional and collapsed, labelled as diagnostic information. Advanced identity matching explains that ordinary name matching needs no Rakeez ID. Its opening state and the parent mapping section survive repaint. The new UI actions retain the existing file/account context guard; plan recovery/cancellation still use their original ownership and receipt checks.

## Focused evidence

`node tests/n107-current-queue-compact-20261020/browser.mjs` passed in fresh isolated contexts using actual application DOM, handlers, source CSS, owner-scoped IndexedDB and the installed automatic Sync/coordinator. All service responses were intercepted synthetic fixtures; no real account/service data was read or mutated.

- Two imports, each two names/four grades, persist independently across navigation and the next import. No manual Sync/drain loops are used in the scenario.
- Holding the second grade ACK leaves one active plan after the first durable receipt. Its displayed stage reflects the queued grade command; local save is not labelled cloud-confirmed.
- Both exact grade commands receive canonical maximums and durable receipts once; final scores per class are 0, 9, 9, 17. Their outbox commands are absent only after genuine fixture receipts, and both original plans remain confirmed in IndexedDB.
- Confirmed/cancelled records do not inflate active count. Review-needed work remains visible with recovery/stop controls. Owner retirement removes private plan UI.
- Actual UI inspected at 390 and 1100 px, with no horizontal overflow: `mobile.png`, `desktop.png`. The next-file action clears old success/history clutter. Advanced identity starts collapsed and opens/closes through the actual guarded handlers.

`result.json` contains the current PASS records and affected source hashes. `baseline.json` preserves the successful automatic progression before UI changes. Initial assertion/fixture timing failures are retained in separate failure artifacts. Native details reopening failed because the new actions were initially subject to an unrelated existing-destination preflight; the correction admits only the named local UI actions while retaining the owner/file guard. The harness also now waits for rendered repaint and settles synthetic startup before beginning this specific two-plan scenario.

Syntax checks for the two affected source files and `git diff --check` passed. No startup/offline dependency changed; the previous dependency proof and unchanged owner/reload/unknown-result matrix are reused. Owned browser/context/server resources were closed in finally. No push, deployment, actual cloud speed claim, or Product closure is claimed.
