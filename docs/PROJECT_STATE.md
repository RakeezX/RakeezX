<!-- BEGIN RAKEEZ OPERATING POINTER -->
# RAKEEZ — current project state

Use [the active Product ledger](PRODUCT_LEDGER.md) and [closed ledger](PRODUCT_LEDGER_CLOSED.md) for Product status. Read `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json` and the relevant `queue/*.json` for live execution; `controller-events.jsonl`, the task's attempt result and delivery receipt explain transitions.

Follow [the current operating contract](RAKEEZ_OPS_CONTRACT.md). Verified `awaiting_po` releases capacity for the next eligible ticket; no PM chat handoff or old phase/date in this file controls dispatch. This pointer carries no fixed current SHA, ticket status or worker count.
<!-- END RAKEEZ OPERATING POINTER -->

## Preserved historical context — not dispatch instructions

The original content below remains evidence and Product context. Its dated assignments, runtime claims and operating procedures do not override the live sources or current authority above. Original user notes and acceptance evidence remain intact.


# RAKEEZ X — derived project snapshot

<!-- ops-docs:start -->
_Generated from the two Product ledgers by `node scripts/ops-docs.mjs`; lifecycle changes belong in the ledgers._
- Current Product release evidence: `d0bea326cb37d7c7d360521e8fc81c41d50b92d2` (ledger headers; verify deployment evidence before promotion).
- Tickets: 27 active, 66 closed.
- Deployed, awaiting PO Production verification: none.
- Current PO/PM actions: [PO queue](PO_REVIEW_QUEUE.md) · [PM queue](PM_REVIEW_QUEUE.md).
<!-- ops-docs:end -->

**Non-authoritative view, derived from the ledgers and release evidence.** Do not maintain independent ticket state here. For OPEN/current lifecycle see [Product Ledger](PRODUCT_LEDGER.md); for CLOSED see [Closed Product Ledger](PRODUCT_LEDGER_CLOSED.md). Recheck Git and provider metadata for exact live identity. Current state generated from ledgers; V5 effective 2026-10-11.

- Silent Beta is active. Per PO, Supabase has 12 registered users: the PO is the only real user and the rest are test accounts. Protect the PO's data and Product foundations while using Workflow V5's proportional gates.
- See the generated section above for the latest Product release recorded in the ledgers; docs-only policy edits do not alter it. See [Changelog](CHANGELOG.md) for material releases.
- [RAKEEZ Ops Contract](RAKEEZ_OPS_CONTRACT.md), [Governance](GOVERNANCE.md), [Test Matrix](TEST_MATRIX.md) and [Release Checklist](RELEASE_CHECKLIST.md) define Workflow V5. [Decisions](DECISIONS.md) holds durable contracts, including D-086 and D-095. [Execution Board](EXECUTION_BOARD.md) holds only active operational lanes; the [PO](PO_REVIEW_QUEUE.md) and [PM](PM_REVIEW_QUEUE.md) queues hold unresolved asks only.
- Production/main governs runtime/data; Work-Active governs PO-approved material visual outcomes; the PO is final Product authority. No applied migration, live high-risk mutation or deploy is inferred from this snapshot.
