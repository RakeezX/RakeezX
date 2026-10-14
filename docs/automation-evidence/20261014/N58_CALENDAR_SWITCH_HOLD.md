# N58 — temporary calendar switch containment

Task: `continuous-n58-calendar-switch-emergency-hold-20261014`

Run: `2c569f6e-59c2-419b-bb09-e01e8963245a`

Base: `89a162adff6d82eccc95f4605c9c7a99c1ada472`
Verified locally: 2026-10-14, approximately 15:03 UTC.

Authority: the activated urgent PO containment card. Read the current operating contract, activated canonical card and N58 ledger row. `git ls-remote origin refs/heads/main` returned the exact base above. This is temporary client containment; N58 remains open for calendar/Sync root cause, repair and recovery. No push, deployment or Production acceptance is claimed.

The named `CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD` disables the region buttons, preserves the selected card and shows the exact approved Arabic message beside them. A retained/enabled click handler returns with an informational message before either account or Demo application and before the success UI. The existing store command rejects changing a selected preset before writes; same-preset requests return `applied: 0` without refreshing data, changing preferences or activating a year/term. The command uses the existing target year, or the active selected year for noncanonical identities such as Demo. Initial foundation boot and existing-calendar reads remain separate, unchanged paths. Lifting the constraint requires verified calendar/Sync repair and explicit removal through the existing delivery path.

## Affected verification

`node tests/n58-calendar-hold-browser.mjs` — PASS on the final source.

- `n58_calendar_switch_disabled_actual_ui`: actual app at `http://127.0.0.1:4188`, actual Calendar settings DOM/handlers and source CSS, fresh disposable Chromium contexts. Demo, new synthetic account without classes, and established synthetic account restored to General all retain the selected region. Disabled attributes, computed opacity/cursor, nearby message, native mouse/Enter/Space and deliberately re-enabled stale click were exercised. Stale click shows only the hold message with informational presentation; selection and sheet remain unchanged. Years/add-year and term-date controls remain enabled.
- `n58_calendar_hold_no_mutation`: direct `applyCalendarPreset(other, {activate:true})` returns the named hold; identical-current apply returns zero applied. Read-through instrumentation of actual `IDBObjectStore.put/add/delete/clear` delegates to the original methods and observes **zero mutation calls** during affected UI/direct requests and subsequent existing-account read. Full persisted and memory snapshots match, including years, terms, calendars, days, device/preferences, profile and sections. Each synthetic account preserves exactly one rejected and 63 blocked owner-bound sentinels byte-for-byte. No guards were disabled.
- `n58_default_boot_and_existing_calendar_read`: synthetic claimed owner contexts use the actual runtime ownership and lease machinery, locally renewed with synthetic evidence. Empty account `store.init()` creates the normal Western foundation with no classes. Established General fixture is installed directly into its own synthetic database, then loaded through `store.init()`; no switch command establishes the fixture. Subsequent init preserves the entire snapshot. Both keep valid term-date configuration and readable official calendar ranges for planning. Demo entry uses the existing served-demo readiness helper.

`node --check src/store.js`, `node --check src/views/calendar.js`, and `git diff --check` — PASS (Git emits its existing LF/CRLF conversion notice).

Earlier local harness attempts failed on Windows absolute ESM import syntax and an incorrect selector (false boolean attributes render as empty values). Those were corrected in the scoped test. A local Demo direct-call failure exposed its noncanonical year identity; the active selected-year fallback corrected that case before final certification. These were local failures, not live proof attempts.

## Resources and limits

Used the canonical `withIsolatedLocalBrowser` eligibility check with this active local card/run, an owned Vite loopback server and external-request/SW blocking. This eligible phase does not acquire the shared live-browser lease. The helper closes its owned contexts/browser in `finally`; the test closes its owned Vite server in `finally`. Port 4188 had no listener after completion. No profile inspection, hosted service operation, real account access, live fixture, SQL/Auth/cloud/Sync/schema source change, outbox replay or real-data repair occurred. The real reported 1+63 events remain outside this code-only containment. Publisher alone owns integration, deployment and served-source verification.
