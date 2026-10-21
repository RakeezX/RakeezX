# N88 user-initiated list response copy — local candidate

AI implementation for task `continuous-n88-user-copy-list-diagnostic-20261021`, run `42c8aae7-f887-4cc1-8abc-e3cb7fec2b00`.
Base: `e04c0fdb72f3d618628f70ebf292052fa513076c`.

The normally loaded actual class portal now has a collapsed support detail. The failure view reuses its existing collapsed support detail and preserves the original failure-copy button and snapshot. The new button copies only `{schema:"n88-list-response-v1",region,elapsedMs,outcome}` from the existing root attestation. It validates the exact three input keys, finite region allowlist (including explicit `unknown`), integer elapsedMs 0–30000, and success/failure outcomes at click time; oversized/malformed/extra-key values are absent. Output is constructed explicitly, never copied wholesale. No new import/startup dependency, request, service change, automatic clipboard write, or clipboard read.

Copy also runs the existing current class binding/owner/session/lease guard and checks DOM ownership. Missing/invalid/retired values show a short absence message without claiming success. Unavailable or rejected clipboard writes reveal a small selectable readonly safe-text fallback with an accurate manual-copy message. After an asynchronous write, current context and tuple equality are checked again before showing success or fallback. Closing details clears fallback/status. Normal class/student/settings/guidance controls and initial list reuse are unchanged.

## Affected evidence

`node --check src/lib/student-portal-runtime.js`, `node --check tests/n88-user-copy-list-diagnostic-20261021/ui.mjs`, and `git diff --check`: PASS. No full build, as directed by the card.

`node tests/n88-user-copy-list-diagnostic-20261021/ui.mjs`: PASS, seven scenario rows in `tests/n88-user-copy-list-diagnostic-20261021/ui.json`:

- Loaded and HTTP503 failure views at 390px and 1280px, using actual runtime, class client, portal DOM/handlers, source app CSS, and existing integrated synthetic store fixture with actual `classBinding` ownership guard.
- No initial clipboard write; collapsed default; only finite schema output; no extra class request (one list request including initial reuse); original failure-copy output preserved.
- Missing, malformed, extra-key/poisoned fields, wrong region/outcome and fractional/negative/over-bound duration rejected. Explicit unknown/30000 boundary accepted without implying a known region.
- Clipboard refusal and absent API display readonly safe fallback; subsequent invalid tuple clears that fallback.
- Owner change, lease invalidation on normal focus reconciliation, and expired session retire old DOM and attestation. Pending clipboard completion and detached clicks cannot publish success/fallback or copy again.
- 390px/desktop collapsed and fallback screenshots recorded; inspected mobile loaded/failure fallback and desktop collapsed state. No horizontal overflow. Technical values stay inside support details.

The first harness failures are preserved in `ui-first-harness-failure.json`, `ui-second-harness-failure.json`, and `ui-session-harness-failure.json`. Corrections: a replacement absence view deliberately has a hidden empty textarea (not zero textarea nodes); lease invalidation needs the existing focus reconciliation event; a newly valid replacement session may legitimately admit a new list, so the retirement fixture now supplies an expired session. No production guard was relaxed.

The canonical isolated-local-browser helper launched fresh disposable synthetic contexts on an ephemeral owned loopback HTTP port, blocked foreign requests/Service Workers, and closed its browser/contexts in finally. The owned HTTP server closed in finally. This approved isolated phase does not take the shared live browser lease. No personal profile, account, teacher/student data, live browser context, provider operation, or service mutation was accessed.

Unchanged carrier/service evidence is reused: `tests/n88-region-response-20261020/provider-readback.json` records exact source identity `2f96fdc067e3658f8105f1c6de73d730fd3d62100c98490bdd0d1604c1204b15` / carrier version `b8e5e6a7-8242-48cb-a3ab-478cc32fcd4e`; latest canonical N88 ledger records response-attestation publication `e04c0fdb72f3d618628f70ebf292052fa513076c` verified 2026-10-20T20:51:19.809Z. These are historical evidence, not new provider checks.

## Remaining observation and delivery

The original dedicated signed-in N88 context disappeared. The later single dedicated-browser Start-Process setup command was rejected before execution by automatic tool review: `blocked by policy`. Both external observation blockers remain; no launch/control retry through another surface was attempted. Historical 503/6600ms and the actual owned-class response region/duration/cause remain unknown. Synthetic ap-south-1 and synthetic response outcomes do not prove an actual class response.

This is LOCAL_READY only. No push, integration, deployment, provider check, Production verification, queue/status change or Product closure occurred here. The independent sole publisher must publish and verify exact changed runtime/CSS assets. After that verified publication, ask the PO once: «من صفحة فصلك، افتح تفاصيل الدعم ثم اضغط نسخ تفاصيل قراءة القائمة وأرسل النص المنسوخ؛ إذا تعذّر النسخ، حدّد النص الظاهر وانسخه يدويًا.» N88 remains open pending actual PO-provided evidence and its remaining Product requirements.
