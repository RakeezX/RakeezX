# N44 mounted settings context recovery — AI implementation

Task `continuous-n44-settings-context-recovery-20261026`, run `22edd3b9-a0c5-4a41-9961-000efc3c2b31`.
Base/current observed `origin/main`: `d33580a267a532e50b508eefed597b07674104b4`.

## Reproduced failure and repair

`tests/n44-settings-context-recovery-20261026/red.json` and `red-empty.png` preserve the actual baseline FAIL. The mounted Product view used real store, cloud, ownership guard, runtime, renderRegions and source CSS over an owned HTTP loopback origin. After its initial synthetic disabled-configuration observation, the same document temporarily set store readiness false, invalidated the actual runtime, dispatched the mounted validation callback through a storage event, then restored readiness to the same workspace/session. Private children disappeared synchronously; after settling, Support/buttons were still 0, paint count remained 1 and configuration request count remained 1. This proves this local blank-state path; it does not prove it was the sole cause of the original published observation.

The historical qualification host named in the card was absent at its exact path. The new small qualification host imports the current Product view and existing `tests/n44-fixture.mjs` arrangement. It supplies no alternate settings markup or callback implementation. The main readiness/reset proof uses `createPushRuntime`, not the manual outcome port.

The view now requests one deferred recovery through the existing repaint bridge after privacy clearing. Its per-mount active closure, canceled timer, root identity and connected-root checks fence obsolete work. Cleanup/unmount disables old callbacks. No immediate paint can restore the pre-deactivation owner while store is still changing. A private recovery revision changes generated markup after clearing, because `renderRegions` otherwise skips identical generated HTML even when live DOM was emptied. Null scope compares against the DOM's empty string. Stable notifications do not request paints; only removed outcomes or cleared/stale settings do.

## Affected checks

Command: `node tests/n44-settings-context-recovery-20261026/check.mjs`.
Canonical `withIsolatedLocalBrowser`: fresh owned context, task identity checked, dynamic unique loopback port, external requests blocked, Service Workers blocked; owned browser/context and server closed in finally. No shared live-browser lease is required for this isolated phase.

- `n44_settings_actual_empty_mount_red_green`: PASS. Same-owner readiness reset recovers Support=1/buttons=15 with one deferred repaint, no reload and no added configuration request. Explicit actual-runtime rebind before the timer also recovers identical final markup.
- `n44_settings_privacy_deferred_recovery_and_unmount_fences`: PASS. Actual store deactivation immediately removes old identity; unavailable text settles; only B's context returns; logout is safe; stable no-context, same-owner storage, real cloud subscription notifications and store refresh notifications settle without paints/IO. Queued recovery cannot paint another route after unmount.
- `n44_settings_recovery_no_automatic_io_and_actual_layout`: PASS. Actual generated view/source CSS inspected at 320 dark and 390 light: no horizontal overflow, one initially collapsed Support, keyboard disclosure and Stop focus ring. Screenshots show expanded Support for inspection. A separately labeled view-only runtime port exercises delegated manual read/Stop handlers: no automatic reads or Stop calls, pending read disabled, Stop/owner/unmount reject late outcomes. No native engine or service fixture was installed for these view-only checks.
- Syntax: `node --check src/views/notification-settings.js`, `node --check tests/n44-settings-context-recovery-20261026/host.mjs`, `node --check tests/n44-settings-context-recovery-20261026/check.mjs`; `git diff --check`.

`green.json` records normalized source hashes and actual final results. `harness-async-bursts-failure.json` preserves an intermediate harness failure: its one-paint bound incorrectly combined a cloud burst and an asynchronous IndexedDB completion. These are separate scheduling turns. Final implementation further avoids any stable-notification repaint, and the final check requires exactly zero paints and zero requests for those notifications.

## Boundaries and continuation

Only notification-settings recovery behavior changed. Owner/context privacy clearing, manual permission/Stop/outcome handlers, pending/finite-result/epoch guards and public copy/layout remain. No router, store, runtime, cloud, service, Auth/schema, SW or native source changed. No account/provider operations, registrations, sends, source mutations, native uploads, pushes or deployment occurred. Synthetic fixture changes are disposable local browser data only.

Real Push, original native packet `9e8732`, native 19-case proof and original device trial: NOT_RUN / unchanged. N44 OS arrival remains NOT_PROVEN. Original private custodian and sole publisher retain their phases; the publisher must build/publish and verify the actually served settings view before original trial continuation. This source candidate is LOCAL_READY, not Product acceptance or Production evidence.
