import os
import re
import shutil
import subprocess
import tempfile
import urllib.parse
from io import BytesIO
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


WIDTH = 1080
HEIGHT = 1920
FPS = 30

# 5 x 4.4s with four 0.5s overlaps = exactly ~20 seconds final.
SCENE_SECONDS = 4.4
TRANSITION_SECONDS = 0.5

SCHOLARPORTAL_BASE_URL = os.getenv(
    "SCHOLARPORTAL_BASE_URL",
    "https://scholarportal.site",
).rstrip("/")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/124 Safari/537.36"
    )
}

VERIFIED_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=90&w=1400",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=90&w=1400",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=90&w=1400",
]


def ensure_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "FFmpeg is not installed or is not on PATH. "
            "Windows: winget install --id Gyan.FFmpeg -e"
        )
    return ffmpeg


def choose_video_encoder(ffmpeg: str) -> list[str]:
    """
    Use NVIDIA NVENC only when it can really start with the installed driver.
    Otherwise automatically use CPU H.264.

    This works locally on Windows and on GitHub Actions.
    """
    cpu_encoder = [
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "19",
    ]

    try:
        encoders = subprocess.run(
            [ffmpeg, "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            timeout=20,
        )

        if "h264_nvenc" not in (encoders.stdout or ""):
            print("      ℹ️ NVENC unavailable; using CPU H.264.")
            return cpu_encoder

        # Real one-frame encode test. This catches FFmpeg/NVIDIA driver
        # NVENC API mismatches even when h264_nvenc appears in -encoders.
        probe = subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel", "error",
                "-f", "lavfi",
                "-i", "color=size=64x64:rate=1:color=black",
                "-frames:v", "1",
                "-c:v", "h264_nvenc",
                "-preset", "p5",
                "-f", "null",
                "-",
            ],
            capture_output=True,
            text=True,
            timeout=20,
        )

        if probe.returncode == 0:
            print("      🚀 NVIDIA NVENC test passed; GPU encoding enabled.")
            return [
                "-c:v", "h264_nvenc",
                "-preset", "p5",
                "-tune", "hq",
                "-rc", "vbr",
                "-cq", "20",
                "-b:v", "0",
            ]

        print("      ⚠️ NVENC exists but cannot start with the current NVIDIA driver.")
        print("      ➡️ Falling back to CPU H.264.")
        return cpu_encoder

    except Exception as exc:
        print(f"      ⚠️ NVENC check failed: {exc}")
        print("      ➡️ Using CPU H.264.")
        return cpu_encoder


def get_font(size: int, bold: bool = False, serif: bool = False):
    if os.name == "nt":
        if serif and bold:
            candidates = [
                r"C:\Windows\Fonts\georgiab.ttf",
                r"C:\Windows\Fonts\timesbd.ttf",
            ]
        elif serif:
            candidates = [
                r"C:\Windows\Fonts\georgia.ttf",
                r"C:\Windows\Fonts\times.ttf",
            ]
        elif bold:
            candidates = [
                r"C:\Windows\Fonts\arialbd.ttf",
                r"C:\Windows\Fonts\bahnschrift.ttf",
                r"C:\Windows\Fonts\segoeuib.ttf",
            ]
        else:
            candidates = [
                r"C:\Windows\Fonts\arial.ttf",
                r"C:\Windows\Fonts\segoeui.ttf",
            ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold else
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
            if bold else
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)

    return ImageFont.load_default()


def _request(url: str, timeout: int = 60):
    try:
        response = requests.get(url, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
        return response
    except Exception as exc:
        print(f"      ⚠️ Image request failed: {exc}")
        return None


def _official_image(source_url: str | None):
    if not source_url or not source_url.startswith(("http://", "https://")):
        return None

    response = _request(source_url, timeout=20)
    if not response:
        return None

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in (
            soup.find("meta", property="og:image"),
            soup.find("meta", attrs={"name": "twitter:image"}),
        ):
            if tag and tag.get("content"):
                return urllib.parse.urljoin(
                    source_url,
                    tag["content"].strip(),
                )
    except Exception:
        pass

    return None


def _image_prompt(opp: dict, scene_number: int) -> str:
    country = str(opp.get("country") or "international")
    organization = str(opp.get("organization") or "prestigious university")
    field = str(opp.get("field") or "academic research")
    opportunity_type = str(opp.get("type") or "scholarship")

    prompts = [
        (
            f"photorealistic prestigious university campus in {country}, "
            "international graduate students, elegant architecture, golden hour, "
            "premium cinematic documentary photography, realistic, no text"
        ),
        (
            f"photorealistic international graduate researcher at {organization}, "
            f"studying {field}, university library and research environment, "
            "natural candid pose, shallow depth of field, cinematic editorial photography, no text"
        ),
        (
            f"photorealistic {field} research laboratory at a top university, "
            "graduate researchers collaborating, authentic modern equipment, "
            "premium cinematic lighting, realistic editorial photo, no text"
        ),
        (
            f"photorealistic international {opportunity_type} applicant preparing an academic application, "
            "laptop, transcripts, notebook, university study room, focused optimistic mood, "
            "cinematic photography, no text"
        ),
        (
            f"photorealistic successful international graduate student walking on a university campus in {country}, "
            "confident future-focused mood, golden hour, premium university campaign photography, no text"
        ),
    ]

    return prompts[(scene_number - 1) % len(prompts)]


def _save_image_from_url(url: str, target: Path) -> bool:
    response = _request(url, timeout=120)
    if not response:
        return False

    try:
        image = Image.open(BytesIO(response.content)).convert("RGB")
        image.save(target, quality=95)
        return True
    except Exception as exc:
        print(f"      ⚠️ Could not decode image: {exc}")
        return False


def _scene_photo(
    opp: dict,
    blog_json: dict,
    scene_number: int,
    output_dir: Path,
) -> Path:
    target = output_dir / f"cinematic_photo_{scene_number:02d}.jpg"

    # Best source for scene 1: the exact image already saved with the blog.
    blog_image = str(blog_json.get("image") or "").strip()
    if scene_number == 1 and blog_image:
        if _save_image_from_url(blog_image, target):
            print("      ✅ Using the opportunity blog image.")
            return target

    # Next choice for scene 1: official OpenGraph/social image.
    if scene_number == 1:
        source_url = (
            opp.get("source_url")
            or opp.get("url")
            or blog_json.get("original_link")
        )
        official = _official_image(source_url)
        if official and _save_image_from_url(official, target):
            print("      ✅ Using official opportunity image.")
            return target

    # Cinematic AI background for the remaining scenes.
    prompt = _image_prompt(opp, scene_number)
    ai_url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(prompt)
        + f"?width=1200&height=1500&nologo=true&seed={9300 + scene_number}"
    )

    if _save_image_from_url(ai_url, target):
        print("      ✅ AI cinematic image created.")
        return target

    # If AI image creation fails, reuse the blog image if available.
    if blog_image and _save_image_from_url(blog_image, target):
        print("      ✅ Reusing blog image as fallback.")
        return target

    fallback_url = VERIFIED_IMAGES[(scene_number - 1) % len(VERIFIED_IMAGES)]
    if _save_image_from_url(fallback_url, target):
        print("      ✅ Using verified university fallback image.")
        return target

    # Absolute local fallback so video rendering is not blocked by networking.
    Image.new("RGB", (1200, 1500), (24, 32, 55)).save(target)
    print("      ⚠️ Using local fallback background.")
    return target


def _clean_text(value) -> str:
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _shorten(value, max_chars: int) -> str:
    text = _clean_text(value)
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip(" ,.;:-") + "..."


def _format_deadline(deadline) -> str:
    raw = _clean_text(deadline)
    if not raw:
        return "Check official page"
    return raw


def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    lines = []

    for paragraph in str(text).splitlines():
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current = words[0]
        for word in words[1:]:
            trial = f"{current} {word}"
            bbox = draw.textbbox((0, 0), trial, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = trial
            else:
                lines.append(current)
                current = word
        lines.append(current)

    return lines or [""]


def _scene_data(
    opp: dict,
    blog_json: dict,
    article_url: str,
) -> list[dict]:
    title = _clean_text(
        blog_json.get("title")
        or opp.get("title")
        or "Scholarship Opportunity"
    )
    organization = _clean_text(
        opp.get("organization")
        or "Host organization not specified"
    )
    country = _clean_text(opp.get("country") or "Global")
    opportunity_type = _clean_text(opp.get("type") or "Scholarship")
    field = _clean_text(opp.get("field") or "Multidisciplinary")
    funding = _clean_text(
        opp.get("funding_details")
        or "Check the official page for funding details"
    )
    deadline = _format_deadline(opp.get("deadline"))

    description = _shorten(
        opp.get("description")
        or blog_json.get("excerpt")
        or "",
        250,
    )
    excerpt = _shorten(
        blog_json.get("excerpt")
        or opp.get("description")
        or "",
        150,
    )

    if not excerpt:
        excerpt = "A new international academic opportunity highlighted by ScholarPortal."

    if not description:
        description = (
            "Review eligibility, documents, benefits and the official application requirements."
        )

    return [
        {
            "eyebrow": f"{opportunity_type} • {country}",
            "headline": title,
            "body": excerpt,
            "footer": "ScholarPortal • Verified opportunity overview",
        },
        {
            "eyebrow": "HOST & FIELD",
            "headline": organization,
            "body": f"{field}\nLocation: {country}",
            "footer": "Academic opportunity details",
        },
        {
            "eyebrow": "FUNDING & BENEFITS",
            "headline": "WHAT IT SUPPORTS",
            "body": funding,
            "footer": "Confirm exact benefits on the official page",
        },
        {
            "eyebrow": "DEADLINE & ELIGIBILITY",
            "headline": f"Deadline • {deadline}",
            "body": description,
            "footer": "Prepare documents early",
        },
        {
            "eyebrow": "HOW TO APPLY",
            "headline": "FULL DETAILS & APPLICATION GUIDE",
            "body": (
                "Read the complete eligibility, funding, required documents "
                "and official application link on ScholarPortal."
            ),
            "footer": "scholarportal.site",
        },
    ]


def _create_scene_image(
    scene: dict,
    photo_path: Path,
    scene_number: int,
    total_scenes: int,
    output_path: Path,
):
    raw = Image.open(photo_path).convert("RGB")
    hero = ImageOps.fit(
        raw,
        (WIDTH, HEIGHT),
        method=Image.Resampling.LANCZOS,
    )
    hero = ImageEnhance.Contrast(hero).enhance(1.05)
    hero = ImageEnhance.Brightness(hero).enhance(0.88)

    canvas = hero.convert("RGBA")

    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)

    for y in range(HEIGHT):
        bottom_ratio = max(0.0, min(1.0, (y - 500) / 1220))
        alpha = int(22 + 210 * (bottom_ratio ** 1.35))
        draw_overlay.line((0, y, WIDTH, y), fill=(3, 7, 17, alpha))

    draw_overlay.rectangle((0, 0, WIDTH, 230), fill=(3, 7, 17, 90))
    canvas = Image.alpha_composite(canvas, overlay)
    draw = ImageDraw.Draw(canvas)

    brand_font = get_font(44, bold=True)
    count_font = get_font(28)
    eyebrow_font = get_font(38, bold=True)

    headline_text = str(scene["headline"])
    headline_size = 68
    if len(headline_text) > 65:
        headline_size = 60
    if len(headline_text) > 95:
        headline_size = 53
    headline_font = get_font(headline_size, bold=True, serif=True)

    body_text = str(scene["body"])
    body_size = 44
    if len(body_text) > 150:
        body_size = 40
    if len(body_text) > 220:
        body_size = 36
    body_font = get_font(body_size, bold=True)

    footer_font = get_font(36, bold=True)

    # Header
    draw.text((62, 62), "SCHOLARPORTAL", font=brand_font, fill=(255, 255, 255))
    draw.text(
        (865, 72),
        f"{scene_number:02d}/{total_scenes:02d}",
        font=count_font,
        fill=(230, 234, 242),
    )
    draw.line((760, 95, 835, 95), fill=(255, 255, 255, 160), width=3)

    # Main content
    y = 900

    eyebrow_text = str(scene["eyebrow"]).upper()
    eyebrow_box = draw.textbbox((0, 0), eyebrow_text, font=eyebrow_font)
    eyebrow_width = min(940, (eyebrow_box[2] - eyebrow_box[0]) + 58)

    draw.rounded_rectangle(
        (62, y - 12, 62 + eyebrow_width, y + 60),
        radius=24,
        fill=(8, 15, 31, 205),
        outline=(255, 255, 255, 70),
        width=2,
    )
    draw.text(
        (90, y + 2),
        eyebrow_text,
        font=eyebrow_font,
        fill=(239, 203, 115),
    )
    y += 104

    headline_lines = _wrap_text(draw, headline_text, headline_font, 930)[:4]
    for line in headline_lines:
        draw.text((62, y), line, font=headline_font, fill=(255, 255, 255))
        y += headline_size + 14

    y += 14
    draw.rounded_rectangle(
        (62, y, 320, y + 11),
        radius=6,
        fill=(239, 203, 115),
    )
    y += 42

    body_lines = _wrap_text(draw, body_text, body_font, 930)[:7]
    for line in body_lines:
        draw.text((64, y + 2), line, font=body_font, fill=(0, 0, 0, 135))
        draw.text((62, y), line, font=body_font, fill=(241, 244, 249))
        y += body_size + 13

    footer_y = 1800
    draw.text(
        (62, footer_y),
        str(scene["footer"]),
        font=footer_font,
        fill=(239, 203, 115),
    )

    canvas.convert("RGB").save(output_path, quality=95)


def _render_scene_clip(
    image_path: Path,
    clip_path: Path,
    ffmpeg: str,
    encoder_args: list[str],
    scene_number: int,
):
    """
    Smooth restrained movement from the improved cinematic test:
    a tiny drifting crop rather than aggressive zoompan.
    """
    frames = int(round(SCENE_SECONDS * FPS))

    phase = scene_number * 0.75
    direction = 1 if scene_number % 2 else -1

    x_expr = f"(iw-ow)/2+{direction}*14*sin(t*0.42+{phase:.2f})"
    y_expr = f"(ih-oh)/2+10*cos(t*0.34+{phase:.2f})"

    vf = (
        "scale=1156:2056,"
        f"crop={WIDTH}:{HEIGHT}:"
        f"x='{x_expr}':"
        f"y='{y_expr}',"
        "fade=t=in:st=0:d=0.18,"
        "format=yuv420p"
    )

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-loop", "1",
        "-framerate", str(FPS),
        "-i", str(image_path),
        "-vf", vf,
        "-frames:v", str(frames),
        "-r", str(FPS),
        *encoder_args,
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(clip_path),
    ]

    subprocess.run(cmd, check=True)


def _join_clips(
    clips: list[Path],
    final_path: Path,
    ffmpeg: str,
    encoder_args: list[str],
):
    if len(clips) != 5:
        raise ValueError("Exactly 5 cinematic clips are required.")

    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    for clip in clips:
        cmd += ["-i", str(clip)]

    filter_parts = []
    previous = "[0:v]"

    for i in range(1, len(clips)):
        output = f"[v{i}]"
        offset = (SCENE_SECONDS - TRANSITION_SECONDS) * i

        filter_parts.append(
            f"{previous}[{i}:v]"
            f"xfade=transition=fade:"
            f"duration={TRANSITION_SECONDS}:"
            f"offset={offset:.3f}"
            f"{output}"
        )
        previous = output

    cmd += [
        "-filter_complex", ";".join(filter_parts),
        "-map", previous,
        "-t", "20.0",
        "-r", str(FPS),
        *encoder_args,
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(final_path),
    ]

    subprocess.run(cmd, check=True)


def build_video_caption(
    payload: dict,
    blog_json: dict,
    article_url: str,
) -> str:
    title = _clean_text(
        blog_json.get("title")
        or payload.get("title")
        or "Scholarship Opportunity"
    )
    country = _clean_text(payload.get("country") or "Global")
    opportunity_type = _clean_text(payload.get("type") or "Scholarship")
    organization = _clean_text(payload.get("organization") or "Not specified")
    field = _clean_text(payload.get("field") or "Not specified")
    funding = _clean_text(payload.get("funding_details") or "Not specified")
    deadline = _format_deadline(payload.get("deadline"))

    tags = ["#ScholarPortal", "#Scholarships", "#StudyAbroad"]
    for value in (country, opportunity_type):
        token = re.sub(r"[^A-Za-z0-9]", "", value)
        if token:
            tags.append(f"#{token}")

    if "fully funded" in funding.lower():
        tags.append("#FullyFunded")

    hashtags = " ".join(dict.fromkeys(tags))

    return f"""🎬 NEW SCHOLARPORTAL OPPORTUNITY

🎓 {title}

🌍 Country: {country}
🎓 Type: {opportunity_type}
🏛️ Host: {organization}
🔬 Field: {field}
💰 Funding: {funding}
📅 Deadline: {deadline}

✨ Watch the 20-second cinematic overview.

📖 Full eligibility, benefits, required documents and official application guide:
👉 {article_url}

🌐 More global opportunities:
👉 {SCHOLARPORTAL_BASE_URL}

{hashtags}""".strip()


def generate_cinematic_video(
    payload: dict,
    blog_json: dict,
    opportunity_id,
) -> Path:
    """
    Generate one ~20-second 1080x1920 ScholarPortal cinematic video
    from REAL opportunity/blog data.

    The returned file lives in a temporary job directory. Call
    cleanup_cinematic_video() after Facebook upload.
    """
    if not isinstance(payload, dict) or not payload:
        raise ValueError("payload must be a non-empty opportunity dictionary.")

    if not isinstance(blog_json, dict):
        blog_json = {}

    ffmpeg = ensure_ffmpeg()
    encoder_args = choose_video_encoder(ffmpeg)

    job_dir = Path(
        tempfile.mkdtemp(
            prefix=f"scholarportal_cinematic_{str(opportunity_id)[:12]}_"
        )
    )

    article_url = (
        f"{SCHOLARPORTAL_BASE_URL}/opportunity/{opportunity_id}/blog"
    )

    print(f"   🎬 Cinematic job directory: {job_dir}")
    print(f"   🔗 Video article URL: {article_url}")

    scenes = _scene_data(payload, blog_json, article_url)
    clips = []

    for i, scene in enumerate(scenes, start=1):
        print(f"      🎞️ Cinematic scene {i}/5: {scene['eyebrow']}")

        photo_path = _scene_photo(
            payload,
            blog_json,
            i,
            job_dir,
        )
        scene_image = job_dir / f"scene_{i:02d}.jpg"
        clip_path = job_dir / f"clip_{i:02d}.mp4"

        _create_scene_image(
            scene,
            photo_path,
            i,
            len(scenes),
            scene_image,
        )
        _render_scene_clip(
            scene_image,
            clip_path,
            ffmpeg,
            encoder_args,
            i,
        )

        clips.append(clip_path)

    safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(opportunity_id))
    final_path = job_dir / f"scholarportal_{safe_id}_cinematic.mp4"

    print("      🎬 Joining cinematic scenes...")
    _join_clips(
        clips,
        final_path,
        ffmpeg,
        encoder_args,
    )

    if not final_path.exists() or final_path.stat().st_size <= 0:
        raise RuntimeError("Cinematic renderer did not create a valid MP4.")

    print(f"   ✅ Cinematic video ready: {final_path}")
    return final_path


def cleanup_cinematic_video(video_path) -> None:
    """
    Delete the temporary render directory after Facebook upload.
    Safe to call even if the path no longer exists.
    """
    if not video_path:
        return

    try:
        path = Path(video_path)
        parent = path.parent

        if parent.exists() and parent.name.startswith("scholarportal_cinematic_"):
            shutil.rmtree(parent, ignore_errors=True)
            print("   🧹 Cinematic temporary files deleted.")
        elif path.exists():
            path.unlink(missing_ok=True)
    except Exception as exc:
        print(f"   ⚠️ Could not clean cinematic temporary files: {exc}")
