# N107 — readable mapping, Noor selection and responsive tabs

AI-authored scoped implementation and evidence, 17 October 2026.

- Task: `continuous-n107-readable-mapping-noor-responsive-tabs-20261017`
- Run: `77244486-2720-4d11-a881-16eae1cb396f`
- Base / observed local origin/main: `3246572025788e2df46bc7be682c64e0b39bde92`
- Authority: activated N107 card and canonical Product ledger PO17October15:01 row. Canonical N36 row is Production verified; the existing 0.5.11 hub download and handoff functions are unchanged.

## Changed result

Before: grade-column rows omitted readonly columns, repeated optional-ID labels and scattered new-item fields; Noor repeated items in checkbox chips and group rows; tabs had small fixed minimum widths; the appbar said «الكشوف» above a duplicate body heading.

After: one source / destination / status grid becomes individual cards on small screens, with the same indexed controls. Readonly columns remain visible with a short reason. A 20-point source versus an existing 10-point item remains ignored until explicitly chosen; the status names both maxima. New-item name/max fields appear together only in their row; explicit new selection reuses the existing header parser's valid proposal, without guessing unknown maxima. The optional stable-ID selector has one collapsed label and retains the unique-name fallback.

Noor renders each item once, with inclusion, name/max and group in the same row/card. Exclusion disables the group and does not redistribute values. Two LTR numeric totals replace RTL arrows; invalid assignments retain the existing export refusal. One confirmation and one Noor export button remain. Import/export tabs equally share available width with 44px minimum targets. The actual appbar uses «استيراد وتصدير الكشوف»; the body landmark receives route focus without scrolling and has no duplicate heading. A narrowly scoped title rule permits wrapping at 320px.

## Focused checks

`node tests/n107-readable-mapping-noor-browser.mjs` — PASS, five groups, zero current failures. Machine evidence and tested SHA256 values: `tests/n107-readable-mapping-noor-browser.json`.

The test reuses the established N107 served-app helper and N73 account fixture with real app DOM, source CSS, handlers, store, ownership guards and durable grade command. All account/service data are fabricated and local. It uses the canonical isolated-local browser helper, fresh disposable contexts, blocked external requests/Service Workers, and task-owned loopback HTTP port 49727. Browser/context cleanup is owned by the helper; the server closes its connections in finally. No listening server remained afterward; no shared live-browser lease was needed under the isolated-local exception.

- Mapping at 320/390/1280: six user-shaped fabricated headers, auto/readonly visible but ignored, exact existing projects match, explicit 20-versus-10 homework mismatch, proposed exam name/max, optional ID collapsed, row-local new/existing controls, focus after repaint, duplicate-target refusal, no pre-consent database changes or transport request. Unknown manual max stays blank and refuses review.
- One mapped 7 / 0 / blank account flow: one final confirmation; real owner-bound outbox command checked by the synthetic transport; exact receipt persists only 7 and 0. No write occurs before consent.
- Noor: exactly five item selectors/rows; baseline 10+10+20 = 40 and 20+40 = 60. Deselecting homework gives 30/40 and disables its group; selection/group changes invalidate confirmation. Unassigned and wrong/over totals refuse actual export. The real export handler's CSV Blob has the preserved headers and missing marks remain blank. Swapping the two 20-point items between groups keeps valid totals and changes the actual exported 60-group score from 7 to 0, proving group choices reach the payload.
- Equal tab widths, minimum height, retained file on resize, existing tab/context reset semantics, one actual appbar heading, no horizontal document overflow or title clipping at all three widths.

`node --test tests/n36-concise-import-panel.test.mjs` — PASS (1/1): extension-first placement, 0.5.11 download and surrounding handoff/owner/review behavior retained.

`node --check src/views/class-import-center.js`, `node --check tests/n107-readable-mapping-noor-browser.mjs`, and `git diff --check` — PASS.

## Visual inspection

Inspected all six actual-application full-page screenshots in `tests/fixtures/n107-readable-mapping-noor/`:

| Width | Mapping | Noor |
| --- | --- | --- |
| 320 | `mapping-320.png` | `noor-320.png` |
| 390 | `mapping-390.png` | `noor-390.png` |
| 1280 | `mapping-1280.png` | `noor-1280.png` |

Desktop aligns source, destination and status; mobile wraps each row without a second control list. The 320px title wraps cleanly to two lines; 390/1280 show it on one line. New-item name/max remain together, optional ID is collapsed, totals use stable number order. Native selects retain their complete destination names/maxima in options; long selected values can use the browser's native visual truncation on narrow screens. Fixed bottom navigation appears in full-page captures; normal scrolling exposes the content behind its captured position.

## Reused evidence and corrections

The focused test compares normalized source against the exact base and records hashes for unchanged reviewNewRoster, transferConfirm, transferExport, immutable-plan/continuation/compactReview and directExtensionEntry sections. Core grade mapping/review, Noor CSV, XLSX and store files are byte-equivalent after line-ending normalization. Existing negative owner/lease/term/session, ambiguity, foreign-ID, partial-receipt and blank-versus-zero proofs in `tests/n107-calm-single-review-import-browser.json` are retained; the older 28/300-row journeys and unrelated Auth/Sync suites were not repeated.

Initial development runs exposed an unclosed new-fields wrapper and the 320px clipped title; both were fixed. Harness synchronization was corrected for asynchronous repaint, focus was explicitly set before a select operation, and the unknown-max assertion now accepts the existing engine's specific refusal. No guard was weakened. Original prior-task failure records remain untouched, and this run's corrected development failures are summarized in its JSON.

No push, build/provider deployment, Production verification, live student/teacher mutation, service operation or PO acceptance was performed. The independent publisher owns integration/build/provider/Production evidence. N107 remains open; N104 is untouched.
