# N119 — plain truthful sort labels, PO20October

AI-authored copy-only change and local evidence.

- Task: `continuous-n119-plain-sort-label-20261020`
- Run: `d8f9dee7-8fb4-4720-b018-4a01cf30ce35`
- Base: `5a91a2b478f63aa0cde33e744f113a404298d0ef`
- Authority: canonical N119 ledger row `[PO-20261020-RESUME]` / `[PO-20261020-LABEL-FEEDBACK]` and activated card. Previous conditional acceptance of deduplication remains historical.

Gradebook and report alphabetical choices now read exactly `أبجديًا`. Distinct saved/historical roll remains `حسب رقم الكشف`; support urgency remains `الأكثر حاجة للدعم`. Historical default remains unchanged. Only label literals changed: existing conditional branches, option values/order, aliases, handlers, numbering, records and CSS are untouched.

## Affected checks

- PASS `n119_plain_truthful_sort_labels`: Node scoped assertion compared both complete source files against their base versions after only the four approved alphabetical-label substitutions. Evaluated the actual report `sortOptions` definition for all 16 tab/historical/distinct-roll combinations, checked unchanged option values/order against base, exact alphabetical labels, separate roll label and support urgency label.
- PASS `node --check src/views/grades.js` and `node --check src/views/reports.js`.
- PASS `git diff --check`; inspected the three changed source lines.
- Reused unchanged handler/DOM/data evidence in `../20261019/N119_ALL_FILTER_SORT_DEDUP.md`, including former-member attendance and historical roll distinctions. This run's assertions are source checks, not a new rendered-UI PASS. No browser matrix, Preview, suite or build was run, as explicitly scoped by this copy-only card.

Observed local `origin/main` was `66a84641fe74b7f0a33c98e2ec9a72b3c31886b9`; its affected views have no diff from the supplied base. No remote freshness or deployment claim is made.

No browser/server/lease resources were acquired. No live account, service, real data, queue or ledger mutation occurred. Independent publisher integration and served-source verification remain outstanding; LOCAL_READY does not assert Production delivery or whole-ticket acceptance.
