# N36 — verified background package download link

Task `continuous-n36-background-package-download-link-20261020`, run `500a6ced-99c0-4b0e-863f-8de8c4de3a43`.
Base/fetched origin-main `20b0744065f08afdd73be096066598ab9b68c47e`.

Only the existing download href and visible version label changed from 0.5.20 to 0.5.21. The entire remaining file, including N107 local import and latest receiver/session/nonce guards, equals the base after reversing those two substitutions. No description, engine, permission, package or service change.

Reused preceding controller receipt: background candidate `32cb9b4df7205aeaa04d9d7688c265e2a06143a8`, publication `15991a36f0a7b3f082b85acd1c45a6c9d581f9a2`, verified `2026-10-20T13:42:47.939Z`. Existing provider SUCCESS and immutable/Production archive records both verify SHA256 `aeef5c41efe6d16dff68055daed21e6400ff6b8d752eac671cea32dd181fa4b2` (127128 bytes), matching the unchanged local manifest/archive. Those checks were reused, not rerun or claimed as this worker's publication.

`node tests/n36-background-download-link-20261020/check.mjs`: PASS (`n36_download_link_matches_verified_background_package`). Exact two-substitution source assertion and JS syntax pass. Fresh canonical isolated browser over owned HTTP `127.0.0.1:49614` rendered the actual authenticated synthetic application's DOM, handlers and source CSS. The displayed label is تنزيل إضافة ركيز 0.5.21. Clicking its real download anchor produced the exact ZIP hash and filename, without route navigation. See result.json and download-line.png. Temporary download deleted; owned contexts/browser/server closed in finally. This eligible local phase needs no shared browser lease.

Initial harness attempts did not display the link: the session reached the landing/account gate. The existing synthetic account fixture and its documented demo-session preparation flag fixed that harness initialization, without disabling guards. No real account or school operation, repeated owner/Sync/source/SW suite, full Vite build, push, deployment, stable install or Chrome reload. Independent publisher owns frontend served-effect verification; whole N36 and actual background-source acceptance remain open.
