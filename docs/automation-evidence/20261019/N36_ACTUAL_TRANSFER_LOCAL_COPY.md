# N36 actual-transfer follow-up — scoped candidate, blocked updater

Task: `continuous-n36-actual-transfer-local-update-copy-20261019`
Run: `fe5829e6-1f04-4655-a82a-ca7cedcf3934`
Base / observed origin/main: `df8e49362e79b488bcf56fbdca5c94e361bead7a`

## Original evidence retained

The PO's actual official 0.5.12 result remains: 303 valid/staged/observed names, 10 classes, 7 processed pages, current page 7, excluded 0, coverage partial, terminal unproven, endpoint none, hasNext false, disabledNext false, transfer error, receipt not available, errors empty. No school recollection, personal browser/profile access, real account writes or original-cause claim occurred here. The recorded diagnostics do not identify which swallowed exception caused that actual failure. The induced APP_CHANGED fixture below is a boundary regression, not evidence that APP_CHANGED caused the PO's attempt.

## Candidate 0.5.13

- Preserve a finite safe transport rejection code instead of collapsing all worker failures into HANDOFF_UNAVAILABLE. The receiver also retains finite safe claim failures. No source text, names or raw exception messages enter diagnostics.
- A rejected first send previously left the run saying it was importing, with no receipt and no automatic completion. It now stops repeated destination attempts, retains every unsent class/cursor, displays an actionable failure and offers one explicit resume. Only a valid existing receipt advances a cursor; no ownership, document, expiry or canonical-save guard was weakened.
- Automatic Madrasati runs no longer show the selected class's “28 names to review”, per-class transfer/review controls or a manual-confirmation help paragraph. Partial-source copy remains truthful after all available names are saved. Completion erases transient names while retaining safe totals and stage diagnostics. Noor's separate reviewed path remains reviewed.
- Manifest, genuine deterministic ZIP, package manifest and website download all advance to 0.5.13. The official 0.5.12 artifacts and extraction/coverage engines remain byte-identical to the base.

## Affected checks

1. `node --test tests/n36-review-1400-guards.mjs`: 3/3 PASS. Actual encrypted MV3 worker, exact tab/document/runner restrictions, expiry/one-use receipt/cancellation and explicit APP_CHANGED rejection; unchanged extraction evidence reused.
2. `node tests/n36-review-1400-copy.mjs`: PASS, actual popup HTML, ESM handlers and CSS over owned loopback HTTP using the canonical isolated browser helper. Fabricated 303 names / 10 classes / partial coverage: induced destination rejection attempts once, retains unsent rows, exposes safe actionable failure without PII or per-class review; explicit resume sends exactly 303 rows, valid fabricated ACKs alone advance progress, partial coverage and totals survive completion. This test does not certify account writes.
3. `node tests/n36-review-1400-transfer.mjs`: PASS after the shared browser lease became free. Installed genuine MV3 extension and actual application DOM/store/ownership guards/CSS, fresh disposable profile, intercepted synthetic HTTPS resources only. One popup Start, two minimal fabricated parser pages/classes with an unproven terminal, same already-open authenticated synthetic receiver, two durable local receipts, one existing ID retained and one new roster name. No per-class/review/save clicks, no extra application tab, grades/history unchanged, no external requests/page errors. Original BUSY acquisition is retained in the JSON; the successful phase released its own lease and closed its server/browser/profile. Prior unchanged duplicate/owner-switch/TTL/pending-resume proofs in `tests/n36-1019-one-start-browser.json` remain valid; no live proof was repeated.
4. `node tests/n36-review-1400-package.mjs --prepare` and subsequent read-only verification: PASS for exact 25 ZIP/source/hash/size entries, protocol parity, changed JS syntax, immutable 0.5.12, unchanged extraction engines and matching 0.5.13 website link. ZIP SHA256: `ba5ffe486fa3b2e7511cde81017355352f486cd5056e254fd1d1dc9bfb78324c`.
5. Rendered screenshots inspected: `tests/fixtures/n36-review-1400/{failure,saved-partial,receiver,runner}.png`. Receiver checked at 390px; no horizontal overflow. `git diff --check`: PASS.

The new synthetic proofs establish the bounded failure-handling/copy result and a working partial handoff, not the previously unclassified real failure's cause, actual personal-account success, Production delivery or Product acceptance.

## Concrete updater blocker and saved continuation

The existing scheduled task `RAKEEZ-N36-Verified-Local-Update` is Ready, cadence PT1M. Its observed action is Windows wscript → `scripts/ops-supervisor-v4/n36-stable-sync-hidden.vbs` → `scripts/ops-supervisor-v4/n36-stable-sync.mjs --once` → `artifacts/private-tools/n36-current/update-stable.mjs`.

Running that exact existing helper in verification-only mode for the already-published 0.5.12 failed with:

`N36_STABLE_UPDATE: permissions/CSP changed`

Its line 47 still requires `!extensionManifest.host_permissions`. Official 0.5.12 and this 0.5.13 candidate correctly have only `host_permissions: ["https://rakeezx.com/*"]`, required to bind the already-open receiver. The fixed no-host predicate therefore rejects the approved manifest. The unchanged minute wrapper suppresses this specific stderr into UPDATE_FAILED_PRESERVED.

During this worker, a separately written install receipt appeared at 2026-10-19T11:09:43.733Z, advancing the stable folder from 0.5.11 to 0.5.12, published SHA `af329b88ee47533e0d2b110af3488897833a6a83`, backup recorded, chromeReloaded false. This worker did not perform or claim that update. Read-only verification confirmed all 25 local files match both STABLE_CURRENT and the official immutable 0.5.12 package. AUTO_SYNC_HEALTH subsequently reports ALREADY_CURRENT 0.5.12; that short-circuit does not exercise or repair the stale helper guard for the next release.

Necessary missing mutation scope: **`C:/Users/Abody/Projects/RakeezX/artifacts/private-tools/n36-current/update-stable.mjs`**, specifically its manifest/permission guard. This absolute private helper path is outside this card's allowedPaths. No ops, private helper, scheduler, queue, ledger, maintenance lock or STOP was edited. No bypass, alternate installer, browser reload or extension reinstall was attempted.

Retry condition: the approved maintenance path may correct the inactive card/helper under its required idle guards, preserving this session/candidate and original evidence. Compare the manifest against the exact approved app-only host grant (and legacy no-host package where applicable), retaining all existing immutable Git/provider/public-package binding, no-school-host/content-script, backup/drift/rollback and manifest-last checks. Then resume this saved task for the affected updater verification. Only the independent publisher may publish the candidate; only after that verified publication may the existing updater reconcile 0.5.13 and read back the stable folder. Do not install an unpublished candidate or create a scheduler. Official 0.5.13 publication/current-folder match remains NOT_RUN, not PASS.
