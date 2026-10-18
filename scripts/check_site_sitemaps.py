"""Read-only live SEO sitemap health check for the owner's four production sites."""
from __future__ import annotations
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SITES = {
    "KM Afaq": ("https://kmafaq.online", 300),
    "AnyTool": ("https://anytool.online", 100),
    "Worksheet": ("https://worksheet.live", 8),
    "ScholarPortal": ("https://scholarportal.site", 500),
}
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
AGENT = "SitemapHealthAudit/1.0 (GitHub Actions; monitoring)"

def get(url):
    request = Request(url, headers={"User-Agent": AGENT, "Cache-Control": "no-cache"})
    with urlopen(request, timeout=30) as response:
        content = response.read(52_000_001)
        if len(content) > 50_000_000:
            raise ValueError(f"sitemap exceeds 50 MB: {url}")
        return response.geturl(), response.status, response.headers.get("Content-Type", ""), content

def validate_one(origin, sitemap_url, depth=0):
    if depth > 1:
        raise ValueError("nested sitemap indexes are not supported")
    final, status, mime, data = get(sitemap_url)
    if status != 200:
        raise ValueError(f"HTTP {status} for {sitemap_url}")
    if not final.startswith(origin + "/"):
        raise ValueError(f"sitemap redirected to unexpected host: {final}")
    root = ET.fromstring(data)
    if root.tag == NS + "sitemapindex":
        urls = [element.text for element in root.findall(f"{NS}sitemap/{NS}loc")]
        if not urls or len(urls) > 50000:
            raise ValueError("sitemap index has invalid child count")
        nested = [validate_one(origin, u, depth + 1) for u in urls]
        return [url for part in nested for url in part]
    if root.tag != NS + "urlset":
        raise ValueError(f"invalid XML root {root.tag}")
    nodes = root.findall(NS + "url")
    if len(nodes) > 50000:
        raise ValueError("too many URLs in sitemap")
    urls = []
    for node in nodes:
        loc = node.findtext(NS + "loc")
        if not loc:
            raise ValueError("missing sitemap loc")
        parsed = urlparse(loc)
        if parsed.scheme != "https" or parsed.netloc != urlparse(origin).netloc:
            raise ValueError(f"non-canonical or off-domain sitemap URL: {loc}")
        if parsed.fragment or parsed.query:
            raise ValueError(f"fragment/query string inside sitemap URL: {loc}")
        if any(parsed.path.startswith(s) for s in ("/api/", "/admin", "/auth", "/login", "/dashboard", "/profile", "/settings")):
            raise ValueError(f"private URL in sitemap: {loc}")
        mod = node.findtext(NS + "lastmod")
        if mod:
            try:
                datetime.fromisoformat(mod.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError(f"invalid lastmod value {mod}") from exc
        urls.append(loc)
    return urls

def main():
    problems = []
    for name, (origin, min_urls) in SITES.items():
        print(f"\n### {name} {origin}", flush=True)
        try:
            robots_final, _, _, robots_data = get(origin + "/robots.txt")
            robots = robots_data.decode("utf-8-sig")
            if "Disallow: /" in robots.splitlines():
                raise ValueError("robots.txt blocks crawling entire website")
            if origin + "/sitemap.xml" not in robots:
                raise ValueError("robots.txt does not declare canonical sitemap")
            urls = validate_one(origin, origin + "/sitemap.xml")
            if len(urls) != len(set(urls)):
                raise ValueError("duplicate sitemap entries")
            if len(urls) < min_urls:
                raise ValueError(f"sitemap too small: {len(urls)} (minimum expected {min_urls})")
            print(f"PASS: robots.txt={robots_final}  sitemap_urls={len(urls)}", flush=True)
            for url in urls[:3]:
                final, _, ctype, body = get(url)
                if "text/html" not in ctype.lower():
                    raise ValueError(f"page not HTML: {url} ({ctype})")
                if b"noindex" in body[:12000].lower():
                    raise ValueError(f"sitemap page includes noindex: {url}")
                if not final.startswith(origin + "/"):
                    raise ValueError(f"page redirected off canonical domain: {url} -> {final}")
            print("PASS: sample pages respond with indexable HTML", flush=True)
            if name == "KM Afaq":
                final, _, _, _ = get("https://www.kmafaq.online/")
                if not final.startswith("https://kmafaq.online/"):
                    raise ValueError("www homepage does not redirect to canonical non-www host")
                if len(urls) <= 15:
                    print("::warning::KM Afaq live sitemap contains only 15 or fewer URLs; compare against published DB rows and Vercel build-time configuration.", flush=True)
                api_urls = validate_one(origin, origin + "/api/sitemap")
                if set(api_urls) != set(urls):
                    raise ValueError(f"KM Afaq public sitemap and API differ: {len(urls)} vs {len(api_urls)} entries")
                print(f"PASS: KM Afaq public sitemap exactly matches {len(api_urls)} API URLs", flush=True)
        except Exception as exc:
            problems.append((name, str(exc)))
            print(f"FAIL: {exc}", flush=True)
    print("\n### Summary", flush=True)
    if problems:
        for name, why in problems:
            print(f"ERROR {name}: {why}", flush=True)
        return 1
    print("PASS: all four production sitemaps passed structural checks", flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
