# N77 D-114 live gate packet — preparation only

## Identity and boundary

- Migration: `supabase/migrations/20261007074600_n77_server_validated_delete.sql`.
- File SHA-256: `96ae7fca889e5e7077f8df92a9ef90e0510c88c2066e3f587805030aef6519f4` (verify again against the exact reviewed candidate before apply).
- Recorded live `main` at preparation: `e84e5b5702bb9efcfbaa5330b7253005c9a85b7e` (read-only remote query, 2026-10-07). Failed Preview candidate: `d400bd3b876329c7566763d70ff18889f2ffdff9`.
- Main Supabase audit supplied by PO: migration absent; `rakeezx.n77_delete_teaching` absent. Recheck with the SQL below at the live gate. No live apply is authorized by this packet.

## Function and security review

- Migration is one transaction with a 10 second lock timeout. It renames the existing `apply_sync_v2_lifecycle_command` to `apply_sync_v2_lifecycle_command_before_n77`, revokes direct public/anon/authenticated execution on that renamed function, and creates an authenticated wrapper that rejects queued `delete_class` and `delete_teaching` commands.
- `n77_delete_teaching(text,text,text,text,text,boolean)` is `SECURITY DEFINER` with an empty `search_path`. It derives owner from `auth.uid()`, checks owner-scoped Section and Teaching rows under locks, fingerprints the current scope, and requires the fingerprint, mutation ID and device ID for commit. The commit and receipt insert occur in the same transaction; identical mutation replay returns the receipt and changed envelopes fail.
- Its preview returns a plan without a delete write. Commit tombstones owner-scoped descendants and the selected Teaching, or the final Section and enrollments. Student identities are preserved. Existing closed report snapshots are not rewritten. A parent guard trigger is attached to the listed descendant tables to reject new live rows below a deleted parent. `n77_guard_live_parent()` is not executable by public, anon or authenticated.
- SQL grants `n77_delete_teaching` execute only to authenticated; public and anon are revoked. Verify effective privileges and function definitions after apply. The embedded Postgres contract test covers owner isolation, stale scope, replay, rollback on injected failure, cascade, sibling preservation and the parent guard. This is not a substitute for disposable-server certification or live authorization.
- Before apply, review the existing function signature, table/column dependencies and any later migration or grant drift. Stop for schema ambiguity, conflicting live objects or unexpected migration history. Do not edit an already applied migration.

## Read-only live preflight SQL

Run on the intended Main Supabase project in a read-only session. Record project identity through the provider console and compare the exact migration file hash above. The queries inspect catalog metadata and counts only; they do not select Product rows.

```sql
begin read only;
select version from supabase_migrations.schema_migrations
where version = '20261007074600';
select to_regprocedure('rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint)') as old_lifecycle,
       to_regprocedure('rakeezx.apply_sync_v2_lifecycle_command_before_n77(text,text,text,text,bigint)') as renamed_lifecycle,
       to_regprocedure('rakeezx.n77_delete_teaching(text,text,text,text,text,boolean)') as n77_delete,
       to_regprocedure('rakeezx.n77_guard_live_parent()') as n77_guard;
select c.relname, count(t.oid) filter (where t.tgname = 'n77_guard_live_parent') as n77_guard_count
from pg_class c join pg_namespace n on n.oid = c.relnamespace
left join pg_trigger t on t.tgrelid = c.oid and not t.tgisinternal
where n.nspname = 'rakeezx' and c.relname in
('teachings','enrollments','items','score_subitems','score_subitem_completions','scores',
 'slots','sessions','session_roster_snapshots','attendance','logs','notes','class_rules',
 'class_goals','class_charter_selections','group_arrangements')
group by c.relname order by c.relname;
select table_name, column_name from information_schema.columns
where table_schema = 'rakeezx' and table_name in
('sections','teachings','sync_mutation_receipts') and column_name in
('owner_id','id','section_id','revision','deleted_at','mutation_id','request_envelope','result')
order by table_name, column_name;
rollback;
```

Expected preflight: no migration row; old lifecycle exists; renamed lifecycle, N77 functions and N77 guard triggers are absent. Any mismatch stops the apply gate. Confirm exact `main` and Preview/client identity independently immediately before authorization.

## Forward recovery posture

The SQL transaction rolls back on error or lock timeout. If application succeeds but a later client check fails, leave the migration intact, stop Delete use, preserve receipts and data, and diagnose with read-only evidence. Do not reverse tombstones, drop guards, rename functions back, or edit this migration in place. A corrective additive migration requires a separate reviewed ticket and explicit live authority. A lost client acknowledgement uses the same mutation ID for receipt replay; an uncertain result must remain fail-closed.

## Exact post-apply gate (requires separate explicit PO live authority)

1. Verify provider project/environment, migration ledger version, exact file hash, and no unexpected `main` movement. Confirm the N77 function and guard exist, old direct lifecycle function is revoked, and authenticated has execute while anon/public do not. Record migration timestamp and operator.
2. In a disposable server first, repeat the owner/scope/replay/rollback and guard contract checks against the final migration bytes. Stop on any deviation.
3. In a synthetic or explicitly authorized test account only, create a Section with two Teachings, separate descendants, a shared student, and a report snapshot. Preview one Teaching; confirm the plan names only that Teaching and the sibling remains. Commit with the shown fingerprint; verify server receipt, local cascade, sibling preservation, shared student preservation, and unchanged report snapshot. Retry the same mutation ID and verify the same receipt with no second deletion.
4. Preview the final Teaching; confirm Section scope. Change the scope before commit and verify stale rejection with no deletion. Preview again and commit; verify Section/enrollments and descendants are tombstoned, student identity and historical report snapshot remain, and a stale-device child create is rejected.
5. With a second synthetic owner, verify the first owner's IDs cannot be previewed or deleted. Verify offline entry, missing/denied RPC, owner/workspace switch, and lost acknowledgement do not start a local destructive cascade before a trusted receipt. Check user messages, reload/recovery and browser console.
6. Record test account IDs privately in the authorized gate record, not in this packet. Use bounded read-only verification for any real account. PO must review the resulting Preview and Production behavior before closure.

Until the migration is explicitly applied and these gates pass, real Delete on a corrected client Preview remains unavailable and must fail closed.
