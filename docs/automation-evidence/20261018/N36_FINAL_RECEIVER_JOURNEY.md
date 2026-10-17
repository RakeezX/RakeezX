# N36 final receiver journey — blocked at the real origin boundary

Task: `continuous-n36-final-receiver-journey-20261018`

Run: `7f8c82ff-b9cc-4fd1-969e-fc45c94caf5f`
Base: `f2395c4841db30fb29e5908fe30e6154a925116a` (also observed local `origin/main`)

The requested full save/Sync journey is **not certified**. No Product fix, extension version increment, live operation, push, deployment, queue change or personal browser operation was performed.

## Actual affected check

`node tests/n36-final-journey-browser.mjs` ran once. Its machine result is in `tests/n36-final-journey-browser.json`: overall **BLOCKED**, required full-journey check **FAIL**, remaining receiver guards **NOT_RUN**. The process exited 0 because it recorded the expected boundary; that exit is not a Product PASS. There was no unchanged browser retry.

The canonical isolated helper launched a fresh disposable context, blocked Service Workers/external requests, and served the actual application and extension modules/CSS at `http://127.0.0.1:49483`. Existing `openReadyServedDemo` and `prepareNamesAccount` helpers prepared the synthetic account with the actual ownership/provisioning/lease guards. Only the school roster, service fixture and Chrome APIs were fabricated. The worker ran its actual source and protocol in the existing package-test VM linking style; it generated the real HTTPS receiver route. No Product engine or origin constant was replaced.

The actual extension controller displayed all ten classes in ascending order and exactly these fabricated counts:

| Class | Names |
| --- | ---: |
| خامس1 | 28 |
| خامس2 | 28 |
| خامس3 | 29 |
| خامس4 | 28 |
| خامس5 | 30 |
| خامس6 | 28 |
| خامس7 | 29 |
| خامس8 | 31 |
| سادس6 | 34 |
| سادس7 | 38 |

Total: 303. Every selector's actual DOM names matched that class's fabricated roster; selection sent nothing and saved nothing. The actual worker accepted the first explicit selected-class transfer and generated `https://rakeezx.com/#/classes/koshoof?...`. The controller remained locked awaiting its receipt.

The synthetic account document navigated to that exact hash using the real application router and Koshoof receiver. The receiver displayed its actual failure message. A direct call to the unchanged actual `claimHandoff` confirmed `HANDOFF_UNAVAILABLE`: document origin was loopback, while `APP_ORIGIN` is `https://rakeezx.com`. No external Chrome claim call occurred. Owner and database identity were read in this same document with a writable NORMAL lease, and every DB store including Outbox remained equal to its pre-transfer checkpoint. There were no application exceptions.

## Exact blocker and retry condition

The activated task requires the canonical loopback-only browser helper **and** the actual origin-bound transport. `claimHandoff`/`reportHandoffOutcome` require `https://rakeezx.com`; the worker's external sender checks and packaged `externally_connectable` manifest enforce the same origin. The canonical helper only permits its explicit loopback origin. This is a test-environment incompatibility, not evidence that Production transport is broken, and not a browser/tool denial. None of the earlier real denials was retried.

The missing operation is a synthetic origin-compatible browser transport test: either an explicitly authorized fixture at the exact required HTTPS origin, or a specifically approved test seam that supplies the transport's origin without changing its production allowlist. Merely adding a shared browser lease, changing a port, repeating the run, mocking a successful receipt, or weakening the origin guard does not resolve it. No change to the global helper or tool rules was attempted. No local missing-path repair is proposed as a substitute for that authority/environment decision.

After that material correction, the saved test needs continuation beyond this boundary: explicit class selection/creation, all selected batches through the real receiver, normal Sync engine ACK/readback, retry/resume, duplicate, TTL, partial-coverage and owner-change checks. Those stages remain unrun; the current test is a reproducible boundary check, not a completed full-journey harness. A second unchanged run would add no evidence.

Source inspection also found that the direct extension entry currently requires an existing class; its modal does not create new classes. New-class creation is available in the separate file-import flow. The receiver currently reports a local names receipt and explicitly says it is not server proof. Neither behavior is represented here as a normal Sync ACK. Their required integration remains open and was not patched without reachable affected verification.

## Package and existing evidence

All 25 files in the deterministic `0.5.11` archive matched both its manifest hashes/lengths and the exact current extension files. Archive SHA-256: `7b9a286073834e3d01df49410f102ece86caa8bdffaa71771ee11fdaafbaa79d` (105862 bytes). The app and packaged handoff protocols matched. Actual protocol checks rejected duplicate rows, exact TTL expiry and a single 303-row transfer; these checks do not assert a total-run limit.

Read-only `STABLE_CURRENT.json` showed version `0.5.11`, source task `continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017`, published SHA `2159da1b7d11ccdc16772085f2ad4228c78e5543`. Read-only `AUTO_SYNC_HEALTH.json` reported `ALREADY_CURRENT`, `chromeReloaded:false`, checked at `2026-10-17T22:13:14.191Z`. This is a local updater receipt, not this candidate's Production evidence. The updater was not invoked. Existing extraction, package/module and layout evidence was reused; no new native-popup or original personal-Chrome module-error proof is claimed.

## User path and limits

المسار الحالي: اختر فصل المصدر في الإضافة ← انقل إلى ركيز ← اختر فصلًا موجودًا ومادته وطابقه ← عاين الأسماء ← أكّد الإضافة ← راجع الكشف وحالة المزامنة. إنشاء فصل جديد وإتمام إيصال الخادم ضمن هذه الرحلة ما زالا يحتاجان التنفيذ والتحقق؛ لا يُعدّ ظهور 303 أسماء إثباتًا لحفظها.

The isolated helper closed its contexts/browser and the test closed only its owned server in `finally`. No shared live-browser lease was acquired for this purely local synthetic phase. `node --check` and `git diff --check` also passed. Only the test, machine evidence and this note form the candidate; N107 and all Product guards remain unchanged.
