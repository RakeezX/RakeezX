# N88 — one authoritative publication editor per mode

AI-authored, 2026-10-31. Task `continuous-n88-publication-controls-compatibility-20261031`, run `75f5be38-08e5-4e3b-b9c7-f808acf94706`.
Base `c4e3d6a3ad3b4da889b5d60d4d4d5b8d26e9a53e`; saved session `01a17f74-7497-71a1-ad06-e7aadcce8f6b` retained. Initial worktree clean. Card explicitly uses gpt-6.1-sol / medium; no model/config/card change.

## Correction

`mountClassPortal` now chooses the editor mode from its already-admitted `publicationClient` dependency:

- V2 mounts the existing per-item publication controls only. It does not mount legacy task guidance, its listeners/read timer, or the class-wide field form. Legacy visibility handlers also refuse execution in this mode. This is conditional construction, not CSS hiding.
- V2 navigation targets the actual publication source selector and the existing numeric code-management disclosure. Keyboard activation focuses those current targets. No V2 quick link points to an absent legacy section.
- Without a publication client, the original V1 field/guidance construction, navigation, handlers and endpoints remain in use. Optional guidance lifecycle calls safely handle its absence in V2.
- Numeric roster, code issue/rotation/revocation, copy/share, student entry link and original UNKNOWN/receipt/closure logic remain unchanged in both modes. No new global service/privacy gate was added.
- Student grade rendering retains the heading `درجاتي المنشورة` and individual values; the paragraph containing `دون جمع البنود المخفية` was removed. No grade computation, projection parsing, source/command authority or totals logic changed.

V2 readiness remains source-controlled **OFF** and V1 readiness remains enabled. Backend/runtime writer work and private hosted-bundle preparation remain with their separate original owner. No service/provider/SQL/Auth/RLS/data/config operation, customer account/browser session, message, push or deployment occurred.

## Affected evidence

`tests/n88-publication-controls-1031/browser.mjs` reuses the existing actual application HTTP host, bootstrap, runtime, store ownership guard, client codec and integrated service with fabricated in-memory ports. No lookalike UI or new server schema was introduced. Canonical isolated Chromium helper, fresh synthetic context, unique loopback port, Service Workers/external access blocked; owned integration lease and finally cleanup.

**V2 PASS:** actual mounted route has exactly one publication editor and no legacy visibility/guidance DOM or quick links. Throughout opening codes, review-rotation/cancel and confirmed grade saves, there were zero `/visibility`, `/guidance-list` or `/guidance-save` requests. Numeric roster and rotation/revocation controls remain reachable. The keyboard publication/code shortcuts work. A confirmed per-item grade ON shows the component value 5 in the actual numeric-login student page; OFF removes it after read; ON restores it. No aggregate is introduced. The unnecessary student sentence is absent.

**V1/default-OFF PASS for affected compatibility:** original field/guidance controls and navigation remain, their original endpoints are requested, numeric roster remains reachable, and account change clears the old view. No V2 endpoint is requested. This fixture does **not** prove a successful V1 service visibility write: the reused terminal-issuance fixture returns HTTP503/source for that unchanged operation (also reproduced directly through the unchanged fixture/service). Its existing safe UNKNOWN UI is preserved. No backend or guard was altered to manufacture a save ACK.

The initial browser harness incorrectly waited for V1 save success despite that fixture limitation; it timed out after its two V2 checks had completed successfully. The exact failure, request trace and source hashes are retained in `browser-initial-failure.json`. The corrected V1-only continuation (`N88_CONTROLS_V1_ONLY=1`) verifies the actual unchanged endpoint and safe failure behavior, roster and owner cleanup. It reuses only the two completed V2 checks after matching all exact source hashes, rather than rerunning them or rewriting the original failure. `browser-evidence.json` records the combined actual affected results and released resources. Zero page errors; real account/provider operations zero.

**Rendered inspection PASS:** `teacher-v2-390.png`, `teacher-v2-dark-390.png`, `student-v2-390.png` and `teacher-v1-390.png` were visually inspected. Relevant keyboard targets and 390px RTL/no horizontal overflow passed. Screenshot names/codes are fabricated fixture data only. Existing CSS is unchanged.

**SW104 PASS:** `node --test tests/n88-publication-controls-1031/sw.test.mjs` (1/1). The actual SW differs from current SW103 by its version only, preserving every N44/offline/private-cache rule and existing required graph. A focused VM executes install/fetch, checks the exact changed `student-portal-class.js` and `student-portal-publications.js` bytes in offline fallback, and rejects install when either required asset is unavailable. Source SHA256 identities are recorded in the browser evidence. No installed-SW/live offline certification is claimed.

Syntax and scoped whitespace/path checks cover only the changed files. Prior unchanged service/client/Auth/native/UNKNOWN and SW-policy evidence is reused; no full build, broad campaign or hosted trial was repeated. No previous evidence file was modified. Both browser phases closed their owned server/browser and released their owned integration lease.

Local frontend candidate only. The sole controller/publisher owns integration, current-main reconciliation and served/Production evidence; N88 acceptance and V2 hosted activation are not claimed.
