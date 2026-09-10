import os
from pathlib import Path

import requests
from dotenv import load_dotenv

from cinematic_video_test import (
    OUTPUT_VIDEO,
    TEST_OPPORTUNITY,
    build_facebook_caption,
)

load_dotenv()

PAGE_ID = os.getenv("FACEBOOK_PAGE_ID")
PAGE_TOKEN = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN")
API_VERSION = os.getenv("FACEBOOK_GRAPH_API_VERSION", "v25.0")


def upload_video():
    if not PAGE_ID:
        raise RuntimeError("FACEBOOK_PAGE_ID is missing from .env")

    if not PAGE_TOKEN:
        raise RuntimeError("FACEBOOK_PAGE_ACCESS_TOKEN is missing from .env")

    video_path = Path(OUTPUT_VIDEO)

    if not video_path.exists():
        raise FileNotFoundError(
            f"Cinematic video not found: {video_path.resolve()}\n"
            "First run: python cinematic_video_test.py"
        )

    title = TEST_OPPORTUNITY.get("title", "ScholarPortal Opportunity")
    caption = build_facebook_caption(TEST_OPPORTUNITY)

    url = f"https://graph-video.facebook.com/{API_VERSION}/{PAGE_ID}/videos"

    data = {
        "access_token": PAGE_TOKEN,
        "title": title,
        "description": caption,
    }

    print("\n============================================================")
    print("📤 ScholarPortal Cinematic Facebook Upload Test")
    print("============================================================")
    print(f"Video: {video_path.resolve()}")
    print(f"Title: {title}")
    print("\nUploading to Facebook Page...")

    with video_path.open("rb") as video_file:
        files = {
            "source": (
                video_path.name,
                video_file,
                "video/mp4",
            )
        }

        response = requests.post(
            url,
            data=data,
            files=files,
            timeout=300,
        )

    try:
        result = response.json()
    except ValueError:
        raise RuntimeError(
            "Facebook returned a non-JSON response:\n" + response.text
        )

    if not response.ok:
        error = result.get("error", {})
        code = error.get("code", "unknown")
        subcode = error.get("error_subcode")
        message = error.get("message", result)

        raise RuntimeError(
            f"Facebook API error {code}"
            f"{f' / subcode {subcode}' if subcode else ''}: "
            f"{message}"
        )

    video_id = result.get("id")
    if not video_id:
        raise RuntimeError("Facebook reported success but returned no video ID.")

    print("\n✅ SUCCESS: cinematic video uploaded to Facebook.")
    print(f"Video ID: {video_id}")
    print("Facebook may take a short time to finish processing the video.")
    return video_id


if __name__ == "__main__":
    upload_video()
