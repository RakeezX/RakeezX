# RAKEEZ UX Skills — two-page Preview pilot
Date: 2026-10-28 · source base: 3d3f9a61d3c6a138f0326e3a7b563a163b52a141
Status: isolated candidate for PO review; not Product CLOSED or deployed Production.

## Scope
Class Hub (#/teaching/:id) and teacher's student roster (#/teaching/:id/students) only.
No backend, Supabase, migrations, grade/attendance calculations, account/Sync or service-worker behavior changed.
Source contains synthetic local tests only. Do not use real student accounts in Preview.

## Applied improvements
- Roster name font size 12px → 14px; subtitle 9px → 11px; up to two lines on narrow mobile.
- Long student names remain visible for hover/full accessible row name, without horizontal overflow.
- Roster count contrast uses existing --text-2 instead of --text-3; no global palette change.
- Correct singular student count: "1 من 1 طالب" instead of "1 من 1 طالبًا".
- Teacher class switcher announces current class for assistive technology.
- Class tool links retain an accessible description on narrow screens when visual subtitle is hidden.
- Mobile edit button target 44×44; phone touch behavior and reduced-motion respect scoped to these pages.
- Class hub title/subtitle use slightly more legible typography without changing the brand or tools.
- Reference DESIGN.md documents approved source tokens, validated with @google/design.md.

## Comparison (Playwright Chromium, synthetic local-only data)
| Measurement | Before | After |
| --- | --- | --- |
| 24 names at 320px, clipped | 7 | 3 |
| 24 names at 390px, clipped | 3 | 1 |
| Name font | 12px | 14px |
| A11y axe findings on 2 pages, 1280px light | Roster 1 rule / 3 nodes (contrast 4.48:1); hub 0 | Both 0 |
| Horizontal document overflow at 320,390,768,1280 | 0 | 0 |
| Hub tools visible | 10 | 10 |
| Single-count copy | 1 من 1 طالبًا | 1 من 1 طالب |
| Student edit overlay | opened | opened |

Automated comparison: tests/ux-skills-pilot.spec.mjs, playwright-ux-skills.config.mjs.
Run: UX_SKILLS_PHASE=candidate node node_modules/@playwright/test/cli.js test --config playwright-ux-skills.config.mjs
Local before/after screenshots: test-results/ux-skills-compare/baseline and /candidate (not intended for main deployment).
Source-affected unit checks: 16 passed. npm run build succeeded.
Not measured: physical iOS/Android; production or real-account performance; N36/N88/N44 functional behavior.
Remain: 3 clipped examples at 320px, 1 at 390px; preserving screen density was chosen over unlimited wrapping.

## How the 10 named skills influenced this scoped pilot
| Skill | Used for | Installation/claim |
| --- | --- | --- |
| Anthropic frontend-design | Protect domain-specific Arabic teacher identity | source guidance, no new theme or framework |
| UI/UX Pro Max | Typography, responsive hierarchy, component consistency | guidance only; did not run optional CLI database |
| Impeccable | Operate-mode restraint, visual clarity and state hierarchy | guidance only; no third-party executable run |
| Emil Design Eng | Touch targets, microcopy and behavior | source guidance |
| Create Design MD | DESIGN.md with reusable shared design tokens | file generated, lint/export verified |
| Review Animations | Avoid unnecessary motion; honor reduced-motion | focused motion code review |
| Mobile Native | Touch hit area and touch feedback | CSS changes; device hardware verification outstanding |
| Break UI | Plausible long Arabic names, empty/one, responsive widths | Playwright fixtures and before/after evidence |
| Vercel Web Design Guidelines | Accessibility, contrast, form naming, labeled controls | axe WCAG checks and code audit |
| Anthropic Webapp Testing | Real DOM browser interaction, screenshot comparison | Playwright used with existing repo dependencies |

This pilot does not pretend each external tool is required as a runtime dependency. Avoid auto-installing all ten untrusted executables or competing style systems.

## Acceptance gates before Production
1. PO sees hosted Preview and approves/discards specific changes.
2. Compare with current live main for changed files and avoid intersecting N36/N88/N44 scopes.
3. Only existing controller/publisher promotes approved Product code. No direct branch-to-main merge.
4. Recheck mobile/RTL, two themes, accessibility, live-environment boundaries and offline shell if a startup dependency is added.

## Round 2 — compact mobile workflows and a third page (2026-10-28)
This is an additive update to the same **Draft Preview PR #15**; it does not constitute Product acceptance.

### Screen 1: Student roster
- At 320px the four teacher action buttons now use two rows, not four: **200px → 106px** total height.
- At 390px teacher actions height **200px → 96px**; all four actions remain present and ≥44px high.
- Grouping preserves true buttons/links and RTL keyboard order, without renaming the underlying store actions.
- The already verified 14px names, contrast repair and singular count remain unchanged.

### Screen 2: Class Hub
- At 320px the ten class tools now use **five two-column rows**, previously ten one-column rows.
- The measured tools grid height improved **1112px → 482px**; titles are not clipped in synthetic checks.
- At 390px the existing two-column behavior remains unchanged.
- Nonessential motion is disabled under the OS reduced-motion preference.

### Screen 3: Classes overview — NEW
- Tested with **24 synthetic classes**: 9 fourth grade, 8 fifth grade, 7 sixth grade.
- At 320px and 390px, cards now use two columns; grid height improved **2676px → 1360px**, with **24 rows → 12 rows**.
- Academic class names and subjects remain represented by existing short display labels, with full accessible labels; class actions/import and account data are untouched.
- Cards without an assigned subject retain a full-width presentation to avoid squeezing their expandable content.

### Verification
- Playwright focused UX suite: **5/5 PASS** (pilot, small/empty, mobile density, 24 classes, and 300-student search).
- Additional Playwright accessibility matrix: **1/1 PASS**, covering 3 screens × 2 widths × 2 themes = **12 scans**, zero WCAG violations detected in tested scopes.
- 300 synthetic students: all rendered; search/clear search worked. One local render measurement 836ms, *not* an end-user performance guarantee.
- Mobile action targets remained at least 44px high; no unintended horizontal document scroll at measured widths.
- Reduced-motion class cards computed transitionDuration = 0s in the tested contexts.
- Focus and keyboard outline tested on Edit control; 16 focused class/section unit tests passed.
- npm run build passed; generated build metadata reverted after verification so only intentional source/test/docs changes are staged.

### Affected files (round 2)
- src/styles/components.css: tightly scoped roster toolbar, class tools at 320px, and classes grid at ≤520px.
- src/views/students.js: group existing 4 teacher actions into two accessible semantic groups without changing their handlers.
- playwright-ux-skills.config.mjs: include separate focused pilot specs.
- tests/ux-skills-mobile-density.spec.mjs; tests/ux-skills-classes.spec.mjs; tests/ux-skills-roster-limits.spec.mjs; tests/ux-skills-accessibility.spec.mjs.

### Still outside this proof
- Real Android/iPhone hardware, actual teacher account, Sync, Cloud, notifications, N36/N44/N88, cross-browser Safari/WebKit production behavior, and live application data.
- Only the reviewer-selected changes should later enter normal integration through the sole existing Product publisher. Do not merge this Draft branch automatically.


## Round 3 — Attendance and Quick Log lesson-time usability (2026-10-28)

- **Scope:** visual, scoped CSS on the two class tools only. No changes to attendance statuses, quick-log scoring, model, store, session creation behavior, Sync, or Supabase.
- **Method:** real app DOM with synthetic local 12-student class, one synthetic today session; Playwright Chromium on 320/390/768/1280 and light/dark; external requests blocked, no user account. Screenshots are retained locally under test-results/ux-skills-compare/lesson-before and lesson-candidate.

### Before/after at 320px mobile

| Metric | Before | After |
| --- | --- | --- |
| Attendance first student row top | 680px | 595px |
| Attendance context card height | 242px | 211px |
| Attendance progress height | 140px | 98px |
| Attendance student name font | 13px | 14px |
| Quick Log first student card top | 387px | 382px |
| Quick Log toolbar height | 226px | 221px |
| Quick Log card name font at 320px | 12.5px | 13.5px |
| Quick Log search font at mobile | 14px | 16px (iOS auto-zoom prevention) |
| Quick Log reason checkbox label hit target | below 44px | 44px |
| Segmented mode/filter buttons | existing | all >=44px high |
| Horizontal page overflow | none | none |

Additional details: quick-log unavailable students now use a subtle dashed border and normal text opacity instead of dimming the entire card; keyboard focus is visible on plus/minus and attendance statuses, and Quick Log pulse is disabled under reduced-motion.

### Verified checks

- New tests/ux-skills-attendance-quicklog.spec.mjs **PASS** on all 16 configurations (2 pages x 4 widths x 2 themes). Focused WCAG axe scan found zero violations in its tested page scopes.
- New tests/ux-skills-lesson-controls.spec.mjs **PASS** at 320px in light/dark, covering 44px targets, real keyboard Tab focus-visible, attendance search and clearing, Quick Log search/filter clearing, reduced-motion and iOS search font. A first trial of the test incorrectly used programmatic focus without keyboard navigation, which does not prove focus-visible; corrected the test to use Tab, then passed.
- 9 focused attendance/Quick Log unit tests **PASS** (completeness, historical state, card layout, availability order).
- Vite build **PASS**; git diff --check PASS. Generated build metadata was reverted from this source-only pilot after build.
- No actual attendance or Quick Log points were changed for any real user. Real Android/iOS touch behavior and Production app account flows remain outside this proof.

**Safety/approval:** The Draft PR remains Preview only. Do not auto-merge or use real credentials in Preview. N36/N88/N44 work continues in its existing lanes; use only the sole original publisher for any later user-approved Production integration.


## Round 4 — Weekly Schedule and Today's Sessions (2026-10-28)

**Scope:** The existing Schedule route (#/schedule) and the Home current-session/remaining-session presentation. Use the same Draft PR #15, with the single established Cloudflare Pages branch Preview. No real account, grade, attendance, underlying timetable date/time data, slot writes, calendar policy, sync, or notifications are changed.

### Before/after in local synthetic Chromium, 320px

| Measurement | Before | After |
| --- | ---: | ---: |
| Schedule first lesson card top | 479px | 388px |
| Schedule title card height | 105px | 93px |
| Schedule weekly summary height | 96px | 76px |
| Schedule six weekday tabs | 2 rows / 105px | 1 row / 53px |
| Home featured lesson card height | 228px | 179px |
| Home first remaining lesson row top | 773px | 724px |
| Home remaining lesson row height | 72px | 64px |
| Horizontal overflow | none | none |

Fixture: 30 recurring weekly periods over 5 teaching days and 3 synthetic grades/classes, six synthetic Wednesday sessions. Identical synthetic input for A/B. All six day tabs have a 44px height and at least 48px width on 320px, do not clip the Arabic labels, and retain keyboard arrow/selection behavior. Each visible slot Edit/Delete control remains 44×44.

### Accessibility correction

The original Schedule loaded class-summary disclosure contained an interactive timing-profile anchor nested inside its summary element. The baseline automated axe WCAG scan reported the nested-interactive issue. This candidate moves the timing-profile link into a visually aligned sibling of the details disclosure, with a separate accessible label; expanded/collapsed details, 3 summary rows and the link navigation were tested. Updated candidate scan finds no violations within the inspected Schedule/Home scopes. The summary's formatting is CSS-only, and no session or timing profile mutation is done in this change.

### Targeted regression evidence

- New tests/ux-skills-schedule-today.spec.mjs: dense week baseline / enhanced A/B, mobile weekday keyboard selection, independently focusable timing link and 3 class summary rows.
- Existing tests/schedule-mobile-today.e2e.mjs: 3 passed — Today selection, empty Today copy and non-teaching holiday default.
- Existing tests/n132-home-compact-labels.e2e.mjs: 2 passed — full/short class names and immutable stored class, subject and routing identity. These served-demo tests require RAKEEZX_E2E_BASE_URL pointing to the isolated loopback fixture; the pilot Playwright config now defaults that variable to http://127.0.0.1:5194 (not production).
- First run of the new A/B test timed out because it awaited non-existent .home-page instead of the actual .page--home. Corrected test locator and reran successfully. The two existing Home tests initially lacked their required fixture origin; reran with that origin and passed. Neither was a demonstrated Product failure.

### Limits

Screen-width emulation is not physical iPhone/Android validation. The public Cloudflare Preview must use only the product's synthetic Demo path and no personal data. Preview publication and code source parity do not authorize Production merge. Keep N36/N88/N44 scopes and the sole publisher unchanged.


### Round 4 final verification summary
- **Chromium:** 16/16 Playwright tests PASS for all four pilot rounds, including three original Schedule Today tests and two Home compact-label identity tests.
- **WebKit:** 3/3 focused Schedule/Home UI tests PASS on 320/390/768/1280, light and dark, including independent summary timing link and day keyboard navigation.
- **Firefox:** 3/3 corresponding focused Schedule/Home tests PASS with the same fixture.
- **Unit checks:** 21/21 relevant tests PASS for schedule-day policy, export/print eligibility, Home labels, attendance completeness, and Quick Log card layout. Vite build PASS. Source diff --check PASS.
- **Corrected baseline test harness issues:** baseline original test initially timed out due to wrong .home-page locator; fixed to .page--home. Existing served-demo Home tests initially had no RAKEEZX_E2E_BASE_URL; corrected local-only pilot config and reran them successfully.
- **Important:** WebKit and Firefox tests were executed with Playwright on Windows. This is not proof of actual mobile Safari, iPhone, Android, offline service worker, Cloudflare/production data, or real teacher accounts. Browser results belong to the exact pilot candidate.
