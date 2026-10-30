# N146 — About privacy copy

Task: `continuous-n146-about-privacy-copy-20261030`
Run: `a294dd19-f1c9-4730-b4a9-7821ea76e384`
Base: `3ce2e89c16805028483daa3d3296e5a2545485e8`

Copy-only correction in `src/views/about.js`, per the activated N146 card and current Product row.
Added a separate Arabic Cloudflare hosting analytics/technical request-processing sentence.
Provider basis: the activated card records Root's read-only actual Production HTML observation of a pinned Cloudflare Web Analytics beacon; this worker did not repeat that observation.
The existing Umami paragraph remains verbatim, so its signed-out event limitation applies specifically to those events.
Corrected retention wording to «نحتفظ بالبيانات»; removed the internal region code while retaining Mumbai, India and processing outside Saudi Arabia.
Removed the redundant email-app explanation; retained support@rakeezx.com, rights, date/version, links and handlers.
No data, auth, analytics configuration, service or styling changes.

- PASS — `n146_privacy_copy_matches_observed_providers`: exact text/diff inspection against the activated card's observed-provider facts; Cloudflare and Umami are described separately, with no blanket login cutoff claim.
- PASS — `n146_about_syntax_and_scoped_diff`: `node --check src/views/about.js` and `git diff --check` exited 0; reviewed diff contains only the four requested copy corrections and this evidence note.
- Reused N145 route/Settings/back, keyboard and 320/360/1280px actual-app evidence from `N145_ABOUT_LEGAL_FAQ.md`; route, handlers and CSS are unchanged. No fresh rendered-UI PASS claimed for N146.
- No browser/server phase, full build, unrelated suite, Preview, push or deployment performed.

The sole publisher must verify actual Production assets for this candidate. Local readiness is not Production verification or PO acceptance.
