# N126 / F09 — pure unfiled evidence selector preparation

AI implementation, 2026-10-28. Task `n126-f09-unfiled-core-1028`, run `27434eca-cc02-4405-9ff2-0d5f87e0c2a3`.
Base: `0c33b120b0baba74af8dd64c7425d7fb83de0411`. The final worker JSON identifies the exact candidate commit.

## Delivered source scope

`selectUnfiledPortfolioEvidence` is one pure read-only export in the existing smart-evidence module. It is **PURE PREPARATION** for the original pending inbox task, not an inbox displayed in the user's browser. The canonical current N126 ledger's PO-20261028-F09-UNFILED-SELECTOR note and activated card authorize only this independent three-file slice.

The caller must pass a nonblank exact `yearId`, validated current-year suggestions from `buildPortfolioEvidenceSuggestions`, current `buildAnnualPortfolioPlan(...).entries`, visible `criteria` using the existing `{number,title}` shape, and the local `hiddenCriteria`, `hiddenWitnesses`, `excludedWitnesses`, `includedWitnesses` Sets and `titles` Map when present. Owner/year provenance remains the upstream caller's responsibility; this selector is not a validator for raw teacher/student records. Missing/malformed required context returns a frozen empty array.

Only the ten existing derived source types, exact current-year IDs, matching official criterion/kind/fixed title, and exact `ركيز المعلم` marker qualify. Hidden, excluded, individually included and annual-plan entries are omitted. Actual annual-plan tests show automatically active attendance, scores and participation sources cannot become duplicate nudges. All repeated source IDs are conservatively omitted, including identical copies and conflicting or tombstone-shaped copies. This avoids enumerating private fields to compare duplicates. Unknown types and custom/templates are omitted. Ordering uses criterion then fixed evidence title and ID; user renames do not reorder evidence.

Each result and the array are frozen. The projection contains only `id` (the existing derived aggregate ID), `criterion`, `criterionTitle` (current criterion label), `title` (fixed source title), `displayTitle` (bounded local rename or fixed title), `sourceKind` and a short Arabic `provenanceState`. The provenance distinguishes review from automatic and does not assert classroom execution or learning outcomes. Caller-provided display labels are preserved as bounded text, not interpreted as verified provenance. References, record IDs, students, owners, grades, metrics, tables and attachments are neither read nor copied. No store call, draft mutation, witness addition, count, score or confirmation requirement is introduced.

## Actual verification

- `node --test tests/portfolio-smart-evidence.test.mjs tests/portfolio-annual-plan.test.mjs`: **21/21 PASS**, including seven new selector tests and all fourteen unchanged source/annual-plan tests. Synthetic actual-record fixtures cover review/automatic status, exact foreign/year-bound IDs, official/hidden criteria, hidden/excluded/included witnesses, merged actual annual selections, duplicates/tombstones, provenance/type/title refusals, stable ordering, renames, frozen safe output and nonmutation of records, suggestions, references, annual entries, Maps and Sets.
- Privacy tests use actual private student-containing log reference IDs, a source Proxy that rejects enumeration and private-field reads, and an enumerable throwing references getter. Projection and JSON serialization succeed without exposing those values.
- `node --check src/lib/portfolio-smart-evidence.js` and `node --check tests/portfolio-smart-evidence.test.mjs`: **PASS**.
- `git diff --check`: **PASS**. Exact changed scope: the smart-evidence module, its Node test, and this evidence file only.

Unchanged actual F09 caller/annual DOM, CSS and handler evidence is reused from [the recorded-work delivery](../20261027/N126_F09_EVIDENCE_FROM_RECORDED_WORK.md); it is not a rendered-UI acceptance test of this new, unwired selector. No browser/server was started and no denied operation was retried. No process/phase resources were acquired.

## Delivery boundary

The original `continuous-n126-f09-unfiled-evidence-inbox-20261027` UI card and `continuous-n126-f09-local-pdf-and-links-20261027` PDF prerequisite remain untouched, including their pending/blocker state. No view, CSS, Service Worker, N71/N44/N88, queue/status, SQL/Auth/RLS/service/cloud or real Product data changes occurred. No push, deploy or Production claim is made. Sole publisher integration, provider and served-asset verification are **NOT_RUN** by this worker. Full F09/N126 acceptance and cloud availability remain outside this preparation slice.
