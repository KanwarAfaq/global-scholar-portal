import os
import requests
from dotenv import load_dotenv

load_dotenv()


class FacebookPublishError(Exception):
    """Raised when Facebook publishing fails."""


def _facebook_config() -> tuple[str, str, str]:
    page_id = os.getenv("FACEBOOK_PAGE_ID")
    page_token = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN")
    api_version = os.getenv("FACEBOOK_GRAPH_API_VERSION", "v25.0")

    if not page_id:
        raise FacebookPublishError("FACEBOOK_PAGE_ID is missing from .env")
    if not page_token:
        raise FacebookPublishError("FACEBOOK_PAGE_ACCESS_TOKEN is missing from .env")

    return page_id, page_token, api_version


def _parse_response(response: requests.Response) -> dict:
    try:
        data = response.json()
    except ValueError as exc:
        raise FacebookPublishError(
            f"Facebook returned an invalid response: {response.text}"
        ) from exc

    if not response.ok:
        error = data.get("error", {})
        message = error.get("message", "Unknown Facebook API error")
        code = error.get("code", "unknown")
        subcode = error.get("error_subcode")
        suffix = f" / subcode {subcode}" if subcode else ""
        raise FacebookPublishError(
            f"Facebook API error {code}{suffix}: {message}"
        )

    return data


def publish_post(message: str, link: str | None = None) -> str:
    """Publish a normal Facebook Page feed post and return its post ID."""
    if not message or not message.strip():
        raise ValueError("Post message cannot be empty.")

    page_id, page_token, api_version = _facebook_config()
    url = f"https://graph.facebook.com/{api_version}/{page_id}/feed"

    payload = {
        "message": message.strip(),
        "access_token": page_token,
    }
    if link:
        payload["link"] = link

    try:
        response = requests.post(url, data=payload, timeout=30)
    except requests.RequestException as exc:
        raise FacebookPublishError(
            f"Could not connect to Facebook: {exc}"
        ) from exc

    data = _parse_response(response)
    post_id = data.get("id")
    if not post_id:
        raise FacebookPublishError(
            "Facebook reported success but returned no post ID."
        )

    return post_id


def publish_photo(image_url: str, message: str) -> str:
    """
    Publish a public image URL as a Facebook Page photo with a caption.

    This makes the opportunity image the main visual in the Facebook feed.
    The caption can still contain the clickable ScholarPortal article URL.
    """
    if not image_url or not image_url.strip():
        raise ValueError("image_url cannot be empty.")
    if not message or not message.strip():
        raise ValueError("Photo caption cannot be empty.")

    page_id, page_token, api_version = _facebook_config()
    url = f"https://graph.facebook.com/{api_version}/{page_id}/photos"

    payload = {
        "url": image_url.strip(),
        "caption": message.strip(),
        "published": "true",
        "access_token": page_token,
    }

    try:
        response = requests.post(url, data=payload, timeout=45)
    except requests.RequestException as exc:
        raise FacebookPublishError(
            f"Could not connect to Facebook while publishing photo: {exc}"
        ) from exc

    data = _parse_response(response)

    # Photo publishing commonly returns an image id and may also return post_id.
    post_id = data.get("post_id") or data.get("id")
    if not post_id:
        raise FacebookPublishError(
            "Facebook reported photo success but returned no post/photo ID."
        )

    return post_id
