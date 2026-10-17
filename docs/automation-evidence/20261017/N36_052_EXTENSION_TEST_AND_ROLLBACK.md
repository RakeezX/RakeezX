# N36 — 0.5.2 package and rollback

AI implementation. Base `668fc444bd7a470349048b416883afeab43c31f2`; task/run recorded in N36_REAL_051_POPUP_USABILITY.md.

Candidate archive: `assets/extensions/rakeez-teacher-import-helper-0.5.2.zip` (87024 bytes).
SHA-256: `07951eac0631bb31d84cf3bc439f00dfefa3a0153ecf6969bda8326d0157b33e`.
Exact fileset, entry byte lengths/hashes and unpacked source bytes: `assets/extensions/rakeez-teacher-import-helper-0.5.2.manifest.json`.

The archive was unpacked into a new owned temporary folder and tested in actual Chrome MV3. Every ZIP entry matches its manifest and checkout exactly. Git-filtered LF identity is checked independently, so Windows CRLF checkout serialization cannot conceal content changes. Existing 0.5.0/0.5.1 archive tests now read their immutable historical source revisions rather than comparing rollback packages with edited 0.5.2 source. Tamper-negative assertions remain intact.

Reproduce package integrity with `node --test tests/n36-popup-052-real-feedback.test.mjs tests/n36-extension-direct-handoff.test.mjs tests/n36-koshoof-discoverability.test.mjs`. Explicit package regeneration uses `node tests/n36-popup-052-real-feedback.test.mjs --package`; normal tests are read-only. Browser replay uses `N36_BASELINE=1` for untouched 0.5.1, then the candidate run of `node tests/n36-popup-052-real-feedback-browser.mjs` with this active task's lease identity. Reuse current evidence while runtime bytes remain unchanged.

The single official Koshoof download now points to 0.5.2 ZIP and manifest. Installation copy stays short and identifies one dedicated folder; stable-folder updates belong solely to the existing guarded updater AFTER an exact verified Production receipt. Worker performed no push, deployment, stable-folder update, personal profile change or extension reload.

Rollback artifacts `rakeez-teacher-import-helper-0.5.1.zip` and `.manifest.json` are byte-identical to the supplied base commit. Preserve them. If 0.5.2 real Chrome retest fails, the sole publisher/controller handles an authorized download-link rollback to that verified package; user/updater must explicitly manage the one installed helper. Do not activate a second copy or automatically reload personal Chrome.

No changes to source route policy, report parser/pager, host permissions, CSP, handoff protocol/worker, owner/Auth/session/Sync/grades, Service Worker shell or portal operations. Review remains 300 seconds; transfer remains 2 minutes. Production proof and PO retest remain separate from these local passes. N36 direct Madrasati roster extraction remains OPEN.
