import json, os, sys
from datetime import date, timedelta
from urllib.parse import quote
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

raw = os.environ["GSC_SERVICE_ACCOUNT_JSON"]
credentials = service_account.Credentials.from_service_account_info(
    json.loads(raw), scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
)
credentials.refresh(Request())
headers = {"Authorization": "Bearer " + credentials.token}
site = "sc-domain:" + os.environ["GSC_DOMAIN"]
sitemap = "https://" + os.environ["GSC_DOMAIN"] + "/sitemap.xml"
base = "https://www.googleapis.com/webmasters/v3/sites/" + quote(site, safe="")
response = requests.get(base + "/sitemaps/" + quote(sitemap, safe=""), headers=headers, timeout=30)
if response.status_code == 404:
    print("Sitemap not submitted to Search Console:", sitemap)
elif response.status_code != 200:
    print("Sitemap API error:", response.status_code, response.text[:250])
    sys.exit(1)
else:
    data = response.json()
    print("Sitemap:", data.get("path"), "warnings:", data.get("warnings"), "errors:", data.get("errors"))
end = date.today() - timedelta(days=3)
start = end - timedelta(days=27)
query = requests.post(
    base + "/searchAnalytics/query",
    headers={**headers, "Content-Type": "application/json"},
    json={"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": ["query"], "rowLimit": 10},
    timeout=30,
)
if not query.ok:
    print("Search Analytics API error:", query.status_code, query.text[:250])
    sys.exit(1)
rows = query.json().get("rows", [])
print("Search query sample (" + start.isoformat() + " to " + end.isoformat() + "):")
for row in rows:
    print("  ", row["keys"][0][:100], "clicks:", row.get("clicks"), "impressions:", row.get("impressions"))
print("GSC API connection verified; this report does not provide complete page indexing counts.")
