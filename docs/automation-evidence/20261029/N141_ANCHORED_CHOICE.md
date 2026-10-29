# N141 — anchored attendance choices (AI-authored)

- Task: `continuous-n141-attendance-anchored-choice-20261029`
- Run: `27f696f1-7862-45aa-8495-7ee92bb7bc52`
- Base: `01b3f3444ec98e4a9087279afba849f970823b2e`; `git ls-remote origin refs/heads/main` observed this same published main before editing. Clean starting worktree.
- Authority: current activated N141 card and canonical Product Ledger N141 PO-20261029-N141-POPOVER note. Local synthetic preparation; no live records or services accessed.

## Prior failure and correction

The prior published implementation used `btn btn--quiet` on the bulk trigger. The existing `.btn--quiet` rule explicitly sets a transparent background. This was a class-selection defect, not evidence of an unknown CSS override. Its previous geometry/text checks passed without checking computed background, and the choice deliberately used the large `openSheet`; that implementation did not meet the corrected PO presentation requirement. Preserve the original evidence in `N141_BULK_ATTENDANCE_CHOICE.md` as evidence of its original checks, not acceptance of this correction.

The trigger now reuses `btn--primary`. A native `popover="auto"` contains exactly two compact buttons, حاضرين / غائبين, without explanatory copy. Native popover invocation supplies expanded-state accessibility, autofocus, non-modal keyboard navigation, Escape, outside dismissal and focus restoration. CSS anchor positioning follows the trigger; coordinates measured by the existing delegated action supply an older-engine positioning fallback. No new global state or listeners. Route/session rerender removes the old popover.

Each choice captures the rendered session identity and checks the current session and teaching before proceeding and after any prestart confirmation. The existing status-specific prestart sheet remains only after choosing a status. The unchanged `store.fillAttendance(sessionId, choice)` remains the only bulk write; its existing lease/owner, snapshot and only-unmarked behavior is retained. No store/helper, N44/N88, grade, Auth, Sync or date-input changes.

## Focused local checks

`node --check src/views/attendance.js`: PASS, exit 0.

`node --test tests/n141-anchored-choice-20261029.test.mjs`: PASS, exit 0, four TAP tests including the parent, zero failures/skips. Reuses the original N141 native-store fixture and `openReadyServedDemo`; actual application DOM, delegated handlers and source CSS through owned Vite HTTP at `http://127.0.0.1:53142`. Canonical `withIsolatedLocalBrowser`, fresh Chromium context, Arabic locale/Riyadh timezone, 320×800 RTL; external requests and Service Workers blocked. No lookalike templates or store mocks.

| Required check | Observed result |
| --- | --- |
| `n141_anchored_two_choices_accessible_without_modal` | Keyboard Enter opens, first option receives focus, Tab reaches second option; exactly two named buttons and zero dialogs. Escape returns focus to trigger. Outside click closes without writes. Actual router navigation and session switching remove the open popover; returning starts closed. Selection closes it. |
| `n141_primary_button_visible_background_and_320px_geometry` | Computed trigger background `rgb(24, 168, 120)`, text `rgb(6, 35, 31)`, primary class present. Popover top is 6px below trigger and right edges align (within 2px); width ≤160px, height ≤110px. Both options ≥40px high and within viewport; no horizontal document overflow. Additional 1024px option geometry check passed. |
| `n141_existing_session_prestart_unmarked_only_semantics_preserved` | Both statuses fill without an ordinary post-start dialog, including students outside search results. Existing present/absent/late/excused records remain deeply equal in memory and IndexedDB; a concurrent native late marking is preserved. Both prestart status texts, cancel/no-write, confirm and session-switch-during-confirmation guards passed. |

Original N141 data safeguards are reused rather than altered; this is a focused rerun for the changed UI entry. No uncaught page errors. Expected console warnings concern Service Workers blocked by the isolated helper; no offline certification claimed.

The helper closed its browser/context in `finally`, and the test closed its owned server in `finally`. Post-check `Get-NetTCPConnection -LocalPort 53142` found no remaining connection/listener. This eligible isolated phase requires no shared live-browser lease.

Production served-source/rendered-CSS proof: **NOT_RUN**, owned by the original independent publisher. No push, deploy, Product closure or PO acceptance claim. Full build, blanket suite and repeated Preview: **NOT_RUN**, outside this affected scope. The prior N141 remains awaiting PO until its correction is served and separately accepted.
