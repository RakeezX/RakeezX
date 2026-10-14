# N58 — installed release upgrade containment [AI]

Task `continuous-n58-installed-release-update-20261014`; run `b67ea81f-56fc-4d23-96db-719524881efc`.
Base `20e41701cc41437ff367675ff2c9cc8dd6db0ce8`. Candidate is the local commit containing this evidence; its full SHA is returned in the worker result. No push, provider operation or deployment was performed.

## Reproduced boundary

Before changing Product source, `node tests/n58-installed-update-browser.mjs` served historical release `89a162adff6d82eccc95f4605c9c7a99c1ada472`, then switched only the owned HTTP server to the base release. Historical responses used `public, max-age=14400, must-revalidate`. The actual app's Calendar settings cards remained enabled and the old unconditional teacher-center repair entry remained visible after three ordinary reloads, both with the installed v62 worker and without a worker. The server saw SW update requests but **zero new calendar.js requests**. No worker was unregistered, no cache was cleared, no forced reload/query-busted page or Playwright network routing was used.

The old release and base have the identical `sw.js` Git blob `b249540f8a4a432650fae883eb98d9e9ef828b9f`. Explicit updateViaCache:none checks therefore did not create a new install/precache phase. The observed cached-module boundary persisted despite the existing network-first/cache:reload worker implementation. This confirms a reproducible installed-client path; it does not identify the PO's personal browser state or prove every browser's internal cache behavior.

The older installed-worker case used actual release `132817129342658ab4133bd72578f88a8a1eebac` (v61). Its transition to the base **already passed**: new worker bytes triggered installation and refreshed the affected modules. It is not reported as an original failure. Subsequent final checks also exercise an actual visible region click on a separate fresh synthetic owner under each historical release: the old handler changes that owner's saved preset. The rejection-preservation owner is kept separate from this reproduction.

## Scoped correction

- `_headers` requires ordinary revalidation for root/index, sw.js and /src assets. Existing already-fresh responses need the additional bridge below.
- The new index entry loads `src/lib/app-update.js`, a previously uncached static path. Before importing app.js it finishes cache:reload reads of the three affected unversioned modules: app.js, store.js and calendar.js. The module graph, calendar hold, repair eligibility, ownership and data contracts are unchanged.
- Requests have an eight-second deadline. A failed refresh waits for an explicit Arabic retry button before importing a potentially mixed graph; it does not automatically reload/retry the document or alter storage. A refreshed worker supplies its offline responses normally.
- Worker generation v63 is discoverable by the existing old app registration/update calls. Its install requires the new entry and the affected three modules alongside the existing mandatory N100 engine; all are fetched with cache:reload. Navigation refreshes the canonical offline shell as well, while preserving the existing redirected-index safeguard. Cleanup remains limited to older numeric RAKEEZ cache generations; unrelated caches and IndexedDB are untouched.

## Final affected evidence

`node tests/n58-installed-update-browser.mjs --fixed` — PASS, natural exit 0, final Product source and final harness. Actual historical/new app files, source CSS and real SWs at `http://127.0.0.1:4197`; fresh disposable Chromium contexts with HTTP caching enabled. No personal profile, credentials, CDP attachment, remote service or public HTML diagnostic was used.

| Required check | Actual result |
| --- | --- |
| n58_old_release_to_current_exact_calendar_ui | PASS: v62, no-SW HTTP cache and v61 → candidate through ordinary reloads. Exact visible إعدادات التقويم والمنطقة → التقويم المعتمد path; cards disabled with the hold notice and computed not-allowed cursor. Deliberately re-enabled stale click produces the hold message; direct real store switch returns calendar-switch-temporary-hold. Reinstall-free page close/reopen retains the fix. |
| n58_unrelated_repair_action_updated | PASS: exact synthetic zero-session fixtures with 1 rejected academic + 63 blocked, and 65 rejected + 2 pending, keep generic Sync diagnostics and no session-repair action. A different fresh owner in the previously used browser gets its own DB/default foundation, no inherited grades and only its own bootstrap outbox. A valid parent/year/term/teaching/session fixture uses the unchanged real owner-guarded review plan: eligible repair appears, starts unchecked/disabled, enables only after selection; closing writes no repair/retry. |
| n58_upgrade_preserves_owner_outbox_offline | PASS: all stores from db.STORES compared byte-for-byte, alongside owner ID, database name, persisted Auth session and an unrelated Cache Storage sentinel. Existing grade 19 and every source rejection remain unchanged across upgrade, stale/direct attempts, restart and refreshed offline loading. No original outbox dispatch occurs. Separate synthetic account switching uses new documents; the original account is restored and its complete snapshot compared again. |
| n58_uncached_and_cached_source_proof | PASS locally: ordinary unbusted static index/SW/bootstrap/store/calendar bytes match worktree SHA256; server headers are derived from the actual _headers file and equal no-cache,max-age=0,must-revalidate. Cached browser traces now contain real candidate calendar fetches. This is local source/installed-browser evidence, not provider publication proof. |

The account UI harness appends an internal export bridge and replaces remote boot with a synthetic owner/transport preparation, using the existing canonical database naming, store.init, real lease and ownership guards, actual router/view handlers and actual CSS. It does not replace the calendar/repair implementations or plans. Initial empty synthetic-account fixture preparation removes its bootstrap outbox before inserting the exact rejection fixtures; nothing is cleared/reset during upgrade. The fresh-owner test retains normal bootstrap events instead of treating them as a defect.

The separate startup/offline check leaves `boot()` unchanged, reuses `openReadyServedDemo` from the existing served-app helper, and exercises the new entry → actual app boot → v63 cache → offline reload. Another unchanged signed-out boot test serves a 503 for store.js: no layout executes until the user presses retry, and a pending-edit storage sentinel survives. External document fetch/WebSocket transport is blocked without Playwright routing, preserving HTTP-cache behavior. There are no Supabase/provider/Auth operations.

`node --check src/lib/app-update.js`, `node --check sw.js`, `node --check tests/n58-installed-update-browser.mjs`, `git diff --check` — PASS. No full Vite build or Preview repeated; deterministic metadata/build remain with the publisher. Calendar/store/app source has no candidate diff. Prior hold/store and N101 owner/repair/idempotency evidence in N58_CALENDAR_SWITCH_HOLD.md and N101_REPAIR_ELIGIBILITY_UI.md remains applicable to unchanged engine code.

Preserved local harness failures: the first action delegate omitted current view actions; a later attempt to switch an initialized workspace in place was correctly rejected by the real guard; a fresh account legitimately created bootstrap outbox entries, invalidating an incorrect empty-outbox assertion. The harness now delegates actual view/global handlers, switches owners through separate documents, and asserts owned bootstrap events. No guard or failure was suppressed.

Resources: the canonical shared browser lease was acquired for this exact run, all owned contexts/browser/server close in finally, the owned lease was released, and no listener remained on port4197 after final verification. No queue/status/STOP/controller/maintenance lock or unrelated process was changed.

## Normal update after publisher delivery

احفظ أي تعديل مفتوح، ثم افتح ركيز وأنت متصل وأعد تحميل الصفحة بالطريقة العادية. إذا كانت النافذة القديمة ما زالت مفتوحة، اترك تحميل التحديث يكتمل ثم أعد التحميل العادي مرة أخرى. لا تمسح بيانات الموقع أو التخزين، ولا تحتاج إلى إزالة التطبيق أو إعادة تثبيته. إذا ظهرت رسالة تعذّر تجهيز التحديث، تحقق من الاتصال واضغط «إعادة المحاولة». تحقق من ظهور رسالة إيقاف تغيير التقويم داخل إعدادات التقويم؛ السنوات والفصول والقراءة تظل متاحة.

Publisher alone must verify the delivered candidate/assets and ordinary response headers. Provider publication, installed PO-browser acceptance, the root calendar/Sync rejection cause and recovery of the 65 existing rejections remain separate OPEN requirements. This containment/upgrade result does not close N58 or claim Product/PO acceptance.
