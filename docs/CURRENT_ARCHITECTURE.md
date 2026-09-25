# RAKEEZ X — current source architecture

Checked against repository source at `eda978fc79979e889adfe97ed65afae88446580a` on 2026-09-25. This describes **checked-in contracts**, not a fresh claim about live Cloudflare/Supabase state or real user data. For live status use [Project State](PROJECT_STATE.md) and provider evidence; for roles and precedence use [Governance](GOVERNANCE.md).

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

- Repository SQL lives in `supabase/migrations/`, through `20260924173929_security_definer_direct_execute_hardening.sql`. Applied migrations are immutable. The directory is **not** proof of live migration history; query the approved Production metadata path before any schema claim or change.
- `src/lib/sync-v2.js` defines versioned entities, owner-bound outbox mutations, revisions, dependencies, and reconciliation. `src/lib/sync.js` orchestrates automatic/manual synchronization; `src/lib/cloud.js` maps client calls to authenticated Supabase endpoints/RPCs. No direct browser `service_role` path is allowed. Owner Guard and RLS remain mandatory.
- New accounts must pass required profile and owner-bound provisioning (`src/lib/account-profile.js`, `account-provisioning.js`, app gate) before editable Home. Existing claimed accounts route only to their own local workspace.
- `src/lib/initial-restore.js` supports `CORE_V2` with `CORE_V1` compatibility. It validates an owner-scoped manifest and consistent cloud snapshot before making a fresh local account workspace READY. Fresh offline clients do not invent an editable real workspace; previously verified claimed clients may continue locally offline.
- `src/lib/curriculum-bootstrap.js` manages the separate, explicit units/lessons historical cloud bootstrap. Units/lessons are not silently part of Initial Restore's CORE_V1/V2 store lists. Assignments/submissions remain deferred and outside core restore.
- `src/lib/score-foundation.js` and the 0033/0034 SQL lineage implement DIRECT and SUBITEM scoring contracts. Student lifecycle/removal uses guarded preview and owner-bound operations, not generic local deletion.

## Offline shell and presentation

- `sw.js` currently names cache generation **`rakeezx-v31`**, precaches shell assets, and has update/fallback logic for offline boot. `manifest.webmanifest` declares install icons. Service-worker asset caching does not guarantee that an OS refreshes a previously installed launcher icon.
- `src/styles/app.css` and `components.css` contain current Product CSS. Font stack is local/system fallback; no remote runtime font is required. Work-Active, not this source tree alone, is the authority for a *new* visual choice.
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
