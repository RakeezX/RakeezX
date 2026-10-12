# N54 Option A — scoped candidate evidence

Task: `continuous-n54-keyboard-compression-20261012`  
Run: `2324e95f-1840-49a9-89ea-86c5fcc56b74`  
Base: `d87f4d7f7daa94e3b3da28794079721790059aae`

Authority: activated 2026-10-12 card and WA-N53-N54-0434 Option A;
D-066/D-067 and their 0413 physical findings informed this new implementation.
The reported 562→227px / scale 1 measurements are prior PO evidence, not a new
device test. Neither rejected 0408 nor diagnostic-only 0411 is promoted.

## Actual route and reproduction

Raw Product `index.html`, ESM, CSS and handlers served over loopback HTTP confirm
that signed-out landing → «ابدأ مع ركيز المعلم» now opens **inline email**, with
working back/focus restoration, in both Chromium and WebKit. The historical
landing-to-email-sheet trigger is absent on this base. It was not reconstructed.

The retained Product Mini Hub email sheet was exercised through its real
`open-teacher-mini-hub` → `mini-hub-login` handlers. The existing
`tests/helpers/settings-0397.mjs` creates a disposable synthetic workspace and
intercepts Supabase transport; `setMockAuth(null, null)` establishes local
signed-out presentation for this retained handler. No real credentials, OTP
send, verification, account edit or student/teacher mutation occurs.

Before patching application source, four baseline cases passed assertions that
**reproduce the defect** (not assertions that the old UI is acceptable):
Chromium 151.0.7922.34 and Windows automated WebKit 26.5, RTL widths 320/390px,
normal visible height 562px and controlled visual-only compression to 227px,
scale 1. The actual sheet measured 215px, header 60.78px, footer 44px and body
32.22px. The 51.59px email input could not fit in that clipped body.

## Observed candidate result

Under severe compression (≤350px on narrow/coarse-pointer form surfaces), the
sheet becomes the single page-like scroll surface; header, natural-height body
and actions participate in that flow. Email body height remains approximately
241px instead of shrinking to 32px; the scroll viewport is 227px. Focused input
is automatically revealed and remains 16px text / approximately 52px tall.
Labels, primary action and close control are readable and hit-test reachable
through the same scroll owner. Restoring height returns the normal sheet and
clears obsolete nested/outer offsets. Existing form/data handlers are unchanged.

| Affected check | Result | Observed scope |
| --- | --- | --- |
| keyboard_reproduction | PASS | Four before-fix reproductions; four corrected email cases on the actual shared Product form, Chromium/WebKit at 320/390px and 562→227px, scale 1; focused input, label, primary action and close hit tests; inspected before/after screenshots |
| viewport_recovery | PASS | Three focus/blur/compression/restoration cycles per email case; 35px visual offset; 844×390 touch landscape with 227px visual height; retained value/focus; nested sheet close/Escape and body-lock release; profile email modal mounted while compressed, two cycles, actual native 390×227→390×562 resize, unchanged account email, keyboard-opener restoration; desktop 1280×720 and 1280×350 in both engines |
| current_landing_route | PASS | Raw-ESM HTTP signed-out landing, actual inline email focus and back, no sheet and no remote requests, both engines |
| physical_iPhone_Safari | NOT_RUN | No physical iPhone available; automated Windows WebKit is not a device test or Product closure |
| physical_Android_Chrome | NOT_RUN | Chromium mobile geometry/touch fixture only, no physical Android claim |
| syntax_and_diff | PASS | `node --check` on both changed JS modules and scoped E2E; `git diff --check` |

Commands:

```powershell
# Unpatched base application, initial scoped reproduction harness:
$env:N54_EXPECT_BASELINE='1'
node scripts/e2e-runner.mjs n54-keyboard-compression.e2e.mjs
# Candidate, with N54_EXPECT_BASELINE unset:
node scripts/e2e-runner.mjs n54-keyboard-compression.e2e.mjs
# Only the corrected profile fixture was rerun:
node node_modules/@playwright/test/cli.js test tests/n54-keyboard-compression.e2e.mjs --grep 'profile email modal'
```

The candidate run recorded seven passes and one WebKit fixture expectation
failure: WebKit pointer clicks blur a button before opening the modal, so it
was not an explicit focus-restoration target. The corrected fixture activates
that real handler with Enter from a focused opener; both profile cases then
passed. All eight distinct candidate cases have passing evidence. Six unchanged
email/landing cases reuse their earlier candidate evidence. An earlier Vite
landing attempt was also corrected to raw HTTP because DEV anonymous routing
bypasses the Production landing. These were harness corrections, with no
additional application-source changes. Mocked cloud incomplete-read and blocked
service-worker warnings are fixture conditions, not Sync certification.

Raw captures/measurements are preserved under the supplied attempt directory:
`evidence/baseline`, `evidence/candidate-initial` (including the failed fixture
trace), and `evidence/candidate-profile-final`. Candidate screenshots are clipped
to the simulated visible viewport; no physical keyboard is depicted.

Tested application Git blob IDs (unchanged through final verification):

- `src/lib/dom.js`: `f80b324fe9aa404d312bb869c1f6a7d4f7dc5ff2`
- `src/lib/visible-viewport.js`: `34db491052ac79c4a62280bd1b32d2771a79139d`
- `src/styles/app.css`: `529c82ae63b7c8466216851f4918a6f5c53f2b8a`

Browser contexts and HTTP/Vite servers are closed after each affected phase.
The browser lease is released before worker return. No push/deploy, queue edit,
Production verification, PO acceptance or N20/N54 closure is claimed.
