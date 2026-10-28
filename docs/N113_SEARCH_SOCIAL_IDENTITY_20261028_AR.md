# N113 — Social & Search identity audit, 28 Oct 2026

**Status:** Isolated Draft SEO candidate. No Production deployment; no changes to the user's connected Google account.

## Verified evidence
- The owner-shared Search Console screenshot shows four platform properties: Instagram @rakeez.x, TikTok @rakeezx, X @RakeezX, YouTube @RakeezX, in addition to domain property rakeezx.com.
- The owner's connected GSC tab, inspected read-only, shows the homepage indexed in Google with Googlebot Smartphone's last crawl at 24 Oct 2026; the overview had one indexed page, two non-indexed URLs, and two clicks in the displayed period. These are not proof of ranking for all brand queries.
- Anonymous Production checks: HTTP 200, canonical, existing WebApplication JSON-LD, robots.txt Allow:/, and a valid sitemap.xml containing only the homepage. The currently served JSON-LD lacks sameAs.
- Historical Bing record: Indexed successfully on 20 Oct 2026. **No current 28 Oct Webmaster Index-card readback** was available; public search samples are not authoritative.

## Candidate source-only change
Add sameAs to the existing public homepage WebApplication JSON-LD, using property handles visibly supplied by the owner:
- https://www.instagram.com/rakeez.x/
- https://www.tiktok.com/@rakeezx
- https://x.com/RakeezX
- https://www.youtube.com/@RakeezX

The canonical URL for every account needs a check against the actual verified GSC Platform Property before Production. These formatted links have **not all been independently fetched/verified**. Google sameAs can support identity disambiguation but does not promise ranking or a knowledge panel.

## Remaining checks
1. Google Search Console / Performance / Queries: brand/name/domain queries and impressions; each platform property has independent performance data.
2. Google Search Console / Indexing / Pages: inspect the reasons for the two excluded URLs; Sitemaps: confirm submission/success for https://rakeezx.com/sitemap.xml.
3. Bing Webmaster Tools / URL Inspection: current Index card status, crawl date, and Live URL, then Site Explorer and Search Performance. Do not infer Bing index from HTTP 200 or a public web search alone.
4. Keep private teacher/student app routes out of public sitemap.

## Validation
The established n113 public metadata/robots/sitemap test PASS 2/2 and npm run build PASS. No N44/N88/Auth/Sync/grade changes.
