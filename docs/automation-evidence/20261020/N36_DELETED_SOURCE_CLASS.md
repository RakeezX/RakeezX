# N36 — reimport after a deleted source destination

AI-authored local candidate, task `continuous-n36-deleted-source-class-reimport-20261020`, run `afe3e92c-362b-4c23-94a2-ca382929c050`. Base and initially fetched origin/main: `01940ee3a6fe0f4c79e0ad50c9209662a7ef7517`.

The actual PO 13:36 Riyadh report remains **FAILED**: extension 0.5.17 collected 303 names / 10 classes / 7 pages, then received unknown / `CLASS_ARCHIVED_OR_AMBIGUOUS` after the teacher had deleted those classes. Collection is not repeated and no live save success is inferred.

## Cause and bounded correction

The original resolver counted tombstones together with live sections, then rejected any deleted match. Both duplicated create guards also rejected deleted same-key records. Saved manual mappings used `getSection()`, which hides tombstones, and the receipt shortcut could acknowledge an old counts-only receipt without checking its destination.

Only `src/views/class-import-center.js` changes:

- One resolver distinguishes tombstoned, unique active, archived live and ambiguous active destinations within the current year and owner. Tombstones do not count as live duplicates. A unique active destination is reused; multiple active matches and archived-only destinations remain unresolved. An explicitly mapped live archived section is never silently switched or unarchived.
- A saved mapping to a current-owner/current-year tombstone supplies its previously approved natural key, never its retired identity. If no live destination exists, the existing `store.createSection` path generates a new UUID. Missing, foreign or wrong-year mappings still fail closed. Old mapping IDs remain preserved as provenance.
- The same resolver runs against the transaction's persisted section/device snapshot during creation. Whole-batch persisted checks validate selected destination snapshots and saved batch ownership/context. A concurrent live/archive destination or mapping change aborts the intended create; its existing competing record remains intact. Names and available setup categories share this guarded creation path.
- Receipt retries requalify current destination identities and rosters instead of returning a stale counts-only receipt. Per-digest destination IDs are recorded; superseded receipts/targets are preserved in history when the destination changes. Identical retry adds no section, student, enrollment, teaching, slot or outbox command.

No tombstone, old enrollment, historical grade/item/teaching or existing delete command is restored, removed or rewritten. New commands are owner-bound and do not target the deleted section. No dummy subject is created. Optional class/subject/timetable data use the normal paths only when supplied; missing teacher/school/principal categories remain reported missing.

## Affected evidence

- `node tests/n36-deleted-reimport-20261020/browser.mjs --reproduce` — **PASS, expected original failure**. Serves the exact frozen base view over HTTP in the actual application composition. Actual account store + IndexedDB + existing worker fixture return unknown / batch / validation / `CLASS_ARCHIVED_OR_AMBIGUOUS`; no new destination/roster/outbox writes. Evidence: `reproduction.json`.
- `node tests/n36-deleted-reimport-20261020/browser.mjs` — **PASS**, eleven affected scenarios: deleted destination with stale saved mapping and receipt; deleted destination with available subject/timetable; unique active reuse; active ambiguity; archived live block; foreign mapped owner; foreign account; saved foreign term; concurrent active create; concurrent archive create; concurrent mapping change. Disk assertions retain the original pending delete command, tombstone, old student/enrollment, teaching/items and scores. Same-batch replay adds zero duplicates. Successful cases remain on the original app page, without import navigation or per-class confirmation. [Actual rendered app](../../../tests/n36-deleted-reimport-20261020/fresh-class.png).
- `node tests/n36-deleted-reimport-20261020/qualification.mjs` — **PASS**. Binds current source hash, preserves the reproduced original failure, verifies the unchanged 0.5.17 profile transaction/direct receiver/lifetime guard code, and checks affected JS syntax. Previous successful profile/bridge evidence is reused from `tests/n36-actual-save-20261020/browser.json`; that suite is not rerun.

Tests use the canonical `withIsolatedLocalBrowser` helper, fresh synthetic contexts, owned loopback HTTP port 49538, external-request and Service Worker blocking, and `finally` cleanup of owned contexts/browser/server. Existing synthetic account/provenance and worker helpers are reused. Only fixture origin configuration is translated to loopback; nonce/document/owner/lease guard implementation remains intact. Synthetic deletion results are seeded as tombstones and historical rows; no delete RPC or service mutation is executed. This is not a live account/Sync/offline-cache certification.

## Delivery limits

Extension bytes and versioned ZIPs remain unchanged at **0.5.17**; no bump, repack, stable-folder write or Chrome reload. No new imports or startup dependency, and no app.js/store/cloud/sync/SW/schema/Auth/RLS writes. No school browsing, 303-name extraction rerun, full Sync/SQL/Delete/Restore suite, push or deployment.

The independent publisher must verify the integrated source and served application effect. The actual school/account journey remains unverified, and N36 remains open; local qualification does not close the reported failed journey.
