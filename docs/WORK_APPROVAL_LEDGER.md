# RAKEEZ X — Work Approval Ledger

Canonical index for PO-approved Work outcomes that remain relevant to Product implementation. This records **what must be built**, not what is implemented or shipped. Production/main remains runtime/data authority. A Work package is visual/UX authority only for the explicitly approved scope recorded here; “final candidate” in a handoff alone is not PO approval. See [Governance](GOVERNANCE.md).

| WORK_APPROVAL_ID | Tickets | Work approval | Source state | Implementation | Preview / Production | Contract |
| --- | --- | --- | --- | --- | --- | --- |
| WA-CALENDAR-0417 | N50, N51, N55 | APPROVED after 0417 handoff | VERIFIED | NOT_AUTHORIZED for remaining scope | none for full Work contract / none | [Contract](work-approvals/WA-CALENDAR-0417.md) |
| WA-SCHEDULE-0429 | N22, N57 | APPROVED: N22 Option A; N57 including 0429 polish | VERIFIED | NOT_AUTHORIZED | none / none | [Contract](work-approvals/WA-SCHEDULE-0429.md) |
| WA-REFINEMENT-0440-2 | N03, N08, N13, N34, N38, OTP email and Product entry | APPROVED by later PO decision in 0445 | VERIFIED: final 0440.2 handoff and prior 99 files | NOT_AUTHORIZED; N13 architecture requires separate decision | none / none | [Contract](work-approvals/WA-REFINEMENT-0440-2.md) |
| WA-N53-N54-0434 | N53, N54 | APPROVED: N54 Option A | VERIFIED for Work files; N54 Product solution reopened | N53 NOT_AUTHORIZED; N54 BLOCKED | N54 attempted Product solution rejected / no Production | [Contract](work-approvals/WA-N53-N54-0434.md) |

N50 Bug #04 closed after the 0443/0444 Production flow. The distinct suspension foundation closed separately after 0446.4 Production and PO verification in 0446.5. N50 overall, N51 and N55 remain open; the complete Calendar 0417 visual/UX contract has **not** shipped. Its remaining Product transfer is `NOT_AUTHORIZED` until a separate ticket selects that scope. Current Product baseline: `0700d55331f1f66678ec236f5de8bad776a6d933`.

## State and authority

- `WORK_APPROVAL`: `APPROVED`, `SUPERSEDED`, `REJECTED`, or `PENDING`. This dimension records a PO decision, not implementation authorization.
- `SOURCE_STATE`: `VERIFIED`, `DRIFTED`, or `UNRESOLVED`. Verify every path and SHA-256 in the linked manifest against disk before implementation. A changed byte makes that source `DRIFTED`; a missing/unlocatable authoritative source is `UNRESOLVED`. Stop for PO/reviewer resolution in either case.
- `IMPLEMENTATION`: `NOT_AUTHORIZED`, `READY`, `ACTIVE`, `BLOCKED`, `PREVIEW_READY`, `PRODUCTION_REVIEW`, or `CLOSED`. Approval alone does not advance this dimension. Preview and Production are recorded separately.
- Precedence for approved visual/interaction scope: explicit PO contract in `docs/work-approvals/` → exact manifest-bound Work artifacts → approved evidence screenshots/results → Work handoff prose → older chats/packages. Production/main outranks all of these for runtime/data semantics. A genuine conflict is `RUNTIME-CONFLICT` and needs a PO decision.
- Before coding a Work-derived ticket, read this ledger and its exact contract; verify the manifest; build a surface/contract parity matrix labelled `MATCHED`, `GAP`, or `RUNTIME-CONFLICT`. Reduce every `GAP` to `MATCHED` before claiming Preview fidelity. Never silently accept a partial surface. Implementation technique may adapt to preserve Product semantics, but may not reinterpret or omit approved UX.

These four entries are the initial active/relevant set, not a reconstruction of every historical closed Work ticket. Closed Production history remains in [Changelog](CHANGELOG.md) and Git. A package absent from this registry must not be assumed approved.
