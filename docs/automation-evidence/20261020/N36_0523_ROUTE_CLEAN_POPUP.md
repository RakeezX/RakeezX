# N36 0.5.24 — exact document route and compact Madrasati popup

AI-authored scoped implementation, 20 October 2026.
Task: `continuous-n36-0523-route-and-clean-madrasati-ui-20261020`.
Run: `781aae3d-3813-4267-81cd-22aa0fc1ad48`.
Base: `27ab4d2a2dabe08cef0f48a3d446598799369e7d`.

## Diagnosis and change

The actual .23 report was `HANDOFF_DOCUMENT_OR_ROUTE`, with the extension still pending. It is distinct from the earlier TTL failure. The original worker stored `tab.url` at preparation and later compared it to a new `tabs.get().url`, even though the owner/session-bound receiver accepts direct delivery in the same original document after a hash change. Those two snapshots can differ without a document/owner change. A failed external claim was returned only to the application; `n36-result` still reported pending.

The focused baseline uses the exact base worker against the real application. An accepted same-document hash transition reproduces this error and the false pending state. No fresh school read was made; the actual user's unsupplied document/hash trace is not asserted.

The candidate captures `location.href` from the original **document-targeted** receiver at accepted delivery. Claims read the current URL of that same document and require exact equality to that bound route. Repeated delivery cannot rebind the nonce. An actual post-delivery route change is denied, and a bound pre-claim failure becomes a failed result and terminal stopped background view. Unrelated wrong-document/frame/origin/tab/nonce attempts cannot poison the original handoff. The first failure code is retained. App-side claim errors report only an allowlisted code for the original unclaimed nonce; a consumed/unknown claim cannot be converted into failed/unclaimed or requeued.

The actual application's owner/Auth-session guard, original job/envelope deadlines, receipt schema, same-identity replay and unknown-outcome reconciliation remain in force. This does not allow arbitrary same-origin routes, manufacture a receipt or extend a timeout. No new startup dependency or offline shell change.

## Visible result and retained source

Manifest, title and heading are exactly **ركيز المعلم - الاستيراد من مدرستي**. The active popup/page loads only the background viewer and diagnostics. Noor, manual preview, selection, paste and CSV controls/modules are absent. Original entry snapshots are retained byte-for-byte as unlinked `archive-*` files in the extension source root, and existing manual/Noor modules and history remain unchanged. No new permission, host or CSP.

One explicit Start retains the existing background job and open tabs. The copy button is accessible and physically top-left, including after a result. Diagnostics retain only existing allowlisted aggregates plus the actual bounded job phase; route errors are copied without nonce/job IDs, names, grades or credentials. Details remain collapsed. No application import-view write or new tab.

Future Rakeez → Noor grade entry is recorded **deferred only** in the extension README. It creates no executable task or authorization.

## Affected checks

- `node --experimental-vm-modules tests/n36-0523-route-clean-popup-20261020/browser.mjs`: PASS. Exact base failure/pending reproduction; corrected hash route → actual claim → delayed pending/outcome → real profile/IndexedDB readback; same nonce replay; wrong document/frame/origin/tab/nonce; actual owner guard denial; genuine later route denial → app handler → failed worker result → actual coordinator stopped. No collection scan or popup Start matrix.
- Same isolated HTTP check inspected actual popup HTML, source CSS and ESM handlers at **445×600**, and run page at **1060×800**, in fresh contexts. No runtime errors, horizontal overflow, Noor/manual controls or module loading; top-left copy after error and completion, safe report allowlist checked. Screenshots and `browser.json` in the test directory.
- `node tests/n36-0523-route-clean-popup-20261020/package.mjs --prepare`: PASS. 29 source/history members, exact archive/member SHA256 and sizes, JS syntax, requested identity, existing package permission policy. Original .23 archive remains immutable. Archived entries equal the base bytes. Test preserves the initial fixture readiness failure separately; the corrected fixture waits for the actual application edit/busy gate before binding.
- Reuse: `.23` TTL/schema boundary evidence at `tests/n36-actual-handoff-limit-20261020/boundaries.json`; prior 303/long-job/unknown-outcome proofs in that directory's `browser.json`. No new 303 scan. `package.json` records exact unchanged reader/protocol/collector/source-roster/navigation hashes; the background runner differs only by the new failed-result branch. Owner/Auth continuity implementation is unchanged. Supported principal label **«قادة المدرسة :»**, authoritative profile policy and calendar hold are unchanged. Actual missing principal remains unproven.

## Package and delivery boundary

0.5.24 ZIP SHA256: `901858c399b04d2c229ae9cea055e83df5d89030fa29c884414380f5608dbd82` (134818 bytes).
Source package manifest: `assets/extensions/rakeez-teacher-import-helper-0.5.24.manifest.json`.
The version was bumped once, .23 → .24. Archived files use new root-level names so the existing stable updater needs no new directory or updater change. All previous installed file names remain present.

Local synthetic only. The isolated helper closes owned browser contexts/browser in finally; the task-owned loopback server closes in finally. No shared browser lease, personal profile, remote account, school automation, real mutation, provider action, queue edit, push or deployment. No actual import/MV3 installation, N36 closure or Product acceptance is claimed.

The independent controller/publisher owns integration/publication and served .24 verification. The serial download-link companion must follow both N36/N107 deliveries; `src/views/class-import-center.js` was not edited. Stable updater installation and final physical parity remain post-publication controller evidence, not local worker evidence.
