# N91: hosted application proof

This is a fresh test of the actual HTTPS Cloudflare Preview application and its normal local Demo workspace. The caller owns the existing browser lease. It is unrelated to the rejected temporary HTML file: it never reads, recreates, serves or opens that file, never uses a `file:` URL, and does not add HTML or CSS to the page.

The approved preview is `https://645cd923.rakeezx.pages.dev`, bound by the provider check observed by the operator to candidate `466bb11d6e83096a226d5e76f66949c9665a85bd`. `preview-manifest.json` records that input evidence separately from the browser's own observations. The expected CSS and teaching-hub module hashes were computed from raw `git show` bytes of that candidate.

The harness uses the repository's existing Playwright package and installed Chrome. It creates a new empty context for each width, blocks service workers and WebSockets, allows only GET/HEAD to that one HTTPS origin, blocks external services and Auth/REST endpoints, requests Demo through the same supported marker as `tests/helpers/served-demo-readiness.mjs`, and verifies the active database is `rakeezx-demo` with an empty outbox. It does not attach to an existing browser/account or grant filesystem access.

Run only while holding the browser lease:

```powershell
node hosted-mobile-proof.mjs --url https://645cd923.rakeezx.pages.dev --module-root C:\Users\Abody\Projects\RakeezX --out <owned-attempt-output-directory>
```

Keep `preview-manifest.json` next to the script, or supply `--manifest <absolute-path>`.

Acceptance:

- Real browser-loaded `src/styles/components.css` and `src/views/teaching-hub.js` responses must match the candidate's exact SHA256 hashes. The CSS must be an active stylesheet. No fixture substitutes for the application DOM.
- At 320/360/390/430 CSS pixels, all eight real card titles must match the source titles and links, have no `nowrap`/ellipsis, stay within their cards and horizontal viewport, and have no clipping ancestor or document overflow. The result includes computed styles, text Range rectangles and screenshots.
- At 390 pixels, tap all eight actual card links, verify the destination hash and rendered route title, and return to the hub. Only route navigation is performed; no record-changing controls are clicked. The workspace/database/outbox guard is checked again.
- `N91_HOSTED_APP_PROOF.json` records PASS only after these observations. Failure exits nonzero and records the failing width, actual measurement and screenshot where available. This is Chrome mobile viewport emulation, not a claim of physical iPhone/Safari coverage.

Preparation only: the author checked JavaScript syntax. No browser was run during preparation. The worker/operator must execute under its own valid lease and use the resulting evidence; this file does not change a ticket status or publish anything.
