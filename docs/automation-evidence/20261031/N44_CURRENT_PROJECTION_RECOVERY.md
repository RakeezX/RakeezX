# N44 current projection recovery — local candidate, service blocked

Task `continuous-n44-current-projection-recovery-20261031`
Run `a28ecd62-83bf-4c8f-8aa7-b511048e76ec`
Base `df23c78126281b8625e2009df7cf3195abd7a482`

## Implemented behavior

An explicit authenticated `events/read` accepts only the existing scope, source
kind/ID, registration, consent revision and fresh nonce. Existing ingress, official
Auth verification, current-session lock and owner lock remain. The exact existing
owner-scoped SELECT is bounded at101 and fails closed above100. Canonical source
locks, consent and active registration/session expiry/revocation checks remain.
No caller owner, stamp, event or action path is accepted.

The response compares the complete non-expired canonical event set with stored
projection: stamp, exact IDs/kinds, due/expiry and safe action path. Future events
are included without invoking due-only authorization or any sender. Empty/deleted
source is deliberately absent, never verified. A bounded digest of canonical
source and dependency identities/revisions also binds the mounted confirmed graph;
matching event times alone cannot adopt another source revision.

The mounted settings action can explicitly recheck UNKNOWN. The runtime snapshots
owner/workspace/device, session/credential/generation, lease, consent/registration,
mounted source/calendar revisions and confirmed Sync/outbox checkpoints. It fences
every awaited result. Only exact VERIFIED identities plus the same confirmed local
graph clear the marker and restore its stamp. Recovery provenance remains CURRENT
on later explicit checks; it is never relabeled an original projection ACK.
Partial/different/malformed/stale results retain the marker. Passive observations
never read or replay. ExistingClickOnly registration can read while opt-in and
projection mutation remain blocked. Recovery calls no events/update or project.

Arabic wording describes the current reminder state and explicitly separates it
from sending/arrival. No date input changed. SW v101→v102 is the only worker change;
the cache inventory and worker logic are exact after that one substitution. The
existing cached db/models modules supply the needed checkpoint/date operations.

## Actual affected checks

| Check | Result | Evidence |
| --- | --- | --- |
| Exact authenticated current-projection read | PASS, local/synthetic | Four service subtests use real signed Cloudflare ingress, Web entry, official AuthClient, backend and gateway with synthetic query/Auth ports. They also execute the exact qualified Native181 composition. Complete/future set verifies; partial/shared-stamp/wrong-field/changed-source, foreign/revoked/expired registration, context/session and forbidden request fields stay unresolved. |
| Mounted reload recovery without replay | PASS, local/synthetic | Real HTTP application DOM, settings handler, runtime, gateway, source CSS, actual store/ownership guard and existing served-demo/native helpers. Saved projection plus lost response persists UNKNOWN across actual page reload; explicit current read clears it, with zero new events/update. Grade4 remains4. |
| Changed context and UNKNOWN fences | PASS, local/synthetic | Same mounted journey rejects absent/partial/wrong-field/forged/revision/nonce responses and discards delayed reads after owner, device, credential, session, consent or source changes. Repeated passive refresh/snapshot/render makes zero reads; explicit retry remains available. Restored registration cannot opt in. |
| Client protocol boundaries | PASS | Exact response keys/nonce/bindings, duplicate identities, oversized stream, stale time and actual15s unending-body cancellation; no write fallback. |
| Existing HTTP400 stale semantics | PASS | Three unchanged subtests from `tests/n44-stale-projection-http-20261031.test.mjs`, excluding its old-card browser phase. Single bounded CAS correction remains;503/lost/body timeout stays one UNKNOWN attempt. |
| Existing permission-race evidence | REUSED, not rerun | `docs/automation-evidence/20261030/N44_PERMISSION_TRANSITION_FIX.md`; the permission listener, opt-in/client and registration path remain unchanged. No old-card browser helper was relaunched. |
| Actual private SQL shapes | PASS, live read only | Exact three pg_catalog definitions, arguments, definer flags, owner, search_path and ACLs match the existing private boundary identities. `bundle/private-boundary-readback.json`; no SQL mutation. |
| Syntax/diff/offline inventory | PASS | Changed JS/MJS/SW syntax, git diff check, and exact base SW comparison after v101→v102; existing affected imports are already cached. No full build or blanket suite. |
| Actual deployed service/configuration/recovery | NOT_RUN | Current Native181 baseline read back; modified service and ingress were not installed. This prerequisite blocks LOCAL_READY. |

The mounted fixture's old Demo→account preparation deliberately deactivates the
old runtime and clears synthetic native registration. Initial harness attempts
therefore observed cleanup_pending. The final harness finishes that cleanup before
restoring the exact same saved synthetic registration/native state and mounting a
fresh actual runtime. It does not provision another registration or bypass a
Product guard. Disclosure-reset and asynchronous-observation fixture failures were
also preserved in this session; the corrected expanded journey passes. This is
mounted local recovery evidence, not certification of real account boot/SW/cache.

## Actual service prerequisite and disposition

Official `get_edge_function` returned Native181, archive
`41c540288561db1e1d0ce32e2cd26660da128251270ee9f686d8846fec2254fc`.
Exact entry is `09d902f57abbb43ac459121072c3a1c28c3c83310aa790a5e8e43d5b744475d2`
and map `50c148558c120b2a7bc3bb65d0b6fe4568d05ce9e681720502a94a716cc51421`.
Preserved original-custodian evidence identifies source
`9d5becbc13e131249bac0d2e73babce6dd841f31`. The new manifest binds the minimal
composition over those current bytes; every other native byte is preserved.

The fresh named admission validated this card/intake hash and original custody
owner. Official CLI source/policy digest and OFF/null/unset assertions completed
before it reached current-ingress preparation. Those metadata values were not
exported. The supported Wrangler4.148 `init --from-dash` command unexpectedly
spawned project setup, installed a local Wrangler^4.156 wrapper and started
`wrangler login`; it timed out after45000ms (`ETIMEDOUT`, `SIGTERM`). It did not
produce current ingress source. No interactive login was completed by this worker,
no credential was extracted, and no fallback/private token search was attempted.
That route is now removed from the admission helper; it must not repeat unchanged.

Exact finite GET request paths for the current ingress source, settings and
schedules are saved in `bundle/provider-read-requests.json`. An authenticated
official Cloudflare operator is required to answer them before the sole qualified
ingress delta and original maintenance install/readback can proceed. No service,
ingress or source-policy update allowance was consumed. No authenticated hosted
fixture was used or created. Public401 and temporary-function evidence are not
substituted for the missing gate. Prior temporary-function cleanup is NOT_VERIFIED.
Old trial/spent/UNKNOWN records, real registrations and data remain untouched.

Browser contexts/servers closed in finally; browser, integration and live-mutation
leases were released. A combined ownership-checked login-process termination and
recursive generated-directory cleanup was rejected by automatic approval review:
`blocked by policy`; none of that command ran and no alternate deletion was tried.
Fresh process observations then found login PIDs14768/29452 and their parents
7016/16728 absent. The generated local `bundle/current-ingress` directory remains
uncommitted, with no active server/login. No disarm write was needed because this
attempt never changed live flags or activated service/trial behavior.

The result is BLOCKED/auth, with an AI-identified exact candidate commit for local
work. The controller owns any later authorized publication; N44 remains open.
