# N90 simplified import — local candidate evidence

Task: `continuous-n90-progressive-grade-import-20261014`  
Run: `81f745f3-b78c-4114-863b-b1095dd6d312`  
Base: `c64a1ee734502422e89cd943c7b1410dd7381270`

The import has choose-file, suggested-mapping, and final-review states. Help and export start collapsed. Exact unique known headers suggest name/optional stable ID and current manual items, including the existing Rakeez export maximum suffix. Metadata and automatic/subitem fields are ignored with a short reason; uncertain columns open the existing editor. Final review shows changed/error rows by default, names without UUIDs, optional unchanged/mapping details, the existing overwrite consent, and one confirm action. No scoring, transport, parser, exporter, schema, Auth or service implementation changed.

Cancellation replaces the transfer session, invalidating delayed reads and approvals. Confirmation refuses disconnected old DOM controls. Export item selection survives import repaints. Noor action reads **ملف مساعد للرصد اليدوي في نور**, with **ليس للرفع المباشر**; official Noor template compatibility remains unverified and N90 is not Product CLOSED.

## Affected checks

Commands:
- `node --check src/views/grades.js`
- `node --test tests/n90-transfer.test.mjs` — 5 PASS, including unique/exact/duplicate/current/read-only suggestion boundaries and existing formula-safe export/zero/blank safeguards.
- `node tests/n90-native.mjs --browser-only --progressive` — final exit 0, four checks below. Existing native setup and account fixture are reused; historical native server suites are not rerun.

- **n90_out_of_range_clear_block: PASS** — 12-column upload: actual UI displays row/student/Exam/value 7/max 5; whole batch confirm disabled, zero transport and native scores unchanged.
- **n90_valid_zero_blank_cancel_guards: PASS** — Actual account store/ownership guard + native RPC: cancel and delayed-read cancellation no write; new review clears acknowledgements and disconnected old confirmation is inert; confirmed 4 and 0, blank preserves original 3; ownerless dispatch still denied.
- **n90_upload_mapping_review_flow: PASS** — Real DOM/file handler/CSS: 12-column Rakeez shape yields 6 exact manual suggestions and no name/metadata rows; collapsed edit; changed-only review. Duplicate/unknown external file opens exceptions, unknown/ambiguous identities and unconfirmed new item cannot write.
- **n90_mobile_density_export: PASS** — 390/1280 real app screenshots, contained panel, collapsed export. Selection survives import repaint; offline loaded-document Noor-aid CSV preserves 0/3 and excludes unchecked item. Fresh reload checkpoint reads correct synthetic owner and mark 4. SW/cache certification reused, not rerun.

The 12-column CSV contains stable ID, student name, six manual grade columns, class, subject, term, and file type. A separate external file has duplicate mark headers, an unknown student and an ambiguous name. The native roster deliberately contains two identical names; stable IDs resolve the Rakeez file, while the external file is rejected. The only native commit is the explicitly confirmed two-cell 4/0 batch; blank retains the unrelated original 3. Screenshots were inspected at 390 and 1280 pixels.

Artifacts retained in this worktree:
- `test-results/n90-progressive/result.json` (checks and actual request envelope)
- `test-results/n90-progressive-native/result.json` (existing SQL identity and owned native cleanup)
- `test-results/n90-progressive/{390-choose,390-error,390-mapping,390-review,1280-mapping,1280-review}.png`

Browser navigation used only the actual app over a unique task-owned loopback HTTP origin, actual DOM/handlers/store/CSS, and the canonical isolated-local-browser helper. Fresh disposable context; external requests and Service Workers blocked. Offline proof is export from an already loaded document, not new SW/offline-shell certification. Existing server/owner/SW evidence and the PO's successful core cases remain unchanged. The isolated browser and HTTP server closed in finally; native PostgreSQL stopped and its owned cluster was removed. No shared/live browser resource was acquired, no remote identity/service/real grade mutation occurred.

Harness corrections preserve the initial failures: Windows ESM absolute import rejected `c:` (corrected to a Node module file URL; no browser file navigation); early DOM count assertions observed repaint before it completed (now wait on actual rendered review/cancel state); an export assertion assumed Exam was immediately after name (now parse CSV and locate the exact header). These were local harness defects, not changed server acceptance or a spent live proof.

N100 coordination: read the active `continuous-n100-automatic-safe-copy-20261014` card's allowed paths; no overlap with these Product or test files. Main/Production, queue/status, and service migration files remain publisher/controller-owned. No push or deploy was performed.

## Verified source fingerprints (SHA-256)

- `src/views/grades.js`: `1518c1fa8910a82c313429d42977996122bd671526b1c41dfe0b7a3dbad0b323`
- `src/lib/grade-transfer.js`: `856db932a940eb2f6d9437f220c284ab1aa7728f5ac9514822e0e6b435cebeba`
- `src/styles/grades.css`: `1f9b8d4116d7b19cb0a3b60cc277b55cdd82ebd150414ea49fc7e01e98a73fa0`
- `tests/n90-progressive-browser.mjs`: `127385a3d8488a3d050d82bcda10175fd2fab6cba3185c211bf271ca9dbb8752`
- `tests/n90-native.mjs`: `9a9600c03df502e70ef05eb73c379ab94659640c25803431c63bbf0f7cc06218`
- `tests/n90-transfer.test.mjs`: `4a1e902f3325042a5e6600cd96e9f60b1ff08c9a55d1443ce35c3951f9d7d23a`
