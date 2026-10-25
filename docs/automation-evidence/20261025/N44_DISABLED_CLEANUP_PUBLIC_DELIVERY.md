# N44 disabled owner cleanup — public source candidate

- Task: `continuous-n44-disabled-cleanup-public-20261025`
- Run: `e265f9ac-7050-4022-9871-256c3afa51b5`
- Base: `59bb179f9913ff6b0603b369258fa0c24a22dd30`
- Worktree: `C:\Users\Abody\Projects\RakeezX\.worktrees\continuous-n44-disabled-cleanup-public-20261025`
- Authority: activated N44 card, qualified disabled-cleanup public dependency; source preparation only. No queue or ledger changes.

## Exact packet — PASS

Only `src/lib/notification-push-runtime.js` was applied from immutable commit `5650542a18df99fa75e6fa8f7e6144738bf77ddc`, using `drafts/n44-push/activation/cleanup-disabled-104a6196/manifest.json` and `public-runtime.patch`. No branch merge or cherry-pick.

| Artifact | Verified SHA-256 |
| --- | --- |
| Base runtime Git bytes | `dd53d6df35b413fe00ab61b434c6168e368530092ce24e8cfe2e3a50c57b5826` |
| Target runtime Git-normalized bytes | `08edd9ce9b53a59a6f2b03827704145d8198f8b01f39dff6b17a6ded40563182` |
| Immutable patch bytes | `d8fc337fd9374f31917582920add23c2ff10a76815cbb211790fa472529677cf` |
| Reused parent UI JSON bytes | `3f1a84733cc43017d0afe69bed54139a93b21769df8028eb4ab3ff1b07054828` |

Base blob `464abe9b1884465f3f6c659ae381645ba4c3632a` matched. Forward `git apply --check` and reverse check passed. The resulting runtime equals the immutable parent's runtime byte-for-byte after Git line-ending normalization. Source diff: two hunks, 18 insertions and one deletion; no startup dependency.

## Owner and activation boundary — PASS

Scoped assertions and diff inspection confirmed disabled configuration exposes cleanup only with a bounded saved owner/workspace/device hint, valid current binding, normal server `current` context and `pushConsent === true`. The path returns with cleanup pending before activation readiness. Existing ownership checks, supported-configuration predicate and `optIn` implementation are unchanged. Explicit Stop retains retirement/revoke, registration removal, owner recheck, unsubscribe and normal consent-false CAS update.

Reuse unchanged evidence at `5650542a18df99fa75e6fa8f7e6144738bf77ddc:tests/n44-current-closed-page-followup-20261024/cleanup-disabled-ui-104a6196.json`: overall PASS, four actual mounted DOM/CSS/owner-store checks PASS:

1. Disarmed account without cleanup hint performs no context read and exposes no cleanup.
2. Mounted owner settings expose cleanup after disabled preview without registration or permission.
3. Delegated Stop revokes the exact saved registration, clears binding, unsubscribes and sets consent false through CAS.
4. Auth owner mismatch clears private identity and cannot expose cleanup.

These checks were read and reused, not rerun. This child's source assertions are not a new rendered-UI proof.

## Current main and affected verification — PASS

Read-only `git ls-remote origin refs/heads/main` observed `59bb179f9913ff6b0603b369258fa0c24a22dd30`, matching the activated base and initial clean HEAD. `node --check src/lib/notification-push-runtime.js`, `git diff --check`, packet hashes, forward/reverse patch checks and scoped owner/no-activation assertions passed. Final candidate identity is returned in runner JSON; the commit contains only the runtime and this evidence document. No build or repeated synthetic harness was run, as directed by the card.

## Remaining disposition

Publication/served-source verification: NOT_RUN here; sole publisher owns integration, build, Pages and served-source evidence. Registration8 disposition remains FAIL pending actual cleanup by the original custodian AFTER publication. The third send remains consumed/provider accepted; OS arrival remains NOT_PROVEN. Recorded source3 canonical cleanup acknowledgment, distribution100/SyncGREEN, approvalNULL/deliveryOFF remain unchanged.

This child performed no browser/server/account/provider/native/pin/carrier/config/service/policy/source/window/consent/registration/send operation, no new source/window/reg9/send4 and no OS retest. No phase resources were acquired. No push or deploy occurred. N44 umbrella acceptance/closure is not claimed.
