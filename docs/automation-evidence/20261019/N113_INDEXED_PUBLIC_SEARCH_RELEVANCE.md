# N113 — indexed homepage relevance

- Task: `continuous-n113-indexed-public-search-relevance-20261019`
- Run: `b21c55d4-c6e8-427d-afa4-9e18749cbe57`
- Base: `98885befd4f13c02210661309a4add21e04c72ca`; `git ls-remote origin refs/heads/main` observed the same SHA during this run.
- Latest canonical Product row: PO 19 October 15:32 feedback accepts Search Console homepage indexing, availability on Google and HTTPS. This is supplied PO evidence, not a new worker Search Console observation. Applies to homepage only.

## Gap and bounded correction

The existing head described classes, lessons, attendance, grades and reports, but
omitted explicit student management and lesson timetable wording. The actual
public landing already describes these capabilities in `.n37-message` and
`.n37-benefits` in `src/app.js`. Updated only the title, description and matching
Open Graph, Twitter and WebApplication description in `index.html` to identify
the teacher product and these existing capabilities. Retained full brand,
canonical domain and offline description. No new visible section, route,
dependency, competitor claim, rating, price or hidden keyword text.

## Affected evidence

- PASS: `node --test tests/n113-1019-public-search.mjs` — 2/2 existing focused checks: metadata/JSON-LD consistency, canonical identity, crawl allowance, singleton homepage sitemap and negative fabricated regressions.
- PASS: `node tests/n113-feedback-1532/public-relevance.mjs` — actual source app served on owned `http://127.0.0.1:15329/`, Chromium fresh context through canonical `withIsolatedLocalBrowser`. Observed visible real landing copy, source CSS, title, descriptions and JSON-LD agreement; fetched actual robots/sitemap, homepage-only URL list, no noindex; clicked existing login entry and observed visible email field without entering credentials or submitting. External requests and Service Workers blocked by helper. Browser/context and owned HTTP server closed in finally.
- Initial harness failures retained: first Vite attempt timed out after 30000 ms awaiting `[data-workspace-gate] .n37-message p`; diagnostic attempt timed out after 15000 ms at the same selector. The captured DOM was the empty local workspace (“ابدأ بفصولك وطلابك”), not the landing. `src/app.js` passes `allowDevelopmentLegacyBootstrap: import.meta.env?.DEV === true`, explaining the fixture mismatch. Replaced Vite DEV serving with the existing N37 static-source server pattern. No Product guard or source behavior was changed to pass. Corrected real-app scenario passed as above. These failures were local harness failures, not evidence of failed public indexing or ranking.
- `git diff --check` passed before commit. No full build or whole-app suite needed for head copy.

## Limits and delivery

Indexing confirms inclusion in Google's index, not position for Arabic queries.
This improves truthful relevance but does not prove ranking, prescribe a search
snippet or guarantee update timing. Sitemap and robots are unchanged; private
student/teacher/account/hash routes remain excluded from the sitemap. No live
account, student, service, credentials, Auth/RLS or Search Console mutation.
Existing prior indexing groundwork and accepted PO indexing evidence are retained.

This is local candidate readiness only. The independent serial publisher owns
integration and provider/served Production evidence. No deployment or PO Product
acceptance is claimed here.
