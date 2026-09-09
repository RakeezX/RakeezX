# RAKEEZ X Runtime Contracts

- Production code and persisted data behavior are the source of truth.
- Do not automatically apply migrations, change schemas, deploy, force-push, reset, or rewrite Git history.
- Preserve durable identities, Sync V2 convergence, tombstones, offline-first behavior, historical records, and owner isolation.
- No visual transport may silently change Auth, IndexedDB, sync, sessions, attendance, scoring, or migration behavior.
- Do not package `.env` files, tokens, privileged keys, IndexedDB exports, student names, attendance, grades, notes, or Production archives.
- Validation is candidate-bound. Any candidate-relevant change makes prior PASS evidence stale.
- Production Review records the exact deployed Production SHA; only explicit Product Owner Production verification may close a ticket.
