# N107 focus and Sync stability — local candidate

Task: continuous-n107-focus-sync-stability-20261020
Run: 69386de3-2267-43e4-a4cf-59b578806a89
Base: 10a98fcbec350030c5b72a1ea9132cab196a9ae2
Authority: activated PO20October card; local synthetic preparation only. N107 remains OPEN pending delivery/PO review.

## Proven cause and repair

The shared paint() replaced all main content on every scheduled repaint, including unchanged import controls. captureFocus only supported data-fk controls and could not preserve an open native select. The immutable base served over loopback reproduces select disconnection after repeated 40ms background updates (baseline-result.json).

The shared DOM helper now retains unchanged generated-markup regions. The application paints the topbar, lease notice and page independently; identical sidebar controls also remain connected. Page afterPaint/focus restoration runs only when the page was actually replaced, avoiding duplicate bindings and unnecessary focus calls. Generated output is recomputed on every paint; this is not a timer-based defer or a freeze of incoming data. Workspace/account/session identity, route, academic scope and lease/permission state invalidate the regions. Meaningful changed page output still replaces its region normally.

A second reproduced edge case was a class-code change handler committing the visible draft on blur without repaint. The next unrelated background paint then observed the changed value attribute and replaced the neighbouring select. The helper adopts only input default-value changes that already equal the corresponding live input value AND leave the entire generated fragment otherwise identical. Any changed structure, other attribute, permission, or differing live value takes the normal render path. No generic DOM morph or event-handler transplant was added.

No import, store, Sync coordinator, outbox, grade, owner guard, recovery, CSS, startup dependency or service code changed.

## Actual application evidence

Evidence directory: tests/n107-focus-sync-stability-20261020/.

- browser.mjs: canonical withIsolatedLocalBrowser, owned 127.0.0.1:49827 HTTP server, installed Chromium, fresh disposable contexts, actual index/app/CSS/handlers, existing served-demo and N73 owned-account fixtures. No user profile, credentials, remote requests, Service Workers or live mutation. Browser/context and server close in finally; this isolated phase needs no shared-browser lease.
- result.json: three required checks PASS. At 1100px and 390px native grade/subject selects remain connected while open through repeated updates and accept ArrowDown/Enter. Code typing preserves node identity, focus, exact text and selection. View-only updates preserve teaching/student/enrollment/item/score/outbox snapshots.
- An actual refreshSyncedState notification from a deliberately changed fabricated durable score retains the import input. A changed account header updates immediately without remounting the page. Committing a custom subject reveals its field: relevant page changes do not stay stale.
- Actual account dialog keeps focused disclosure and open details across background paints, with unchanged data/outbox; desktop/narrow screenshots inspected. No horizontal overflow in the affected narrow view.
- A persisted fabricated account also boots through the actual application entry with a test-only local transport. Actual operational summaries drive the rendered indicator: pending blue rgb(37,99,235), synced green, blocked/rejected/failed non-green. A paused full synthetic Sync emits real start/failure subscriber notifications while typing; input identity, focus and caret survive. Failure remains red. Replacing even the same owner session invalidates old controls, preserving the existing import reset boundary. Workspace deactivation removes cached import controls.
- owner-check.txt: existing Sync outbox owner guards, 7/7 PASS (foreign owner, isolated workspace, Demo, legacy paths).
- status-unit-check.txt: affected presentation severity/context tests, 3/3 PASS, including hard failures, transient timing and stale-owner callbacks.
- node --check src/app.js and src/lib/dom.js PASS.

Blue/green is the existing pending/syncing versus synced presentation, not evidence of Sync failure by itself. The candidate does not hide pending/blocked/rejected counts, change retries, manufacture success or smooth away real failure. Exact summaries/colors are in result.json; source digests bind it to the changed assets.

## Preserved failures and limits

baseline-result.json is an expected failing reproduction against the immutable base, with hashes of the actual base source served. draft-commit-regression.json preserves the genuine remaining input-blur/select defect before its fix. Other initial *failure.json records preserve harness corrections: selection identity after the user's own committed change, RTL ArrowLeft assumption, settling own-change renders, an initial deliberately failed Sync polluting severity, and an empty partial Sync not exercising reads. The final full paused Sync fixture fixes those assumptions; no guard or acceptance condition was weakened.

legacy-fixture-failures.json records two exploratory existing fixtures that failed: the old N95 coordinator fixture lacks session.user and receives AUTH_CONTEXT_CHANGED; old automatic-sync-cadence writes have no renewed authenticated lease and receive OFFLINE_LEASE_LIMITED. These test sources and the Product modules they exercise are unchanged; they are not claimed PASS. Current actual-account UI/Sync/permission proof and the focused owner/presentation checks above provide the affected verification. This is not a live cloud, offline-cache or recovery-service certification.

No build/push/deploy was performed. No queue/status file was edited. The independent publisher must integrate the candidate and verify the exact served assets src/app.js and src/lib/dom.js (including bundled equivalents) against the candidate. Local evidence is not Production delivery or PO acceptance.


## Continuation — corrected regression fixtures

Run: e9e2829b-e609-4fde-b009-c4185ef4443f.
Previous candidate preserved: cda1032b47272f4e4d4a78f3b144390774fb55da.
The adapter rejected the previous final result because it included a recorded failing check. This continuation supplies a concrete fixture correction and new passing verification; the old failure records remain unchanged.

The original legacy files are outside this card's allowed paths. Scoped regression files under tests/n107-focus-sync-stability-20261020 retain the original cadence assertions and the complete N95 coordinator/lifecycle test assertions, with original source hashes for provenance. The previously excluded historical source-comparison test remains unrelated to this change; no active assertion was removed to pass.

- authenticated-fixture.mjs installs isolated in-memory localStorage, persists a fabricated session with matching user, uses the existing test Auth hook and renews the real runtime lease API with synthetic verifier evidence. It refreshes the store's lease context after the non-notifying test Auth hook, including owner B. No Product guard is patched.
- cadence-authenticated.test.mjs asserts the missing lease rejects writes before renewal. It seeds an acknowledged owner profile in both fabricated DB and store: the intended patch/cadence test no longer accidentally exercises bootstrap from an absent persisted profile. Original two-phase Sync-ready, render, durable command and batch-save assertions remain.
- coordinator-authenticated.test.mjs retains transient failure timing, offline/online presentation, repeated failure escalation, successful recovery, Auth failure, hard failure, durable failed/rejected work, interrupted-lifecycle warning, logout/reset, owner B and mismatched-owner blocking assertions.
- authenticated-checks-initial.txt preserves the intermediate correction failures: absent canonical persisted profile legitimately triggered an authoritative repaint; owner B's test Auth hook did not refresh the runtime lease context. Both fixture causes were corrected before the final run.
- authenticated-checks.txt: all 3 regression tests PASS, zero failures. Logged synthetic transport/Auth/data-loss failures are deliberate inputs whose expected outcomes are asserted by the coordinator test.
- resume-result.json verifies exact current UI source SHA256 matches the saved actual-DOM evidence and that all Product source remains byte-for-byte unchanged from cda1032b. The required UI checks, screenshots and owner/presentation results are reused from the exact saved run; their runId is preserved. No browser/server was relaunched. Existing failure artifacts are historical evidence, not current failed acceptance checks and not overwritten to PASS.

The new candidate changes tests/evidence only on top of the preserved Product repair. It makes no Production/service/queue changes. Publisher verification of the served assets remains pending.
