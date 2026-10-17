# N88 — branded teacher → student example

Task: continuous-n88-branded-teacher-student-journey-20261017
Run: bbb04581-90eb-4340-a8d7-e7c9ccc9abbe
Base: aa6a1843c5102add77d61d1a3777c7916e376bb7
Authority: activated PO17October12:48 card, fabricated public UX only.

The existing exact guest hash now introduces the benefit in one sentence, presents a prepared teacher invitation, and opens a student view with three Digital Skills activities, distinct statuses, 1/3 progress, example grade and next step. Current-step context, visible opening success and reset make the journey reversible. DEMO-ONLY entry remains secondary in a disclosure, with a labelled field and error. One compact synthetic notice covers all screens. No QR/link sharing claim or real invitation was added.

Brand uses unchanged app.css tokens/font stack and shipped light/dark header SVGs, matching the production auth-brand/sidebar lockup. All new styles are scoped inside the standalone guest module. No shared CSS, startup dependency, router, index, SW, account/store/data or provider change.

## Affected verification

- `n88_teacher_invitation_to_student_preview_is_clear_and_interactive`: PASS — actual app DOM/handlers over task-owned loopback HTTP; primary Enter opens student content, three statuses and progress; reset restores teacher state.
- `n88_actual_Rakeez_brand_RTL_mobile_desktop_visuals`: PASS — 390/1280 × light/dark; before/teacher/student screenshots, correct shipped theme logo, inherited font/tokens, RTL, no horizontal overflow, zero axe violations on both screens. Visually inspected before/after; calm cards and hierarchy replace the former disclaimer-heavy layout. Desktop retains parallel activity/progress columns; mobile stacks them.
- `n88_compact_synthetic_notice_manual_reset_keyboard_and_isolation`: PASS — Enter/Tab transitions, focus on student heading and restored primary button, invalid code error, normalized DEMO-ONLY success, reset clears field/disclosure. Fresh contexts use canonical isolated-local-browser helper; external requests and SW blocked. App instrumentation before axe sees only unchanged head theme read. Each axe scan itself reads existing flatpickr CSS once via XHR; exact calls asserted separately from app actions. No app/account/store module graph or remote service request.
- `n88_unchanged_exact_guest_bootstrap_and_source_binding`: PASS — node syntax check and five focused node tests. Byte comparison to base verifies index.html, sw.js, app/router/store, shared CSS and shipped logos unchanged. Exact hash/reload guard retained; source SHA256 binds browser report. Reused `tests/n88-guest-hash-entry-browser.json` protected evidence: guest-back-link, import-failure, ordinary/nonexact-hash visitors, demo-other-hash and synthetic-account-bootstrap. Existing offline shell/cache/install checks pass; no new startup dependency.

Commands: `node --check src/views/n88-public-guest.js`; `node tests/n88-branded-journey-browser.mjs`; `node --test tests/n88-branded-journey.test.mjs tests/n88-guest-hash-entry.test.mjs`.

Browser details and exact screenshot paths: `tests/n88-branded-journey-browser.json`. Twelve screenshots are in the OS temp directory, named `n88-branded-bbb04581-90eb-4340-a8d7-e7c9ccc9abbe-{390|1280}-{light|dark}-{before|teacher|student}.png`. Before serves the immutable base's actual guest module in the same actual application shell; no lookalike template. Screenshots are local evidence, not a public Preview or physical-device proof.

Initial axe run found duplicate unnamed complementary landmarks (notice and sidebar). Fixed notice semantics to a paragraph; zero violations after correction. Initial private-call assertion also detected axe stylesheet reads; harness now asserts app-only calls before each scan and the exact two CSS reads afterward, preserving the observation.

Owned ephemeral HTTP server and disposable browser contexts close in finally. No shared live-browser lease is needed for this eligible isolated synthetic phase. No push/deploy or Production/PO acceptance claim; independent publisher owns delivery. N88 real student access/security and umbrella acceptance remain outside this result.
