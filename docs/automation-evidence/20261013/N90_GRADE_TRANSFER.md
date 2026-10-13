# N90 reviewed grade transfer — bounded candidate

Task: continuous-n90-reviewed-grade-transfer-20261013
Run: ccf493ea-4eee-4010-b002-f93de6e8118a
Base: 97a6c54128954b6dfe2075d9210a598130581566
Worktree: C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n90-reviewed-grade-transfer-20261013
Authority: PO-20261013-N90-explicit-grade-transfer; activated card's scoped-N90-grade-import-service preparation.
Candidate identity: the AI-authored commit containing this evidence; exact full SHA returned separately to the controller.

## Result and boundaries

The actual grade screen now reads CSV/XLSX locally using the unchanged audited N12 reader/limits (1 MB, 300 data rows, 50 columns, 8 MB expanded ZIP). First row is headers; first sheet is read. No inferred student or item mappings. Teacher selects the name column and optionally an existing stable RAKEEZ student ID column; otherwise only unique normalized names in the selected live current-term class match. Duplicate/ambiguous/unknown/deleted students, duplicate XLSX row/cell addresses, spreadsheet formulas, dates, invalid/nonfinite/out-of-range grades block the whole review. Arabic names and Arabic-Indic digits are supported. Blank cells mean no change; zero is a mark.

Each grade column defaults to ignore, or is explicitly mapped to an existing DIRECT manual item, or a named new manual item with a confirmed maximum. Automatic/subitem items cannot receive imported marks. The review shows exact identities, item maxima, old/proposed values, additions, overwrites, unchanged and rejected rows. All matches require explicit review confirmation; overwrites require a separate confirmation. Selecting another file clears the prior review while parsing. Unused blank new-item columns create nothing.

Accounts commit one minimal owner-bound durable score:grade_import command through the existing Sync engine. Queue admission checks the entire outbox atomically; dispatch checks it again. The RPC acquires the existing owner lifecycle boundary and receipt/item locks, verifies teaching/current term, live enrollment, item maxima/revisions, score identity/revision/old value and overwrite consent, then creates explicit items and writes all marks in one transaction. Existing direct-score triggers/guards remain enabled; no score-domain bypass flag is set. Existing owner-scoped score_domain_receipts are reused; no new relation, backfill or table grant.

A lost response retains its locked mutation ID/envelope and an explicit recovery action. Retry returns the identical saved receipt and cannot reapply over a later server edit; canonical adoption also preserves a newer local server revision. Receipt owner, protocol, teaching and exact item/score scope are checked before local atomic adoption. Only a definitively rejected command can be explicitly retired by the teacher; its original envelope and rejection remain as a superseded record. Pending/unknown-outcome commands cannot be discarded or replaced.

CSV exports selected current items with alphabetical students, source maxima, class/subject/term context, exact values, blanks versus zero and formula-safe text. The separate “مراجعة للرصد في نور” CSV is a manual teacher aid. No audited XLSX writer exists here, so export is honestly CSV only. Official Noor template compatibility remains **NOT_VERIFIED**; this subtask does not close parent N90 as full Noor integration. No Noor/Madrasati login/upload/send, N93 period model/weights, N12 names-only behavior, N94 states/dates or N100 target-mark policy changed.

## Affected verification

- n90_exact_student_and_column_mapping: PASS — four focused unit tests plus actual browser XLSX reader cover explicit mappings, stable-ID disambiguation, repeated/unknown/deleted names, new maximum consent, read-only automatic/subitem grades, Arabic digits, blanks/zero, invalid numbers/dates, limits, formula-only and duplicate spreadsheet cells.
- n90_account_preview_confirm_atomicity: PASS — actual served app DOM/handlers/source CSS, account store, runtime ownership guard, durable Sync command, loopback HTTP transport and the exact native PostgreSQL RPC. Preview/cancel/missing consent send zero grade calls. Explicit new item + mark commit together. Native invalid late cell and injected late trigger failure roll back every prior write/item/receipt.
- n90_score_owner_stale_retry_guards: PASS — authenticated native owner B cannot read/apply A grades/receipts; stale score/max/revision and duplicate cells reject whole batch. Actual account auth drift, ownerless dispatch, invalid lease, offline commit with a valid lease and dirty outbox are blocked. Lost acknowledgement retry has identical ID/envelope, preserves later server/local revisions, and changed-envelope reuse is refused. Explicit rejected disposition preserves original failure.
- n90_export_values_and_noor_claim_boundary: PASS — focused CSV assertions protect UTF-8 BOM, alphabetical order, zero/blanks, exact maxima and formula injection. Actual offline account DOM downloads the separately named Noor aid CSV with the non-official-template label. The actual UI also exports after offline shell reload.
- n90_server_binding_and_offline_shell: PASS — exact locally certified SQL was applied once and full function definitions/body hashes/ACL/security/search_path were read back and matched. SW v57 precaches all three new modules; actual offline reload boots an approved synthetic Demo, validates the expected database/readiness/teaching in the same new-document checkpoint, loads the new grade DOM/modules/CSS, and exports CSV.
- Syntax checks: PASS for grade-transfer.js, grade-transfer-parsers.js, grade-transfer-export.js, cloud.js, sync-v2.js, store.js, grades.js, sw.js. git diff --check PASS.
- Rendered mobile/desktop: PASS at 390/1280 widths; 390 scrollWidth equals 390, no horizontal document overflow. Screenshots inspected.

Commands: node --test tests/n90-transfer.test.mjs; node tests/n90-native.mjs --browser; final changed-receipt/UI verification node tests/n90-native.mjs --browser-only. The last command preserves the prior six native gates and uses a separate disposable cluster/result file instead of repeating their unchanged scenarios. The migration filename was subsequently aligned to the provider-generated history version; SQL bytes stayed identical and the harness path reference was updated.

Native evidence: test-results/n90-native/result.json (six native gates).
Final account/browser evidence: test-results/n90-native-browser/result.json and test-results/n90-browser/result.json (nine actual app gates).
Unchanged N73/N100/scoring contracts and proofs reused; no broad historical suite, additional Preview, Vite build or review worker.

## Applied service identity

Project xlrubcwjqktzzunrvuns, schema rakeezx.
Before application: both N90 functions absent; migration history had no N90 entry. Existing lock_student_lifecycle and score guards were read; existing receipt relation has ENABLE/FORCE RLS, owner-only authenticated SELECT and no authenticated write grant. Current parent/revision/lifecycle triggers were inspected without reading school rows.

One authorized Supabase apply_migration returned success; subsequent history contains exactly n90_reviewed_grade_import at **20261013122332**. Repo file: supabase/migrations/20261013122332_n90_reviewed_grade_import.sql.
SQL SHA256: f645d975c379dd5ab02e339624d9ae7815eb586abcbe99497152bc97c177f4ed.
Originally locally certified under 20261013130000_n90_reviewed_grade_import.sql; renamed to actual applied history identity without changing SQL or replaying it.

Exact full pg_get_functiondef comparison with native certified definitions: PASS.
apply_reviewed_grade_import(text,text,jsonb) prosrc MD5: d7e2b58de993a4b75ec071e0c652b4f6.
reviewed_grade_import_capability() prosrc MD5: 567760dadc48cc572bb1a1367b5eeff0.
Both: SECURITY DEFINER, empty search_path; ACL {postgres=X/postgres,authenticated=X/postgres}; anon EXECUTE false, authenticated EXECUTE true.
No production RPC mark application, real grade read, teacher/student edit, Auth account/fixture, service key extraction or migration replay occurred. The generic publisher must not apply this migration again.

## Original failures and corrections

Preserved as factual initial failures, not rewritten as successful runs:
1. Harness “Unknown endpoint”: loopback path slice was off by one; corrected to /__n90/ prefix length 7.
2. Initial account clean-outbox assertion failed because the native fixture omitted the existing application's required second academic term. The app correctly queued its bootstrap term. Fixture now seeds the normal upcoming second term before init; no guard or outbox was cleared to pass.
3. Actual 390px document overflow assertion failed with the transfer panel inside the mode flex row. Panel moved to its own context grid row; actual DOM overflow now zero.
4. Immediate upload after cancel could target an element removed by the scheduled repaint. Harness now waits for cancellation/filename readiness. Product file loading also immediately invalidates old review and disables confirmation while local parsing runs.

These were corrected local implementation/harness findings, not tool/security refusals. No tool denial was bypassed.

## Resources and delivery

Shared browser phase lease was used because this card has liveAuthorizationRef/liveMutation. Fresh owned Chromium contexts, task-owned loopback server/unique ephemeral port and no real credentials/profiles. Browser, HTTP server and native PostgreSQL were closed; only the owned test cluster was removed in finally. Browser lease released. The live-mutation lease surrounded only the authorized one-time migration/readback and was released in finally. No queue/controller/maintenance locks or status files changed.

No push, frontend deployment, provider asset verification or Production acceptance was performed here. Controller/publisher owns those steps. Parent official Noor compatibility stays open and separate.

## Source and rendered evidence binding

Hashes below are the verified working-tree file bytes (Git normalizes repository text line endings); the SQL hash is identical to the applied/certified payload.

```json
{
  "sourceSha256": {
    "src/lib/grade-transfer.js": "f1d510ce9eba4b09223f3b2d3a3a438b569cd95d3856c36bedcfc67744ae537d",
    "src/lib/grade-transfer-parsers.js": "f7402ede7a67e3535ed9311ec7e61bde17c57feac2e82abbfcbfadc0679b2a9e",
    "src/lib/grade-transfer-export.js": "1f4efb93560b20a7c8f55b5d3eb057bf3dfa35f11626b005247733e30b7fa9bb",
    "src/lib/cloud.js": "24c555291d269b2f6e22c1601cba5e6e18b19cf24eff90f7658e633e37d1e5be",
    "src/lib/sync-v2.js": "c7d006887f51de0b4a5ad09f3cd6410a9fbdd5ee33ec90f29c1e4c0cb27d7196",
    "src/store.js": "783b28e9d8526ba9f4274b95697c0e6052568c8a0ffc00ad70ece9658c0d025e",
    "src/views/grades.js": "dd084a37f9772edcbcb5324a166d47c8c966e58a9b4ef4a337d305dceeafbd6b",
    "src/styles/grades.css": "a5f1cc862de57f3e6bf62a918a65a624397806f5a90ebfa21c45e92c56ab8c36",
    "sw.js": "d280d84a37172d20e789b894226c17bac993f7c2fe0141c3a8901ce7a3ece113",
    "supabase/migrations/20261013122332_n90_reviewed_grade_import.sql": "f645d975c379dd5ab02e339624d9ae7815eb586abcbe99497152bc97c177f4ed"
  },
  "renderedSha256": {
    "test-results/n90-browser/390-review.png": "8e1c918aa29c4aacd7fa594764b12ef63ccd2575db96998c496ff9199d2afc8b",
    "test-results/n90-browser/1280-review.png": "1652c7127b10e1683909d3e6adc227d63e582dec1b2277d798633c67412a7491"
  }
}
```
