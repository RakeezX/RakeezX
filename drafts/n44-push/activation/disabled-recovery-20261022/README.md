# INACTIVE N44 disabled-registration source repair

AI-authored, 22 October 2026. This directory is a source-only qualification package.
It is not imported by the application or service and contains no deployment entry,
sender, new approval, secret or runtime configuration.

`patch-native44.mjs` is a pure string transform accepting ONLY the exact retained
`register503-composition/edge.mjs` SHA-256 recorded by native44. It replaces one
admission expression; every other byte, including the one-snapshot composition,
transaction/COMMIT handling, hard stop and authority-wide send budget, is retained.
The transform returns source in memory. It neither writes nor imports that source.
The manifest records its resulting fingerprint. Do not regenerate a whole bundle
from current or old backend modules over this source.

The qualified change admits a fresh registration ID when all prior identities are
fully revoked with null sealed/fingerprint/binding material on the same approved
owner/workspace/device. The repository's existing owner snapshot and endpoint-claim
validation remain authoritative. An old ID still reaches the existing tombstone
rejection; an active, dead, unresolved or foreign identity cannot provide the new
exception. Matching active-ID retries retain the existing idempotence check.
The expression also rechecks unchanged approval validity at locked-snapshot
admission, since a fabricated delay demonstrated expiry after the initial check.
No expiry constant or budget is changed. Foreign workspace/device rows conservatively
deny this one-device recovery even if retired; this is not a multi-device rollout.

Run the focused reproduction from the repository root with the already-installed
Deno 2.2.12 binary (no download or installation):

```powershell
& C:/Users/Abody/AppData/Local/npm-cache/_npx/0e4e476789f8ae0f/node_modules/deno/deno.exe run --cached-only --no-config --import-map=drafts/n44-push/activation/bundle/edge/import_map.json --allow-read=drafts/n44-push/activation/register503-composition,tests/n44-register503-1019-composition-corrected.json,drafts/n44-push/activation/error-boundary-contract.json --allow-write=tests/n44-disabled-recovery-20261022/result.json tests/n44-disabled-recovery-20261022/source44.mjs
```

This exercises the original/corrected bundled backend, real AuthClient and repository
against fixed fabricated ports. Only the final service startup suffix is omitted
in memory and replaced with test exports; it is fingerprinted and never executed.
There are no net/env/run permissions, browser, credentials or service operations.
This is source logic evidence, not rendered UI or a new SQL/crypto certification.

## Later activation prerequisites (not authorized by this package)

1. The original private custodian `01a14fcd-032c-7ec0-8b0c-0e0395862c61`
   must reconcile its saved attempts, ACK cleanup and unresolved outcomes without
   transferring private custody. No journal, tombstone or consumed marker may reset.
2. Obtain explicit current owner/workspace/physical-device consent, valid bounded
   authority and resolved remaining attempt allowance. The retained hard stop is
   expired; this source patch does not renew it. A new runId cannot renew allowance.
3. Any later change to that hard stop/authority requires its own explicitly scoped
   implementation and materially affected qualification BEFORE spending a fixture.
   Do not deploy this patch expecting it to enable present-day registration.
4. The original custodian and independent publisher must use their authorized path
   to qualify/publish/read back the exact service identity before a separately
   authorized registration/send. This worker performs none of these operations.
5. Keep general delivery and cron OFF outside that exact authority. Verify a
   committed `registered` ACK before any single allowed send, distinguish provider
   acceptance from actual OS arrival, and retain ACK cleanup and unknown-outcome
   fences. No automatic replay or retired identity reactivation.

The actual hosted disabled subcause and original503 attribution remain unknown.
The last recorded live push disposition was OFF; no fresh readback was made.
N44 and its actual-device acceptance remain open/blocked independently of this
qualified local source-only result.
