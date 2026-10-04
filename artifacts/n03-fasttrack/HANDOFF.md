# N03 fast track — D-079/D-080

## Identity and source

- Product baseline: `861006d5bfb30ed30125ff10a81110c0b2d89f7c` (`origin/main` at ticket start).
- Local branch: `n03-fasttrack-d079-d080` from that detached HEAD.
- Newer PO instruction authorizes N03 Product implementation; the committed `NOT_AUTHORIZED` label is historical for this ticket. The approved visual contract remains `WA-REFINEMENT-0440-2`.
- Verified `docs/work-approvals/WA-REFINEMENT-0440-2.manifest.json` against its Work package: **100/100 files match SHA-256**, including all 16 N03 paths, the final handoff, screenshots, picker source, and the dated 47-name directory. No Work file was copied into active Product code.

## Storage decision: high-risk gate

Current account/profile storage **cannot durably persist Education Department without a new Supabase schema and Sync contract change**:

1. `rakeezx.profile` has no department column (`supabase/migrations/0001_core_schema.sql`, later profile migrations). The similarly named `device.preferredEducationRegion` is a Calendar preference, is device-specific, and must not be reused or changed automatically.
2. `complete_account_profile` in migration `0032_account_profile_access_foundation.sql` accepts only teacher name, phone, teacher form, and school name. `account_contract()` returns the same profile fields. `src/lib/cloud.js` and `src/lib/account-profile.js` enforce that shape.
3. The server and client Sync V2 profile field maps (`0032...sql`, `src/lib/sync-v2.js`) omit the department. Saving it only to IndexedDB would not survive normal cross-device account Sync and could be overwritten by a pull. The old V1 mapping also omits it.
4. Existing `profile_status = READY` is server-controlled from name and valid phone. Reusing or weakening that access/provisioning state for a deferrable department could block general use. N03 needs a separate nonblocking completion indicator.

**Gate:** design/review an additive migration and owner-scoped contract for the field, plus explicit high-risk Supabase/schema authorization before applying it. No migration file was created or applied; no live/private data was read or changed. Do not publish a UI that promises saving until this is resolved.

## Current Product implementation map

| Approved outcome | Current Product surface | State |
| --- | --- | --- |
| Settings → بياناتك only | `src/views/settings.js` identity `<details>` | GAP; no department control |
| Official-name search, keyboard selection, change/remove | Work `public/review/n03/{index.html,app.js,style.css,official-departments.json}` | MATCHED in verified Work source; Product GAP |
| Selected/incomplete and “إكماله لاحقًا” | `src/lib/settings-profile-ui.js`; Settings profile summary | GAP; requires separate nonblocking indicator |
| Persist across account devices | `rakeezx.profile`, account RPC, Sync V2 client/server field maps | RUNTIME-CONFLICT; schema/Sync gate above |
| Demo parity | `src/lib/demo-workspace.js` and shared Settings view | GAP; Demo should use local isolated profile data after shared control exists |
| No onboarding, Calendar automation, live Ministry call | Current onboarding and Calendar paths | Preserve; no edits planned |

## Proposed narrow implementation after gate

1. Resolve catalog packaging/freshness for the dated 2026-09-30 Work snapshot. Keep exact official display names, including the source spelling for Mahd adh Dhahab. Search may fold Arabic variants, but selection must persist a member of the structured directory. No live Ministry request.
2. Add an owner-scoped nullable department field with validation and a reversible null state through a **new** additive migration, account RPC return/write contract, and both server/client Sync V2 profile maps. Preserve existing profile fields and readiness/access semantics. Define catalog version and behavior for a saved name removed by a later directory update before coding that update.
3. Add the Settings → بياناتك control and calm status using the verified Work interaction, adapted to current Product DOM. Keep postpone nonblocking. Persist change/remove with normal profile Sync. Use the same control with isolated local persistence in Demo.
4. Keep the N03 field out of onboarding and Calendar. Do not infer Calendar region or change `preferredEducationRegion` from the department.
5. Before Preview, create a current-Product integrated Work patch and golden evidence under Workflow V3, or obtain the required review for a new visual adaptation. The existing N03 Work source is a static reference, not an exact Product patch.

## Queued checks

Ticket-router class: `CRITICAL_DATA_AUTH_SYNC` (profile/account, owner-bound RPC, schema and Sync), plus visual gates. After the schema contract and integrated patch are approved: synthetic owner A/B and account switch, invalid/non-directory and null cases, Sync offline/reload/cross-device convergence, profile/account RPC tests, Demo isolation, Settings keyboard/search/RTL/light-dark at 1440/390/320, accessibility, `git diff --check`, build/Build Meta and mandatory Preview. N58 owns the Heavy Window, so Vite/browser/build gates were not run here. Production promotion requires exact reviewed SHA and explicit high-risk authorization; no push or deployment in this ticket pass.

## Scope note

Untracked `review/n03/`, `src/lib/education-department-directory.js`, and `tests/education-department-directory.test.mjs` appeared after the initial clean Git status during this pass. Their ownership is unknown; this handoff neither edits nor stages them.
