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
