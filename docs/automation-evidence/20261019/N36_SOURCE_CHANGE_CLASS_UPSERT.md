# N36 — source review binding and fifth-class upsert (AI implementation)

Task: `continuous-n36-source-change-class-upsert-20261019`  
Run: `538f9cb0-3d79-40a8-8c5c-37748229abd3`  
Base / observed origin/main: `98885befd4f13c02210661309a4add21e04c72ca` (`git ls-remote origin refs/heads/main` at start). Before commit, current remote main was `f7ea41605c64955526cd074b28b0138315de2243`; fetched read-only and compared all affected extension/assets/receiver paths: no difference from this base. Candidate remains on the supplied isolated base; publisher owns integration.

## Original failure, preserved

The new PO attachment is a failed actual trial, not acceptance. Its unchanged intake is
`artifacts/ops-supervisor-v4/intake-evidence/po-20261019-feedback-1532/PO_FEEDBACK.txt`
in the canonical repository (SHA256 `2a62db60e5f6f5802b9f3e33b67d2b0b3f79280884e8e49f384bb0e73cf14204`).
`intake.json` records the original attachment path and SHA256
`2a62db60e5f6f5802b9f3e33b67d2b0b3f79280884e8e49f384bb0e73cf14204`.
The exact diagnostic JSON from that intake is retained below. No source page or actual pupil names were recollected.

```json
{
  "schema": "rakeez-safe-diagnostics",
  "reportVersion": 1,
  "extensionVersion": "0.5.13",
  "context": "run-tab",
  "browser": {
    "family": "chrome",
    "major": 155,
    "platform": "Windows"
  },
  "layout": {
    "innerWidth": 1536,
    "innerHeight": 639,
    "devicePixelRatio": 1.25,
    "visualScale": 1,
    "root": {
      "clientWidth": 1536,
      "clientHeight": 639,
      "scrollWidth": 1536,
      "scrollHeight": 639,
      "computedWidth": 1536
    },
    "body": {
      "clientWidth": 840,
      "clientHeight": 534,
      "scrollWidth": 840,
      "scrollHeight": 534,
      "computedWidth": 840
    },
    "main": {
      "clientWidth": 840,
      "clientHeight": 534,
      "scrollWidth": 840,
      "scrollHeight": 534,
      "computedWidth": 840
    }
  },
  "health": {
    "bootstrap": "ready",
    "modules": {
      "popup.js": "ready",
      "categories-popup.js": "ready",
      "run-controller.js": "ready"
    },
    "background": "ready"
  },
  "collection": {
    "valid": 303,
    "staged": 303,
    "observed": 303,
    "excluded": 0,
    "classes": 10,
    "processedPages": 7,
    "currentPage": 7,
    "stage": "unresolved",
    "coverage": "partial",
    "terminal": "unproven",
    "endpoint": "none",
    "hasNext": false,
    "disabledNext": false,
    "transfer": "error",
    "receipt": "unknown",
    "failure": "SOURCE_CHANGED"
  },
  "errors": []
}
```

Destination also reported `CLASS_MAPPING_REQUIRED` for خامس 1–4. The first affected-path synthetic run reproduced that receiver failure before the alias edit; see `tests/n36-feedback-1532/before-alias-failure.json`. Its FAIL has not been changed to PASS.

## Diagnosis and implementation

* The captured source tab is already correctly carried into the separate run tab. It must not be replaced by the active run tab. Source extraction/pagination engines, source permissions and encrypted receiver transport are unchanged.
* The old `tabs.onUpdated` guard unconditionally destroyed a completed review on any URL update. In the original base controller plus actual categories handler, a same-source page1 → page2 update during the asynchronous pre-export window reproduces the exact `SOURCE_CHANGED` diagnostic before any save. `baseline-source-change.json` retains that expected failure. The baseline harness instruments only entry at the completed extraction checkpoint; original guard and handoff handler code run unchanged. No extractor, pagination crawl or native popup-layout suite is replayed. The PO safe report lacks URL/event timing, so the synthetic causal reproduction does not claim to reconstruct their exact unobserved click sequence.
* Completed collection now installs its original-tab/school/source-route review before publishing copied rows. Only pagination parameters of the same policy-approved source route may change. Different report/school/origin, login, source closure, negative role, expiry and receiver ownership checks remain active. Immutable collected row values are transported; no re-extraction is needed for a completed snapshot.
* The destination parser accepted full canonical grade names but missed deterministic short primary aliases. خامس / الخامس (and رابع / سادس variants) now resolve to the canonical grade plus section. Canonical grade/section/year identity takes precedence over arbitrary display names. No guessed stage for ambiguous bare أول/ثاني/ثالث and no fallback to an unrelated same-named class. Existing archived/tombstone/owner guards and canonical import transactions remain in place.
* Recognized missing targets create names-only sections without inventing subjects. Retry reuses exact section/student/enrollment IDs and adds only new pupils. Ambiguous labels keep durable pending rows with an explicit stage/mapping explanation. ACKs remain true local durable receipts; no server Sync claim is added.
* Removed ordinary happy-path two-minute expiry wording. Partial source coverage remains explicit after save.

## Affected evidence

`tests/n36-feedback-1532/verified-journeys.json`: recorded PASS from the actual completed process (exec session 12481, exit 0, all seven PASS records) using a fresh disposable installed-extension context, synthetic intercepted HTTPS source, actual application HTTP-served DOM/handlers/CSS/store, existing authenticated-account fixture and actual ownership guard. No real account or school service contacted. All external requests blocked. The shared browser phase lease was acquired and released; owned browser/profile/server cleaned in finally.

1. Four fabricated fifth labels, initially zero target classes: four sections/rosters, actual encrypted extension claim and durable receiver ACK. Same-source pagination occurs during preflight while the run tab is active.
2. Retry those targets plus one pupil: exact same sections and previous pupil/enrollment rows, exactly one new pupil/enrollment; no duplicates or grade changes.
3. One actual consumed ACK is lost at the runner boundary: unresolved until explicit retry, same durable receipt, no roster/outbox writes on replay.
4. Bare ثاني 1 stays unresolved with explanation and zero class/student writes; existing actual mapping/resume handler clears only its owned synthetic pending batch.
5. Actual source-update handler permits same-page pagination and denies replacement report/school.
6. Actual batch UI/store entry denies mismatched session owner; full database checkpoint unchanged.

Rendered `runner.png` and `receiver.png` inspected: actual RTL UI, truthful partial/local-save status and 0.5.14 website download. Original source extractor, pager, role parser and transport files are hash-identical to base; accepted earlier evidence is reused, including `tests/n36-1019-one-start-browser.json` and `tests/n36-review-1400-guards.mjs` results already recorded in the baseline. No blanket suite/build.

Two separated lease acquisitions could not read the runner checkpoint during its concurrent write; `lease-checkpoint-read-failure.json` retains the error. No browser started in either failed attempt; no lease or policy was bypassed. The first was followed by normal successful acquisition and actual completed UI checks. The later failure occurred only when attempting an optional extra expiry phase after all required UI checks had passed on unchanged Product code. It remains FAIL in `journeys.json`; no further browser retry. That optional extra phase was withdrawn, not marked PASS. The exact expiry rejection expressions are unchanged and their existing evidence is reused. `verified-journeys.json` records the earlier successful observation separately, rather than changing the failed process result. The initial synthetic harness also lacked the narrow activeTab grant; corrected by triggering the extension action only on the fabricated source, without Start or extraction and without changing permissions.

## Release boundary

`tests/n36-feedback-1532/package.json`: exact 25 runtime files, ZIP/source/manifest SHA256, narrow unchanged permissions, old 0.5.13 package immutable, scoped JS syntax PASS. New immutable package: `assets/extensions/rakeez-teacher-import-helper-0.5.14.zip`, SHA256 `0283dd8b15c086311e9fb36394ac8f0433c8f4d62a30942d1c470b551ec53576`.

No push, deployment, queue/status/ledger write or real data mutation by this worker. Provider/Production/official school acceptance: NOT_RUN. Existing corrected minute updater currently reports stable 0.5.13; it must advance to 0.5.14 only after the independent publisher's verified delivery. No updater, scheduler or personal Chrome changes were made. Source-local readiness is not Product acceptance or full N36 closure.
