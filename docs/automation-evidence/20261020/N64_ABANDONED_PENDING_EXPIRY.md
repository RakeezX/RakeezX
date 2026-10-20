# N64 — abandoned pending request presentation expiry

Task: `continuous-n64-abandoned-pending-expiry-20261020`  
Run: `e1881199-ce7a-427a-b749-51bb3149ba9d`  
Base / freshly fetched origin/main: `7a68241d47c4501b224ac237a36e9d44c4a377ea`.

Only `src/views/settings.js` changes application behavior. The current N64 ledger note and activated card authorize a 900-second request presentation lifetime based on provider `email_change_sent_at`. The existing cloud transport, owner checks, persistence, ACK/Sync, profile library and N44 code are unchanged.

## Result

Pending guidance and its profile attention are shown only while the request has a valid, nonfuture provider timestamp and is younger than 900 seconds. At the exact boundary an owned view timer repaints the existing settings feedback. Reloaded old provider metadata and return/focus also show the concise expiry notice, keeping the current email and provider metadata intact. This is **not provider cancellation or proof of metadata removal**.

A fresh accepted request resets prior success and uses its returned provider timestamp, including the view-local target fallback. Missing/invalid/future timestamps produce neutral feedback, without manufacturing a request time or an indefinitely pending label. The remaining prerequisite for dated status in that case is a valid request timestamp in the existing owner-verified provider response; no new service operation is proposed.

Request identity remains available in view memory for the existing supported verification channel. Only a fresh successful owner-bound read matching the requested email, with no provider pending email, can announce success. Expiry and failed reads cannot do so. Owner changes discard presentation state. Timer cleanup occurs on settings unmount; no new dependency or offline-shell asset is added.

## Affected evidence

- `node tests/n64-expiry-20261020/ui.mjs --baseline`: reproduced the reported defect in the actual application using the immutable baseline settings module, real source CSS/store, synthetic account fixture and HTTP. A 900001ms-old request still displayed pending after reload. Saved in `tests/n64-expiry-20261020/baseline-failure.json`.
- `node tests/n64-expiry-20261020/ui.mjs`: actual app DOM/handlers/CSS, existing `bootSettings` fixture, real cloud ownership guard, canonical isolated browser helper and task-owned loopback Vite server on port 19964. `result.json` records expiry reload, before/exact boundary, automatic timer without Auth calls, return after suspended time, failed verification, missing/invalid/future timestamps, fresh dialog request, view-local expiry, matching verified success after expiry, foreign-owner rejection and owner-switch reset. Controlled time; one fully intercepted synthetic PUT; no real request or 15-minute wait.
- `expired.png`: inspected actual mobile settings output, with existing change action, original email and concise expiry message.
- `node --check src/views/settings.js`, `node --check tests/n64-expiry-20261020/ui.mjs`, `git diff --check`: PASS.

The first harness attempt tried pausing an advancing fake clock in the past; corrected by pausing relative to its actual current clock. A subsequent harness async assertion ran before the fresh identity promise/paint settled (`harness-async-failure.log`); corrected with bounded network/paint settling. All affected scenarios subsequently passed, but the broad console assertion found pre-existing loopback `404 /api/n44/push/config` (`harness-resource-failure.log`). The final harness records and permits only this exact unrelated local endpoint; synthetic 500 identity failures are intentional. No N44 change or acceptance is claimed. Service Workers and external traffic remain blocked by the canonical helper; expected existing synthetic Sync warnings do not certify Sync.

Browser/context/server cleanup is in owned `finally` blocks and completed. No shared live browser, credentials, real account/pupil mutation, mail send, Auth configuration, SQL or provider cancellation was used. Existing unaffected ownership/cloud/Sync proofs are retained, not rerun as a blanket suite.

## Delivery boundary

Local candidate only. No push, integration, deployment, Production verification or current real-account journey is claimed. The independent controller/publisher owns those steps. N64 Product acceptance/closure is not asserted, and previous actual refusals remain binding.

Provider reference inspected read-only: [email templates](https://supabase.com/docs/guides/auth/auth-email-templates). Project-specific 900-second policy comes from the activated card's recorded official project readback, not an inferred provider default. Changelog was read; no service/client API change is introduced here.
