# N107 unified Koshoof follow-up — local candidate

Task: continuous-n107-unified-koshoof-flow-20261016
Run: fe68cc47-4162-4a86-8534-fc32175e9a6d
Base: 66688ecee4f0fe298a1d0de9cd09dd11177bdb60

Read the canonical operating contract, activated queue card and latest PO-20261016-N107-UNIFIED-KOSHOOF row. `git ls-remote origin refs/heads/main` observed the same base before coding. This is the follow-up to delivered N107/N108, not Product closure.

## Implemented

- Classes has one prominent الكشوف link alongside the existing Add button and quiet delete icon. Empty Home links directly to the same hub's new-class pane. Demo footer and both delete confirmation handlers are unchanged.
- The central hub has three compact sections: new-class file entry, one labelled native existing-teaching import select, and checkbox exports with select-all/count and a shared names-only/names-and-grades choice. Choices reset on workspace/year/term changes; current access is checked again at export/navigation. No per-class action-card grid.
- Single selection downloads readable XLSX directly. Multiple selection produces one client-side ZIP, each teaching with its own XLSX. Reuses N108's stored ZIP writer, extracted into zip.js with binary payload support and UTF-8 entry flags. Existing sanitization plus case-insensitive collision suffixes yields distinct filenames containing class/subject labels, no internal identities. OOXML remains inline text without formulas and keeps RTL, widths, wrapping, zero versus blank. Dedicated Noor CSV remains available; ordinary export always uses Excel.
- New-class CSV/XLSX reads only the student-name column. Teacher selects grade, section label and subject using existing Rakeez controls/catalog. Recognized name headings auto-select; ambiguous columns require a deliberate native selection. A one-column file without a heading preserves the first student. Grade/section/subject columns in a file cannot override manual choices.
- Preview lists names with unique/duplicate/invalid counts; invalid or ambiguous names block confirmation. Changing inputs invalidates old preview. No save until review plus final explicit confirmation. Existing store routines and all owner/session/year/term/lease/transaction guards are unchanged.
- Success shows year label, term, class/subject, saved/pending counts, Open Class and Return to Koshoof. Only actual failure renders partial progress and pending names; UI receipts contain no raw section/teaching IDs. Retry retains existing parent/default records. Legacy #/classes/import loads exactly the same hub component and new-class pane.
- Service Worker v67 caches both added modules for offline navigation. Reports, Auth, service schema/functions and portal extraction were not changed.

## Affected verification

39 Node tests PASS across these scoped commands:

```
node --test tests/n107-classes-import-parser.test.mjs tests/n107-classes-import-mutation.test.mjs tests/n107-central-entry.test.mjs tests/n108-xlsx-export.test.mjs tests/n104-class-operations.test.mjs tests/n12-student-import.test.mjs
node --test tests/n107-unified-koshoof.test.mjs
node --test tests/n90-transfer.test.mjs tests/n90-current-source-sync.test.mjs tests/n105-grade-export-filenames.test.mjs
```

Covers actual account store preview/cancel/replay; owner/session/database/provenance/year/term/archive drift; persisted cross-tab and per-await negative guards; failed teaching/student persistence and exact retry; parser limits/school matching; binary ZIP workbook separation, collisions, names-only/grades, injection-safe inline strings, no identities, Arabic widths/RTL, zero/missing marks; retained scoring/Noor and Sync owner-history admission/dispatch guards. Expected injected failure logs remain visible.

Actual browser evidence: `tests/n107-unified-koshoof-browser.json` (9 PASS checks, zero page errors; Product source SHA256 inventory). Source was served over owned loopback HTTP port 49217, using the existing served-demo readiness and N73 synthetic-account fixture helpers. No credentials or live service/student data; external requests blocked. Shared browser lease acquired with this task/run, then RELEASED after all owned contexts/browser/server closed in finally.

- `node tests/n107-unified-koshoof-browser.mjs`: fresh account app DOM, source CSS and real handlers at 320/390/768/1280; light/dark empty Home/Classes and populated hub, no horizontal overflow; actual CSV/manual override, invalid/duplicate preview blocking, stale-preview invalidation, cancel/no writes, one-class confirmation/success; real student-transaction failure/parent retention/explicit retry; actual native existing-class navigation; captured XLSX/ZIP downloads inspected for per-class separation; term selection reset, archived/foreign teaching filtering, wrong-owner denial, session drift during final modal and expired offline lease all prevent writes. Separate fresh Demo installation certifies Service Worker cached hub/legacy route reload offline.
- `node tests/n107-unified-koshoof-browser.mjs --file-variants`: actual ambiguous-name column selection, actual XLSX preview/confirmation, existing-class duplicate block, meaningful year/term success text, keyboard focus and 320px receipt inspection. Reused unchanged results from the preceding run.
- Screenshots inspected: `test-results/n107-unified/390-light-hub.png`, `320-success.png`, and corrected `320-success-year.png`. All viewport/theme screenshots remain in that owned local evidence directory.

Preserved harness history: initial browser test incorrectly expected a retained draft after changing term. Timeout is retained in JSON previousFailures; expectation corrected because context change correctly clears the draft. Initial new binary test omitted the missing-score student's context object; corrected the synthetic fixture, retaining a blank score assertion. No guard was weakened. Visual inspection found the previous year display used `.name` instead of the actual `.label`; corrected and verified through the focused real UI variant, reusing unaffected earlier checks.

Syntax checks PASS for all changed JS modules, sw.js and browser harness; `git diff --check` PASS. Full build/provider/deploy not run by this worker. Prior unchanged deletion flow evidence is reused from `tests/n107-classes-import-browser.json`; this change only removes/relabels toolbar links, preserving both delete steps. Production integration/provider/served-asset evidence belongs to the independent controller/publisher.
