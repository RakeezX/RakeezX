# N101 — isolated account bootstrap

Task: continuous-n101-account-switch-bootstrap-20261014
Run: 8ed6a66e-4769-4cfc-8846-e214b28cdba9
Base: 24dbfed57644dbed13ecd1b77064dff98ed7b0fe
Outcome: LOCAL_READY source candidate; publisher integration, provider/build checks and Production evidence remain unrun here.

## Change

An unrelated claimed legacy workspace excludes that database from B's boot; it no longer excludes B from owner-bound provisioning/Initial Restore. Unknown, ambiguous and malformed same-owner registrations remain closed. Boot does not mount an account until its local owner receipt agrees with its registration.

An absent deterministic account database can enter full cloud restore only with valid original same-owner registration/receipt evidence. The registry keeps that original record in recoveryEvidence; a fresh full snapshot gets its own receipt. Existing mature provisioned cloud accounts never receive a foundation-only reimport. Missing account registries can recover from a valid local immutable restore receipt, or from a local provisioning receipt matching the verified server foundation hash. Legacy claim inconsistencies remain closed; no other owner's database is used as recovery material.

Restore and provisioning keep the expected owner fixed, abort on logout/owner change, and check access at the import transaction. Initial Restore now refuses occupied local storage instead of clearing it after a preparation race. The profile submit handler also keeps its original owner. No user DB, outbox, registry or token is deleted by this fix. SW generation changes from 58 to 59; no new shell dependency path.

## Actual checks

- Original reproduction: N101_BASELINE=1 node tests/n101-browser.mjs served immutable base workspace-routing.js with the actual app, CSS, native IndexedDB and OTP/logout handlers. A logout then B login produced authenticated-account-workspace-mismatch with no A Product open. This is the original failure, not an acceptance PASS.
- node tests/n101-browser.mjs: all four functional required checks PASS on final functional source. Actual A -> B -> A logout/OTP handlers; B owner receipt and student loaded before teacher UI. B's indexedDB.open trace excludes rakeezx. The entire A database inventory equals the snapshot before B boot, including device/history/outbox; after A returns every Product store/outbox/history remains preserved (A's renewable lease/device runtime fields may renew).
- Fresh disposable account profile: full CORE_V2 restore; recovery of a missing registry preserves the exact receipt; recovery of a missing DB creates a new full restore receipt and preserves original recoveryEvidence. A missing provisioned-account DB also takes full restore. An existing valid cached account opens with its approved editable lease under simulated navigator-offline conditions.
- Fresh offline account shows connect/retry and creates no Product account DB. Synthetic HTTP503 failure retries successfully. Synthetic HTTP401 invalidation returns to login and resumes through actual OTP. Foreign canonical owner, logout/cancel during delayed restore, owner change during delayed restore, corrupt registry/receipt, and profile-owner change before submission all keep teacher UI closed. A truly new account uses the actual required-profile form; a switched profile form sends no profile-completion call.
- Native source tests: 58/58 PASS via node --test tests/workspace-routing.test.mjs tests/workspaces.test.mjs tests/initial-restore.test.mjs tests/n101-recovery.test.mjs tests/n101-provisioning.test.mjs tests/n49-runtime.test.mjs tests/sync-outbox-owner-guard.test.mjs tests/n71-domain.test.mjs tests/n98-default-order.test.mjs tests/n44-inapp.test.mjs. Covers exact 7/14-day lease boundaries, expired/wrong-owner/timeout/rollback, command and pull isolation, N71 immutable restore/deletion dependencies, N98 ordering, N44 owner/notification closure, recovery corruption/ambiguity and occupied/cancelled atomic import. N90/N100 data algorithms are unchanged.
- Shared leased browser: node tests/n101-shell.mjs PASS for actual installed v58 -> v59 controller update, old cache retirement, exact new routing source/dependencies cached, and HTTP app navigation/source available with the context truly offline. The owned browser/context/server closed and browser lease released. This shell evidence is reused after subsequent receipt/import guard hardening: sw.js, dependency paths and update/cache logic are unchanged; final functional source is separately covered above. A later attempt to refresh this unchanged shell evidence returned BUSY browser before launch; another owner's lease was preserved. No final Production/served-asset claim.
- node --check on all seven changed JS source files and git diff --check: PASS. No blanket suite or Vite build; publisher owns its deterministic build.

## Harness corrections and preserved failures

Initial UI harness attempts assumed the old sheet login and a desktop sidebar trigger at mobile width. Corrected to the current inline OTP form and visible desktop trigger. A readiness predicate followed by later DB access crossed an app reload; replaced with a bounded atomic app owner/database/receipt/data checkpoint in the same document. Synthetic database eviction now closes the prior app document before removing its own fixture, preventing its still-running Sync from recreating fixture storage. These failures were not reported as Product PASS.

The old account-provisioning.test.mjs repair fixture gave the registry an isolated IDBFactory while its DB adapter used a different global IDBFactory. Its repair case returned not_applicable because storage was genuinely absent from the supplied factory. tests/n101-provisioning.test.mjs certifies that exact repair with both adapters using the same disposable factory; PASS without weakening the production presence check. The original out-of-scope test file remains unchanged and its initial failure is retained here.

## Resources and boundary

Purely synthetic functional UI uses the canonical withIsolatedLocalBrowser helper, a fresh disposable context, a unique ephemeral loopback HTTP server, no profiles/credentials, blocked Service Workers/external requests and finally cleanup. Auth/REST transport is synthetic route fulfillment; no request reaches a real provider. Only disposable fixture B storage/registry is removed to model eviction; user storage is never attached. The separate SW phase uses the canonical shared browser lease and a fresh context. No queue/status edits, pushes, deployments, service/schema/Auth changes or real-account operations were performed.
