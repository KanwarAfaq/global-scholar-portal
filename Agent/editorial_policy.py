"""Editorial publication safeguards shared by the opportunity and standalone agents.

The cap applies to NEW public article pages across blog_posts and
opportunity_blogs, not to discovery-only opportunity records. Publishing
workflows share a GitHub Actions concurrency group to serialize writers.
"""
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

MAX_DAILY_ARTICLES = min(4, max(1, int(os.getenv("MAX_DAILY_ARTICLES", "4"))))
PUBLISH_TIMEZONE = os.getenv("PUBLISH_TIMEZONE", "Asia/Taipei")

def _utc_bounds():
    today = datetime.now(ZoneInfo(PUBLISH_TIMEZONE)).date()
    start = datetime.combine(today, datetime.min.time(), ZoneInfo(PUBLISH_TIMEZONE))
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()

def daily_article_count(db):
    start, end = _utc_bounds()
    count = 0
    for name in ("blog_posts", "opportunity_blogs"):
        # Include newly filled historical drafts, not just newly created rows.
        # This conservatively counts same-day article updates as publishing
        # activity rather than allowing reconciliation to bypass the cap.
        ids = set()
        for time_field in ("created_at", "updated_at"):
            rows = (db.table(name).select("id")
                    .gte(time_field, start).lt(time_field, end)
                    .neq("content", "").execute().data or [])
            ids.update(str(row["id"]) for row in rows)
        count += len(ids)
    return count

def remaining_articles(db):
    return max(0, MAX_DAILY_ARTICLES - daily_article_count(db))

def editorial_prompt(kind):
    universal = (
        "Write for an actual international applicant, not for search engines. "
        "Use a calm, professional editorial voice with descriptive headings. "
        "Include the primary-source URL supplied in the record, clearly label "
        "confirmed facts versus unknowns, and give concrete application advice "
        "that is grounded in the source. Do not fabricate a deadline, grant "
        "amount, university endorsement, citation, or attributed statement. "
        "Avoid sensational titles, keyword stuffing, duplicated source prose, "
        "unverified superlatives, and generic AI filler. State when the source "
        "was checked and explain how readers can verify changes."
    )
    if kind == "opportunity":
        return universal + " Explain eligibility, funding, dates and the application process ONLY when documented; explicitly say when details are not stated."
    return universal + " Add original context, a practical checklist and limitations beyond a basic paraphrase; link to the genuine source, not invented references."

def validate_draft(kind, value):
    if not isinstance(value, dict):
        raise ValueError("Article must be a JSON object")
    title = str(value.get("title") or "").strip()
    body = str(value.get("content") or "").strip()
    if len(title) < 16 or len(title) > 145:
        raise ValueError("Article title must be clear and descriptive")
    if len(body) < (850 if kind == "opportunity" else 1100):
        raise ValueError("Article needs sufficient sourced, reader-useful detail")
    if any(marker in body.lower() for marker in ("lorem ipsum", "as an ai language model", "insert source", "[source url]", "click here to learn more")):
        raise ValueError("Unfinished or boilerplate editorial copy")
    if len(set(body.lower().split())) < 65:
        raise ValueError("Article contains insufficient unique information")
    return True
