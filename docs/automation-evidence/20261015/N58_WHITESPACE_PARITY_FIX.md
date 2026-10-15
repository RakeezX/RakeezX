# N58 provider-tail correction

The saved 2026-10-14 Production receipt reports one ASCII whitespace byte after the pinned Cloudflare Analytics beacon. Original tag adjacency was too strict. The revised verifier locates the exact pinned provider tail before that whitespace but preserves all application bytes, demanding original SHA-256 equality. No generic strip, provider or security change. Tests use synthetic HTML, not personal browser or account data. The corrected publisher must verify served Production through the existing controller; this document does not claim deployment or full N58 acceptance.

The calendar switch remains held until the separately activated prevention ticket passes; two abandoned dummy accounts remain untouched.
