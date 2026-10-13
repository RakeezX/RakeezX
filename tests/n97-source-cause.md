# N97 bounded diagnosis and local evidence

Task: `continuous-n97-delete-resume-sync-status-20261013`  
Run: `ab5ef306-4038-4f34-b4e3-6d59385be321`  
Base: `c672774a2033425f168d9e41fbe04086884fcd3f`

## Cause and reproduction

Before this change, `store.deleteTeaching` created `device.n77DeleteIntent` without draining an already running coordinator pass. `syncAll` checked the checkpoint only at entry. A pass already past that check could subsequently hit the IndexedDB write exclusion (`N77_DELETE_RESUME_REQUIRED`) during canonical pull. `syncAll` classified that protective local exception as a hard presentation failure. The severity object retained it until a successful complete Sync; it is in-memory state, not a persisted disk flag. N96's live-operation predicate covered only student lifecycle, and N77 did not use its exclusive-operation wrapper.

The current-application browser reproduction deliberately models the original ordering: hold an actual sections pull, persist the N77 checkpoint, release the pull, then clear only the synthetic checkpoint. The actual coordinator returns false with `sections: Resume pending N77 Delete before writing Product data`, zero failed outbox entries, `presentationSeverity.hardFailure=true`, and a red operational badge. A successful complete pull recovers it. This reproduces the reported status pattern; it does not establish that this was the exact cause on the PO's devices. No original device trace or real-account mutation was used.

Resolved conflict counts 7 (screenshot) and 27 (later details) are separate historical observations, not counts of active failures. Actual dialog tests seed each historical count independently and retain Synced after authoritative convergence without a support action.

## Correction

- Reserve class deletion before the checkpoint is created; stop scheduled work and drain the current pass. Recheck the reservation after Sync's asynchronous initial checkpoint read. Revalidate owner/context and the unchanged strict queue/scope guards before committing deletion.
- Attest only the matching live owner/context/teaching/mutation checkpoint as syncing. Unknown, foreign or orphan checkpoints remain unsafe/actionable. Independent failed/rejected/blocked work, Auth, owner and hard failures bypass the neutral live-operation presentation.
- Keep the exact server receipt, atomic cascade, outbox checks and tombstones. The N77 server protocol, online-only entry, SQL/Auth/RLS, scoring and anti-resurrection policies are unchanged.
- A delete receipt cannot certify a complete fresh pull. Mark presentation awaiting verification and schedule the existing complete Sync after exclusivity ends. Resume invalidates freshness synchronously, before awaiting any queue read, and requests a full pull. Empty-queue verification has explicit neutral copy instead of claiming Synced or reporting nonexistent changes. Wake does not clear hard failures or reset transient escalation evidence.
- A rejected class operation, including a local storage failure after its receipt, records a hard presentation failure and retains recovery evidence. Successful authoritative Sync clears presentation failure evidence using the existing context token.

## Affected checks

All browser checks navigate the actual Vite application at `http://127.0.0.1:5277`, using fresh synthetic account contexts and the existing `remote-sync-browser.mjs` transport/workspace helper. They exercise source modules, actual DOM/dialog/Sync handlers and source CSS. No real service writes, file navigation or lookalike application rendering is used.

- `npx playwright test tests/n97-delete-resume.e2e.mjs`: four PASS. Two independent device contexts drain held existing pulls before distinct-scope commits; exact mutation receipts and empty queues; local write exclusion; mutual tombstone convergence and sibling survival; no red observations; synchronous pending on persisted pageshow before fresh pull; HTTP 503 is genuinely fulfilled as a server response, remains actionable across wake, then recovers; actual failed/rejected durable outbox remains actionable; legacy-order source reproduction; actual selected-subject/final-class dialog handlers; historical counts 7/27. Evidence includes `held-device-0.png`, `held-device-1.png`, `actual-http-rejection.png` and JSON attachments in the corresponding `test-results/n97-delete-resume.e2e.mjs-*` directories. Mobile Chromium at 390px is a lifecycle/context check, not a physical iPhone/Safari certification.
- `node --test tests/n97-delete-resume.test.mjs tests/n77-delete.test.mjs tests/n96-lifecycle-presentation.test.mjs tests/n77-legacy-delete-guard.test.mjs tests/n77-restore-boundary.test.mjs`: 20 PASS. Includes owner/offline/stale/foreign receipt rejection, exact retry identity, subject/final scope, immutable reports, deletion restore boundaries and N96 independent safety predicates.
- `node --test tests/n97-storage-failure.test.mjs`: one PASS. Actual synthetic IndexedDB write transaction creation throws QuotaExceededError after a valid receipt; local teaching survives, checkpoint remains, queue stays empty and status is hard error/unsafe without live-operation attestation.
- `node --test --test-name-pattern='transient_status|fatal_visibility: hard|owner_reset' tests/n95-sync-status-severity.test.mjs`: four PASS, including the actual synthetic coordinator and wake/owner/Auth/failure cases. The historical N95 source-identity assertion for unchanged scheduling is outside this selected check because N97 intentionally changes class exclusion and resume freshness. N95/N96 remain CLOSED.
- Five changed JavaScript modules pass `node --check`; `git diff --check` passes. No blanket suite/build/Preview or live mutation was run; publisher build/provider/Production verification remains independent.

Initial browser development failures exposed fixture readiness, duplicate synthetic subject identity and Vite's module graph after source edits. The fixture now waits for settled application boot, uses distinct subject identities and the final checks ran against a freshly started server. Those failures are not reported as Product PASS evidence. Final source and affected inputs are represented by the candidate commit returned to the runner.

No Product acceptance, Production delivery or physical device certification is claimed. Browser lease and owned server processes are released before returning.
