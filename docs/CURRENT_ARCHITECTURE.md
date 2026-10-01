# RAKEEZ X — current source architecture

Calendar range, suspension, R2 presentation and Demo reference contracts reconciled against repository source at `95abecef88c4b05e5c963a2140cd622284f1c2eb` on 2026-10-01; other sections retain their prior source audit. This describes **checked-in contracts**, not a fresh claim about live Cloudflare/Supabase state or real user data. For live status use [Project State](PROJECT_STATE.md) and provider evidence; for roles and precedence use [Governance](GOVERNANCE.md).

## Authorities and entry points

- `main`/Production defines runtime and data behavior. Work-Active supplies only PO-approved visual outcomes; Codex ports the accepted diff selectively. The PO decides Product behavior and verifies user-visible Production changes.
- `src/app.js` owns first-run, unified email OTP entry, profile/provisioning/restore gates, and mounted shell. `src/router.js` maps hash routes to views. `src/store.js` owns local Product operations and projections; `src/models.js` holds shared record/score rules.
- `src/lib/cloud.js` requests one email OTP flow. Its explicit `NEW_ACCOUNT_SIGNUP_ENABLED` constant controls `create_user`; Supabase Auth remains the server signup authority. Auth user UUID is the owner identity. Neither a signed-out nor an unknown-owner route may mount another account's Product storage.

## Local workspace and identity

- `src/lib/db.js` opens IndexedDB version **8** with **33** `id`-keyed stores. The allowed database names are historical `rakeezx`, isolated `rakeezx-demo`, and per-account `rakeezx-user-<32 lowercase hex>`. The name is selected before Product storage is opened.
- `src/lib/workspaces.js`, `workspace-routing.js`, `workspace-claim.js`, and `sync-ownership.js` form the ownership boundary. A claimed legacy database remains in place; there is no automatic claim or ownerless fallback for a different account. `WORKSPACE_NOT_READY` fails closed when identity/registry/presence cannot be proved.
- `src/lib/demo-workspace.js` builds synthetic records in `rakeezx-demo`; Demo is not an authenticated Product workspace and must not issue Product cloud mutations.
- Durable identities matter: sections and slots are logical identities; a teaching relates section × subject × term; a student retains one ID while enrollment changes. Dated sessions and attendance remain historical. Deletions use tombstones. `db.applyBatch()` is the local atomic multi-store path.

## Cloud, Sync, and bootstrap

- Repository SQL lives in `supabase/migrations/`, through `20260930234353_calendar_suspension_kind.sql`. Applied migrations are immutable. The directory alone is **not** proof of live migration history; the latest Production head was verified in the 0446.1 backend flow and recorded in [Project State](PROJECT_STATE.md).
- `src/lib/sync-v2.js` defines versioned entities, owner-bound outbox mutations, revisions, dependencies, and reconciliation. `src/lib/sync.js` orchestrates automatic/manual synchronization; `src/lib/cloud.js` maps client calls to authenticated Supabase endpoints/RPCs. No direct browser `service_role` path is allowed. Owner Guard and RLS remain mandatory.
- New accounts must pass required profile and owner-bound provisioning (`src/lib/account-profile.js`, `account-provisioning.js`, app gate) before editable Home. Existing claimed accounts route only to their own local workspace.
- `src/lib/initial-restore.js` supports `CORE_V2` with `CORE_V1` compatibility. It validates an owner-scoped manifest and consistent cloud snapshot before making a fresh local account workspace READY. Fresh offline clients do not invent an editable real workspace; previously verified claimed clients may continue locally offline.
- `src/lib/curriculum-bootstrap.js` manages the separate, explicit units/lessons historical cloud bootstrap. Units/lessons are not silently part of Initial Restore's CORE_V1/V2 store lists. Assignments/submissions remain deferred and outside core restore.
- `src/lib/score-foundation.js` and the 0033/0034 SQL lineage implement DIRECT and SUBITEM scoring contracts. Student lifecycle/removal uses guarded preview and owner-bound operations, not generic local deletion.

## Delivered scheduling, remote wake-up and UI contracts

- N33 Phase 1: `src/lib/sync.js` uses a measured **325 ms trailing debounce** after durable local changes. Coordinator coalesces bursts, prevents overlapping runs and preserves trailing work; manual/reconnect/open/resume and retry semantics remain separate.
- N33 Phase 2: `remote-sync.js`, `owner-invalidation-channel.js` and Sync/cloud integration use owner-scoped private Realtime only as advisory invalidation. Sync V2 remains authoritative; no Product payload is applied directly from signals. Revision coverage suppresses writer self-echo; newer revisions preserve required trailing work. Idle receiver path is guarded; independent reads are bounded to four. Periodic owner-marker checking supports missed-event recovery. Account/logout lifecycle and same-browser BroadcastChannel remain guarded.
- The source includes additive `20260926115629_owner_sync_invalidation.sql`. Production application was verified in the earlier backend ticket, not re-executed by this docs checkpoint. No-Web-Locks environments lack automatic remote wake-up but retain safe manual/reconnect convergence. Chromium/Edge/WebKit evidence is recorded; physical Safari/iOS was not available. Phase 3 broader store-level/incremental/full-pass optimization is deferred.
- N27 removal readiness uses authoritative `summarizeSyncV2OperationalState` while preserving retained superseded evidence and fail-closed unsafe/owner states; lifecycle guards/tombstones remain. Approved return copy is “العودة”.
- Micro-Batches 01–04 selectively delivered Quick Log/Schedule text treatments, calendar-aware Home empty states, viewport/form/profile/first-run UX, calm timed-session attendance warning/bulk confirmation and Today state hierarchy, safe subject default, active identity-aware Home search and eligible target-count grouping. Current helpers include `visible-viewport.js`, `session-start-ui.js`, `class-subject-default.js`, `student-search-ui.js` and `group-count-ui.js`. Auth, student/session identity and attendance/scoring semantics remain current Product contracts. See [Changelog](CHANGELOG.md) for release identities.

## Calendar range identity and lifecycle — N50 Bug #04

- Modern custom exception range identity is reconstructed from the exact persisted day-ID structure; genuine legacy single-day rows remain independent identities. Range edit, move and delete queue explicit Sync V2 DELETE operations for removed days. Calendar range writes and their outbox changes are atomic.
- The applied `20260930094421_calendar_day_active_identity` migration removed the old full `calendar_days` natural unique constraint. The active-only `calendar_days_active_natural_uniq` index enforces `(owner_id, calendar_id, date)` only where `deleted_at IS NULL`. Reusable-after-delete includes `calendar_days`: the same natural key may be used by a **new active row**, while the old tombstoned ID remains protected against stale-ID resurrection.
- Official preset multi-day display identity is reconstructed only when the exact known preset source and definition, plus date/kind/label guards, match. No server `rangeId`, `rangeStart` or `rangeEnd` columns were added. Bug #04 is PO Production-verified and CLOSED; its active-only uniqueness and tombstone lifecycle remain unchanged by suspension. Overall N50 later CLOSED after the 0452.4 R2 transfer and PO Production verification.

## Distinct Calendar suspension — N50 / 0446

- `holiday` (إجازة) and `suspension` (تعليق دراسة) are distinct persisted Calendar kinds and both are non-teaching; `remote` remains teaching. The applied `20260930234353_calendar_suspension_kind` migration extends only the Calendar day kind constraint. The existing generic Sync V2 kind mapping and Backup/Restore preserve the distinct kind.
- Session persistence still uses `cancelled_holiday` for Calendar non-teaching days; no new persisted session status, attendance state or range columns were added. Contextual teacher-facing presentation resolves the session's teaching → term → year Calendar day and labels a suspension as تعليق دراسة while retaining ordinary holiday/manual-session presentation otherwise.
- Home/Today follows the current effective non-teaching Calendar day for operational presentation, suppressing current-day teaching obligations without deleting or rewriting historical sessions or attendance. Demo uses the same teaching predicate locally and does not gain Product cloud access. Suspension is PO Production-verified and CLOSED; the remaining WA-CALENDAR-0417 visual/UX transfer later shipped in 0452.4.

## Shipped Calendar R2 and Demo official references — 0452.4

- The PO-verified R2 Calendar presents the calm identity/header, academic-year metadata, “أين نحن الآن؟” current-term timeline/progress, next milestone, balanced current/next cards, term cards and “الإجازات والفترات الدراسية” with four filters, fresh-entry القادمة default, central “إضافة استثناء” and four distinct exception types. Successful Calendar selection closes its settings sheet. These are shipped presentation/interaction contracts; existing Calendar switch runtime/data semantics remain in force.
- For currently supported official Calendar references, Demo uses the shared built-in reference source while retaining one stable Demo-local year, two official terms, one Demo Calendar and stable year/term/calendar IDs. Western ↔ General selection persists across reload. Official days/holidays follow the selected reference without duplicating a canonical Product year; existing Demo students, Teachings, sessions and attendance remain. Demo Calendar actions cause no Product outbox writes or Product/Supabase traffic. This is scoped D-075 parity, not global future Product/Demo parity.
- **D-076/N58 is PO-approved target behavior, NOT current runtime.** Stable academic identities through preset changes, official date updates, today-only session decisions, immutable history, account/year-synced preset selection, preset-scoped exceptions/customizations and teacher-controlled active-term activation require a separate HIGH-risk runtime/data foundation audit. Do not infer that current Production implements them.

## Offline shell and presentation

- `sw.js` currently names cache generation **`rakeezx-v33`**, precaches shell assets, and has update/fallback logic for offline boot. `manifest.webmanifest` declares install icons. Service-worker asset caching does not guarantee that an OS refreshes a previously installed launcher icon.
- `src/styles/app.css` and `components.css` contain current Product CSS. Font stack is local/system fallback; no remote runtime font is required. Work provides the authority for a *new* visual choice after PO approval; held Work-Active is not permission to port unapproved experiments.
- `src/views/reports.js` and `src/lib/report-print.js` provide A4 preview/printing and export paths. A visible UI or data claim still needs direct focused verification, not only source inspection.

## What to read next

| Need | Current source of truth |
| --- | --- |
| Live state, active focus, and known limits | [Project State](PROJECT_STATE.md) plus fresh Git/provider evidence |
| Durable PO decisions | [Decisions](DECISIONS.md) |
| Raw PO notes and unresolved Product follow-ups | [Product Ledger](PRODUCT_LEDGER.md) |
| Roles, Work/Production precedence, relay boundary | [Governance](GOVERNANCE.md) |
| Test depth and promotion rules | [Test Matrix](TEST_MATRIX.md), [Release Checklist](RELEASE_CHECKLIST.md) |
| Current implementation contracts | This page, then the cited `src/` and `supabase/migrations/` files |
| Historical design/evidence | Dated handoffs and the archived documents explicitly marked historical; never use an old SHA, cache version, or feature status as current truth |

This page deliberately omits private data, credentials, live row counts, and claims that cannot be proved from this checkout.
