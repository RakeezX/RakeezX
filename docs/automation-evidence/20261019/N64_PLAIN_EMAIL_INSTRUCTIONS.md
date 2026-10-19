# N64 — plain email instructions

- Task: `continuous-n64-plain-email-instructions-close-20261019`
- Run: `b9b8b41c-ee3e-4090-b0b0-28727339698d`
- Base: `a0490e3e54b11498406bad71c70ab5485920f26e`
- Observed `origin/main` via `git ls-remote origin refs/heads/main`: same base.
- Authority: current canonical N64 row, PO-CURRENT-1837, 2026-10-19: actual email change and acceptance message confirmed by PO; copy cleanup only, then conditional closure after verified publication.

Changed only four user-facing text nodes in `src/views/settings.js`: accepted-request paragraphs, pending summary and expandable instructions. Preserve both-email confirmation, spam guidance and current-email use until confirmation. Remove technical server wording and repeated refresh instructions. Automatic-return wording is supported by the unchanged owner-bound mount/focus/visibility verification handlers.

## Affected verification

- PASS `n64_plain_user_email_instructions`: inspected actual application source; a Node strict assertion compared the complete file with the base after exactly four specified literal replacements. No handler, guard, markup, account flow or refresh logic changed.
- PASS `node --check src/views/settings.js`.
- PASS `git diff --check` (Git emitted only its existing LF-to-CRLF normalization warning).
- No rendered-UI PASS claimed. The activated copy-only card permits source inspection; no browser/server, Auth/network fixture, new email request, account mutation, full suite or build was run. Prior behavior evidence is reused because executable code and markup are unchanged.

Local candidate only. Integration, Production assets and conditional Product closure belong to the independent controller/publisher and were not performed by this worker.
