# N145 — About / FAQ / Terms / Privacy

Task: `continuous-n145-about-privacy-terms-20261030`  
Run: `05c97c2c-6b6e-45e7-a646-650ec6eea417`  
Base: `c159e1a1ea0985db178cfdc8f260e053e75f6f6f` (also observed via `git ls-remote origin refs/heads/main`, 30 October 2026).

Implemented a concise Arabic RTL full page at `#/about`, normal Settings link/back, accessible native FAQ disclosures and keyboard section links. Terms and privacy remain visible, contact is the existing user-initiated support email, version uses BUILD_META and policy date is 30 October 2026. Public boot exception loads only this informational view, without workspace/auth initialization; protected navigation resumes original boot guards. No data/service behavior changed.

Facts reviewed: `src/views/support.js` (support@rakeezx.com), `src/lib/support.js` (bounded technical diagnostics), `src/lib/marketing-analytics.js` and its app eligibility (two optional signed-out marketing events, sanitized campaign tags, Umami, privacy signals), `src/lib/brand.js`, and activated N145 facts for service region/retention. No new company identity, legal certification, retention deadline, consent mechanism or outbound message.

## Affected checks

- PASS — `n145_full_page_route_and_settings_entry`: real app loaded directly without workspace at 320/360/1280px; real Settings link activated by keyboard and app Back returns to Settings at 320/1280px. Protected `#/classes` still shows the workspace gate with production DEV semantics.
- PASS — `n145_concise_truthful_privacy_terms_faq_and_contact`: source review plus actual rendered section headings, privacy/service labels, mailto destination, dynamic version/date; native disclosure and index keyboard interaction. Screenshots at 320 and 1280 inspected visually; no horizontal overflow at all checked widths.
- PASS — `n145_rendered_mobile_desktop_navigation_and_offline_dependency`: `node --test tests/n145-about-page.test.mjs` (1/1, 14.3s), canonical isolated browser helper, owned Vite loopback server `127.0.0.1:53145`, fresh disposable contexts, external requests and Service Workers blocked; server/browser/context cleanup in finally. SW shell list contains about.js and its existing dependencies. This is dependency coverage, not runtime SW/offline-cache certification.
- PASS — `node --check` on about/settings/router/app/sw and `git diff --check`; no full build or unrelated suites.

Harness corrections preserved: first attempt failed before browser launch because a Windows drive path was used as an ESM import; corrected to the canonical relative module import. Initial UI attempt reached About successfully but expected a gate after Back while Vite DEV enabled the existing legacy local bootstrap. Corrected the harness with `define: {'import.meta.env.DEV': false}`; app guards unchanged. Final run passed. Expected existing SW-registration warnings occurred because the helper deliberately blocks Service Workers; no page errors were observed in public-route scenarios.

No real account/data, collector call, shared browser lease, Preview, push or deployment. Existing data/Sync safeguards unchanged; no new proof claimed. Publisher owns deterministic metadata/build and served Production verification; Product remains unaccepted.

## Source binding (SHA-256 before candidate commit)

| Path | SHA-256 |
| --- | --- |
| `src/views/about.js` | `341862def647214bc10d6255c4df587d6bc99355989fc40f2f7e58f23f88a587` |
| `src/views/settings.js` | `65df32755667f13a98c9ad42a150b162eac56d4025de68b04641ea781a9b526f` |
| `src/router.js` | `b14915977ad66602a4fdd31456129217490b6f4f6c1cd6aece7aa5c961bb7d9f` |
| `src/app.js` | `e86c09c5d7d3539eafa1a8ea0fba4cde62bb0d5b54fbca1441a81aedbf776da5` |
| `src/styles/components.css` | `668582762e5685d503fc98caf8640dff1df18c593c58bad120cadc540e96d7c4` |
| `sw.js` | `7c35bc2496ee8286a69ff567aef616ab4579d6523ee920cc44fc05414b3e5da6` |
| `tests/n145-about-page.test.mjs` | `2309b204e80d356c9135d6762221a0fedc926726154cee8ea56cac72b2a5a3cb` |
