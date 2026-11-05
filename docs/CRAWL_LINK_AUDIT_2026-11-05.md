# ScholarPortal crawl-link audit — November 5, 2026

Source: three UTF-16, tab-delimited CSV crawl exports supplied by the site owner, collected November 5, 2026. Counts below refer to **link records** in this crawl, not unique indexable pages or the Google Search Console Page Indexing report. External status codes are crawler observations, not confirmed browser availability.

## Canonical report
- 773 canonical link records; all 773 sources and all targets returned HTTP 200.
- 754 self-referencing and 19 non-self-referencing.
- Of those 19, two are intentional query variants of `/` (`/?q=Taiwan`, `/?q=fully%20funded`), and the other 17 canonicalize duplicate/near-duplicate article titles to another existing page.
- Do **not** blindly change all 19 to self-canonical; verify whether each duplicate represents identical content first. Title-only similarity is not proof of identical article content.
- The existing canonical-aligned sitemap logic excludes duplicate-title variants. Keep it, unless content review confirms two pages are genuinely distinct and should both remain independently canonical.

## 4xx report
- 122 reported link records, 99 distinct external target URLs; **zero** target the ScholarPortal origin.
- 112 ordinary outbound hrefs, 9 image references, and 1 hreflang from a third-party source page (not a ScholarPortal-owned hreflang).
- Status distribution: 69 × 403, 37 × 404, 7 × 406, 4 × 410, 3 × 402, 2 × 429.
- **Nine 404 image references share exactly one Unsplash asset**: `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800`. The prerenderer and article card now omit/replace this known-missing asset with safe existing fallbacks, so its repeated failures won't remain in new site snapshots.
- The other **28 404 records** (27 ordinary outbound links and one third-party hreflang) plus four 410 records should be checked by an editor against the original university, funder, or official program site. Do not silently redirect an application link to an unrelated homepage; a scholarship might have ended.
- High-priority examples for source review:
  - `https://nu.edu.kz/admissions/graduate-programs` (404 in crawler; source `/opportunity/cfb3c985-68e8-4e89-917e-02439ae14ca4/blog`)
  - `https://www.oph.fi/en/development/edufi-fellowships` (404 in crawler; source `/opportunity/c43de3c6-bb3a-447c-abdb-774ce9e60adf/blog`)
  - `https://www.gatescambridge.org/programme/the-scholarship/` (410 in crawler; appears on multiple opportunity pages)
  - `https://www.gatescambridge.org/apply/timeline/` (410 in crawler).
- An HTTP 403, 406, 402 or 429 can reflect anti-bot protection, auth, negotiated formats, or rate limiting; do not infer the underlying resource was permanently removed. Recheck in a normal browser and with an authorized provider URL.
- The source label has been made factual (`Source article or application information`) rather than calling every third-party aggregator an "official source."

## Redirect report
- 44 reported link records (42 distinct external destination URLs); status counts: 29 × 301, 12 × 302, and 3 × 308.
- Zero redirect targets are internal ScholarPortal URLs. These are **not** broken ScholarPortal routes; a successful external redirect may be normal.
- Where a verified redirect resolves permanently to the same application resource, editors can update stored `original_link` to the final destination. Avoid bulk replacements without confirming destinations.

## Where external URLs are stored and what requires content updates
- Public pages are exported by `Agent/indexing_agent.py` from the `blog_posts` and `opportunity_blogs` database records. The source link comes from each row's `original_link`; images come from each row's `image`.
- For provider links reporting 404/410, the correction belongs in the relevant approved database content record **after** a verified replacement is found. Changing `robots.txt`, canonical tags or local redirects cannot repair a university's external link.
- Run the regular content/export job and a full site build after validated source changes. Re-crawl and re-inspect actual Google index status separately.

## Indexing impact and verification
- Broken external images can reduce page presentation quality; outbound 403s from a crawler alone are **not** a Google indexing diagnosis.
- GSC Wizard previously confirmed that some ScholarPortal URLs are unknown to Google; it does not establish that these external HTTP errors caused that indexing state.
- Re-crawl the new production deployment and confirm the known image URL disappears. Verify that the archive pages and canonical sitemap remain present. Watch Google's URL Inspection and Page Indexing reports for later crawl changes.
