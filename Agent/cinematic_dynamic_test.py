import os

from dotenv import load_dotenv
from supabase import create_client

from facebook_publisher import publish_video
from video_generator import (
    build_video_caption,
    cleanup_cinematic_video,
    generate_cinematic_video,
)

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)

SCHOLARPORTAL_BASE_URL = os.getenv(
    "SCHOLARPORTAL_BASE_URL",
    "https://scholarportal.site",
).rstrip("/")


def get_latest_real_opportunity_with_blog():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase credentials are missing from .env")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Look through recent opportunities until we find one that has
    # a dedicated opportunity_blogs row.
    result = (
        supabase.table("global_opportunities")
        .select("*")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    opportunities = result.data or []
    if not opportunities:
        raise RuntimeError("No global_opportunities rows were found.")

    for opportunity in opportunities:
        opportunity_id = opportunity.get("id")
        if not opportunity_id:
            continue

        blog_result = (
            supabase.table("opportunity_blogs")
            .select("*")
            .eq("opportunity_id", opportunity_id)
            .limit(1)
            .execute()
        )

        blogs = blog_result.data or []
        if blogs:
            return opportunity, blogs[0]

    raise RuntimeError(
        "Recent opportunities were found, but none had a linked opportunity_blogs row."
    )


def main():
    payload, blog_json = get_latest_real_opportunity_with_blog()

    opportunity_id = payload["id"]
    article_url = (
        f"{SCHOLARPORTAL_BASE_URL}/opportunity/{opportunity_id}/blog"
    )

    print("\n============================================================")
    print("🎬 DYNAMIC ScholarPortal Cinematic Facebook Test")
    print("============================================================")
    print(f"Opportunity ID: {opportunity_id}")
    print(f"Title: {payload.get('title')}")
    print(f"Country: {payload.get('country')}")
    print(f"Type: {payload.get('type')}")
    print(f"Host: {payload.get('organization')}")
    print(f"Field: {payload.get('field')}")
    print(f"Funding: {payload.get('funding_details')}")
    print(f"Deadline: {payload.get('deadline')}")
    print(f"Article: {article_url}")

    video_path = None

    try:
        print("\n🎬 Generating cinematic video from REAL Supabase data...")
        video_path = generate_cinematic_video(
            payload=payload,
            blog_json=blog_json,
            opportunity_id=opportunity_id,
        )

        caption = build_video_caption(
            payload=payload,
            blog_json=blog_json,
            article_url=article_url,
        )

        print("\n📤 Uploading dynamic cinematic video to Facebook...")
        video_id = publish_video(
            video_path=video_path,
            title=blog_json.get("title") or payload.get("title") or "ScholarPortal Opportunity",
            description=caption,
        )

        print("\n✅ SUCCESS")
        print(f"Facebook video ID: {video_id}")
        print(f"ScholarPortal article: {article_url}")

    finally:
        if video_path:
            cleanup_cinematic_video(video_path)


if __name__ == "__main__":
    main()
