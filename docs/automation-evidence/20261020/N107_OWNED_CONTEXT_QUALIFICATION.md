# N107 owned generic mutation context qualification

Task `continuous-n107-owned-write-context-qualification-20261020`  
Run `4690d799-da5a-428d-8763-3ad02ae18464`  
Base `64d6ee3ad4c765561d55148a6f004f480881290b`.

**LOCAL_READY: context guard only.** Existing generic owned RPCs now carry a transient client context fence through send/retry and atomic receipt adoption. No student-create concurrency was enabled. Actual hosted import latency remains **18 seconds**; no speed improvement, N107/N125 closure or N125 incident attribution is claimed. Previous diagnostic candidates `002715c309ffccd71fddd75e4be835c20da96479` and `61cdec24f9793b5794e4b5bd357ac89e48a96875` remain untouched, with their original NOT_RUN performance gates.

## Actual caller baseline

Read the current canonical contract, activated card/current N107 row and affected source. Existing N36/N117/base changes remain intact. The new fixture reuses the existing N73/N107 synthetic account data/setup, calls the actual `store.importStudents` entry with its real access/lease guard, and dispatches through the configured `sync.syncAll` runtime engine. It uses the real Product transactional DB adapter with fake IndexedDB and actual runtime ownership/offline-lease guards. `cloud.setMockBackend(null)` ensures the actual default RPC wrapper/request/refresh code runs. Every fetch is intercepted in-process; no credentials, native/hosted requests, SQL, real accounts/students/files/imports or sends are used.

Before modifying source, one newly composed baseline at this base held the first student RPC, changed the synthetic authenticated owner and returned401. The actual configured caller sent the same student request twice, adopted revision1 in the **original** owned database and removed its envelope. `baseline.json` preserves those observations. This confirms that upper-layer composition did not fence the generic retry/adoption. It does **not** prove cross-database writes or a real application leak; prior lower-layer injections alone were not treated as that proof. The earlier latency/parser/full-Sync suites were not replayed.

## Minimal change

- `cloud.js::captureOwnedMutationContext` captures the runtime owned workspace object, active database, authenticated owner and existing Auth context generation. Each check requires the same workspace/database/principal, a present session and a currently writable existing offline lease. Failed checks retire that captured fence. The existing generation distinguishes logout/owner replacement from ordinary same-owner token refresh; no token equality check would reject a normal refresh.
- `applySyncV2Mutation` combines that fence with the caller's fence and supplies it to the **existing** `request` assertAccess hook. Existing refresh/401 retry and response-body boundaries therefore recheck before another send or returning a receipt. Its mock path performs the same pre/post checks. RPC path/body, server protocol, retry counts and Auth service behavior are unchanged.
- `sync.js` supplies the context capture callback to its existing runtime engine. Generic queued work uses the captured pass context and command owner. Special command transports are not refactored.
- `sync-v2.js` checks the fence in generic `markAttempt` prepare and again inside `reconcileReceipt` prepare, after the asynchronous database-open/transaction scheduling boundary. Generic failure/rejection persistence uses the same transaction check. A retired context stops this pass without acknowledging, deleting or replacing the original uncertain envelope. Dependencies, envelope locking, IDs, revisions, canonical receipt adoption and pre/post-pulls remain intact.

This is transient client context fencing, not a new authorization system. No Auth SDK, login flow, JWT trust, roles/RLS/grants, backend/schema, scoring/max/delete/Restore/calendar transport, UI step or general Sync scheduling was changed. No new startup module was created: cloud's added DB import points to the existing `src/lib/db.js`, and all affected modules already appear in `sw.js`'s offline shell. The shell-membership assertion passed; no offline-cache certification is claimed.

## Affected checks

`tests/n107-owned-context-20261020/qualification.json` records exact task/run/base, finite observations and source SHA256s. Run each scenario in a fresh Node process:

`node tests/n107-owned-context-20261020/composition.mjs --scenario=<name>`

| Scenario | Actual composed result |
| --- | --- |
| owner401 | One student send; changed owner cannot retry; no adoption; locked same-ID envelope retained. Baseline was two sends/adoption/removal. |
| ownerack | Delayed successful response after owner retirement cannot adopt/remove its envelope. |
| workspace | Actual store deactivation and mounting of a different synthetic owned DB while response held. Foreign student absent and deliberately same-ID foreign Outbox sentinel unchanged; original DB still retains its original locked request. |
| lease | Existing runtime lease invalidated during held response; no receipt adoption and original request retained. |
| session | Logout and login back to the same owner retires the original generation; no adoption/removal. |
| atomic | Fake IndexedDB's transaction entry retires owner only when the real all-store receipt transaction starts, after transport/pre-adoption checks. Atomic prepare aborts adoption/removal. This specifically exercises the asynchronous check-to-write boundary. |
| refresh | Actual intercepted Auth refresh RPC after401 returns a new token for the same owner; same generic request retries and receipt persists, Outbox removed, coordinator succeeds. |
| normal | Actual generic receipt persists before successful coordinator return; one student request and acknowledged envelope removed. |
| lost | Fixture commits once but loses the response. Failed uncertain envelope remains; explicit next coordinator pass sends the identical body/mutation ID, recovers the cached receipt and removes the request only then. |

Both required checks **PASS**: `n107_actual_owned_database_context_qualification` and `n107_same_owner_refresh_and_retired_owner_ack_boundaries`. This is actual affected **store-entry composition** proof, not a rendered-UI or hosted PASS. There was no view/CSS change or browser phase. No server/browser lease was acquired; the fixture restores fetch/IDB hooks, drains its owned coordinator timer via existing deactivation helper and closes its owned DB/channel in finally. No unknown process/resource was touched.

Harness corrections are preserved in `development-failures.json`: the initial table stub lacked the required exact count header; foreign account lease setup initially omitted its matching persisted synthetic Auth owner. These are fixture failures, not relabelled Product safety passes. The lost-response scenario's initial Sync failure is intentional and remains part of that observation. Syntax for the three changed modules and harness, whitespace, and existing offline-shell membership all PASS. No build/PWA/browser matrix, full Auth/Sync/scoring/SQL suite, provider polling or repeated Preview was run.

## Delivery and remaining scope

This guard is independently substantive and ready for the sole publisher's integration/served-source verification. Optional width-two scheduling and its same-dependency performance comparison are **NOT_RUN / omitted**, as expressly allowed for guard-only delivery. Prior max/grade/ACK-order/recovery and file evidence is reused; no safety gate was removed to improve a time. Hosted18s and N125 attribution remain unchanged/UNKNOWN. No push, deploy, queue/status, global config or service mutation occurred in this worker. Product acceptance remains with the authorized lifecycle.
