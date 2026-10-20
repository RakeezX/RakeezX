# N117 — initial department/calendar service prerequisite

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
