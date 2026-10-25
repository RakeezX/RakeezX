# N88 visible student support — source-only candidate

AI-authored, 2026-10-25. Task `continuous-n88-visible-support-public-dependency-20261025`; run `c4e86648-b758-47b9-a6b2-0db85e2e1585`.

## Exact source boundary

Base / observed remote main: `1fd1dd89b396b58f4c4fec0e63c1f720ce531875` (`git ls-remote origin refs/heads/main`, checked before application). Immutable qualification parent: `23659216b5cc9eb550db436b1c6438e11bed83fe`.

Applied only that parent's `drafts/n88-student-portal/activation/web-boundary-20261025/public-source.patch`, qualified by adjacent `manifest.json`. Patch SHA-256: `b5741314e43dfbd8e8375ce9b873d6a3d373785bd4de88f25a27345cf976568e`. No whole-parent merge or cherry-pick.

Canonical LF SHA-256 identities:

| Source | Current-main preimage | Candidate target |
| --- | --- | --- |
| `src/lib/student-portal-unified-client.js` | `ae085b4758cabea01cd0062c48536e41328ae024a0b0326178708d5c4a62f6ec` | `7615ac6cb2487863798c7066a1270334cb4356c1e35c9c3a85708704f91ccd78` |
| `src/views/student-portal-login.js` | `2469c30835e9cb589e73f681d0eabed1456e3cd25457261cb3504105e27f0da9` | `e212a374984af07f5100e58dd6dd6bee0124cf363dcd6f70b05f71d2611da9be` |

The optional support section shows the same sanitized serialization used by its single copy action. Fixed clientStage/responseKind/5xx stage allowlists and synchronous initial-failure fallback add no request or private projection. Projection validation, binding acceptance and context fences remain intact.

## Affected verification

- `n88_visible_support_exact_patch`: PASS. Immutable patch hash, both working-tree and current-main preimages, `git apply --check`, application and both target hashes matched.
- `n88_visible_support_single_copy_privacy`: PASS. Scoped assertions verified one copy button, common `diagnosticText()` serialization, unchanged single transport send site, no view fetch, unchanged projection validator and response/context acceptance fences. Rendered behavior evidence is reused below; source assertions are not a new rendered-UI proof.
- `n88_visible_support_current_main_preservation`: PASS. Only the two qualified source paths changed before this report; all manifest `src/` dependency hashes match and imports are unchanged. No startup dependency or offline-shell change.
- Both changed JavaScript files passed `node --check`; `git diff --check` passed.

Reused without rerunning from the immutable qualification parent above:

- `tests/n88-current-terminal-fence-20261024/web-boundary-client.json`: PASS, 11 focused cases covering success/session/service/fetch/synchronous fetch/JSON/HTML/schema, stale context, claim and end without replay/private payload.
- `tests/n88-current-terminal-fence-20261024/web-boundary-rendered.json`: PASS, 9 actual compiled entry/view/client/binding/CSS cases over HTTP in fresh synthetic contexts, including synchronous initial and malicious diagnostic fallback. One visible sanitized result, same copy text and no extra read; owned browser/server cleanup recorded.
- `tests/n88-current-terminal-fence-20261024/web-boundary-pg.json`: PASS, 3 real PostgreSQL / compiled browser-header cases: no-cookie denial, real cookie GET without Origin/Content-Type/CSRF, and current client accepting one projection read. This does not establish the hosted failure's cause.

No new browser/server, service read, SQL, account, credential, message, provider, carrier, native or pin operation occurred in this child. No phase lease was needed or acquired. Queue and ledger are untouched; N44 notification files are outside the diff.

## Preserved failures and delivery boundary

Parent `drafts/n88-student-portal/activation/web-boundary-20261025/outcome.json` and `manifest.json` record the already delivered carrier `78c726c184a21803905e30b6f67363015671435ad711658b0d0bb97e7c3e041e` and exact served student asset `558b311d4fffc3e3998ddb9592aa9e24c58e25741055bcd452244b95407749c0`. Their other eight assets, native c145, N44 peer and all 47 map entries remain preserved; this child did not reread or modify those services.

**FAIL preserved:** served document byte identity failed because of Cloudflare dynamic HTML insertion. Embedded document / expected module reference identity is separate and does not turn that failure into PASS.

**FAIL preserved:** actual student initial read returned JSON HTTP 503 in the 1250 ms bucket, `clientStage=response`, with no source/transport category or private projection. Cause remains UNKNOWN. Historical actual 5xx/750 ms and cancellation failures remain recorded. The diagnostic observation is consumed and retired; no new read or retry is authorized here.

Whole N88 remains OPEN. This is source-only LOCAL_READY, not a source-cause fix, Product acceptance or deployment receipt. The independent sole publisher owns integration, publication and served public-source verification. No push or deployment was performed by this worker.
