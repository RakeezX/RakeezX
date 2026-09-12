# Brand implementation — local candidate

## BRAND-ICON-ASSET-LOCK-01.1 — display scale and favicon framing

All platform icon exports and the authoritative 1254px Master remain unchanged. Presentation-only sizing increases the persistent desktop sidebar/header icon from 56px to 64px, and the mobile Home/header icon from 48px to 54px. Both dimensions are explicit before image load, so the refinement introduces no loading-driven layout shift.

The only asset transformation in this refinement is the Product Owner-authorized 32px favicon framing. `scripts/build-brand-assets.mjs` removes an equal 108 source pixels of outer canvas on every side, leaving a centered 1038×1038 source frame. It then proportionally scales the complete image into the 32×32 RGB PNG canvas. This is one uniform image transform: internal modules, typography, colors, spacing, shadows, and relative positions are untouched. Cache key `v15` exposes the revised favicon without changing service-worker behavior.

The untouched 16px Master review remains insufficiently legible and unsupported. No 16px favicon or replacement symbol is shipped: **MASTER ICON NOT LEGIBLE AT THIS SIZE — PRODUCT OWNER DECISION REQUIRED**.

## BRAND-ICON-ASSET-LOCK-01 — locked master, 2026-09-12

This section supersedes every earlier icon-generation or favicon statement below. Earlier sections are retained only as historical implementation notes; their generated SVG, reconstructed artwork, simplified favicon, and monochrome derivative are no longer Product assets.

Authoritative external source: `ChatGPT Image 12 سبتمبر 2026، 01_01_17 م (1).png`. The byte-identical repository source is `assets/brand-icon-master-1254.png`: PNG, 1254×1254, RGB, SHA-256 `a83bbe865c835e1162d313bc95c6ad9aac34630cceae62a79dab55cf746e5a27`.

`scripts/build-brand-assets.mjs` verifies the source hash and dimensions, then performs proportional PNG resampling only. It does not recreate, redraw, retype, recolor, simplify, or rearrange any artwork. No canvas padding is applied: the supplied source already keeps the functional modules and central wordmark inside the mask-safe area. `assets/icon-maskable.png` is byte-identical to the proportional 512px export.

Generated exports:

- Web/PWA: 512, 256, 192, 180, 96, 64, 48, and 32px.
- Android: 512, 192, 144, 96, 72, and 48px.
- iOS/iPadOS: 1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, and 20px.
- Shared output naming: `assets/icon-{size}.png`; identical dimensions shared by platforms are one byte-identical file.
- PWA maskable alias: `assets/icon-maskable.png` at 512px.
- Favicon: `assets/favicon-32.png`; its framing is governed exclusively by the approved 01.1 rule above.

The 32px Master treatment remains recognizable by the locked four-module silhouette and is used with the authorized outer-canvas framing above. The untouched 16px export was reviewed but is not sufficiently legible, so it is generated only under ignored review output and is not referenced or shipped: **MASTER ICON NOT LEGIBLE AT THIS SIZE — PRODUCT OWNER DECISION REQUIRED**. No replacement or simplified derivative was created.

The locked raster source now supplies the installed PWA/Desktop icon, manifest Android-style icons, Apple touch icon, mobile Home header identity, install prompt, Login, and About identity. The previous `icon.svg`, `favicon.svg`, 16px favicon, and monochrome SVG derivative were removed. Browser title remains `رَكيز المعلم`; Product/runtime/data behavior is unchanged.

---

The remaining sections document superseded brand exploration and earlier responsive refinements. Where they conflict with the locked-master section above, the locked-master section is authoritative.

## Refinement 01.2 — one Home brand treatment

This supersedes the Home hero direction in 01.1. Home no longer renders its own icon/wordmark block at any width. It begins with the existing greeting and timing link, followed by date/calendar context and daily content; no placeholder space remains. Desktop retains the persistent sidebar brand; mobile retains the compact app-header brand.

Login, About, the contextual PWA install identity, all installed-app/PWA assets, small favicon, T3 typography and print/export branding remain unchanged. The install prompt is a purposeful install surface, not another Home hero.

Files touched in 01.2 only: `src/views/home.js`, `src/styles/app.css` (remove unused Home brand-context rule), `tests/brand-identity.e2e.mjs`, and this document. All earlier candidate changes remain uncommitted and preserved.

Validation: 3 focused browser tests and 8 Home/PWA tests passed; Vite build once and `git diff --check` passed. Browser review covered 320/390/412/1280/1440, light/dark, guest and named greeting, Login, About, install prompt, sidebar/header, favicon/title. Regression assertions require exactly one visible app wordmark on Home, no Home hero icon/wordmark, compact greeting height, and no horizontal overflow. Browser runtime/console errors: none. Native OS PWA installation/update was not performed; its approved artwork was not changed.

## Refinement 01.1 — icon and small surfaces

- Home welcome and About now use the approved full app-icon artwork with a prominent T3 wordmark (80px mobile / 104px desktop icon), without adding a new card. Greeting, date, calendar context and timing link remain available.
- Desktop sidebar uses the full artwork at 56px; the Home install prompt uses the same 56px artwork. Login retains the existing full 80px icon.
- Tiny/mobile-header and favicon treatment now uses four stronger green modules framing an open central workspace. It omits letters, miniature pictograms and the previous central dot. Native 16/24/32/48px specimens reviewed against light/dark backgrounds.
- Browser title remains رَكيز المعلم. Versioned favicon links and the existing shell-cache revision ensure a fresh icon request; no cache algorithm changes.
- Main SVG, 180/192/512/1024 PNG and maskable artwork are unchanged by this refinement. The generator's `--small-only` option regenerates only favicon/monochrome derivatives. Fonts and licensing position are unchanged.

Refinement files: `src/lib/brand.js`, `src/views/home.js`, `src/views/settings.js`, `src/app.js`, `src/styles/app.css`, `scripts/build-brand-assets.mjs`, `index.html`, `sw.js`, `assets/favicon.svg`, `assets/favicon-16.png`, `assets/favicon-32.png`, `assets/brand-monochrome.svg`, `tests/brand-identity.e2e.mjs`, and this document. Earlier uncommitted implementation changes remain preserved.

Refinement validation: 3 browser tests and 8 Home/PWA tests passed; 320/390/412/1280/1440 in light/dark, real theme/account/login controls, keyboard navigation, Home branding accessibility scan, icon dimensions and favicon URL loading. No page overflow or browser runtime/console errors in these checks. Vite build passed once; `git diff --check` passed. Native OS installed-app icon update remains a manual device check, not a claimed automated result.

Primary name: **رَكيز المعلم**. RAKEEZ X is a restrained digital signature, not the name.

Model 3 retains the ivory tile, four green workspace modules and central Arabic name.
T3 hierarchy is retained: stronger/larger رَكيز, lighter المعلم, and a quiet X.
The current favicon is wordmark-first on an ivory tile, without modules or X: ركيز المعلم at 24/32px and above, ركيز only at 16px. The browser title supplies the complete name. The monochrome derivative uses the complete wordmark without a tile. The full Model 3 installed-app assets are unchanged by the mobile refinement.

## Typography and distribution

No fonts downloaded, embedded or redistributed. No Dubai artwork/font is shipped.
Live typography uses the existing offline-safe Product font stack. On this Windows workstation it resolves to Segoe UI; other systems may resolve to another locally available fallback.
App artwork uses a complete two-word Segoe UI raster graphic, embedded inside the geometric SVG, to remain consistent across devices. It is not a font, glyph set or outline-font conversion.

Microsoft permits graphics/logos made using Windows-supplied fonts, distinct from redistribution of font software: [Font redistribution FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq).
Dubai Product distribution licensing remains unproven and is not required by this implementation. Matching Dubai exactly would require a separately approved, verified licensing path.

## Assets

`scripts/build-brand-assets.mjs` reproduces the assets on Windows using installed Segoe UI and Chromium. It does not read/copy a font file.

- `assets/icon.svg`: primary composition; inline raster Arabic text, vector modules.
- `assets/icon-{180,192,512,1024}.png`: Apple, PWA and high-resolution artwork.
- `assets/icon-maskable.png`: full-bleed ivory with artwork inset to the mask-safe area.
- `assets/favicon.svg`, `assets/favicon-{16,32}.png`: simplified derivative.
- `assets/brand-monochrome.svg`: single-color derivative.

Palette: ivory #F8FBF8, deep green #0F5132, green #198754, module highlight #34B77E, pale green #D9EAD7; Arabic ink #0C3022. The existing Product action tokens are unchanged.

Only visible strings, brand presentation, assets and shell-cache revision change. Routes, PWA id/start URL, package IDs, data keys, auth, Sync and export data logic stay unchanged. The service-worker revision updates branded shell assets using the existing update mechanism.

Installed OS shortcut labels/icons can remain cached until the browser refreshes the installed app; verify on a real installed device before release. No installation, push or deployment is performed by this ticket.

## Changed files

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `src/app.js`
- `src/lib/brand.js`
- `src/lib/export.js` (visible validation message only)
- `src/lib/report-print.js`
- `src/lib/schedule-export.js` (visible export branding only)
- `src/styles/app.css`
- `src/views/backup.js` (visible completion message only)
- `src/views/class-rules.js` (presentation brand label only)
- `src/views/home.js`
- `src/views/reports.js` (shared summary signature only)
- `src/views/schedule.js`
- `src/views/settings.js`
- `src/views/student.js` (shared summary signature only)
- `src/views/teaching-hub.js` (visible onboarding copy only)
- `assets/icon.svg`
- `assets/icon-180.png`
- `assets/icon-192.png`
- `assets/icon-512.png`
- `assets/icon-1024.png`
- `assets/icon-maskable.png`
- `assets/favicon.svg`
- `assets/favicon-16.png`
- `assets/favicon-32.png`
- `assets/brand-monochrome.svg`
- `scripts/build-brand-assets.mjs`
- `tests/brand-identity.e2e.mjs`
- `tests/home-pwa.test.mjs`
- `tests/visual-system-batch-c2a.e2e.mjs`
- `docs/RAKEEZ_BRAND_IMPLEMENTATION.md`

## Validation evidence

- 14 focused Node tests: Home/PWA and Schedule export engine passed.
- Brand browser checks: Home, responsive shell, Teacher Center, login, keyboard field navigation, About, install guidance and manifest/icon dimensions. 320 / 390 / 412 / 1280 / 1440, light and dark. No page overflow; scoped login-brand accessibility audit passed.
- Existing report/export browser checks passed: real preview/options/download controls, PNG download, isolated print content and A4 PDF outputs. Test fixtures only; no account login submitted and no cloud writes.
- Reviewed generated PNG and rendered PDF pages: support report portrait, grade report landscape and Schedule landscape.
- Vite compilation completed once. Browser tests rechecked final brand asset URL resolution. The existing raw-ESM serving/deployment convention is unchanged; generated `dist` is not a release package for this ticket.
- Local test screenshots and PDF outputs remain ignored under `test-results/`.
- Browser console/runtime errors in completed checks: none. Playwright prints only its environment-level NO_COLOR/FORCE_COLOR warning.
- Native OS PWA install/update is not claimed as verified. Existing browser install guidance and the new manifest/assets are verified.

## BRAND-MOBILE-UX-REFINEMENT-01 — local refinement, 2026-09-11

Workspace: `D:\Abdullah Projects\RakeezX-Work-Active`. Existing candidate preserved on local `main`, HEAD `cf637d176642b6106d9b0df6ffe2827307e96db2`. The supplied Production baseline `d1657568da23906a633bca0a8b02517b4b2de5ef` is not present in the local Git object database. This refinement does not claim alignment with that baseline; no fetch/reset/merge was performed.

Changes in this ticket only:

- Keyboard-only skip-link presentation; activation transfers focus to main without altering the hash route. Pointer usage leaves it visually clipped.
- Wordmark-only ivory favicon: complete name at 24/32px+, first word at 16px. Full installed/PWA artwork preserved. Cache revision changed through the existing shell update mechanism only.
- Home mobile header uses the full Model 3 asset and quiet digital signature; Teacher Center receives a restrained labeled entry. Greeting spacing, install treatment and shortcuts are tighter.
- Mobile Schedule has calmer summary/actions and six equal-width, fully visible day choices; counts remain in content and desktop. No schedule/export logic changes.
- Mobile Calendar has a quieter settings action, bidi-isolated academic-year labels and a compact three-metric progress surface. Timeline text uses contrast-safe semantic tokens in both themes, including desktop.

Files edited by this refinement (other working-tree brand edits predate it):

- `src/app.js`
- `src/styles/app.css`
- `src/styles/components.css`
- `src/views/calendar.js`
- `index.html`
- `sw.js`
- `scripts/build-brand-assets.mjs`
- `assets/favicon.svg`
- `assets/favicon-16.png`
- `assets/favicon-32.png`
- `assets/brand-monochrome.svg`
- `tests/brand-identity.e2e.mjs`
- `tests/brand-mobile-ux.e2e.mjs`
- `docs/RAKEEZ_BRAND_IMPLEMENTATION.md`

Focused evidence:

- 18 Node assertions passed across Home/PWA, Calendar, mobile Schedule default-day and Schedule export-engine tests. `--test-force-exit` lets the focused runner exit after completion despite existing retained handles; no tests cancelled or skipped.
- Five Playwright checks passed: full brand regression, manifest/assets, native-size favicon comparison, daily surfaces, and skip-link standalone/reduced-motion behavior.
- Daily surface matrix: 320 / 390 / 412 / 1280, both themes, RTL, no horizontal overflow. Real Teacher Center entry, all six mobile day selections, export dialog and Calendar settings controls exercised. Desktop weekly grid retained.
- Scoped accessibility audits passed for Home header/greeting/install, Schedule header/summary/day choices, Calendar header/progress; brand regression also covers login and About through 1440px.
- Skip link: hidden by default; keyboard Tab reveals it; Enter focuses main and preserves the Calendar URL; pointer interaction hides it. Standalone display mode and reduced motion were simulated. Native OS installed-app chrome/install update has not been tested.
- Browser console/page errors: none. Vite build ran once and passed. `git diff --check` passed. Generated review images are ignored under `test-results/brand-mobile-ux` and `test-results/brand-implementation`.
- No supplied screenshots accompanied this ticket, so the existing reachable UI and current rules were the visual review basis.

Local: http://localhost:5174/ · LAN: http://192.168.3.19:5174/
Candidate remains uncommitted; no push, deployment or Production writes.
