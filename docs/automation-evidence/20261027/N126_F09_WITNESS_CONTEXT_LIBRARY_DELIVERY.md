# N126 / F09 — witness context and cross-criterion library

AI implementation, 2026-10-27. Task `continuous-n126-f09-witness-context-library-20261027`, run `ebb435b7-07d8-49dc-b71f-2e25fb0839c4`.
Base: `c9be2e35849ab816a112c1a87c529b131a18e408` (worktree HEAD and observed origin/main before work). Exact candidate is returned by the worker JSON; this document is included in that commit.

## Bounded result

- Six optional teacher-entered fields per existing witness ID: performed action, activity, historical activity date, class/subject context, qualitative reflection, evidence/source note. Source metrics remain read-only. Fields have bounded lengths; whitespace is normalized to prevent multiline overflow. No teacher scores or execution are inferred from a template.
- Existing owner/year IndexedDB snapshot includes `contexts`; missing keys restore as an empty map. Existing archive version 1 carries these fields with the original photo Blobs and checksum. Deleted custom IDs are filtered out of stored metadata; session Undo restores the context, and final removal forgets it.
- A nonblank query searches all criteria, including renamed titles/descriptions, and retains source, hidden and in-file filters. Results identify criterion number/title and source kind. Selection/restoration navigates to the correct criterion without opting templates into print. Empty query retains the original per-criterion mode. The existing application focus/caret hook preserves keyboard typing.
- 56 original editable neutral examples: 5 in each criterion except criterion 04 with 6. IDs of the original examples are unchanged. Recommended evidence hints are suggestions, not supplied receipts or proof of execution.
- Nonempty context prints on one clearly labeled A4 continuation immediately after its witness, before any photo continuation. Empty fields/pages are omitted. The annual manifest includes this page in numbering and subsequent criterion offsets; chart and photo sheets retain their existing capacity.
- Date uses the existing `rakeez-datetime.js` adapter, historical scope and optional ISO value, including Arabic-digit normalization. No new asset file was added. Read-only inspection of `sw.js` confirmed the adapter, values module, Flatpickr JS/locale/CSS and affected F09 modules are already in the shell list; `sw.js` is unchanged. No runtime Service Worker/offline-cache or cloud certification is claimed.

## Actual affected verification

`node --test tests/portfolio-local-draft.test.mjs tests/portfolio-local-archive.test.mjs tests/portfolio-annual-plan.test.mjs tests/portfolio-evidence-templates.test.mjs`: **18/18 PASS**. Covers legacy/new snapshot and image archive roundtrip, account/year rejection, orphan cleanup, template coverage/truthfulness, context inclusion and chart/photo numbering.

Playwright ran the actual application at task-owned `http://127.0.0.1:5296`, with the canonical `withIsolatedLocalBrowser` helper using this task/run. Fresh synthetic contexts, external requests/WebSockets blocked, Service Workers blocked, no credentials or personal profiles. Vite was created with `strictPort:true` and closed in the owning wrapper's `finally`; each browser/context was closed by the canonical helper. This local-only phase uses the explicit isolation exception, not the shared live-browser lease.

**10 unique affected browser scenarios PASS**, reusing unchanged successful evidence:

1. Owner/year isolation, including context in the owned payload.
2. One-file archive with original image and context restored/reloaded in a separate clean synthetic browser.
3. Custom context removal from disk, session Undo and removal across reload.
4. Existing library type/filter/hide/restore behavior.
5. Existing renamed search, witness reorder and photo Undo.
6. Existing annual multi-criterion assembly and printable ordering.
7. Existing stale-tab conflict refusal.
8. Cross-criterion navigation for all eleven criteria, renamed description/title search, hidden provenance/restoration, in-file filtering, no duplicate inclusion and keyboard focus.
9. Empty/populated contexts, maximum-length notes, historical date normalization/ISO persistence, 320/390px no horizontal overflow, A4 content above footer, sequential unique pages, PDF page count matching manifest and A4 MediaBox. Chart and six photos retained. Product state unchanged. Repeated only to add readable element screenshots.
10. Actual account UI entry with an in-memory synthetic account/year and the real store lease guard: unauthenticated context save reports failure; owner-scoped F09 disk payload stays null; lease stays LIMITED. No guard, credentials or Auth service was mocked.

Commands used the existing Playwright config and an owned Vite wrapper with `RAKEEZX_E2E_SERVER=1`, `RAKEEZX_E2E_BASE_URL=http://127.0.0.1:5296`. Scoped selections were `N126 cross-criterion|N126 optional context|N126 personal context|F09 portable copy can|F09 isolates`, then `N126 cross-criterion|N126 optional context|library switches type|personal witnesses reorder|annual portfolio assembles|F09 refuses a stale tab`, followed by the account entry and readable print capture.

Evidence directories (local ignored artifacts):

- `test-results/`: initial owner/archive/removal passes and original failures.
- `test-results/n126-context-corrected/`: six corrected/affected scenario passes.
- `test-results/n126-context-final/`: final A4/mobile scenario, `context-annual-a4.pdf`, `context-a4-sheet.png`, `context-fields-320.png`, `context-fields-390.png`, full-page screenshots. A4 sheet and mobile form visually inspected.
- `test-results/n126-account-guard/`: final account entry PASS.

Original failures are preserved: date control initially lacked adapter activation (fixed with explicit import of the already cached adapter); cross-criterion hidden test initially forgot that manual criterion navigation resets filters (corrected to choose Hidden again); the account fixture initially attempted to switch a still-mounted database (corrected to use the existing `deactivateWorkspace` lifecycle before mounting its synthetic fixture). No guards or assertions were weakened. These were implementation/harness defects, not service/tool denials.

Syntax checks for all four changed JS modules and the e2e file, and `git diff --check`: PASS. No blanket build or unrelated suite was run.

## Delivery boundary

This candidate is local-only opt-in F09 Preview preparation. No push, deployment, queue/status edit, external service, SQL/Auth/RLS/Storage operation, Product database mutation, N71 cloud integration, Sync change, scoring change or N44 change occurred. Existing F09 service/schema/port denials remain binding; none were retried. Cloud sync and cross-device cloud availability are not delivered. Controller/publisher owns integration, frontend publication and served Production verification; PO acceptance remains separate.
