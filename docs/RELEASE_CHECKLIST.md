# Exact-SHA release checklist

1. Confirm branch, baseline, candidate SHA, intended file scope, migration status, and clean tracked tree. Save an evidence manifest under ignored `test-results/evidence/`.
2. Reuse tests only when they match the exact candidate tree. Resolve or report failures; never waive an unexplained failure or count skips as passes.
3. For a **Work-derived user-visible** ticket: identify `WORK_APPROVAL_ID`; read [Work Approval Ledger](WORK_APPROVAL_LEDGER.md) and exact contract; verify every source-manifest path and SHA-256; stop on `DRIFTED`/`UNRESOLVED`. Record a surface/contract matrix (`MATCHED`, `GAP`, `RUNTIME-CONFLICT`) and close every `GAP` before Preview. A `RUNTIME-CONFLICT` needs a PO decision. Backend/internal tickets use risk-proportional review without visual review when no visual outcome changes.
   Visual Workflow V2: require an exact Product baseline → real-Product Work integration → PO approval → frozen patch/manifest/goldens → Codex exact transport/certification with no visual reinterpretation → focused/golden/geometry/accessibility checks → Preview → PO Preview approval → exact Production → PO Production verification. A post-freeze source change stops unless PO authorizes a narrow micro-fix. Static Work may explore options, but chosen visual outcomes should be integrated on real Product where practical. For high-risk Auth, Supabase/schema/RLS, Owner Guard, Sync, deletion/restore, student lifecycle and scoring, verify the Codex data/runtime foundation first, then Work UX on that exact foundation.

4. Require explicit promotion authority for the exact candidate. Recheck remote main immediately before a fast-forward-only push. Stop on movement or divergence; never force-push or change the candidate during promotion.
5. Verify the normal Production deployment by provider metadata: correct project/environment, non-skipped success, exact full SHA, and current release. A 200 response or Build Meta alone does not prove deployed identity.
6. Run bounded, non-destructive Production smoke in a disposable context. Do not use private Product data unless specifically authorized. Report deployment and smoke separately if one remains pending.
7. Request **PO Production review** for the real user-visible outcome; only then mark the ticket CLOSED. Do not begin the next ticket automatically.

Automation never applies migrations, changes Supabase, clears browser data, deploys, or touches Work-Active. Those operations require a separate ticket's authority.
