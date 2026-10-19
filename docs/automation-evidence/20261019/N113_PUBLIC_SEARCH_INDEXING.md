# N113 — public search discovery groundwork

- Task: `continuous-n113-public-search-indexing-20261019`
- Run: `5b3fba1c-fa4d-4d86-9f1b-8567733d931e`
- Base and observed origin/main: `80d7a264596cb38c1856796c0c30c23dbbb6b49f`
- Authority: activated N113 card and canonical ledger's PO19October N113 row.

## Observed problem and bounded change

Read-only public HTTP inspection on 2026-10-19 (07:43–07:44 UTC):
`curl.exe -I https://rakeezx.com/` returned 200 with HTML content type and no
X-Robots-Tag in the observed headers. `/sitemap.xml` returned a "Not found"
HTML document (with provider JSD injection), not sitemap XML. `/robots.txt`
returned provider content-signal comments without a sitemap declaration.
The web browsing tool separately reported these URLs inaccessible; the public
HTTP CLI observations above are the evidence, not a browser-rendered UI claim.
No local file or denied browser operation was reopened through another surface.

Source had a canonical and description but no robots/sitemap files or structured
data/social title and description. The existing router is hash based and includes
private workspace routes. Only the canonical root is therefore listed. Added root
robots/sitemap and consistent Arabic title, social metadata and minimal factual
WebApplication JSON-LD. No runtime modules, auth/routes, CSS, student data, storage,
grades, Sync or existing ownership guards changed. No public page was invented.

## Affected verification

- `node --test tests/n113-1019-public-search.mjs`: PASS, 2 tests; required
  `n113_public_metadata_canonical_robots_sitemap_private_routes_excluded` and
  five fabricated regression mutations rejected (missing canonical, noindex,
  crawl denial, private hash URL, invalid JSON-LD).
- PowerShell `[xml]` parsed `sitemap.xml` and read its sole URL as
  `https://rakeezx.com/`.
- `git diff --check`: PASS.
- Initial test run: 1 PASS / 1 FAIL because the test incorrectly applied its
  query-character exclusion to the XML declaration's `?`. Corrected that harness
  assertion to inspect URL values only; the XML declaration remains required.

These are metadata source/syntax checks, not rendered UI evidence. No browser,
server, live fixture, service mutation or shared phase resource was needed.
No broad suite/build rerun for this head/discovery copy change.

## Delivery boundary

Candidate commit is recorded in the worker result. No push/deployment, provider
acceptance, Search Console submission or actual search indexing is claimed.
The sole publisher/controller owns integration and served verification. Include
`robots.txt` and `sitemap.xml` in served-path inspection: the current publisher's
default root asset set does not automatically verify these new file types.
Check actual text/XML responses and the sitemap declaration after any provider
robots injection; source readiness alone does not prove those served results.
