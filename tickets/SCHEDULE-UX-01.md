# Ticket: SCHEDULE-UX-01 — selective Schedule and Timing Profile promotion

## Status

`PRODUCTION REVIEW` — selectively implemented locally; pending Product Owner promotion gate.

## Source of truth

- Google Local UX: approved.
- Visual Lab source: `visual/main` at `22d811cbc8833dcfddeeb5b2e162d97b61fc9e7c`.
- Production base: `d5365a9b7abb0d468f01ac23946128dd6fc85b19`.

## Approved scope

- Daily-column schedule, concise class labels, and compact Home timing indicator.
- Timing profile cards, Western `HH:mm` controls, stacked sheets, generator, and independent timing models in `timeProfiles.overrides.models`.
- One optional recess per model, with explicit position/duration/transition.

## Protected scope

- Keep Production sync/focus behavior, offline shell, attendance/scoring semantics, and all existing data stores unchanged.
- No migration, IndexedDB version change, service-worker change, or sync mapper/semantic change.

## Persistence audit

`timeProfiles` already persists `periods` and `overrides` as generic record fields locally and in the existing cloud mapper. `overrides.models` therefore survives save/reload/current sync without a schema change.

## Lean gate

- `node --test tests/time-profile-ux.test.mjs`
- `tests/timing-visual.e2e.mjs` and `tests/interaction-focus.e2e.mjs`
- Production build and `git diff --check`

## Remaining limitation

- Existing clients receive the UX through the normal application update; no service-worker strategy change is part of this ticket.
