# RAKEEZ — UX Quality Gate V1
**Owner:** Product Owner chooses what ships. **Status:** isolated UX Preview / Draft PR #15, not Production.

## Outcome and measurable acceptance
Establish a reusable, objective UI safety net before expanding visual changes:
1. No critical/serious WCAG findings in the current 30 safe, synthetic-demo routes, at 320px/light and 390px/dark.
2. No horizontal page overflow at 320px, 390px or 1280px, and no route rendering failures.
3. Preserve class/roster/attendance, scoring, schedule, current lesson, search and export entry points, RTL, touch targets, reduced-motion, and accessible names.
4. Document excluded scopes explicitly; never call 30 rendered routes a full end-to-end certification.

This is a target for the allowed Demo route subset, not a claim about the 9 excluded routes, authenticated accounts, offline/Sync, services, installation, physical iOS/Android or live data.

## Re-run a measurable gate
From the isolated candidate root:

- Chromium: npm run test:ux:system
- WebKit: npm run test:ux:system -- webkit
- Firefox: npm run test:ux:system -- firefox
- Other focused Demo tests: node node_modules/@playwright/test/cli.js test --config playwright-ux-skills.config.mjs

The gate boots Vite on loopback, forces synthetic Demo, blocks outside network and Service Workers, and needs no account. It reads router declarations instead of a manually maintained list; the current 9 exclusions cover active N36/N44/N88 work and unavailable archived state. It checks 30 safe route templates, and fails if any fails to load, overflows or has a serious/critical axe issue. JSON and Markdown outputs reside in artifacts/ux-system-audit-v1.

IMPORTANT: reading synthetic demo screens does not certify feature business logic, service integration, or privacy. Existing unit and affected functional tests remain required before Production.

## Skill-by-skill application policy
| Skill/tool from study | Practical purpose | Guardrail |
| --- | --- | --- |
| Frontend Design (Anthropic) | Preserve purposeful Arabic teacher hierarchy | No indiscriminate redesign |
| UI UX Pro Max | Typography, spacing and pattern selection | No conflicting palette |
| Impeccable | Clarity, content grouping, density, microcopy | Do not change business behavior |
| Emil Design Eng | Tap surfaces and keyboard interaction | Avoid animation overhead |
| Create Design MD | DESIGN.md token naming | Reuse existing tokens |
| Review Animations | Reduced-motion and calm feedback | No distracting animations |
| Mobile Native | 320/390 mobile layout, touch/input sizing | Physical devices require separate proof |
| Break UI | Long Arabic names, 24 classes, 300 students, empty/singular | Synthetic fixtures only |
| Web Design Guidelines (Vercel) | WCAG semantics, labeling, scroll regions and focus | axe plus DOM inspection |
| Webapp Testing (Anthropic) | Browser-flow checks and before/after images | No account reuse |

These are techniques and workflows, not a direction to auto-install all third-party executables or unreviewed scripts. No new global agent or publisher was created.

## Current audit scope (first wide pass)
- 39 declared route patterns.
- 30 safe Demo routes tested at 320/light, 390/dark and 1280/light.
- 9 deferred due to N36/N44/N88 active work or unavailable archival state.
- The first baseline found two serious accessibility issues:
  - Attendance subject paragraph incorrectly used aria-label; a visually hidden real text node preserves the full subject for assistive technology.
  - Execution report scrollable table was not keyboard focusable; a labelled, focusable region with visible focus fixes it.
- No horizontal overflow or route loading errors in the baseline 30-route sample.

## Workflow
1. Inspect exact source and rendered output; fix semantics/layout, never change the test to hide a real failure.
2. Run the focused route/keyboard test.
3. Run the quality gate and compare the generated report with baseline.
4. Run affected unit, build and WebKit/Firefox tests where material.
5. Keep changes in Draft Preview for the PO to review; no direct Product merge.

## Operational isolation
- The live controller and sole publisher remain authoritative.
- Avoid N36/N44/N88 and their shared persistence/service code while active.
- Never use teacher credentials or real students in Preview.
- Rendering an empty or restricted route is not functional coverage.

## Cross-browser audit caveat (current)
The **30-route full gate is verified on Chromium only**. Focused WebKit/Firefox tests of Schedule/Home from earlier Preview rounds succeeded, but optional full-inventory WebKit and Firefox commands are currently blocked by unstable Demo class context during the audit bootstrap. A separate WebKit Demo-only boot probe did load 8 synthetic classes and 184 students. We have not established whether the scanner's workspace transition or Product initialization causes the inconsistent class state; do not claim these full browser audits passed. Preserve their failed diagnostic evidence locally and investigate without touching Auth, Sync or active N88/N44/N36 scopes.
