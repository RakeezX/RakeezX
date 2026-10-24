# N88 stable student view — public source dependency

AI-authored scoped implementation, 2026-10-24.

Task: `continuous-n88-stable-student-view-public-dependency-20261024`.
Run: `2f44b4b4-03b3-4e50-a8ee-c0a6ab9bc0ef`.
Base and observed local origin/main: `a35aa9fc8452434a017112d1254b0a14cd61ef9f`. Qualified immutable parent: `b5999fda76e5bde0920c71987c3712b2ee59e669`.
Candidate identity is the commit containing this record, returned as the full candidateSha in the runner result.

## Exact source transfer

Manifest: `b5999fda76e5bde0920c71987c3712b2ee59e669:drafts/n88-student-portal/activation/stable-student-view-20261024/manifest.json`; SHA-256 `4fbb06571c896e52c134429c6f2497fac24a51067bf93cd8d3cf7bd8a2a98988`.
Only `drafts/n88-student-portal/activation/stable-student-view-20261024/public-source.patch`, SHA-256 `80a24b04fdbda8e78feeae47041f7ee7f5bf2f36739a58223c7aa2413fb92250`, was applied with `git apply --unidiff-zero` after exact HEAD and normalized worktree preimage validation and parent target validation. No private branch/history or old whole-file overwrite was imported. The resulting zero-context Git diff equals the manifest patch byte for byte.

| Source | Base SHA-256 | Target SHA-256 |
| --- | --- | --- |
| `src/views/student-portal-login.js` | `b2c123fd5da51759ba7bddb2f0f573a1149e31d48fd8174e9ccb2f4f856a3612` | `ae13ddbbf1adf9e83b4aae200e09a3884bb963765cd4d6c5c81f710d03d47208` |
| `src/lib/student-portal-unified-client.js` | `14e3c39335602f15dee4a1816724a78700a36cc90d1856f61816e8fd6c50718a` | `78d7cc6f544eca7584e138350a2ef3863231bfd6fd6814612af1ca58ae19363e` |

Ordinary short same-document tab switches retain the private DOM/details/scroll and unsubmitted entry draft without another GET. Refresh is manual or five-minute bounded quiet revalidation. Known invalidation/expiry, failed revalidation, pagehide and disposal purge the view and fence late replies. No session lifetime or server authorization was extended.

## Affected checks

All evidence below is reused from the immutable parent, not a new browser run. The saved harness exercised the actual student-entry/view/client/binding observer and source CSS over loopback HTTP with fresh synthetic contexts, plus the actual compiled student asset. Its source baseline reproduced two reads and destruction of the settled DOM; GREEN contains 15 actual rendered cases. The five transport checks are separate non-rendered evidence, not a substitute UI proof.

| Required check | Result and basis |
| --- | --- |
| `n88_stable_actual_rendered_source_and_bundle` | PASS — exact target/input/CSS/compiled asset/proof identity; 15 rendered cases, 5 transport privacy checks, 4 final assembled carrier cases reused. |
| `n88_stable_exact_current_main_and_privacy` | PASS — exact two-file manifest diff; all declared shared input hashes match, CSS unchanged; Node syntax on both files and git diff --check pass. No startup/SW/route/service change. |
| `n88_stable_old_failures_and_no_replay_preserved` | PASS — saved RED reproduced; original FAIL records retained at parent; transport call/claim bytes unchanged; no persistence/cookie APIs, automatic claim/end replay or operations introduced. |

Compiled student asset: `b5a785ff6a11a0bad7aba2635e6c47d851f6711570631d4af7a7523ef52b42c8`; prepared carrier: `651e8b7c25b8a317447ded7f32b16eaf0a10b2caf8c7ae3fb7cf0898473595be`. These are qualified local bytes, not served hashes.
Unchanged student CSS: `2a67b8c32793d52b4e2f5daff17ac72f6775235b7d4862495c0963c714c5e7f9`. app.css also equals the rendered harness baseline `d4d03041d9d39166780e015a1c50b76ddff5cad3`. Every manifest input hash was checked; shared current-main dependencies match. Auth403, Sync, Support diagnostics, existing entry/end-uncertain and transport/proof safeguards remain outside the exact delta or retain their qualified bytes.

Proof identities (SHA-256; paths resolve in the immutable parent):

- `tests/n88-current-terminal-fence-20261024/stable-view-rendered.json`: `fd78a34ce105f057e7e19c4d564bf1a3e6b45222a99c04a1e7d982050f4bd8d8`.
- `tests/n88-current-terminal-fence-20261024/stable-view-final-carrier.json`: `84f9973aec7268d3d7262f13d85444cf45cecb028d082f0599b4215eb587596b`.
- `drafts/n88-student-portal/activation/stable-student-view-20261024/carrier-lineage.json`: `439be82b7006fa1fd7a8a8906de3dc38bb6148683eee55b675ab81b21c589f2a`.
- `tests/n88-current-terminal-fence-20261024/stable-view-client.json`: `1c71adb358b70c69f141b2da2041c500c2cd85c67bf95689f6d3e57bf9bd1f4e`.

Rendered cases preserved:

- `/actual_full_entry_short_tab_exact_DOM_details_scroll_zero_extra_GET`.
- `/compiled_full_entry_short_tab_exact_DOM_details_scroll_zero_extra_GET`.
- `manual_one_GET_stale_one_coalesced_quiet_GET_no_claim_end`.
- `denied_purges_private_view`.
- `session-expired_purges_private_view`.
- `invalid_purges_private_view`.
- `known_context_immediate_purge_entry_draft_selection_retained_zero_claim`.
- `hidden_display_freshness_expiry_purges_then_authoritative_return`.
- `pagehide_late_hidden_read_cannot_revive`.
- `dispose_late_hidden_read_cannot_revive`.
- `context_late_hidden_read_cannot_revive`.
- `hidden_claim_context_retirement_no_late_revive_or_replay`.
- `hidden_end_context_retirement_no_late_revive_or_replay`.
- `unknown_end_no_replay_no_private_web_storage_or_cache`.
- `end_deadline_unknown_no_replay_or_private_data`.

Transport/privacy cases preserved:

- `context_notification_synchronous_invalidation_abort_late_reply_retired_unsubscribe`.
- `denied_expired_revoked_service_failure_finite_no_body_or_retry`.
- `lost_claim_end_response_no_automatic_replay`.
- `read_deadline_bounded_without_transport_cooperation`.
- `no_private_persistence_API_or_cookie_inspection_in_changed_sources`.

## Original failures and limits

No historical FAIL was relabeled. The original RED remains in stable-view-rendered.json. Preserved parent FAIL artifacts:

- `tests/n88-current-terminal-fence-20261024/stable-view-client-initial-failure.json`: `f93be80e3429d34908c8b8ae6fe56fde3e729777e45b4294d71d52aaf899a5df` (FAIL).
- `tests/n88-current-terminal-fence-20261024/stable-view-carrier-fixture-failure.json`: `ce48a105d2276d289b46538b2cfa5bf146eeb97606fc2e072b7045195466308a` (FAIL).
- `tests/n88-current-terminal-fence-20261024/stable-view-final-carrier-lease-failure.json`: `6745a065b89c7ddcce8df88540a7861239237ca383f98872d2408dc9ac965e1b` (FAIL).
- `tests/n88-current-terminal-fence-20261024/stable-view-fixture-initial-failure.json`: `92a300cb15aaefb35fb71ad843f5c2f86095d77a004a0b8b22a9e26e2fdc08f8` (FAIL).
- `tests/n88-current-terminal-fence-20261024/stable-view-package-initial-failure.json`: `528024a55041a41506b3f5becbafb2f78d3f4f0e0c4b3be1824830f33c2b8111` (FAIL).

The earlier package/fixture/lease/client harness failures remain separate from subsequent qualified evidence. The original parent outcome remains BLOCKED pending source publication/private asset delivery; this child does not rewrite that outcome or any spent allocation.

No browser/server/lease phase, account/provider/native/carrier/pin/SQL/Auth/fixture/consent/registration/send/read operation was performed. No resources were started. No private asset was activated or uploaded. No queue/status/ledger changes, push or deployment occurred.

Sole-publisher source integration, deterministic build and actual served-source verification are NOT_RUN by this worker. Source publication alone does not prove delivery of the private compiled student asset. Original N88 custody owns that separately authorized phase. Actual final user stable-tab/grade/privacy acceptance is NOT_RUN here; the recorded five created codes and successful prior return are reused context only, not newly observed. N88 remains OPEN. N44 source/policy and concurrent causal work are untouched.
