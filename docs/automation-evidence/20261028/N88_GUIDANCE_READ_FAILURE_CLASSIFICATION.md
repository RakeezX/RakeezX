# N88 — independent guidance-read classification (AI-authored)

Task `n88-guidance-read-1028`; run `f1d7a109-b3dc-47a4-a74d-126c5dc3e4e0`.
Base: `0a7c492875cb606e9928886a17189a3339fdfb6b` (observed origin/main at preparation).
Scope: frontend source and fabricated local verification only. No push, deployment, real account, provider, SQL service, Auth/RLS or student-code operation occurred.

## Result and limits

The actual class-list and guidance-list routes are independent. In the current integrated source, class list does not query `n88_private.task_guidance`; guidance list does, after canonical source/owner checks, synchronization and visibility-source projection. A list HTTP 200 proves neither guidance health nor prior issuance. The teacher's actual guidance failure remains unclassified until its own response is observed. Missing table and missing SELECT both reproduce guidance HTTP 503 at `projection` while class list succeeds; this does **not** establish either condition on the live provider.

The bounded frontend change adds a separate collapsed **تفاصيل دعم قراءة التعليمات** result. Its fixed snapshot fields are `schema`, `kind`, `phase` (`request/http/ack`), `code`, HTTP status/class, existing allowlisted 503 stage, allowlisted region (otherwise `unknown`), elapsed milliseconds clamped to 0–30000, and success/failure outcome. No request, response body, names, student/teacher IDs, guidance text, grades, credentials or arbitrary error/header text are retained. The callback is independent of roster `readSequence`, so a later roster read cannot suppress the separate guidance result. Observer exceptions cannot affect the request.

A reproduced codec defect is corrected: `{tasks:[null]}` previously threw TypeError before ACK validation and surfaced as `uncertain`; it now fails validation as `invalid_ack`. Invalid JSON is likewise classified as `invalid_ack` for guidance only. The runtime passes non-object envelopes to the exact ACK validator instead of destructuring them. HTTP rejection and deadline failures remain failures; no service-success banner, retry loop or write is introduced.

The existing Arabic read-error copy, explicit **مراجعة الحالة** action, draft handling, manual save, source/revision CAS and original UNKNOWN issuance journal/reservation/once-only command code remain unchanged. No parent field-view/CSS or service file was edited. Only SW generation changes, 94 → 95; no new startup dependency or shell path is introduced.

## Actual affected verification

| Check | Evidence |
|---|---|
| Independent actual HTTP routes/ACK | `tests/n88-guidance-read-20261028/result.json`, `native-proof.json`: current gateway → integrated service → restricted native PostgreSQL; successful roster and guidance; absent table and revoked backend SELECT cause separate 503/projection, roster still succeeds. |
| Strict canonical 0/28/50 sources | `native-rosters-result.json`: real canonical parent/child FKs, owner guard and bounded source reader; each count with saved visibility ON/OFF; ON yields four tasks for nonempty rosters, OFF/zero empty. Wrong owner denied. No credentials or guidance rows created. |
| Failure/privacy/deadline | `result.json`, `ui-expanded-proof.json`, `ui-runtime-proof.json`, `ui-pwa-result.json`: 401/403/503, partial/null/null-element/invalid-JSON ACK; default real 10-second client and UI timeout; owner/session/term shift; exact diagnostic key allowlist. Original codec RED and corrected GREEN recorded. |
| Real app entry/draft/UNKNOWN | Actual full app shell, route, store, ownership/lease guard, runtime, client, handlers and source CSS over task-owned loopback HTTP. Native service failed read preserves draft and disables save, deliberate read-only retry preserves it; uncertain explicit save runs once and retains draft/CAS fence. Owner retirement removes controls. Synthetic transport matrix verifies original UNKNOWN hint byte preservation and disabled issuance, without writes. A valid term shift retires controls. |
| Queue/late response | A deliberately held earlier roster read queues guidance (330 ms observed); release gives valid success within its deadline. Separately, a delayed guidance response times out at the existing 10-second budget, remains failed after late arrival, preserves draft and performs no automatic replay. These are distinct scenarios: a later queued request can legitimately finish within its remaining deadline. |
| Mobile | Four native-app screenshots plus 12 actual-app scenarios: 0/28/50 fabricated members × 320/390 × light/dark, saved prior ON/OFF. Four 28-member screenshots retained; actual RTL, no horizontal overflow. Inspected 320-dark and 390-light guidance/fields and 320-dark roster screenshots. |
| PWA | `sw-ownership.json`: this task was the only active/delivery owner of sw.js before the generation edit; no N44 owner. `ui-pwa-result.json`: shared browser/integration leases, fresh context, actual v94 → v95 installation, eviction of v94, exact runtime/client/codec cached bytes and offline retrieval; `/api/n88/` remains network-only. All other SW bytes equal base. |
| Syntax/scope | `node --check` for changed JS/SW and task helpers; `git diff --check`. Full Vite build and provider/served checks belong to the independent publisher. |

All native clusters, HTTP servers and browser contexts were owned and closed; integration/browser leases released in finally. The native journey used the canonical isolated browser helper (blocked SW/external origins); PWA used the shared phase leases. The parent fields task's existing canonical receipt recorded verified Production before this task began; this worker did not repeat that delivery.

## Preserved harness failures and evidence reuse

`attempt-history.json` preserves the original UTF-8 text and SHA-256 of each failed local artifact, indexed by its original name. Reuse references in the final reports resolve to these archive entries. No failed gate was relabelled as PASS; corrected scenarios have separate later evidence. Source hashes bind the reusable completed assertions.

The old integrated review helper needed current private-boundary SQL in its **owned local** cluster, an explicit fabricated rollout guard in both service and canonical adapter, JSON MIME for current JSON modules, and `canonicalReadMode` for the boot-only read. An unrelated membership-repair SQL preflight rejected the synthetic role topology and was removed from test setup; no Product guard or SQL source was changed. Further harness corrections covered the actual two-member seed, asynchronous details toggle, uncertainty injection through the existing boundary operation name, a valid second term (invalid IDs fall back in the actual store), and the canonical unrecorded subitem score (`value:null`, not fabricated zero). The initial queue-timeout assumption was disproved and replaced with independent queue and deadline scenarios; its original failure is retained.

## Authorized next stage

This candidate is locally ready for the original controller/sole publisher's frontend integration and served-PWA verification. Production, real guidance health, issuance resolution and Product acceptance are **not** claimed.

If a separately authorized future observation shows a genuine service failure, the exact target is `/api/n88/teacher/class/guidance-list`, with the guidance snapshot's URL-independent HTTP/stage category. A `503/projection` alone cannot distinguish table, grants, stored metadata or projection mismatch. Any provider investigation needs a new bounded authorization/readback for `n88_private.task_guidance` (existing migration `20261018125611` schema/constraints, private owner RLS and `n88_backend` SELECT plus exact boundary routine identity). This card grants zero such operations; do not apply a migration, alter permissions or infer a provider repair from the roster 200. The original UNKNOWN command stays fenced.
