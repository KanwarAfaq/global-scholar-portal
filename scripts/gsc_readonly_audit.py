"""Read-only Search Console monitoring: sitemap, query/page rankings and priorities."""
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

DOMAIN = os.environ["GSC_DOMAIN"]
SITE = "sc-domain:" + DOMAIN
SITEMAP = "https://" + DOMAIN + "/sitemap.xml"
END = date.today() - timedelta(days=3)
START = END - timedelta(days=27)
PREVIOUS_END = START - timedelta(days=1)
PREVIOUS_START = PREVIOUS_END - timedelta(days=27)

credentials = service_account.Credentials.from_service_account_info(
    json.loads(os.environ["GSC_SERVICE_ACCOUNT_JSON"]),
    scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
)
credentials.refresh(Request())
session = requests.Session()
session.headers.update({"Authorization": "Bearer " + credentials.token})
base = "https://www.googleapis.com/webmasters/v3/sites/" + quote(SITE, safe="")

def api(method, path, **kwargs):
    response = session.request(method, base + path, timeout=30, **kwargs)
    if not response.ok:
        raise RuntimeError("Search Console request failed: HTTP " + str(response.status_code))
    return response.json() if response.content else {}

def analytics(dimensions, start, end, limit=1000):
    return api("POST", "/searchAnalytics/query", json={
        "startDate": start.isoformat(), "endDate": end.isoformat(),
        "dimensions": dimensions, "rowLimit": limit,
        "dataState": "final",
    }).get("rows", [])

def simplify(row):
    return {
        "keyword_or_page": row.get("keys", [""])[0],
        "clicks": int(row.get("clicks", 0)),
        "impressions": int(row.get("impressions", 0)),
        "ctr_percent": round(100 * row.get("ctr", 0), 2),
        "position": round(row.get("position", 0), 1),
    }

report = {"domain": DOMAIN, "period": [str(START), str(END)]}
sitemap_response = session.get(SITEMAP, timeout=30)
sitemap_response.raise_for_status()
from xml.etree import ElementTree
xml_root = ElementTree.fromstring(sitemap_response.content)
if not xml_root.tag.endswith(("urlset", "sitemapindex")):
    raise ValueError("The public sitemap is not a valid sitemap root")
report["public_sitemap"] = {"http_status": sitemap_response.status_code,
                            "entries": len(xml_root)}
# A submitted sitemap alone does not tell whether individual pages were indexed.
# Inspect a small sample of the most recently modified URLs via the official API.
namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
recent_urls = []
for node in xml_root.findall(namespace + "url"):
    loc = node.findtext(namespace + "loc")
    modified = node.findtext(namespace + "lastmod") or ""
    if loc and loc.startswith("https://" + DOMAIN + "/"):
        recent_urls.append((modified, loc))
recent_urls.sort(reverse=True)

try:
    sitemap_data = api("GET", "/sitemaps/" + quote(SITEMAP, safe=""))
    report["gsc_sitemap"] = {
        "submitted": True, "errors": int(sitemap_data.get("errors", 0)),
        "warnings": int(sitemap_data.get("warnings", 0)),
        "is_pending": sitemap_data.get("isPending", False),
        "last_downloaded": sitemap_data.get("lastDownloaded"),
    }
except RuntimeError as exc:
    if "HTTP 404" not in str(exc):
        raise
    report["gsc_sitemap"] = {"submitted": False}

# Search Console URL Inspection API is read-only. Results are sampled, not sitewide coverage.
# Google can decline indexing an accessible, valid page; report the reason rather
# than claiming sitemap submission guarantees indexing.
inspected = []
inspection_errors = []
for _, url in recent_urls[:5]:
    try:
        response = session.post(
            "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
            json={"inspectionUrl": url, "siteUrl": SITE, "languageCode": "en-US"},
            timeout=30,
        )
        if not response.ok:
            raise RuntimeError("HTTP " + str(response.status_code))
        status = response.json().get("inspectionResult", {}).get("indexStatusResult", {})
        inspected.append({
            "url": url,
            "verdict": status.get("verdict"),
            "coverage_state": status.get("coverageState"),
            "indexing_state": status.get("indexingState"),
            "page_fetch_state": status.get("pageFetchState"),
            "robots_txt_state": status.get("robotsTxtState"),
            "last_crawl_time": status.get("lastCrawlTime"),
            "google_canonical": status.get("googleCanonical"),
            "user_canonical": status.get("userCanonical"),
        })
    except (requests.RequestException, ValueError, RuntimeError) as exc:
        inspection_errors.append({"url": url, "error": str(exc)})
report["recent_url_inspections"] = inspected
report["inspection_errors"] = inspection_errors
report["inspection_note"] = "Only up to five recent sitemap URLs are inspected; this is not the Search Console Page Indexing report."

current_total = analytics([], START, END)
previous_total = analytics([], PREVIOUS_START, PREVIOUS_END)
def metrics(rows):
    if not rows:
        return {"clicks": 0, "impressions": 0, "ctr_percent": 0, "position": None}
    item = simplify(rows[0])
    return {key: item[key] for key in ("clicks", "impressions", "ctr_percent", "position")}

report["current"] = metrics(current_total)
report["previous"] = metrics(previous_total)
keywords = [simplify(r) for r in analytics(["query"], START, END)]
pages = [simplify(r) for r in analytics(["page"], START, END)]
report["top_queries"] = sorted(keywords, key=lambda r: (-r["impressions"], -r["clicks"]))[:30]
report["top_pages"] = sorted(pages, key=lambda r: (-r["impressions"], -r["clicks"]))[:30]
report["quick_wins"] = [
    r for r in keywords if r["impressions"] >= 10 and 5 <= r["position"] <= 30
][:30]
report["low_ctr_pages"] = [
    r for r in pages if r["impressions"] >= 20 and r["ctr_percent"] < 2
][:30]

Path("reports").mkdir(exist_ok=True)
Path("reports/gsc-audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print("GSC audit:", DOMAIN, "dates:", START, "to", END)
print("Public sitemap entries:", report["public_sitemap"]["entries"])
print("GSC sitemap:", report["gsc_sitemap"])
print("Current performance:", report["current"])
print("Previous performance:", report["previous"])
print("Recent URL inspection verdicts:", [(entry["url"], entry["verdict"], entry["coverage_state"]) for entry in inspected])
print("URL inspection errors:", inspection_errors)
print("Quick-win keywords:", len(report["quick_wins"]))
print("Low-CTR pages:", len(report["low_ctr_pages"]))
for entry in report["quick_wins"][:10]:
    print("  keyword:", entry["keyword_or_page"][:100], "impressions:", entry["impressions"], "position:", entry["position"])
print("Complete detailed report is in the downloadable workflow artifact.")
print("Note: search performance is not a complete index coverage report.")
