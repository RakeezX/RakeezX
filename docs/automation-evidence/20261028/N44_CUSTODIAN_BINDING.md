# N44 original-custodian inactive adapter contract

AI-authored source-only correction, 2026-10-28.

- Task: `n44-original-custodian-binding-source-20261028`
- Run: `716dffc6-98ff-4275-99d2-1f7102d4c673`
- Base: `a980406d3e38d92a6386aa459be984b4411be6a1`
- Scope: the inactive module, its synthetic test file and this evidence only.

## Preserved failure and source evidence

Read original `n44-core-live-1028/6ff59697-1fc6-4bdb-94e7-e4056d0d3ddc/result.json`, original checkout `tests/n44-core-live-1028/phase-preparation-6ff59697.json` and its finite-trial evidence. Original candidate `8ebb069741795959d04b6e7af2e60b91742bf9e8` remains unchanged. Its eight synthetic orchestration tests were not rerun; its five live gates remain NOT_RUN. Its private adapter hash `57fea12bf8e9547efbed98f7ea1c669380a9aa98eb50491e32b611fc8551b23d` is historical evidence, not a binding this module imports or executes.

Inspected published `activation/device-custodian.mjs`, `existing-host.mjs`, `activation/core-v1-packet/build.mjs` and `scripts/n44-activation-custody.mjs` at the base. Known `device-custodian.execute('--preflight')` checks original custody/configuration digests and source. `execute('--readiness')` checks signed hosted service readiness, source and transport/boundary flags. These historical commands pin their own task/run/lease and are NOT new-grant entry points. They are recorded by exact reference, never imported or invoked here. Service readiness is not an authenticated phone receipt.

`existing-host.createExistingHost` composes an HTTP handler/close lifecycle and reads `N44_FINITE_SCHEDULER_JSON`; it does not install an external schedule. The packet builder compiles an archive, not a provider installation. The custody script's environment/install/readiness actions do not establish a supported new-grant schedule binding. Historical `--deploy-edge`, `--bind` and scheduler/send probes are not reused as substitutes.

## Implemented contract

`core-v1-binding.inactive.mjs` has no imports, ambient IO, timers, environment reads, CLI, provider or send API. Creation performs no capability invocation. `describeOriginalCustodian` records known source references, rejects read invocation as INACTIVE, and reports typed NOT_BOUND for schedule install/removal, current service installation and authenticated phone receipt. There is deliberately no live-enable flag.

`createOriginalCustodianAdapter` defaults to inactive and accepts only an explicitly synthetic lifecycle. JSDoc defines exact Scope, Configuration, Receipt, Schedule and SyntheticPorts shapes; runtime validation rejects extra fields, source/scope/config mismatches, enabled flags and unverified receipts. Only caller-injected trusted synthetic functions execute. This cannot sandbox a malicious injected function and must never be exposed as an HTTP/browser capability loader.

Before installation, all four capabilities, including removal, must exist. The adapter reads exact inactive configuration and authenticated synthetic receipt, reserves INSTALL_UNKNOWN before dispatch, and accepts only its matching schedule acknowledgment. Removal uses only the acknowledged schedule and checks its identity. Failed/uncertain install/removal cannot replay or return cached readiness. Concurrent duplicates serialize; acknowledged receipts/install/removal are idempotent within one instance. No durable restart journal or live authentication is claimed. Original protected journals and guards remain required for any future integration.

Cancellation before dispatch makes no installation. Cancellation during an acknowledged installation removes that exact synthetic schedule. Uncertain installation cannot safely infer an owned schedule; it remains INSTALL_UNKNOWN for explicit original-custodian reconciliation, with no guessed cleanup or replay.

## Affected checks

Executed `node --check drafts/n44-push/activation/core-v1-binding.inactive.mjs` and `node --test tests/n44-custodian-binding-20261028/bindings.test.mjs`: syntax PASS; 10 tests PASS, 0 FAIL.

| Required check | Result | Evidence |
| --- | --- | --- |
| n44_exact_custodian_port_shapes_and_inactive_failclosed | PASS | Default/known-reference inactivity; exact input/output shapes; every missing port fails before work; forbidden live mode and send port rejected. |
| n44_schedule_install_remove_and_receipt_adapter_contract | PASS | Synthetic config/receipt/install/remove sequence; concurrent idempotence; cancellation before/during install; exact teardown; UNKNOWN no replay; stale cached readiness rejected after uncertainty. |
| n44_no_live_calls_no_grant_consumed_and_no_peer_replay | PASS (local scope) | Tests use only memory mocks, no custodian imports; no runtime entry references this new module. Foreign source/scope and peer teardown fail. Only three new allowed files changed; no grant, historical receipt, original candidate or vault files edited. |

No browser/server phase, lease, service/network request, secret decryption, provider operation, schedule, phone, SQL, source record, registration or send was performed. No UI PASS is claimed. No unchanged app/packet/live checks were rerun. No queue/status edit, push or deployment occurred.

## Ready versus remaining external work

LOCAL_READY applies only to this inactive source contract and mock qualification. The concrete local contract gap is addressed without inventing a supported live port. Source-only publication remains with the sole controller/publisher; publication has not been verified by this worker.

Original N44 live execution remains blocked on supported original-owned schedule install/removal, current install/config scope integration and authenticated phone receipt capability. These are NOT_BOUND, not silently successful stubs. Later separately authorized original-custodian readback must establish current source/configuration, real quiet preference and all finite-trial readiness before activation. This card grants no new trial, metadata retry or private grant use. Historical failures, grant counters and DPAPI custody remain untouched. N44 stays open; no feature completion or Production/PO acceptance is asserted.
