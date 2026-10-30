# N145 Cloudflare provider-tail verification repair

The About implementation candidate 7263a19e06dfd26caf3e1aa1edd456b77e95bb89 was integrated as 116cb808cdf868cc6cc54a4f3be89ceefc1b36cf. Cloudflare Pages succeeded and the immutable deployment plus all changed Production assets matched. The entry HTML was blocked by an observed provider JSD template rotation.

The actual response was captured read-only at 2026-10-30T12:32:45.719Z. The beacon remains the exact existing 17 October pin; its downloaded SHA-512 matched the advertised integrity. No arbitrary script, origin, query, markup or application-byte waiver is added.

Publisher now recognizes a second exact JSD tail. Both ray occurrences must match, the base64 timestamp must decode canonically to exactly ten digits, the fixed origin-resolution fragment remains literal, and reconstructed HTML must equal the original Git SHA. Controller accepts only the explicitly enumerated new transform combinations.

Focused verification: 32 positive/negative synthetic checks and the actual captured response passed. The negatives cover ray/time alteration, changed origin/path/query, extra/duplicate scripts, altered beacon attributes, modified application HTML and invalid response metadata. Existing original JSD and both exact analytics pins are retained.

Fixture SHA-256: 3cba903babeff2306fa62a29b6e842140e4fc04672417312adebd2f415b74cc6. Expected published index SHA-256: a9d2bed93029152a60ad466aa21b49fc4676a71ad97e51ef8e889482e23121d6.

Apply only through the guarded existing maintenance helper with zero active workers and idle publisher. Preserve the exact N145 session/run/candidate/base and original receipt. Reload the existing controller through its verified scheduled task and let its sole publisher recheck the original publication. This evidence does not itself claim final Production acceptance.
