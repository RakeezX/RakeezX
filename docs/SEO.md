# Public search discovery

The sole canonical public document is `https://rakeezx.com/`. The root
`robots.txt` allows crawling and advertises `https://rakeezx.com/sitemap.xml`.
The sitemap lists only that public document; it deliberately omits workspace,
teacher, student, account and UUID/hash routes, including the synthetic invite lab.
Do not add account links or real data to the sitemap.

The existing Arabic landing page supplies the public product description.
Its HTML head contains a matching title, description, canonical URL, Open Graph,
summary card and minimal WebApplication JSON-LD. No pricing, ratings, reviews or
organization claims are supplied. Structured data does not promise a rich result.

The app uses hash navigation. Hash routes are not independent public documents;
robots.txt is not an access-control or privacy mechanism. Existing ownership and
account guards remain responsible for protecting workspace data. Do not disallow
the JS/CSS assets needed to render the actual landing page.

The hosting source must serve root `robots.txt` as text and `sitemap.xml` as XML,
rather than falling back to the application HTML. The publisher should inspect
those two served paths alongside `index.html` after integration. If hosting uses
a generated output directory, include both discovery files in that output.
Provider-injected robots content may coexist, but must not disallow public search
or remove the sitemap declaration.

Run the affected source check with:

```sh
node --test tests/n113-1019-public-search.mjs
```

This is discovery groundwork only. Neither a successful deployment nor this check
establishes search-engine indexing or Search Console submission. Those require
separate observed evidence; no Search Console access is needed for this change.
