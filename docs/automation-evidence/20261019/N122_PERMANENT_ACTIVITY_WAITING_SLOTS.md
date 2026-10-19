# N122 — permanent activity / waiting timetable slots

Task: `continuous-n122-permanent-activity-waiting-slots-20261019`  
Run: `58c9921b-1400-4d91-a9cb-d831b4b2cb4b`  
Reviewed base and observed `origin/main`: `63502a351413f4b3ba2a9196ecb3b7ddca7dab7d`

## Result: BLOCKED — existing model cannot preserve the requested semantics

The activated card explicitly permits documenting the exact model blocker and a minimal proposal when the existing schedule cannot represent an independent recurring activity/waiting slot. It explicitly excludes new live schema/migrations. No Product code, existing records, queue, source card or ledger was changed. This is a diagnostic/proposal candidate, not an implemented feature or a publication/acceptance claim.

### Concrete affected facts

- `src/models.js`, `makeSlot`: local objects accept additional properties, but that does not make them supported Sync fields.
- `src/lib/sync-v2.js`, `SYNC_V2_SCHEMAS.slots`, `encodeSyncV2Patch`, `decodeSyncV2Canonical`: only `teachingId`, `weekday`, `period` are domain fields. Both proposed kinds become the exact same payload; neither kind nor a standalone slot's term affiliation survives canonical readback.
- `src/lib/sync.js`, `slots.toCloud/fromCloud`: the legacy mapping likewise has no standalone kind or term affiliation.
- `supabase/migrations/0001_core_schema.sql`, `rakeezx.slots`: `teaching_id text not null`, with an owner-bound foreign key to `teachings`. A null teaching cannot satisfy the declared schema; an invented teaching ID needs an actual academic parent. The reviewed subsequent slot alteration in `0012_sync_v2_server_protocol.sql` drops the natural uniqueness constraint, not this parent requirement. These are repository schema facts, not a new hosted-schema readback or an observed service rejection.
- `src/store.js`, `allSlots`: filters slots through real active-term teaching IDs. `ensureSessionsForDate` and future projections also enumerate real teachings. Standalone slots are not represented by these paths.
- `src/views/schedule.js`, `render`/`slotSheet`: no teachings means the create-class empty state; submit requires a teaching. Adding a select alone would neither persist the kind through Sync nor preserve independent slot affiliation.

Using a sentinel teaching/subject, overloading weekday/period/ID, storing the type only locally, or hiding a Sync rejection would violate this card's no-fake-academic-records and truthful-Sync requirements. No such workaround was introduced.

## Minimum reviewed proposal for separately authorized implementation

Extend the existing `slots` domain rather than creating fake academic parents:

1. Add an explicit slot kind (`teaching`, `activity`, `waiting`) with a backward-compatible academic default. Permit a null teaching only for the two nonacademic kinds and give those slots an explicit owner-bound term reference. Validate kind/parent combinations and period/day bounds server-side. Preserve existing IDs and historical sessions unchanged; nonacademic slots do not generate attendance, rosters or grades.
2. Extend both Sync mappings, canonical readback, server mutation validation and affected backup/restore handling for those exact fields. Preserve owner isolation, revision/ACK/error semantics, tombstones and existing parent guards; explicitly verify cross-owner teaching/term rejection. Apply and read back the specifically authorized service prerequisite before frontend readiness.
3. Within schedule/store, show the independent slots for their term, count their occupancy in conflicts (including class restoration), allow save/edit/soft-delete, and label them without a subject or students. Keep time derived from existing timing profiles; no new date/time input or picker is required. Include affected timetable export representation so saved slots are not silently omitted from exported schedules.
4. Run one real-app synthetic save/reload/edit/delete flow for both kinds with no teachings, then an academic-slot coexistence/conflict control, historical-data preservation, and the affected owner/Sync roundtrip and failed-ACK checks. Reuse unchanged evidence.

Required scope correction includes `src/models.js`, `src/lib/sync.js`, `src/lib/sync-v2.js`, `src/lib/schedule-export.js` and the exact reviewed new service migration/protocol/restore paths once specified. This is a genuine schema/data-authority dependency, not merely an allowedPaths repair. No SQL was drafted/applied and no service call was made. Resume only with explicit bounded schema/service authorization and the corresponding paths (or an approved existing model with demonstrated equivalent Sync semantics).

## Checks

- `node --test tests/n122-1019-model-blocker.mjs`: two diagnostic checks; exercises actual slot factory and Sync encode/decode with fabricated identifiers. Demonstrates type/term loss and confirms the existing academic codec control. No network, browser, server or live fixture is involved.
- `n122_permanent_activity_waiting_slot_save_reload_edit_delete_no_fake_subject`: **NOT_RUN**, blocked by the representation/service-authority boundary above. Diagnostic PASS does not count as rendered UI PASS.
- No build, blanket suite, Preview, browser lease, integration, push or deployment was performed. No owned phase resources remain.
