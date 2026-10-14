# N58 atomic reviewed foundation recovery

AI implementation for `continuous-n58-empty-account-reviewed-recovery-20261014`, saved session `01a13b56-395f-7451-84a0-80235cb98089`, run `79f2600c-16c3-4f27-9092-8c1aedd2f9cc`.

The previously proved separate-request race remains in `N58_EMPTY_ACCOUNT_RECOVERY.md` and `tests/n58-empty-recovery-race.json` as **historical unsafe-design evidence**, outside current release check results. It was not rerun or relabeled Product PASS.

## Source and behavior

Preserved evidence candidate `9f7413ea87dc558fe92a9780a879701ed697f004` on assigned base `2ec81320feb8fa32a7e99714f89d8921c70759b3` was merged with integrated first-use source `46a9cedcbc3f9f95280e33bb950fbc18285225a5`. Observed newer origin `5e86ef7a4dd186a5c446df4c4054b20a8de2fe5b` adds only the scoped operating card. No older foundation was restored. Provider/assets evidence for that preceding release is separate; its index parity and full N58 acceptance are not claimed here.

The calendar entry is exposed for an exact owner-bound `N58_EXISTING_TERMS_REQUIRED` year CREATE rejection with the connected original default foundation. Current year/term identities and original payloads must match the existing release catalog, including known official calendars/days. Generic diagnostics, customized records, ambiguous/missing local foundation, school data/tombstones and other related intents fail closed. No arbitrary date or parent is guessed. Read review obtains the Initial Restore receipt in the current owner/document/database context and complete owner-filtered school-content reads before the server review. Cancel/review enqueue no writes. Blocked plans expose their actual reason without confirmation controls; ordinary use/support remains available.

Explicit acknowledgement saves one persistent owner-bound local audit and repair UUID. The RPC takes the existing per-owner transaction mutex, rechecks authoritative school-content/tombstone absence and the exact reviewed canonical academic preimage, and invokes ordinary year/term mutations in order: missing unselected year, missing term1/term2, selected-year PATCH. Existing N58 guards/receipts/triggers stay active. A partial error rolls back rows and normal mutation receipts together. A completed same-input repair UUID returns its stored result before checking later legitimate school additions; different input or owner is rejected.

Frontend lost-response/reload recovery sends the identical saved RPC body and repair identity. The original reviewed envelopes are quarantined from ordinary dispatch/pull while pending. Completion validates owner/IDs, both ordinary term payloads, selected year/revision, canonical owner-filtered readback and equivalent official-day projection. It retains raw academic/failure snapshots in the audit and marks only the exact reviewed original operations `superseded`, never originally applied. Official materialized raw records remain retained. Unrelated failures remain outside the group. Calendar switching remains **HOLD=true**.

## Exact additive migration, certified locally before any service application

- Path: `supabase/migrations/20261014203000_n58_atomic_empty_foundation_repair.sql`
- Management migration name: `n58_atomic_empty_foundation_repair`
- Exact UTF-8 SQL SHA256: `99cf05f33d1d19c1694a859a84072a25fb0faeffb346a031464542abb96bfb67`
- Project authorized by card: `xlrubcwjqktzzunrvuns`
- Scope: two authenticated RPCs, two revoked internal helpers, one necessary receipt table. No existing table alteration, backfill, original migration rewrite, Auth trigger change, owner-access expansion, privileged frontend key or real recovery invocation.
- Receipt table has enabled/forced RLS and no public/anon/authenticated table grants. Internal helpers are inaccessible to those roles. RPC execution is granted only to authenticated owners, derives `auth.uid()`, binds the owner input, limits input/preimage size and identity lengths, and uses fixed empty search paths.
- Installation aborts on unexpected normalized mutation/N58 guard/mutex body digests, missing/disabled/wrong owner-lock triggers or an already-installed repair definition. CRLF→LF normalization is limited to body-identity comparison. No original SQL definition is rewritten.

All relevant ordinary section/student/teaching/academic tables and portable restore children carry the same enabled BEFORE STATEMENT owner-lock trigger. Existing ordinary RPC wrappers/restore finalizers also acquire that lock. Score-subitem tables cannot populate a truly empty account independently: their ordinary functions require existing assessment/student parents; creation of those parents is in the protected lock set. No writer scope was broadened. Native metadata/triggers and the actual ordinary section/atomic HTTP interleaving confirm serialization; a mutex was not assumed from its name.

## Affected current verification

| Required check | LOCAL result and evidence |
| --- | --- |
| `n58_existing_empty_rejected_account_review` | PASS: actual old-source profile-only bootstrap/store/ownership/Initial Restore under official LOCAL services, then current source reload with persisted data. Exact year rejection, genuine local and authoritative emptiness, review/cancel and acknowledged-only confirmation. |
| `n58_reviewed_academic_repair_actual_protocol` | PASS: actual app UI/store + Auth/PostgREST/Postgres converge to one year/two stable terms and acknowledged selection; canonical readback and projection verified. Before-first dispatch and after partial dispatch source fixtures are recorded, without fabricating PO counts. |
| `n58_repair_idempotent_lost_ack_and_owner` | PASS: mobile response lost after server commit, persistent pending audit, full page reload/current-document owner/database/restore checkpoint, identical body/UUID and identical stored receipt. Native wrong-owner and changed-input replay are rejected. |
| `n58_no_school_data_or_custom_history_repair` | PASS: native populated race and custom/stale academic state are no-write rejections; three focused old-fixture tests cover all school stores/tombstones, custom calendar/term dates, missing group dependency, wrong owner, generic rejection and retired session dependency. Independent failure is excluded from the selected group. |
| `n58_calendar_hold_and_old_failures_retained` | PASS: actual 1280/390 DOM/CSS/handlers, disabled region cards, raw calendars/days unchanged, complete original envelopes retained in verified audit, exact supersession count. Support closes the sheets and navigates. |
| `n58_atomic_other_device_race_and_receipt` | PASS: section before lock rejects with zero term writes; actual apply and section requests wait on existing owner lock, then repair succeeds followed by legitimate section creation. Completed receipt replay remains identical after that addition. Injected LOCAL second-term error rolls back the year, terms and normal receipts. |
| `n58_atomic_sql_scope_and_service_binding` | PASS: current exact SQL LOCAL installation/limits plus actual connected service application and metadata-only source/ACL/RLS/history readback below. |

Receipts: `tests/n58-empty-recovery-atomic.json`, `tests/n58-empty-recovery-limits.json`, `tests/n58-empty-recovery-ui.json`. Desktop1280 PASS is reused from the completed desktop scenario in `tests/n58-empty-recovery-ui-desktop-and-mobile-selector-failure.json`; the retained failure there is the later mobile harness selecting the hidden desktop header button. The corrected mobile harness chooses the actual visible trigger; it does not force-click a hidden control. UI/review/serialization source is unchanged. Pending dispatch/pull protections were subsequently strengthened inside the local transactions to cover overlapping ordinary Sync reads; the materially affected mobile lost-response/reload scenario was rerun and passed. Current source hashes and exact migration/schema are in the mobile receipt.

The atomic model has one outer acknowledgement. There are no independently committed first/middle academic responses to recover: native injected mid-transaction failure proves rollback, and the actual UI lost final acknowledgement proves receipt recovery. A new repair ID is not minted on retry.

Both new Product modules and changed startup JS pass syntax checks. The existing executable offline-shell graph passes. Reused real HTTP/SW Demo helper proves `calendar-recovery.js` is precached and an offline reload renders Calendar with source CSS and an empty Outbox (`tests/n58-empty-recovery-offline.json`); this is not hosted-owner/offline certification.

Original harness failures remain recorded: ACL assertion incorrectly matched the authenticated role's execute grant; PG activity polling initially reused a cached statistics snapshot; checkpoint read opened the legacy DB before owner-ready context; Vite source-phase graph aliases and mobile hidden-trigger selection. Corrected probes use public-role ACL matching, fresh statistics, guarded current-document reads, fresh owned HTTP server phases at the same origin and visible actual controls. No Product guard was disabled. Owned native fixture-only failure trigger is removed in finally. Owned contexts/browser/servers and six labeled Docker resources are cleaned in finally; browser phase lease is released after checks.

## Service and delivery boundary

Only the exact migration above may be applied once through the available sanctioned connected tool after this LOCAL certification. Required metadata-only readback: all four new routine signatures/body MD5/security/search_path/ACL, receipt table RLS/ACL, preserved mutation/N58 guard/mutex identities and original migration history plus the new named entry. No real account query or recovery invocation is required or authorized.

The generic publisher does not apply SQL. Frontend push/deploy, Production served/index parity, retired hosted pair gates, calendar re-enablement and whole N58/PO closure remain separate; no automatic umbrella acceptance is claimed.

### Actual authorized service completion

The connected Supabase `apply_migration` tool applied the exact certified SQL once as `n58_atomic_empty_foundation_repair`, recorded version **20261014174527**. Its successful result was followed by independent metadata-only readback through `execute_sql` and `list_migrations`: all four new routine body MD5/security/search_path/ACL values match the exact LOCAL installation, receipt-table enabled/forced RLS and ACL match, existing mutation/N58 guard/mutex bodies are unchanged, and every original history row is unchanged with exactly one new named migration. The local filename's planned timestamp differs from the connected tool's generated history version; both actual identities are retained, with no history rewrite or duplicate application.

See `tests/n58-empty-recovery-service-binding.json`, bound to SQL SHA256 above. No user table rows were read and no real recovery RPC, profile/teacher/student operation, Auth account, message or hosted fixture was created/invoked. The live-mutation lease was acquired only for this DDL/readback phase and released afterward. Browser/HTTP/Docker resources were already cleaned before this phase. This completes this scoped backend prerequisite; it is not frontend deployment, full hosted N58 acceptance or PO closure.
