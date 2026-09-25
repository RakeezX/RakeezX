# Exact-SHA release checklist

1. Confirm branch, baseline, candidate SHA, intended file scope, migration status, and clean tracked tree. Save an evidence manifest under ignored `test-results/evidence/`.
2. Reuse tests only when they match the exact candidate tree. Resolve or report failures; never waive an unexplained failure or count skips as passes.
3. For a **user-visible visual** ticket: Work local result → PO Work approval → Codex strict-fidelity implementation → focused tests → Cloudflare Preview → PO Preview approval. Do not treat Work-local or Preview approval as Production verification. Backend/internal tickets use risk-proportional review and do not require a visual review when no visual outcome changes.
4. Require explicit promotion authority for the exact candidate. Recheck remote main immediately before a fast-forward-only push. Stop on movement or divergence; never force-push or change the candidate during promotion.
5. Verify the normal Production deployment by provider metadata: correct project/environment, non-skipped success, exact full SHA, and current release. A 200 response or Build Meta alone does not prove deployed identity.
6. Run bounded, non-destructive Production smoke in a disposable context. Do not use private Product data unless specifically authorized. Report deployment and smoke separately if one remains pending.
7. Request **PO Production review** for the real user-visible outcome; only then mark the ticket CLOSED. Do not begin the next ticket automatically.

Automation never applies migrations, changes Supabase, clears browser data, deploys, or touches Work-Active. Those operations require a separate ticket's authority.
