# N44 already-applied atomic cleanup source record

Task: `continuous-n44-applied-atomic-cleanup-source-record-20261024`
Run: `175c8bc0-2331-4555-b686-9274ede2629c`
Base and observed remote refs/heads/main: `50ada074a82df5b8d493d6a7ba1cd5b4f255d9a7`
Qualified source parent: `3263e2799011d1f8ccabc3f68d02d04df081015e`.

## Source identity and provider mapping

Only `supabase/migrations/20261024151136_n44_atomic_item_cleanup.sql` and this document are imported. SQL bytes exactly match the qualified parent, SHA256 `99b94b973de1858f916a7cbbebf9b8983736bc862a265d4748c692f2c668e4ec`. Actual already-applied provider version: **20261024151136**, name **n44_atomic_item_cleanup**. The historical unpublished `20261024150000_n44_atomic_item_cleanup.sql` alias is absent from this candidate and base. Do not apply either filename again or repair provider history.

The immutable service-result records one acknowledged application and exact definition/version readback, corrected normalized function-body MD5 `f9942b878b29a0543ac223af9310f82e`. This child performs no fresh service readback. The function's owner, locks, immutable mutation envelope, receipt/idempotency, outer guards and transaction/COMMIT behavior remain byte-identical. Legacy delete_item has no expectedRevision/CAS; client timestamp remains metadata.

## Reused immutable evidence

Reports read from the qualified parent, not copied into the candidate:

- `3263e2799011d1f8ccabc3f68d02d04df081015e:tests/n44-atomic-current-cleanup-20261024/qualification.json` — SHA256 `cbf38317c97e7f3eaccac34548bd26bbedcc5f351c0f046b7e9b9601bd1c8617`.
- `3263e2799011d1f8ccabc3f68d02d04df081015e:tests/n44-atomic-current-cleanup-20261024/service-result.json` — SHA256 `67ad6fb81f9f4c6637be52826866085cb968bf936ef8189cb4dac2833778acfc`.
- `3263e2799011d1f8ccabc3f68d02d04df081015e:tests/n44-atomic-current-cleanup-20261024/result.json` — SHA256 `8e18c63bd70b34f7b26815be0d7fc9d16d921aaff0fb2b0c46f1aa364ac41eeb`.

The result records 12 prior real-PG PASS checks: original 42501/no-effect reproduction; unchanged function identity/ACL/owner/outer guards; atomic parent/child tombstones; exact replay/content collision; foreign-owner/unauthenticated refusal; rollback before ACK; receipt-insert rollback; both configuration/delete lock orders; committed receipt reconciliation after withheld COMMIT acknowledgment; N77/context containment; owned runtime cleanup. These are reused, not rerun; their SQL hash matches this exact payload.

Additional local dependency comparison found all 35 listed Git migration blobs identical between qualified parent and this base. Of these, 34 also match the historical result's raw hashes. `0001_core_schema.sql` does not match its historical harness-recorded hash; this check is preserved as a raw-hash mismatch, not relabeled PASS or used to claim a new PG certification. No dependency source changed between parent and base. The parent documents platform-bootstrap accommodation and prior bootstrap/identity/interactive failures, which remain unchanged. The activated source-only card reuses the original qualified 12-check result by identical SQL hash.

Parent narratives read: `docs/automation-evidence/20261024/N44_ATOMIC_CURRENT_ITEM_CLEANUP.md` and `docs/automation-evidence/20261024/N44_RECOVERED_CURRENT_CLOSED_PAGE_OUTCOME.md`. The later narrative records same-account successful Sync at 18:34 Saudi and original custodian's exact-owner reconciliation: matching original committed receipt, parent+child tombstones, zero active scores/completions. No old delete replay occurred. Earlier 403/42501 FAIL and prior UNKNOWN_SYNC_ACK remain historical; old-owner source2/source3 cleanup UNKNOWN and quiet-restoration uncertainty remain separate. Private reconciliation custody was not accessed.

Three actual registrations remain revoked, fourth slot unused and saved global actual sends zero. OS arrival and new-source/opt-in/registration/send/arrival/fresh cleanup gates remain NOT_RUN. Native hard stop 2026-10-24 15:49:15.430 UTC expired and is not renewed. N71 Restore/Undo was not invoked or certified. Whole N44 remains OPEN.

## Child verification and delivery boundary

`n44_applied_migration_record_identity`: exact qualified blob bytes/SHA256; prior service version/name/one-application/readback mapping; same hash in reused 12-check evidence; transaction delimiter/end sanity. No PostgreSQL execution.

`n44_no_duplicate_alias_or_service_execution`: clean starting checkout at declared base, remote main observed at that base, no atomic-cleanup record/old alias on base, final scoped Git diff restricted to actual-version SQL and this document. Git whitespace/scope assertions accompany the commit.

Zero provider, SQL, PG, data, Auth/RLS/ACL, configuration, native, registration, send or browser operations by this child; zero private-custody reads. No frontend/existing SQL/guards/queue/status change. No lease, server, browser or long-lived process acquired. No suite/build/Preview/benchmark rerun.

Independent sole publisher owns integration/build/served-commit evidence; this child does not push/deploy or claim those steps ran. Source-history delivery is not another backend operation, OS arrival, PO acceptance or whole-N44 completion.

## Resumed evidence correction — da4fefca-71e1-4d8b-bb00-111aae0dd017

The previous source candidate `1043b950636d4fa7a112d1673e5dd9808db211b3` is preserved. Its result was rejected with `Candidate validation: An affected check must pass and no recorded check may fail` because the extra raw bootstrap comparison was recorded as FAIL. The earlier paragraph and original result retain that observation; no historical failure is erased.

Read-only inspection of the qualified parent's `tests/n44-atomic-current-cleanup-20261024/cases.mjs` establishes the actual hash input: it reads each migration as UTF-8 and removes a leading U+FEFF before execution and hashing (`replace(/^\uFEFF/,'')`). `0001_core_schema.sql` begins with UTF-8 BOM bytes EF BB BF. Its raw Git SHA256 is `23b6ef2f2731fadd0e20aa1ac797c8be5e0b6ad47c9efe857c5418bc9dcf2332`; after that exact BOM removal its SHA256 is `dae5eba346bd8607a6d07bc75d587f61256440256e675e1e4221e8d4709833a7`, exactly the historical report's recorded hash. The earlier comparison used a different representation from the harness and was not a Product regression.

The corrected local assertion verifies all 35 dependency hashes against the report using precisely that documented BOM removal, and verifies all 35 raw Git blobs remain identical between qualified parent and declared base. This is local evidence reconciliation only: no SQL/PG execution, new certification, provider read or fixture operation. The original 12 real-PG checks remain reused unchanged. Imported SQL bytes and the already-applied version/name mapping are unchanged. The final result reports the two activated affected checks; the invalid additional raw-hash expectation is superseded by this evidenced correction, not by suppressing a real acceptance failure.
