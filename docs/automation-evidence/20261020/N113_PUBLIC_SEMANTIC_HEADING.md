# N113 public semantic heading — 20 October 2026

- Task: `continuous-n113-current-public-semantic-heading-20261020`
- Run: `ca36e715-c4c1-4ac7-995e-7076fe15dcf0`
- Base and observed `origin/main`: `0e6925b8ce699ee3ccb89504cdc4a2662dcbf5b8`.
- Preserved the supplied current Bing indexed report: sitemap success, one URL discovered, homepage indexed and eligible to appear. Last crawl was 18 October 09:08 UTC. This change did not query or resubmit to a search engine.
- The supplied current HTML comparison identified the actual gap: meaningful Arabic page title already present; initial H1 absent; both logo variants deliberately decorative with empty alt and `aria-hidden`.

Added one `h1.sr-only` with the Arabic brand name inside the existing boot composition. Kept the light/dark logo pair decorative and grouped under `aria-hidden=true`, leaving a single accessible brand name in the initial boot tree. Existing `.sr-only` styling was reused. No other app module, metadata, route, visible copy, or boot behavior changed.

## Affected checks

- PASS `n113_public_initial_heading_accessibility_no_visual_change`: `node tests/n113-public-semantic-heading-20261020/heading.mjs` served actual source files over task-owned loopback HTTP and used the canonical isolated browser helper. Before app import, actual rendered DOM exposed exactly one level-one heading named `رَكيز المعلم`; its visual box was 1×1. Toggling its display left boot composition, mark, status message and progress geometry byte-for-byte equal. Actual app CSS loaded; the existing page title remained intact; both logo images retained empty alt and `aria-hidden=true`.
- PASS `n113_current_title_and_decorative_images_preserved`: in a second fresh isolated context the real app booted and mounted its existing signed-out gate. The boot heading was gone, one application heading remained, and the current app's single brand label was present. No credentials were entered. Helper blocked external requests and Service Workers; owned browser contexts and HTTP server closed in `finally`.
- PASS `node --check tests/n113-public-semantic-heading-20261020/heading.mjs` and `git diff --check`.

The old Bing report may retain its H1 notice until a later crawl; this worker makes no new crawl, indexing or ranking claim. Local checks establish source behavior only. The independent publisher owns integration and served Production verification.
