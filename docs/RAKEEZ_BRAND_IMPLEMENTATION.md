# Brand implementation — local candidate

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
The favicon and monochrome derivative retain the central workspace and four modules without unreadable text.

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
