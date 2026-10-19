# N123 — mobile reload repeated-read diagnosis

AI-authored, 2026-10-19. Task `continuous-n123-mobile-reload-real-wait-20261019`, run `3bea38e5-a1ac-4c39-b9ae-8fa2f0392f9c`.
Base: `98885befd4f13c02210661309a4add21e04c72ca`.
Tested `src/lib/sync.js` Git blob: `9a2489b27f9acbda874b787f577753deb276a908`.

## Finding and bounded change

The PO's genuine 30s-or-more mobile refresh failure remains the motivating actual observation. The prior 71% synthetic four-read-lane improvement did not resolve that observation.

The coordinator still performed **two complete pulls on open, manual sync and return**, even with an empty initial outbox and zero attempted mutations. Its existing revision-proven single-pull path was restricted by the `remote` entry flag. This is concrete avoidable repeated work, rather than a fixed 30s startup timer. The 325ms scheduling debounce, 2/4/8/16/30s failure backoff, 5s advisory marker deadline, background Auth refresh, background lease renewal and 30s lease presentation timer were inspected; their deadlines/policies are unchanged. No claim is made that the PO's actual device/network phase distribution was observed.

The same existing optimization now applies to full open/return/manual passes only when a valid owner revision was captured **before** the complete pull, the initial pending snapshot was empty, dispatch attempted zero commands and the durable pending snapshot remains empty. The final marker must still validate. Newer revisions remain pending and request trailing work; they are not acknowledged by the older captured revision. An additional final workspace/session/owner check prevents the newly shortened path from certifying a changed context. Missing initial marker evidence, partial passes and all writes retain their post-pull. No timeout, lane count, merge ordering, capability policy, mutation envelope, durable ACK, tombstone, grade, lease or calendar hold was changed.

## Affected evidence

`tests/n123-feedback-1532/latency-result.json` preserves the completed A/B run against the exact base source and candidate source, both already using four read lanes. The actual application index/app-update/app, source CSS, account registry, store, ownership guard, lease and IndexedDB run over an owned loopback HTTP origin in fresh 390×844 mobile contexts. Only Auth/service transport and all records are synthetic. The same 2500ms delay applies to every table response in both versions.

| Scenario | Base | Candidate |
| --- | --- | --- |
| Actual account boot, 2500ms per table response | 30,418.3ms / 48 reads | 15,329.9ms / 24 reads |
| Actual reload, 10ms per table response | 627.7ms / 48 reads | 481.6ms / 24 reads |

This establishes a 49.6% reduction for the deliberately slow bounded case, with the repeated full read removed. It is **not** a measured improvement on the PO's actual phone, an absolute network guarantee or proof that all remaining latency is resolved. Write-heavy operations (including N107's reported 13–14s import observation) still need their actual durable acknowledgments and canonical post-read; this patch does not claim a measured fix for that write latency.

The reload assertion obtains the owner, exact database descriptor, durable outbox, preserved grade and healthy summary in one new-document checkpoint. It does not reuse readiness from the preceding document.

`tests/n123-feedback-1532/result.json` adds only the affected fast negative checks, reusing the slow A/B measurement:

- Final marker failure: 24 reads, returns false, unhealthy.
- Workspace context changes at final validation: 24 reads, returns false, unhealthy.
- A newer owner revision arrives during the pull: 24 reads, still unhealthy/pending; older capture cannot certify it.
- Table read failure: false/unhealthy; no early green.
- Missing marker: conservative 48-read fallback succeeds only after both complete pulls.
- Owner-bound real store edit held before ACK: one durable command remains, unhealthy; releasing its ACK finishes with 48 reads and empty outbox.
- Wrong receipt retains the durable command; recovery reuses its mutation ID and clears it only with the canonical ACK.
- Foreign owner: false, zero Product reads.

`tests/n123-feedback-1532/ui-result.json` exercises the actual mobile topbar/mini-hub tap handler and «مزامنة الآن» button, then actual pagehide/pageshow listeners. Each performs 24 reads and reaches fresh healthy state. `mobile-sync.png` was visually inspected: the actual sheet shows متزامن after completion. `mobile.png` records the actual mobile classes shell.

Existing `tests/remote-sync.test.mjs`: **19/19 PASS**, including revision capture, concurrent update, owner binding, bounded marker failure and teardown. Syntax checks on the three changed JS modules and `git diff --check`: PASS.

Prior `tests/n123-review-1400-browser.json`, original failure records and `tests/n123-review-1400-node-repair.json` remain intact. Their four-read-lane ordering/ACK/deletion/grade and repaired Node-harness results are reused; the unchanged fixture matrix was not rerun. Initial new harness failure is retained in `initial-harness-failure.json`; the corrected harness polls and captures readiness/data in the same evaluation. Synthetic provisioning also requires matching device and registry receipts. The UI selector ambiguity is retained in `ui-selector-harness-failure.json`; the corrected selector targets the visible mobile topbar button. These were harness failures, not Product acceptance PASS results.

Reproduce the slow A/B: `node tests/n123-feedback-1532/reload.mjs`.
Run only the fast changed-path guards: set `N123_GUARDS_ONLY=1` and run the same script.
Run only the actual UI/return handlers: set `N123_UI_ONLY=1` and run the same script.

The canonical isolated-browser helper owns fresh disposable contexts with Service Workers/external traffic blocked. Every phase closed its owned browser/context and ephemeral loopback server in finally. No shared browser/profile, live service, real identity, real student mutation, queue/status update, push or deployment was used. The `file:///` import in the Node harness loads the canonical helper only; every browser navigation is HTTP.

Current remote main movement was read and affected files compared with the base; no affected-source difference was observed. The independent controller/publisher owns integration, provider/served-source verification and Production evidence. This candidate is local readiness only; official delivery and the PO's subsequent actual mobile outcome remain unverified here.
