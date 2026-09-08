# Google Visual exact-patch transport

Use this maintainer workflow when Google AI Studio produces an approved visual
change. Google-local environment files are never Product changes.

1. Work in Google Local and obtain Product Owner approval.
2. Export one **Exact Accepted Patch** from the approved Google change.
3. On a clean target branch, validate it without mutation:

   ```powershell
   node scripts/visual-patch-transport.mjs --patch C:\path\accepted.patch --base <expected-sha> --allow src/views/home.js --allow tests/home-focus.test.mjs
   ```

4. Review the reported SHA-256, base, touched files, and dry-run result.
5. Apply only after that review by adding `--apply` to the same command.
6. Run the approved focused tests, review the diff, then make the explicit
   Visual Git commit/push.
7. Promote only the accepted Visual commit(s) to Production, then complete
   Product Owner Production verification.

The tool rejects environment-only and preservation files, paths outside the
explicit allowlist, traversal/absolute paths, malformed diffs, wrong bases,
and dirty working trees. It never commits, pushes, stashes, resets, or cleans.

By default the expected base must equal `HEAD`. For a deliberately newer,
compatible target, use `--allow-newer-base`; the expected base must be an
ancestor of `HEAD` and `git apply --check` must still pass. This mode is
explicit because it is not an authorization to apply an unrelated patch.
