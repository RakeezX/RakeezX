# N88 — durable uncertain-command receipt hints

AI-authored scoped implementation and synthetic evidence, 24 October 2026.

- Task: `continuous-n88-uncertain-receipt-recovery-isolated-20261024`
- Run: `74ddc95c-2e2d-4fa3-a19d-649466baa6d8`
- Base: `aa761cc6583385d0a5215c49324f68d20b0f8ba0`
- Owned checkout: `C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-uncertain-receipt-recovery-isolated-20261024`
- Initial checkout was clean, detached at the card base, with its own Git worktree registration. No predecessor/capture-child checkout was used. Observed `origin/main` before candidate commit: `61190ef4603daba714724c699f37c66077cbe94b`; its two affected source files match the card base exactly. No fetch, push, deployment, queue/status edit or provider operation.
- Authority read: canonical operating contract, activated isolated successor, current canonical N88 ledger row and `FUNCTION_REVIEW_20261024.md`. This fixes review item 4 only; N88 remains OPEN.

## Reproduction before repair

`tests/n88-uncertain-recovery-20261024/baseline-ui.json` records actual runtime/client/component handlers and source CSS served over task-owned loopback HTTP in a fresh canonical isolated browser context. One fabricated issuance503 was followed by real runtime disposal/remount and HTTP document reload. Both subsequent lists sent `reconcile: []`, losing the uncertain request identity.

`baseline.json` records the original client sending an unreserved pending mutation despite injected blocked storage, a second client sending an empty reconciliation list while that mutation remained pending, and two failed guidance attempts sending the same request ID. The baseline script intentionally describes the pre-repair source and is not a final regression command.

## Change and boundaries

The existing class client now lazily uses the account-local storage convention, prefix `rakeezx-n88-uncertain-v1:`. The scope includes exact owner, workspace ID, database/claim-restore-provisioning generation, teaching, class and term. Runtime obtains the database/generation discriminator from the existing guarded `classBinding`; the wire binding and all read/write ownership/lease/session checks remain intact. Session tokens, session IDs, source snapshots, student/enrollment IDs, names, codes, field choices and guidance text are absent from hints. The protocol version, command action/ID, original roster/credential versions (or guidance source hash/revision) and reservation time are the only command metadata.

A synchronous durable write plus exact readback precedes every mutation. Storage failure, malformed/foreign/version-mismatched metadata or an existing unresolved hint refuses the mutation before transport. One unresolved command fences further mutations in that exact scope, including fresh replacements and same-ID guidance retries. Lists remain read-only. A normal exact validated ACK clears its own reservation; a partial issuance ACK, transport failure, timeout or stale reply does not.

Only issuance has the existing typed receipt read. List sends the original request ID and original roster/credential versions, never the current versions as a substitute. Response shape, cardinality, full current binding and existing validators remain mandatory. Only `committed` retires a matching hint. Current roster/code counts and loaded visibility always come from the validated current list; they never prove the old command's disposition. A legacy list200 cannot silently bypass a requested receipt read. The current server contract has no authoritative `not-applied` discriminator: receipt absence, disagreement, duplicate receipts and unsupported `not-applied` all retain uncertainty.

Records accept at most eight finite hints and 8192 characters. Automatic lookup expires after 30 days, but expired metadata remains an unresolved fence; expiry never becomes success or permission to replace the command. No eviction drops an UNKNOWN to admit a mutation. Non-issuance hints cannot be resolved through a new server operation: guidance, selective rotate/revoke and visibility remain conservatively fenced after lost ACK. Storage cleanup failure also retains a warning/fence. Existing UI UNKNOWN warnings are reused, without changing its counts, ordering, support-copy or field-draft rendering.

Hints grant no authorization. Replies from retired owner/session/context/database scopes cannot settle or render old results. A newly verified session for the same stable owner/workspace/class can make the existing authoritative read with its current binding; it cannot replay the mutation. Claim/restore generation and class/owner changes never adopt foreign hints.

No new startup import/dependency or offline-shell asset is introduced. The previously published counts/order/finite mutation diagnostic changes are preserved. Class view, class CSS, guidance codec and server receipt-read implementation are byte-unchanged from the base.

## Affected checks

- `n88_unknown_remount_reload_cause`: PASS — original reproduction artifacts above, followed by corrected real runtime remount/reload, including pending transport retired by lifetime abort.
- `n88_durable_owner_scoped_reconciliation`: PASS — `node tests/n88-uncertain-recovery-20261024/client.mjs` (22 grouped cases) and `node tests/n88-uncertain-recovery-20261024/ui.mjs` (7 rendered scenario groups). Includes actual current ownership guard through `classBinding`, exact receipt versions, existing pure server receipt contract, committed/current-data disagreement, absent/unsupported not-applied and legacy list200, eight-hint bound and expiry, normal ACKs and unqueryable command kinds.
- `n88_no_replay_stale_owner_and_storage_faults`: PASS — same focused commands: pending/UNKNOWN no replay/replacement; owner/workspace/class/term/session/source retirement; stale list/ACK; storage read/write/readback/cleanup failures; malformed/foreign/oversized/future/versioned records; partial/wrong-ID ACK and timeout; actual guidance save/revalidation/reload handlers; actual batch handler with injected quota failure dispatches zero mutations. No sensitive payload in hints or finite diagnostics.
- Syntax: both changed JS modules passed `node --check`. `git diff --check` passed.
- Reused unchanged display evidence: `tests/n88-five-ui-delivery-20261024/ui.json` count/order/duplicate-label/CSS checks for the unchanged class view and CSS. Its historical ability to send another mutation after UNKNOWN is **not** reused: the new class-scope fence intentionally refuses that path. Current rendered checks independently verify the source CSS and loaded fields.

`ui.initial-harness-failure.json` preserves a test selector mistake: the existing review button exists only during retry, so after a successful review the committed-receipt test now remounts through the actual runtime. `ui.guidance-harness-failure.json` preserves waiting for a transient failure message that the existing automatic guidance read clears; the corrected waiter observes the stable revalidation control and non-busy real component. Neither correction changed Product code or an actual failing acceptance result.

All contexts were fresh and disposable; Service Workers/external requests blocked by canonical `withIsolatedLocalBrowser`. Task-owned port `52589` server and browser contexts closed in `finally`. This purely synthetic phase does not require/reserve the shared live-browser lease. No user browser, account, credentials, service fixture, native/provider operation, grade, real code, publication flag or live message was touched.

## Truthful remaining limits

Historical UNKNOWN request IDs already lost before this client change cannot be reconstructed or automatically resolved. No new backend capability is claimed. The hosted student503 cause, native integration, actual account acceptance and whole N88 acceptance remain unresolved/unrun here. Controller/publisher alone owns integration, original served frontend-byte verification and Production evidence. This candidate is local source readiness only.
