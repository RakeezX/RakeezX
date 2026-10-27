# N88 — safe offline teacher asset generation repair

AI-authored, task `n88-pwa-sw-safe-1028`, run `bc2dc652-b0cb-4e6e-8398-014eb71217be`.

Base: `9dc2acf8ce7cc070657116658a010cd0dd77adb0`, observed equal to remote main before implementation on 2026-10-27 22:35 UTC.

## Bounded change

`sw.js` changes only `rakeezx-v92` to `rakeezx-v93`. The manifest, required install assets, generation-safe cleanup, navigation fallback, private network-only exclusions, consent namespace and all N44 Push/message/click handlers remain byte-identical to base after substituting that one version string.

The initial fresh queue/process snapshot is in `tests/n88-pwa-sw-safe-20261028/ownership-before.json`. Only this SW worker and the disjoint inactive N88 contract worker were active; no N44 worker, publisher or other SW editor was active. N44's existing blocked trial and exhausted grant remain unchanged. Its recorded failure explicitly says the canonical isolated-browser helper rejects the retained exhausted liveAuthorizationRef. This task neither retries nor changes that grant/card/helper.

Read-only canonical receipts confirm previously verified immutable and production assets for N44 frontend `e2f40e680edea6a546331d4adc58f5de9fcd392c` and N88 teacher UX `3fb70a8f91bfc5dbedbf6ae4ff29e608234815d1`. These are reused historical receipts, not new delivery claims.

## Affected verification

Command: `node tests/n88-pwa-sw-safe-20261028/cache.test.mjs`.

The harness reuses the existing teacher issuance synthetic bootstrap, canonical store/owner/offline lease entry and transport ports, real router/view/handlers/CSS. Its HTTP server uses the actual complete SW/manifest without substituting a toy shell. v92 serves teacher view/CSS from the pre-urgent-UX revision `df2186a7ca2edc277f8f9d430f061df7f8c4305f`; v93 serves current source. The unchanged client is checked for exact current bytes, rather than incorrectly requiring a source difference. The existing synthetic mount seam is the only teacher view substitution; the view hash in the browser report therefore reflects that seam. CSS and client bytes are exact repository source.

Fresh disposable Chromium contexts, at 320px and 390px, install/control v92, update the real worker, await controller change, prove v92 retirement and matching v93 teacher asset contents, then exercise the actual teacher UI offline. The uncertain request remains disabled, private roster starts collapsed, guidance/settings handlers work, and there is no horizontal overflow. Private N88/N44/entry requests remain unavailable offline and absent from Cache Storage. An unrelated cache namespace and synthetic IndexedDB marker survive. No push subscription, notification send, live identity, real API, SQL/Auth or provider operation is used.

The synthetic session context is served under excluded `/api/n88/synthetic-context`, so the harness never teaches SW to cache session tokens. The report audits cached responses for the synthetic private sentinel and actual fabricated access token. Cold synthetic boot without its network-only session context must fail closed, rather than certify real account restoration.

Result and screenshots live in the same test directory. Initial harness failures are preserved separately: observing a partially created cache before controller activation; an over-strict difference assertion for an unchanged client; hash-only navigation retaining the old document; a cold-error selector mismatch; and the independent publisher temporarily holding the integration lease. None caused a Product code change or was converted into a passing historical result.

Final result: **PASS**, completed 2026-10-27 22:41 UTC. Both widths pass the complete corrected scenario, including opening all 28 synthetic roster rows before invalidating the actual owner binding, and a fresh offline document displaying the real fail-closed boot error without private roster/code DOM. Cached responses contain neither the fabricated access token nor the private response sentinel. `offline-320.png`, `offline-390.png` and `cold-offline-320.png` were visually inspected. The result records browser/server closure and release of both owned phase leases. `node --check` also passes for the worker and both harness modules; no broad build was run.

The final fresh ownership/process check (`ownership-after.json`) finds no surviving prior N44 PID/birth owner, N44/SW overlap, publisher process or held browser/integration lease. Remote main advanced to `aa8fd551c23e0692321e7742fcb053492dbf4bc7` through the independent inactive-contract delivery; its SW and the three affected teacher source files are identical to this task's base. No unchanged Product test needs repeating for that disjoint documentation/preparation movement.

## Delivery boundary

Only the sole controller/publisher may integrate, build and verify immutable/production SW and teacher asset hashes. This worker performs no push/deploy and does not close N88 or N44. The original gated N88 card remains untouched. Recheck current generation before any later execution of that card to avoid another redundant bump.
