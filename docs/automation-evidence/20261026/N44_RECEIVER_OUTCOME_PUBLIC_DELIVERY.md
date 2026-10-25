# N44 receiver outcome public delivery candidate

Task `continuous-n44-receiver-outcome-public-20261026`; run `e79f81e5-ced7-4d48-8229-85c47292a584`. AI-prepared source-only candidate. Publication NOT_RUN; OS arrival NOT_PROVEN; N44 not CLOSED.

## Source and scope

Immutable packet source `54b9059ee99301a99daee5832d57590bc9503841`: `drafts/n44-push/activation/disabled-outcome-e339abc1/public/manifest.json` and `public.patch.json`. Decoded UTF8 patch SHA256 `d626b24aaa4942ab96395ee7df02f0c7cc4dfe3d956a241a18afb52b81d72c09`. Packet base `2d08d6774491d27d0ad29dece84862b8ab975620`. Observed actual remote main/candidate parent `6ab7d0e157c257254f64e76386ff25c4bba48ea1`. All four actual-main preimages match. Exact patch applied; exact packet target bytes retained. Initial raw-byte assertion detected Git checkout CRLF conversion; applied canonical bytes already matched, then exact LF packet bytes were retained without configuration changes. Final raw and Git target hashes pass. No whole private branch merge.

| Path | Preimage SHA256 | Target SHA256 |
| --- | --- | --- |
| `sw.js` | `f5928cc47355c86c2824b01b54e8085a1aef083b3af2ef8170ee502e44cdb3c5` | `fd52443f133f7108c91cf8c9f89c4a2a9db5997f556bb29226acf09e648c8e71` |
| `src/lib/notification-push-browser.js` | `7c526515bbf724fa06d9ff4b85babb4b3cd047540e6a6713f4795762547e3151` | `571e2dcc069d822509313c5a39b247f52cce5ca53c80a1d1248fadb1496f9bd9` |
| `src/lib/notification-push-runtime.js` | `08edd9ce9b53a59a6f2b03827704145d8198f8b01f39dff6b17a6ded40563182` | `8e832818f2196fc50d5ae7a288d64267cf283279f879edc999aa52a2836ed1e1` |
| `src/views/notification-settings.js` | `aa6ffe64847d3f6433657ac726f4e8f3e8042bf4c46a441662bb2ffc2d9e3221` | `b50c26ac6cc4af619f093b587046ce824d01239a2b73ca33573492d1289c05c6` |

Only these four public source files and this record change. All other source preserved; no new startup dependency.

## Scoped checks

- `n44_receiver_exact_four_file_public_delta`: PASS. Verified immutable decoded patch digest, observed-main preimages, four packet targets and exact source scope; `node --check` passes all four files, `git diff --check` passes.
- `n44_receiver_actual_native_prerequisite_preserved`: PASS by immutable actual receipt reuse. `tests/n44-functional-readiness-20261026/hosted-result-dfd4e638.json` SHA256 `335c748e29285415909deab8fc67c35fcce1fc837fd424511b5bfd0f3b0e3e7f` confirms source `c1ec411c898320eeded8ba8a3363c69a3e192418`, native archive `cb0bec6dcc12b3831b518add1cc2af7cf7339b4a33f5cc04623dcd2c820f3dec`, exact entry/import map, registration8 revoked, consentfalse, pendingempty, preferences match and rollback acknowledgement. Private writes/COMMIT zero; final native144/peer155, approvalNULL/deliveryOFF, other45 keys and peer archive exact (all47 keys accounted). No current provider read.
- `n44_receiver_reused_qualified_outcome_owner_guards`: PASS by immutable evidence hashes and dependency comparison. Current src/index/package manifests/assets before this patch are identical to the final certified packet base. Original rendered base `4ddd0ed76763545d70e0822c817ca4bde9b9f711` differs only in generated build metadata and unrelated student portal login/class views/styles. Original qualification/final certificate preserve affected notification/store/gateway/CSS dependencies and unchanged SW receiver proof. No new browser or suites.

Finite same-binding outcome DTO and reserve-before-display guards remain exact. Only known TypeError/NotAllowedError rejection permits bounded recovery; unknown/accepted/persistence failures/duplicates stay consumed. Disabled cleanup_pending read retains current owner/workspace/device/session/lease/consent/registration guards before and after await. Support is collapsed and manual-only; no paint/open/focus read, no extra HTTP. Browser observations never prove Windows visual arrival.

## Reused evidence

All paths refer to immutable source `54b9059ee99301a99daee5832d57590bc9503841` and are not copied here. `docs/automation-evidence/20261026/N44_FUNCTIONAL_READINESS.md` preserves original failures and qualification history. Actual mounted DOM/handlers/CSS and synthetic native/PG/SW evidence are reused. Screenshots were previously visually inspected; this run verifies identity only.

| Evidence | SHA256 |
| --- | --- |
| `tests/n44-disabled-outcome-20261026/mounted.json` | `e517c79fc7f8e1a853ae753aaab6cb7caa0de82d70b643a08b65b6ea71cf33a6` |
| `tests/n44-disabled-outcome-20261026/initial.json` | `c8d725f88abca26f873a93df3f67e3915f9ccf5594cafd9afab91eaa1bb8d54e` |
| `tests/n44-disabled-outcome-20261026/screens.json` | `00798a3ddde08c808b735b8bc1a0fd52d1d3e044a77580b03df9a500503d84dd` |
| `tests/n44-functional-readiness-20261026/inspection-pg.json` | `40665f809b726d8064cdcb38730b98aa0df401c363e7d870fb85c15607223269` |
| `tests/n44-functional-readiness-20261026/host.json` | `f0980bcdb985515aa0963312bc4bd7056a224a848dcb178becf79fdd0e752a0a` |
| `tests/n44-functional-readiness-20261026/worker.json` | `b6af1c581b00fb4204b7c426459a903dc63b0acee5371dd16ba357743617dce3` |
| `tests/n44-functional-readiness-20261026/browser-outcome.json` | `8ba74777b8cc8afd8477ac04c281b3ce954361348228f084d92ef3e902f765b0` |
| `tests/n44-functional-readiness-20261026/runtime-entry.json` | `8d8d26f48be98a5d90ad751bccc6c5d84d37a49b72ea5bf386617b6dcfd12946` |
| `tests/n44-disabled-outcome-20261026/support-320-dark.png` | `ca781b2392cd7a65d2f86f02043c67cc89885498ee626d5ff71718faa305d589` |
| `tests/n44-disabled-outcome-20261026/support-390-light.png` | `bb5e6cad8335f19de530b8332f6e9aa932cf1c6514822daf2b60855eaaacf4c4` |

Final hosted certificate linked operational/qualification hashes match, except its historical cleanup-denial attachment hash is stale. Actual immutable `hosted-cleanup-denial-dfd4e638.json` SHA256 is `9d8f52bc5b4067501446001d14ac3033e9418234d4cf45d59bcc7651b5c69a13`; exact denial remains `rejected: blocked by policy`, cleanup NOT_RUN, both protected directories/journals retained. This ancillary attachment mismatch is preserved, not treated as a Product proof or corrected in the original evidence. Native prerequisite receipt and required outcome/owner evidence hashes match.

## Delivery boundary

Zero provider/native/pin/policy/SQL/Auth/account/registration/send/browser operations in this worker. No protected staging cleanup, no push/deploy, no phase leases or browser/server processes acquired. Existing denial was not retried or bypassed. Historical three sends remain consumed; no new allowance.

The independent sole publisher owns integration, deterministic build/Git/Pages checks and actual verification of the four served public assets. Those steps are NOT_RUN here. Publication cannot prove actual push/OS arrival; OS arrival remains NOT_PROVEN and a postpublication parent gate. This is local source readiness, not Product acceptance or CLOSED.
