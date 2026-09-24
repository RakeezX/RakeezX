# RAKEEZ X — operating rules

- The Product Owner is the final Product authority. Work-Active is the sole active Visual/UX golden source; Production is the runtime and data authority. Codex implements Production changes.
- Promote only the accepted, isolated Work diff. Never copy a whole Work candidate into Production or restore obsolete runtime files from Archive.
- Keep ticket scope explicit. Do not silently add Product behavior, migrations, or unrelated cleanup.
- Choose proportional gates from [docs/TEST_MATRIX.md](docs/TEST_MATRIX.md), record evidence, and use an exact reviewed SHA for Production promotion. A user-visible ticket remains pending Product Owner Production review before CLOSED.
- Applied migrations are immutable. Treat Production and private data fail-closed; do not clear, rewrite, or inspect them beyond the ticket's authorization.
- Continue autonomously through ordinary test, tooling, and infrastructure issues. Stop for a Product decision, data-loss/security risk, unexpected main movement, schema ambiguity, or a Product-code change outside approved scope.
- Never force-push, reset user work, apply a migration, or deploy without explicit ticket authorization. See [docs/GOVERNANCE.md](docs/GOVERNANCE.md) and [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
