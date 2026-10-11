# N79/N89 PO addendum — OS and device diagnostics (2026-10-11)

PO approved including identifiable operating-system family, OS release when reliable, and device model when available in BOTH safe WhatsApp prefill and automatic in-app Support notification email. No repeat questions/approvals required for this narrowly scoped code change.

## Product behavior
- Shared client allowlist gathers only Android / iOS / iPadOS / Windows / macOS / Linux / ChromeOS classification; bounded version and Android model if reliably exposed. No raw UA, serial numbers, IDs, IMEI, student/class information, credentials, or raw errors.
- Chromium optional model/platform-version hints prime on Support mount; WhatsApp one-tap stays synchronous without awaiting hints. Browser privacy restrictions omit unavailable data. Windows NT 10.0 cannot determine Windows 10 versus 11.
- Both N89 client sanitizer and server notification worker sanitize the same three new fields (operatingSystem, operatingSystemVersion, deviceModel). Worker email formatting prints OS/model when available; WhatsApp text prints the same. Manual mailto recipient remains unchanged, and NO automatic email is sent when WhatsApp is opened.
- WhatsApp card button now shows an inline small symbolic phone/chat icon before «تواصل عبر الواتساب». The extra long external-service explanatory paragraph is removed per PO request; offline/invalid-contact fallback remains. WhatsApp text omits redundant build-time/message-time/timezone/mobile/PWA lines, while retaining privacy-safe essentials and relevant Sync diagnostics.
- Preserve existing support request submission, auth/ownership, server-only contact details, separate transports, and Sync isolation. Product CLOSED only after PO verifies Production.

## Evidence and release limits
- Isolated branch from exact N79+N89 sealed Preview candidate a80140ebc18a659e1150d0ec844c1b940abb5439. Root canonical worktree not switched or overwritten.
- Targeted six test files: **20/20 PASS, 0 FAIL, 0 SKIP** (including device detection, bad-input rejection, email and WhatsApp formatting, support one-tap, owner switching and existing SW dependency-omission baseline). `git diff --check` and modified JS syntax checks PASS.
- Full Vite build **NOT VERIFIED**: worktree has no installed Vite executable; `npm.cmd run build` produced only generated Build Meta then exited with 'vite is not recognized'. The incidental generated file was restored to exact candidate source. No package installation or deployment.
- ACTIVE deployed N89 Edge worker is known to lack three preexisting fields. The new worker source requires independent exact live allowlist parity and controlled deployment authorization; this addendum does NOT authorize sending real email, Supabase or Edge deployment, nor production promotion.
- No Cloudflare Preview or Production deployed from this addendum. Product stays OPEN / candidate only. Preserve remaining physical-device, live owner and PO gates.
