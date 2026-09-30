# N50 suspension foundation 0446 — pre-code matrix

Recorded from current-main source inspection before Product edits. Baseline: `9b05180b6fb540a0a5e89c03bd7ab5ac05b2d97b`. The WA-CALENDAR-0417 manifest matched 35/35 hashes. `GAP` identifies the bounded 0446 work. No `RUNTIME-CONFLICT` was established.

| # | Contract | Baseline | Finding |
| - | - | - | - |
| 1 | Distinct Calendar kind | GAP | Model lacks suspension. |
| 2 | Four exception choices | GAP | Holiday/suspension share one persisted holiday option. |
| 3 | Non-teaching semantics | GAP | Canonical predicate can represent false, but suspension is absent; direct session creation hardcodes kinds. |
| 4 | Remote remains teaching | GAP | Model says true; direct session creation misclassifies remote. |
| 5 | Range lifecycle / Bug #04 | MATCHED | Current range identity, atomic save and explicit deletes exist. |
| 6 | Calendar period impact | GAP | Non-teaching copy says holiday. |
| 7 | Next milestone | GAP | Suspension would be described as a holiday. |
| 8 | Affected-session copy | GAP | Explanation mentions official holidays. |
| 9 | Schedule day | GAP | Fallback says holiday. |
| 10 | Home day | GAP | Kicker/fallback says holiday. |
| 11 | Attendance | GAP | Static cancelled_holiday label. |
| 12 | Sessions | GAP | Static status label and holiday-only generator copy. |
| 13 | Teaching Hub | GAP | Static status label. |
| 14 | Student history | GAP | Static status label. |
| 15 | Session editor | GAP | Static status option/toast. |
| 16 | Demo | GAP | Teaching-day helper uses a stale hardcoded list; local-only boundary exists. |
| 17 | Sync V2 | MATCHED | Generic Calendar `kind` field mapping exists. |
| 18 | Backup/Restore | MATCHED | Calendar days are handled generically. |
| 19 | Server constraint | GAP | Seven allowed kinds; a fresh migration is needed. |
| 20 | Active-only uniqueness/tombstones | MATCHED | Shipped Bug #04 migration and range lifecycle support both. |
| 21 | RLS/Owner Guard | MATCHED | Existing owner-scoped policy and Sync path; retain and verify. |

## Candidate resolution

All 21 entries are `MATCHED` in the 0446 candidate; no `RUNTIME-CONFLICT` or unexplained `GAP` remains. The baseline `GAP` entries above remain as the pre-code record.

| Items | Candidate resolution / verification |
| - | - |
| 1–4 | Distinct persisted `suspension`, four form choices, canonical non-teaching predicate, and remote teaching behavior; focused model and browser tests. |
| 5 | Existing range identity, edit/move/delete/recreate, atomic outbox and tombstone paths are unchanged; current Bug #04 tests pass. |
| 6–8 | Calendar impact, next milestone and affected-session copy distinguish suspension; real Calendar browser test passes. |
| 9–10 | Schedule and Home show suspension context; cross-surface browser test passes. |
| 11–15 | Attendance, Sessions, Teaching Hub, Student history and session editor share contextual session presentation; existing status/counting semantics stay intact; cross-surface browser test passes. |
| 16 | Demo uses canonical teaching predicate; isolated Demo test proves zero Product outbox and denied cloud access. |
| 17–18 | Generic Sync V2 kind mapping and Backup/Restore round trip retain suspension; focused tests pass. |
| 19 | Fresh unapplied constraint-only migration accepts all prior kinds plus suspension; full migration-chain test passes. |
| 20–21 | Current active-only uniqueness, tombstones, Owner Guard and Calendar RLS remain; full-chain and ownership tests pass. |
