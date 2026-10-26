# N126 Reports Portfolio Preview entry — local evidence

AI-authored implementation and verification, 2026-10-27.

- Task: `continuous-n126-portfolio-reports-entry-20261027`
- Run: `b8e0ca7e-a67d-4085-ab66-93fe380a1702`
- Base: `bcf7353cc3b55b5030174a4139cfbebd6a9cd225`
- Authority: activated discoverability card and current N126 ledger note, not full F09 acceptance.

## Result

The existing Reports hub now includes a native link labeled **ملف الإنجاز (معاينة)** to `#/reports/portfolio-preview`. The shared card renders for populated and zero-teaching states. Existing certificate, aggregate and individual report destinations are preserved, as is the empty-state instruction and Classes link. The card explains eleven annual criteria, evidence/photos/PDF, same-browser draft, manually portable local archive, and unfinished cloud/N71 integration with no automatic backup to N71 or another device. It reuses existing surface/report-destination styles without CSS changes.

## Affected checks

- `node --check src/views/reports-index.js`: PASS.
- `node --test tests/n126-portfolio-reports-entry-20261027.test.mjs`: PASS, 1 focused test, 6 rendered scenarios (320/390/1280px, populated/empty), final run 19.9 seconds.
- `n126_reports_entry_visible_with_or_without_classes`: PASS. Actual app DOM, handlers and CSS served by task-owned Vite at `http://127.0.0.1:57175`; native link, exact label and explanatory copy; unchanged existing report links; original empty guidance; no horizontal page overflow, link within viewport and at least 44px tall.
- `n126_reports_entry_existing_preview_route_matches`: PASS. Focus and Enter follow the native hash link through unchanged `src/app.js` special resolver. Existing Preview focus UI and eleven contents rows render in all six scenarios.
- `n126_reports_entry_no_cloud_or_notification_mutation`: PASS within local scope. Persisted Demo database snapshots remain identical across Reports/Preview navigation in each scenario; no non-GET/HEAD browser requests; no page errors. Changes only touch Reports render, focused test and this evidence. No service operation or real data used.
- Visual inspection: inspected screenshots of narrow populated/empty states and desktop populated/empty states. Copy wraps; focus outline is visible; destination remains distinct. Empty state uses the existing stack layout to retain full-width guidance on desktop.

Final six screenshots: `C:/Users/Abody/AppData/Local/Temp/rakeez-n126-reports-pSvmT1/{320,390,1280}-{populated,empty}.png`.

The first harness invocation failed before browser startup because a Windows drive path was used as an ESM import; corrected to the existing canonical relative import. Initial rendered check passed; visual inspection prompted a bounded empty-state layout adjustment and resetting scroll before screenshots, followed by the final passing run above. Expected console warnings about blocked Service Worker registration/update are from the required isolation policy; no offline/Service Worker certification is claimed.

## Resources and limits

Canonical `withIsolatedLocalBrowser` validated the active task/run and owned fresh contexts/browser; external requests and Service Workers were blocked. The approved isolated local exception needs no shared live-browser lease. Vite selected a unique loopback port and closed in `finally`; contexts/browser closed in their own `finally`. No personal browser, shared lease, queue status, publisher, provider or live account was touched. No build or unrelated suite was run for this render/copy change.

Candidate is local only. Independent controller/publisher owns integration and Production served-asset verification. Existing parent receipts remain unchanged; full Portfolio Sync and Product acceptance are outside this result.
