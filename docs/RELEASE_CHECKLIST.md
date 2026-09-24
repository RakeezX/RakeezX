# Exact-SHA release checklist

1. Confirm branch, baseline, candidate SHA, intended file scope, migration status, and clean tracked tree. Save an evidence manifest under ignored `test-results/evidence/`.
2. Reuse tests only when they match the exact candidate tree. Resolve or report failures; never waive an unexplained failure or count skips as passes.
3. Require Product Owner approval for the accepted Product outcome and explicit promotion authority. Recheck remote main immediately before a fast-forward-only push. Stop on movement or divergence; never force-push or change the candidate during promotion.
4. Verify the normal Production deployment by provider metadata: correct project/environment, non-skipped success, exact full SHA, and current release. A 200 response or Build Meta alone does not prove deployed identity.
5. Run bounded, non-destructive smoke in a disposable context. Do not use private Product data unless specifically authorized. Report deployment and smoke separately if one remains pending.
6. Keep user-visible tickets pending Product Owner Production verification. Do not begin the next ticket automatically.

Automation never applies migrations, changes Supabase, clears browser data, deploys, or touches Work-Active. Those operations require a separate ticket's authority.
