# N128 — V6 reference picker candidate (AI)

Date: 2026-10-27 Asia/Riyadh. Result: **BLOCKED; do not publish this candidate**.

- Task: `continuous-n128-v6-subject-picker-reference-20261027`
- Run: `edd04f6a-123e-4c14-a337-dd6e92846a3b`
- Base: `3b6a6b03beb2bad1a8365539a9caadc125da9957`
- Exact fetched source: `61f7c90893fdf8561d395d5e2b688592aaf4af85` (selective file port, no merge).
- Candidate: the AI commit carrying this evidence; full SHA returned in the worker result.

## Scope and provenance

The four Product files and V6 unit test are byte-equivalent after LF normalization to the named source: `src/views/teachings.js`, `src/lib/subject-catalog.js`, `src/lib/official-v6-subject-data.js`, `src/lib/stage-subject-options.js`, and `tests/stage-subject-options-v6.test.mjs`. The only builtin catalog change is the PE alias. No V2 context, subject-change workflow, schema, Sync, Auth/RLS, restore, storage engine, notifications, or service-worker changes were imported. N127's `src/views/teaching-hub.js` is unchanged.

All submit validation and everything from `let demoBusy = false` onward in teachings.js were compared against the base and are unchanged, including createTeaching, workspace/term/context guards, duplicate rejection, and the existing add-subject handler. The catalog filters suggestions only; it never persists program/track context, renames history, or binds a guide entry to a server Section identity. Current/custom subjects remain selectable.

The data contains 1,211 source rows. Recomputed JSON rows SHA256: `99408a3e2ea0345d103c6f2421a50d4eefacfc87f40e04625cd7d972b9f24aac`. Source PDF SHA256 retained exactly: `763cc563d832b1876e6ae04d3e26729b56a8b59f7b8fd7f757778cfce73333bd`.

The [MOE public study-plans page](https://www.moe.gov.sa/ar/education/generaleducation/StudyPlans/Pages/Study-plans.aspx) still displays the fifth edition (read on 2026-10-27). The [SNCC sixth-edition PDF](https://www.sncc.gov.sa/reports/study_plan_guide_v6.1.pdf) is the 114-page source recorded in the approved source commit's `docs/automation-evidence/20261025/V6_STAGE_SUBJECT_CANDIDATE_AR.md` and activated card. A fresh web read of that PDF returned **403 Forbidden**; no alternate surface was used to bypass it and no fresh PDF-content verification is claimed. Edition/year applicability is deliberately not certified for all 1448 programs. UI suggestions cover supported grades 1–12 and distinguish supplemental programs.

## Affected verification

| Check | Actual result |
| --- | --- |
| `node --test tests/stage-subject-options-v6.test.mjs` | **22/22 PASS**, including 1,211 rows, grade/program/track filtering, source references, Arabic/PE stable builtin identity, existing and custom subjects |
| Chromium V6 chooser | **5/5 PASS**, actual application DOM/handlers/source CSS, mobile 390×844, task-owned Vite `http://127.0.0.1:5198`; final two modified tests rerun **2/2 PASS** to explicitly select then clear program/track selections and custom names |
| Chromium synthetic persistence | **3/3 PASS**, create/reload; two added subjects in an existing section with a nonempty shared roster; custom Tajweed/reload |
| Existing add-another-subject UI | **PASS** within persistence test: actual class settings → «إضافة مادة أخرى لهذا الفصل», disabled grade, original section ID, +2 distinct teachings, identical roster IDs, unchanged total student count, separate nonempty default-item identities after reload |
| Exact source parity and preserved create/submit guards | **PASS**, Node assertions against immutable Git source/base |
| Syntax and whitespace | `node --check` on all seven JS/MJS candidate files and `git diff --check`: **PASS** |
| `node --test tests/offline-route-graph.test.mjs` | **FAIL**: two new reachable modules absent from current SW SHELL, plus eight unrelated existing portfolio modules; failure preserved, no assertion weakened |
| Current SW offline runtime | **FAIL**, described below; this is the release blocker |

Browser tests use fresh disposable contexts and no school login, credentials, personal profile, or external traffic. Existing `openReadyServedDemo` is reused. Browser lease was acquired through the canonical resource-lease script and released with this run's owner token. Vite, the static server, and owned Chromium instances were closed in finally; no listeners remained on 5198/5199. No push, deployment, provider verification, or real service/data operation ran.

## Preserved failures and fixture corrections

The first current-main run was 4 PASS / 4 FAIL. One assertion assumed only account builtin tokens, while current Demo correctly uses `subject:demo:subject:digital`. The three persistence failures occurred after reload because `makeIsolatedDemoContext` unconditionally sets `preparing` in its init script, requesting a fresh Demo seed every navigation. The scoped tests now initialize the Demo request only when absent, preserve `active` across reload, and compare the chosen token to the current preexisting option. No Product guard was altered. The corrected run passed all eight cases; the two subsequently strengthened program/track tests also passed. The persistence scenario now checks actual nonempty rosters and distinct default items, rather than inferring student isolation from two teaching counts.

Historical `subject-flexibility.test.mjs` **4 PASS / 2 FAIL (`OFFLINE_LEASE_LIMITED`)** is reused from the named source's baseline evidence. It was not rerun or relabeled PASS. Lease/owner guards remain intact.

The first static offline harness attempt timed out waiting for bootstrap; a diagnostic attempt identified JSON modules served as `application/octet-stream`. Correcting the temporary server MIME map to `application/json` allowed the unchanged app to boot with no page errors. These harness failures are not treated as offline Product evidence.

## Concrete blocker and retry condition

The corrected offline check served **unmodified actual application files** and current `sw.js` over `http://127.0.0.1:5199`, `Cache-Control: no-store`, in a fresh Chromium context with Service Workers allowed under the shared browser lease. It booted the synthetic Demo online, waited for SW control, inspected the installed cache, switched the context offline, and opened a fresh document at `/#/classes`.

Observed result:

```json
{
  "phase": "offline",
  "status": "FAIL",
  "cache": {
    "key": "rakeezx-v87",
    "missing": [
      "src/lib/stage-subject-options.js",
      "src/lib/official-v6-subject-data.js"
    ]
  },
  "ready": false,
  "errors": [],
  "offlineErrors": [
    "Failed to load resource: the server responded with a status of 504 ()",
    "[rakeezx] تعذّر تحميل الشاشة TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:5199/src/views/teachings.js"
  ]
}
```

The new dependency edge requires an authorized offline-shell update; `sw.js` is explicitly excluded while N44 owns that scope. It was left unchanged. Preserve this exact candidate/session. Resume only after the N44 conflict is resolved and the controller supplies explicit SW scope to incorporate these modules and the appropriate cache generation, then verify the materially changed offline path. Do not repeat unchanged local checks or publish the current candidate as ready. Production and PO acceptance remain unclaimed.
