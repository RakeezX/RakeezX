# N135 local candidate — 2026-10-29

Task: `continuous-n135-mobile-class-badge-20261029`  
Run: `7f7edf7b-c27a-44d7-a77c-56ff340b7baf`  
Base: `3f2d3660da1fe08b6386d0033f58c403f174df34`

Ported only the 35-line mobile class-header CSS addition from PR16 commit
`34a7cdb8f91f4309bf89638ab67b3be1a766c886`. At screen widths <=520px,
the name and status occupy separate grid rows. Existing title/ARIA names,
badge labels, RTL, handlers and N133 compact labels remain in source unchanged.
No N136 account notices, N44/N88 files, backend or real records changed.

## Affected verification

Command: `node tests/n135-class-badge-layout.e2e.mjs` (exit 0).
The test serves actual source through its owned Vite server at
`http://127.0.0.1:53135`, reuses `openReadyServedDemo`, and uses the canonical
`withIsolatedLocalBrowser`. Fresh synthetic Demo only; external requests and
Service Workers blocked, no credentials. Server and browser close in finally;
this approved isolated phase needs no shared browser lease.

| Width | States exercised | Name clipping | Status row | Document width |
| --- | --- | --- | --- | --- |
| 320 | رُصد / حصة اليوم / none | false for all | separate | 320 |
| 390 | رُصد / حصة اليوم / none | false for all | separate | 390 |

All six cards preserve full names in `title` and `aria-label`, visible compact
names, hidden desktop full-name spans, and RTL direction. At both widths the
actual card click opens its classroom, N133 compact identity and add-subject/edit
controls remain visible, and the class switcher opens and returns through its
actual “كل الفصول” handler. Final output:
`N135_PASS {"cards":6,"widths":[320,390],"selectionAndSwitcher":true}`.

Original evidence retained: before CSS, the same synthetic 320px marked card
reported `clipped:true,separate:false,documentWidth:320` and failed its clipping
assertion. First post-change pass verified all six layouts but its interaction
loop timed out because the fixture navigated without closing the open switcher.
Corrected only the test to use the existing close/navigation link; the final
affected run passed. No clipping assertion or guard was removed.
Service Worker warning messages reflect intentional isolation, not offline proof.

Syntax (`node --check`) and `git diff --check` passed. Scoped assertion confirms
only the allowed CSS/test/evidence paths and an exact PR16 CSS addition.
No blanket suite or build was run for this CSS-only source change.

## Publisher boundary

LOCAL_READY only. No push, merge, Preview or Production deployment was performed.
The sole publisher must integrate this candidate and bind served Production
CSS/class-card evidence to the integrated SHA. Product remains pending PO acceptance;
this document does not claim publication, acceptance or closure.
