# N117 — initial department/calendar service prerequisite

## Current continuation — 20 October 2026

Run `0ebb5450-f191-4951-b332-e54cee3e2455` continues saved candidate `e7a4b30ceb03cc94010d8654328e66d8e241dfe7` on base `66a84641fe74b7f0a33c98e2ec9a72b3c31886b9`. The updated card expressly authorizes ONE locally qualified append service correction. **LOCAL_READY** for independent controller integration/publication; no frontend push/deployment or Product acceptance claimed.

### Implemented behavior

- Actual initial profile form requires a canonical department from the existing 47-row directory, displays its approved short label and hint «تحدد إدارة التعليم التقويم المعتمد لحسابك». Exactly the four named departments map to the existing western preset; all 43 others map to general. No directory/date research or competing date policy.
- Actual OTP return establishes owner → server profile checkpoint → profile completion. Completion sends the durable department through the supported RPC before foundation creation. A fresh owner without a valid department returns to profile completion; READY/restore/claimed-workspace branches retain their calendars.
- The service validates canonical department/preset consistency and the entire exact existing foundation shape, official term/day dates, identities and normal source codec (`preset:<id>` locally ↔ `moe` on the server). It obtains the existing owner/academic writer mutex before row locks. No new tables, roles, Auth configuration or RLS changes.
- The mapped preset is chosen before constructing/inserting any foundation. To preserve N58's existing two-terms-before-selection guard, only the year newly inserted within the same atomic transaction receives that preselected preset after its parents exist, before READY/commit/local import. No default preset is provisioned. A preexisting incomplete foundation fails closed; no committed existing year is retagged. READY snapshots/recovery retain the original receipt path.
- One five-argument completion signature with optional last argument replaces the old public four-argument signature; existing four-argument clients still resolve for existing accounts. Old implementations become owner-only private helpers. No ambiguous public overload, existing calendar switch, N58 API substitution, outbox discard or eager session generation.
- Existing Settings department writes remain metadata-only. Existing startup assets already include the directory module/JSON in `sw.js`; cache generation advances to v75.

### Actual checks

`node tests/n117-20261020/qualify.mjs`: **11 PASS**, disposable native PostgreSQL 17 with existing application schema and exact saved N58 migrations. The initial unrelated N88/N44 staged-service setup was excluded after its missing Auth fixture failed; those services are untouched. Their full suites were not run. Native scope retains calendar/academic guards and current N122/N36 definitions.

- Required/invalid canonical choice; all four special departments plus Riyadh; all 47 directory entries recognized with exactly four special mappings.
- Actual profile completion → persisted checkpoint → provisioning; wrong preset/date rejection leaves zero year rows; correct identity/dates; no duplicate year/terms on retry; metadata changes never remap READY years.
- Foreign owner without checkpoint and anon rejected; private ACLs and single public signature verified. Client owner change during profile preflight issues no completion call.
- Actual application HTTP DOM, handlers and source CSS at 390/1280: initial form → native owner-checked completion/provisioning. Synthetic response lost AFTER native commit → reload → same department/general calendar, one year/two terms, zero slots/sessions/outbox. Later reload never reprovisions.
- Actual installed offline shell caches the existing department module; with `navigator.onLine=false`, empty required selection prevents submission before any completion/foundation creation. This is the narrow field gate, not offline restore/cloud certification.
- Actual stale profile form submitted after synthetic logout is blocked by the application owner guard; native profile remains PROFILE_REQUIRED.

`node tests/n117-20261020/otp-entry.mjs`: **2 PASS**, actual app OTP request/verify/session/reload path reaches the required department form for the synthetic new owner; the same OTP surface preserves an existing UUID without treating it as a new signup. Auth transport is synthetic; no real user or message. The unchanged native qualification is reused.

`node --test tests/n117-20261020/client-mapping.test.mjs`: **1 PASS**, every approved canonical row maps exactly to the existing preset constants; empty, short-label-only and misleading office/city strings are invalid selections. Existing optional metadata-attention validation remains unchanged.

JS syntax and `git diff --check`: **PASS**. No full build, blanket Auth/Sync/calendar suite or real account journey. Original diagnostic and FAIL/NOT_RUN below remain historical evidence and were not replayed. Harness setup/HTTP failures and the exact tool-policy rejection remain in the adjacent original-failure JSON files and `harness-denial.json`; no acceptance failure was edited into PASS.

### One service operation and exact readback

CLI `supabase@2.121.0 migration new n117_initial_department_calendar` created `supabase/migrations/20261020085614_n117_initial_department_calendar.sql`. Qualified immutable SQL SHA256: `f35a1ebadb1ff1b833bf68f4492362adf2bb35c7d05074acd4e8284540832ffe`.

Only after local PASS, official connected Supabase metadata read matched all five relevant preimage bodies/ACLs and showed no N117 migration. The initial read-only metadata query had a SQL syntax error; the corrected metadata-only query succeeded. One `apply_migration` invocation succeeded. Provider history records **`20261020090836 / n117_initial_department_calendar`** (provider-generated version, distinct from CLI filename). Its single stored statement has MD5 `5c4dbe240363de69049eab00fe7f6f92`, exactly matching this SQL file. Never apply it again under the CLI timestamp.

Readback matches the native-qualified bodies: completion `e298f8c2588a742735ca0571fb6ac26d`; provisioning `f6eb00b2589ed8f4f8a5a53537046fe1`. Both retain only postgres/authenticated execute; PUBLIC/anon denied. Renamed helpers are postgres-only. Existing N58 calendar, provisioning-state and foundation-completeness guard bodies/ACLs remain identical. See `tests/n117-20261020/service-preimage.json` and `service-readback.json` for exact metadata/source evidence. No real profile/Auth user/student rows were read or mutated.

Browser and live-mutation leases released. Owned browsers, HTTP listeners and native PostgreSQL clusters stopped. Stopped synthetic runtime directories are retained and Git-excluded because the combined recursive cleanup command was policy-denied; no deletion retry via another surface. No unknown process/lock touched.

The existing-account calendar-switch hold and unresolved old-year incident remain unchanged/UNKNOWN. LOCAL_READY is not served frontend verification, live account acceptance or Product CLOSED; the sole publisher owns those delivery steps.

## Preserved original run — before service scope repair

- Task: `continuous-n117-required-department-initial-calendar-20261020`
- Run: `db801aaf-cf45-4b9b-bad9-1cfe30fe2322`
- Base: `66a84641fe74b7f0a33c98e2ec9a72b3c31886b9`
- Result: **BLOCKED**. This candidate contains a reproducible diagnostic and this evidence only; it does not implement or enable N117.

## Exact Product scope

Read the canonical operating contract and latest N117 row in canonical `docs/PRODUCT_LEDGER.md` (PO20October exact mapping). Required canonical department at initial new-account completion must select the existing western preset for مكة المكرمة، جدة، المدينة المنورة، الطائف only; all other approved departments select the general preset before foundation creation. Existing calendars and the existing-account switch hold remain intact.

## Concrete prerequisite

The current repository service implementation in `supabase/migrations/20260924003436_beta_new_account_provisioning.sql`, function `rakeezx.provision_account_workspace(jsonb)`, rejects any foundation whose calendar ID/source is not `cal:y:1448-1449:preset:sa-western-1448-1449` / `preset:sa-western-1448-1449`, with `22023: Invalid foundation identity`. Its insert path also uses source `moe`. No later repository migration replaces this function. The N58 repair function is a different operation and is not an authorized substitute for initial provisioning.

`src/lib/cloud.js:completeAccountProfile` sends only teacher name, phone, form and school to the four-argument `complete_account_profile` RPC. `src/lib/account-profile.js:validateProfileCompletion` also discards department. The N03 migration adds the durable profile field, Sync field mapping and contract readback, but does not extend the completion RPC. An implementation must use an owner-checked supported persistence path and establish that the intended department survives interruption before foundation creation; merely adding a form field would lose it.

## Actual affected evidence

Command: `node --test tests/n117-20261020/service-prerequisite.test.mjs`

Result: **1 diagnostic PASS**, exit 0. Uses existing `lifecycleServer` / disposable PGlite and the unchanged actual provisioning and N03 SQL, with synthetic identity only.

- Actual profile provisioning → profile completion → begin provisioning succeeds for the synthetic owner.
- Actual general preset records submitted as initial foundation fail with `Invalid foundation identity`.
- Rejection leaves zero years, calendars, terms, calendar days, subjects, time profiles, slots and sessions for that owner. State remains `PROVISIONING`.
- Contract department remains null after the existing completion RPC.
- Positive control: existing western foundation reaches READY. Retrying returns identical snapshot with one year/two terms.

This diagnostic PASS confirms the prerequisite failure. **`n117_required_department_initial_preset_before_provisioning`: FAIL** against the current service contract for a general-department foundation. It is not a rendered-UI PASS or Product acceptance.

Actual new UI/OTP handshake, required/invalid selection, all-four mapping, interrupted department retention, restored-account and offline profile UI checks: **NOT_RUN**. No Product source change was made; no browser/server phase was opened and no lease or process remains owned. No full build/suite, remote service read, real signup, SQL deployment, Auth/RLS/schema change, real data write, queue/ledger edit, push or deployment occurred.

## Retry condition

The activated card explicitly forbids SQL/schema/service changes and supplies no live service preparation authority. The publisher does not apply migrations. A frontend-only candidate cannot satisfy general initial provisioning through the existing RPC. This is a service-contract/authority prerequisite, not merely a missing allowed path or a request for routine PM approval.

Resume this exact task/session only after a separately authorized service correction supports both existing preset identities during initial provisioning with the required owner/retry safeguards, and that exact service capability has been verified (or authoritative readback proves an already-applied compatible implementation). Then implement the bounded client/profile persistence flow and execute the card's affected application checks. Preserve the existing-account hold and the unresolved old-year incident; do not provision western first and switch the year, route through N58 repair, relax ownership guards, or claim the general preset works from a mocked response. Current hosted function identity is unverified; this result makes no claim about live readback.
