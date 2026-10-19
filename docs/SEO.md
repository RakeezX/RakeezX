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

PO evidence supplied on 19 October 2026 confirms that Search Console URL inspection
reports the homepage indexed, available on Google and served over HTTPS. This
confirmation applies only to `https://rakeezx.com/`; it is not evidence for other
routes or a particular query position. Preserve that accepted result rather than
repeating an indexing diagnosis.

The homepage title and matching descriptions now explicitly identify teacher
class/student management, attendance, grades, lesson timetable and reports. These
are existing capabilities already described in the visible public landing page.
The full product name, canonical domain and WebApplication identity distinguish
this product without competitor claims or extra keyword lists. The existing
landing layout and private routing are unchanged.

Indexing means the homepage is in Google's index; ranking is its position for a
particular search. This copy improvement does not establish or guarantee a ranking,
a search snippet, or when Google will reflect the updated content. Deployment
verification remains with the serial publisher; this local check is not proof of
delivery or a new Search Console observation.

The affected actual-app HTTP check (fresh local synthetic browser, no credentials,
external requests or Service Workers) is:

```sh
node tests/n113-feedback-1532/public-relevance.mjs
```
