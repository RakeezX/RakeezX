# Ticket: SYNC-UX-01B / OFFLINE-ROUTES-01 — reconnect recovery and core offline routes

## Status

`PRODUCTION REVIEW` — local fix pending promotion and Product Owner verification.

## Goal

An old demo-linked timetable record must never block real teacher changes from syncing. The Settings page and Teacher Mini Hub must report one truthful sync state, and the core routes covered here must open on a first offline visit after the updated PWA shell is installed.

## Product decisions

- Decision(s) already approved: preserve demo data locally; do not delete/reset Product Owner data; manual sync retries immediately; no schema or data-semantic change.
- Decision(s) still required: Product Owner Production verification after promotion.

## Source of truth

- Runtime/data source: Production failure `sessions: missing remote teaching demo:…:teaching` during required timetable sync.
- Relevant commits / production baseline: `47ada73` (quiet automatic sync UX).

## Approved scope

- Treat records with explicit demo references as local-only during sync/outbox eligibility.
- Keep full-run status authoritative and paint Settings/Mini Hub indicators without a page render.
- Precache the lazy core-route dependencies required by the verified first-offline routes.

## Forbidden scope

- No migration, IndexedDB schema change, outbox/tombstone semantic change, sync-architecture rewrite, cloud-data deletion, or unrelated PWA redesign.

## Files expected

- `src/store.js`, `src/lib/sync.js`, `src/app.js`, `src/views/settings.js`, `sw.js`
- Focused browser coverage and continuity documentation.

## Required Lean Gate

- Demo-linked session does not abort a real offline-created section on reconnect.
- Temporary failure is truthful and manual sync retries immediately.
- Settings and Teacher Mini Hub agree on sync state.
- Unvisited covered core routes load offline from the installed shell.
- `interaction-focus.e2e.mjs`, production build, and `git diff --check`.

## Codex implementation

- Approach: exclude explicit demo-linked records from cloud work while retaining their local records/outbox receipts; publish status only at the full-run boundary; update existing sync indicators in place; release PWA cache `rakeezx-v7` with lazy dependencies.
- Files changed: pending final local commit.
- Tests and observed evidence: pending final local gate.

## Production commit

- Commit SHA: pending local commit.
- Push/deployment result: not pushed or deployed.

## PO Production verification

- Required scenario: create a real class offline with retained demo data, reconnect, and verify the class uploads; force a temporary failure, verify both surfaces agree, then retry manually; install the update and open the covered routes offline first.
- Result: pending.

## Remaining issues

- The app cannot sync while fully closed; stale local demo receipts remain intentionally local for diagnosis.
