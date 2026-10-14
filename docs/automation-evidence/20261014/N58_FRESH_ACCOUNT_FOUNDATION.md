# N58 fresh-account foundation — bounded LOCAL correction

Task: `continuous-n58-fresh-account-calendar-foundation-20261014`
Run: `ba07cfbe-1861-4a6b-a4b1-2137ec432a26`
Base: `a256a1cce6f0368a1a4dbe3dc24ead677cfaf0d5` (also observed `origin/main`).
Result: **corrected source saved; BLOCKED/external for outstanding hosted gates**. No push, provider operation, hosted account, live-data access, SQL deployment or publication.

## Observed boundary, not an assertion about the PO account

The historical fixture serves the actual base application/store with only the temporary switch hold disabled in a test-only Vite transform. It creates an official LOCAL GoTrue account, completes only its profile, reads back an empty years table, imports the actual profile-only Initial Restore manifest, resolves its claimed workspace, renews the real ownership lease and runs the actual `store.init()` entry. No Product foundation SQL seed or mock acceptance transport is used. The test-only transform is confined to this harness; shipped region cards and the store hold remain disabled/true.

Both before-first-Sync and after-first-Sync historical cases first receive HTTP400, SQLSTATE `22023`, **`N58_EXISTING_TERMS_REQUIRED`**, for the year's CREATE carrying `calendar_preset_id`. The existing N58 server contract requires both owner-bound terms before accepting selection. The historical bootstrap has75 Outbox entries; following the switch, each local fixture has135 entries:67 rejected,65 blocked and3 pending. These are local observations, **not a reproduction of the PO's65 count or proof of the PO's unknown real error code**. See [raw historical receipt](../../../tests/n58-fresh-account-baseline.json).

## Correction

- A truly empty store atomically persists its selected local foundation but queues an **unselected year CREATE**, both stable term CREATEs with no calendar pointer, then a separate selection PATCH dependent on both server-acknowledged terms. It queues no materialized official calendar/day rows. Reinitialization does not mint another foundation/selection.
- Selection changes only the existing year's preset field. It does not retire calendars, replace term/year IDs, overwrite raw dates, erase rejections or replay them. Official dates/days are detached projections from the preserved N58 runtime module at `2a5242099dd73e161e1dffe1decc07f9d7653f6e`; selected read selectors use them without persisting projections.
- Preserved N58 scoped override codecs/dependencies/remapping and scoped term/calendar entries reconcile current client serialization with the existing service contract. Raw terms remain unchanged when an override is saved. Tombstones and missing parent evidence cannot become a new first-use foundation.
- Recorded session context remains historical; missing recorded provenance stays unrecorded. N101's actual missing-parent creation guard is unchanged. Installed update/app entry, models/N98 sorting, cloud transport, Initial Restore, session-provenance and grading implementations remain unchanged from the base.
- `CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD=true` remains in the production-facing store. `sw.js` adds the startup runtime module to the existing shell without replacing installed-update behavior.

## Scoped evidence

The official local harness is reused from the preserved `tests/n58-official-services.mjs` under an allowed task-specific filename. Its four Docker images remain digest-pinned. It applies current existing SQL definitions and the three **unchanged historical N58 SQL blobs** read directly from the preserved commit, in their original ordering, exclusively inside its owned disposable PostgreSQL database. No migration file was created/edited. The scenario receives Auth/PostgREST endpoints, not a SQL API. [Final receipt](../../../tests/n58-fresh-account-candidate.json) records service identities, SQL digests, actual requests/receipts and exact normalized Product source hashes.

| Check | Actual result |
| --- | --- |
| `n58_actual_new_account_first_rejection` | PASS: historical source + profile-only first boot; native HTTP400/22023 boundary above, original failed envelopes retained in evidence. |
| `n58_foundation_dependencies_local_protocol` | PASS: default Western without a switch; General before first Sync; General after initial Sync. All converge to one year/two terms with acknowledged selection and no official calendar/day rows. A lost selection acknowledgement replays the identical envelope and receipt. A session queued before first Sync reaches the actual API only with the final acknowledged selectionRevision. |
| Scoped override and reload entry | PASS in all three cases: actual store entry and canonical scoped date serializer; raw remote terms unchanged; selected dates round-trip; current-document owner/database/restore receipt/data checkpoint after reload; actual Calendar DOM, selected region handler and source CSS. |
| `n58_hold_preserved_and_no_legacy_replay` | PASS: reused actual HTTP UI harness in three fresh synthetic contexts (Demo, empty claimed fixture, established General fixture). Disabled mouse/keyboard cards, stale handler/direct calls and identical selection make zero IndexedDB mutation calls. Existing64 hold sentinels unchanged. An additional focused contract preserves65 retained envelopes and historical sessions byte-for-byte. |
| `n58_owner_history_and_current_regressions` | PASS: real local account store + ownership guard; wrong-owner dispatch attempts zero requests;6 new affected contracts and18 targeted regressions (N10110, N90 five, N98 three with valid parents). Recorded/unrecorded historical context and missing/tombstoned parents remain fail closed. |
| Offline startup dependency | PASS: actual HTTP application + fresh synthetic Demo + real Service Worker. New runtime module precached; offline reload renders Calendar DOM/CSS and reads projected holidays with empty Outbox. Existing complete executable shell graph check also PASS. This is not hosted-owner/offline certification. Export implementation is unchanged. |
| Syntax/resources | PASS: changed JS syntax and Git whitespace; final receipt source hashes match saved Product source. Four owned containers, network and volume closed and proven absent. Owned browser/server contexts closed; shared browser phase lease released. No credentials in committed evidence. |

[Compact verification and original harness failures](../../../tests/n58-fresh-account-verification.json) bind these results. The original N98 fixture FAIL (missing year/term) remains visible; the separate scoped copy supplies valid parents and retains its assertions. The first reload harness FAIL is preserved in [its receipt](../../../tests/n58-fresh-account-reload-original-failure.json); corrected verification obtains the complete checkpoint in the current document. The first65-history assertion compared insertion order with IndexedDB key order; its correction compares the actual persisted checkpoint, without changing Product behavior.

Unchanged prior nine-protocol/60-contract evidence is retained in the preserved candidate and reused only for unaffected contracts; it is not rebranded as full acceptance of this changed client. The unchanged pure runtime, service definitions and owner/late-context safeguards retain their existing evidence. New first-use/dependency/entry cases above cover the materially changed scope. No broad audit, build, repeated Preview or hosted proof was substituted.

## Outstanding gates / exact retry condition

Preserved broad hosted N58 gates remain: A session/A2 restore **FAIL**, hosted context rejection **NOT_RUN**, B owner isolation **NOT_RUN**, hosted preset-context preservation **NOT_RUN**. Prior retired hosted identities/disposition and original hosted histories remain untouched. This card authorizes neither a replacement hosted pair nor publication/service administration. Local service application proves only the disposable local stack, not hosted capability identity.

Retain this exact candidate/session for a separately authorized hosted/service capability and acceptance phase, with its precise fixture and data permissions, followed by the independent controller/publisher's authorized delivery path. Do not repeat unchanged local checks merely to restate these external gates; do not enable the Production calendar switch or declare N58/Product CLOSED from this correction.
