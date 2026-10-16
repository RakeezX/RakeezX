# N88 public guest preview — local candidate evidence

Task: `continuous-n88-public-preview-reachability-20261016`  
Run: `7a841bca-7fba-48ac-9f38-0ca158871df7`  
Base: `f3014b1f60cfa56e1f8578aa9817917c884031e3`

Added `public/n88-invite-preview.html` as a standalone Arabic RTL static preview for fabricated school, student, and activity data. Its inline-only CSP disables network connections and forms; interactions only reveal/reset sample content or switch the page theme. No app imports, real invite token, account access, storage, or external resources are present. The existing Demo-only `#/n88-invite-lab` implementation is untouched.

Checks run:

- `node --test tests/n88-public-invite-preview.test.mjs` — PASS: scoped assertions cover static Arabic RTL page, disclosure, synthetic copy, restrictive CSP, no app imports/storage/auth/network APIs, responsive CSS and focus styling.
- `node tests/n88-public-invite-preview-browser.mjs` — PASS: direct anonymous HTTP request to `/n88-invite-preview.html` in fresh isolated contexts at 320/390/768/1280 px in light/dark modes. Actual page handlers and CSS passed keyboard mock opening, manual invalid/valid example, reset/back, theme switching, RTL and overflow checks. Each context requested only the one same-origin static document. Owned contexts/browser/server were closed.
- Vite publicDir copy check — PASS: Vite ran with a tiny temporary JS entry (not the full application build), copied the exact source to `dist/n88-invite-preview.html`, and byte comparison passed. Temporary entry was removed. The publisher still performs its deterministic full build and served-asset verification.

Publication and served-asset identity are not claimed by this local evidence.
