# N118 — Compact compatible class routes

Task: `continuous-n118-compact-compatible-class-routes-20261019`  
Run: `7b8859f6-1667-4799-8683-04bb43933be7`  
Base / observed origin/main at start: `b725e9b309ca81195580d11180407a9fd2122002`

The reported long URL is the natural teaching identity (section, subject, year and term), not an error. The router now accepts a lossless shorter spelling of its recognized canonical format, for example:

- Existing: `/teaching/tch:sec:12345678-1234-4234-8234-123456789abc|sub:digital-skills|tm:y:1448-1449:1`
- Shorter: `/teaching/~12345678123442348234123456789abc.digital-skills.1448-1449.1`

This reduces the example teaching path from 90 to 70 characters (same reduction with `/quicklog`). It removes repeated structural labels and UUID separators. It is not encryption or an access control. The exact original identity is reconstructed before a teaching view receives params. No lookup registry, new stored ID, migration, owner inference, data write, renumbering or changed term policy is involved. Unknown formats, including newer `tch:<uuid>` generations and Demo identities, retain their existing identity. The compact syntax is restricted to the recognized lowercase UUID/subject/year/term format.

Class cards, teaching-hub links and its switcher generate compact links; router `go()` also accepts and shortens recognized legacy teaching paths, retaining the suffix and query. Raw and percent-encoded old links remain accepted; old anchors elsewhere remain usable. Existing browser and app navigation metadata and the same teaching views/access guards are used. The codec is inline in the existing cached router, so no new startup dependency or offline-shell path is introduced. `sw.js` already includes `src/router.js`.

## Affected verification

Command: `$env:N118_RUN_ID='7b8859f6-1667-4799-8683-04bb43933be7'; node tests/n118-1019-compact-routes.mjs`

Final exit code: **0**. Structured results: `tests/n118-1019-compact-routes.json`.

- Lossless identity and compatibility assertions: PASS. Raw/encoded legacy and compact paths resolve the same ID and session/date query. Different year, term and subject remain distinct. Unknown IDs round-trip.
- `n118_compact_route_same_owner_context_legacy_links_preserved`: PASS. Actual app DOM, handlers and source CSS over a task-owned loopback HTTP server, fresh isolated mobile Chromium context. Existing served-Demo readiness helper plus the existing N36/N73 synthetic account setup exercise the real account store/provisioning resolver/access guard. Class card → hub → Quicklog, native Back/Forward, app Back, old aliases, compact links, switcher and `go()` → Students pass. Persisted product stores (including grades, history, tombstones and outbox; device presentation preferences excluded) compare unchanged before/after navigation.
- Foreign-owner negative: PASS. In-memory synthetic section owner conflict at the current Students route produces the actual ownership denial and removes add controls. Persisted stores remain unchanged.
- JavaScript syntax for the three changed source files and the test harness: PASS. `git diff --check`: PASS.

The canonical `withIsolatedLocalBrowser` validates the running task/run and owns its fresh contexts; no shared live-browser lease is required for this approved synthetic phase. The test owns an ephemeral loopback-only port; its server closes in `finally`, and the canonical helper closes owned contexts/browser in `finally`. No user browser, remote service, live credential or live mutation is used. No build or unrelated test suite was run.

## Preserved harness failures

The first UI attempt is retained in `tests/n118-1019-initial-browser-failure.json`: the old N73 setup lacked the provisioning receipt required by the current real class guard. Diagnostic readback confirmed an ownership denial; the guard was preserved. The harness now reuses the existing N36 `prepareNamesAccount()` wrapper, which registers the synthetic provisioning receipt through the actual registry/boot resolver.

`tests/n118-1019-roster-fixture-failure.json` records the next missing Quicklog link: the fabricated enrollment omitted `status: active`, so the real roster was empty. The fixture was corrected, without changing the application.

`tests/n118-1019-owner-fixture-failure.json` records the negative-test timeout after the positive scenario passed: it changed the first sorted teaching's section rather than the current route's section. The corrected harness obtains the current teaching through the actual router/store before applying the in-memory owner conflict. These are distinct corrected harness failures, not suppressed Product failures.

## Delivery boundary

Local candidate only. No push, integration, deployment, provider verification, Production evidence or PO acceptance is claimed. The independent controller/publisher owns those phases. Product ledger and queue/status files are unchanged.
