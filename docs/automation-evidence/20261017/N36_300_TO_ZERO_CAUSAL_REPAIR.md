# N36 — causal repair of 300 staged → zero final (AI)

Task: continuous-n36-300-students-final-zero-20261017
Run: caf47a23-74be-4246-9c28-be2a91d8a2b4
Base: 8714bef9f047a5169a5c4ca3eb0d9ef6e3b08199 (HEAD and observed origin/main at preparation).
Scope: local synthetic extension/application only. No authenticated school account, credentials, personal profile, real students, service change or Product publication.

## Reproduction before implementation

The untouched 0.5.1 ZIP was unpacked into a fresh owned Chrome 155 profile. The actual toolbar action, popup/run DOM, source readers, parsers, accumulator and CSS ran against intercepted synthetic HTTPS documents. Its count history in tests/n36-300-then-zero-browser.json records:

- page 2: 50 students; subsequent reports reach 100, 150, 200, 250;
- page 10: **300 students / 323 total category rows**;
- page 11, MyStudents: **300 / 323 remains staged**, then final filtering displays **0 / 23**;
- ROSTER_LINKS_PENDING expires into ROSTER_LINKS_UNAVAILABLE after the bounded reader wait;
- diagnostic: MAIN_FRAME_READ_LINK_ABSENT, relevant=2, unsupported=0, iframeCount=3.

The same genuine reader fixture also produces EMPTY_OR_LIMIT for a separate classes table with a visible header and hidden-only body. This proves that these two codes can coexist independently; it does NOT prove that the PO's EMPTY_OR_LIMIT had that exact category/cause. No fabricated reader response was used. Baseline source SHA256 values are preserved in baselineEvidence.sourceHashes. The final document has 23 non-student rows (teacher/school/principal + 20 timetable slots).

## Causal conclusions and implementation

run-controller stages parseCategoryTable → mergePage → validateCategory → bundle transactionally. On validation failure it records a category warning and retains the prior accumulator. Final unresolved-category filtering intentionally removes the entire warned category. The old final counter measured only that filtered export preview, falsely presenting the accumulated 300 as zero. Clearing the accumulator subsequently hid that distinction.

0.5.3 distinguishes accumulated names, complete names for review and committed names (zero in the helper), records a bounded aggregate observed-row lower bound and safe exclusion codes, then discards excluded names. No new persistent/chrome.sync storage exists. Count diagnostics contain no names, URLs, school IDs, source HTML or contacts. An overflow does not retain its rejected names or silently truncate an export.

EMPTY_CATEGORY and CATEGORY_ROW_LIMIT now distinguish empty data from per-category overflow. Per-category/parser/receiver/one-action handoff remain capped at 300; bundle total remains 600. No segmentation, new nonce semantics, multi-class automatic write or raised cap was introduced.

The source reader now carries explicit terminal evidence into run completeness. Every page from 1 through the declared terminal must be present, without duplicate response/identity or changed context. The controller binds the validated visible school name in its existing ephemeral context; the existing guard checks it on subsequent documents. A negative active-role check also runs at read/export, without treating a principal's metadata name as the active role.

The unknown MyStudents route after already collected reports is **not** suppressed. Completion of known reports does not prove that an unvisited discovery page contains no further class/report. Known discovery/self links are not navigated repeatedly; a genuinely missing/unconfirmed page still blocks all student export. Neither 300 staged nor the observed screenshot proves official completeness. The repaired partial result explicitly says 300 accumulated / 0 complete / 0 committed, with transfer disabled and no hidden partial names in the review DOM. A complete <=300 synthetic series still enters the existing explicit review and owner-bound receiver Preview.

## Affected evidence and limitations

Node command: node --test tests/n36-300-then-zero.test.mjs tests/n36-popup-052-real-feedback.test.mjs tests/n36-extension-direct-handoff.test.mjs tests/n36-receiver-limits.test.mjs

16 targeted tests pass: 299/300/301/350, 50/page transactional overflow, normalized identity collision, HTML/CSV/JSON/formula rejection, category/field guards, route/origin/school binding, handoff limits, exact archive/manifests and immutable 0.5.1/0.5.2 rollback. The prior 0.5.2 test now checks that historical archive against its immutable source rather than expecting a new candidate to still be 0.5.2. Its old package-generation switch refuses to overwrite rollback.

Browser script: tests/n36-300-then-zero-browser.mjs. Evidence: tests/n36-300-then-zero-browser.json. Runtime SHA256 equality is checked before reusing partial evidence. The same unchanged source's completed scenarios are reused, not silently relabelled reruns. Synthetic fixtures cover 299/300 complete, 301/350 blocked, missing terminal, missing last page, repeated response, duplicate identity, ambiguous pager, empty roster, changed school/role/origin/login, known discovery/self links, and role change at export. Complete and partial UI plus actual Rakeez owner Preview are inspected at 320/390/768/1280. Expiry is checked at deadline −1ms / deadline. Chrome session/local/sync storage has no retained student envelope at phase end. Existing unchanged receiver lease-negative evidence remains in tests/n36-extension-direct-handoff-browser.json; the fresh affected real UI/store entry additionally verifies owner-switch invalidation and unchanged DB with zero import confirmation.

Preserved harness failures: initial dashboard fixture lacked a required marker and correctly failed the role guard; the receiver fixture originally lost its transport hash on reload; ServiceWorker dynamic import is unsupported and that diagnostic attempt was removed. A full-300 transfer intermittently failed in earlier sequential fixtures while the standalone case succeeded; the exact failed events remain recorded, and focused follow-up captures the original export guard/send response without weakening either guard or replacing Chrome APIs. The final focused 299-then-300 sequential run passed with the original Chrome APIs, including actual owner-bound Preview and zero writes. The earlier failed event is retained rather than erased.

An HTTP-302 negative navigation fixture failed the no-external-attempt assertion: the redirect chain attempted public source dependencies (vstedu.azureedge.net, googletagmanager.com, muneer.cx), which the outer route blocked. This failure remains in priorFailures/priorBlockedExternal and is not a PASS. HTTP redirects were removed. The materially safer synthetic DOM navigation fixtures are independently intercepted, passed the origin/session guards, and recorded no external attempts. No authenticated account or real roster was involved. A transient checkpoint file-sharing error also affected lease cleanup; owned Chrome/profile/server were closed and the same ownership-checked lease tool subsequently released it. No ACL, policy, controller lock or queue edit was made.

No frontend build/provider/Preview/Production deployment is claimed. No new startup dependency was added. The sole publisher owns integration, deterministic build metadata, provider immutable identity and served assets. N36 remains OPEN pending PO official-account completeness and accepted import.
