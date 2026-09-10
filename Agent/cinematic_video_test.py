import json
import os
import shutil
import subprocess
import urllib.parse
from io import BytesIO
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

load_dotenv()

# ============================================================
# ScholarPortal Cinematic Facebook Video Test - Improved Motion / Large Text
# ------------------------------------------------------------
# - 1080x1920 vertical
# - exactly ~20 seconds
# - 5 cinematic scenes
# - all important scholarship/opportunity information
# - uses official image when available, then AI image fallback
# - automatically uses NVIDIA NVENC locally when FFmpeg supports it
# - otherwise falls back to libx264 (works on GitHub Actions)
# - DOES NOT post to Facebook
# ============================================================

WIDTH = 1080
HEIGHT = 1920
FPS = 30

# 5 * 4.4 sec - 4 * 0.5 sec overlaps = 20.0 sec final
SCENE_SECONDS = 4.4
TRANSITION_SECONDS = 0.5

OUTPUT_DIR = Path("video_test_output")
OUTPUT_VIDEO = OUTPUT_DIR / "scholarportal_cinematic_test.mp4"

SCHOLARPORTAL_BASE_URL = os.getenv(
    "SCHOLARPORTAL_BASE_URL",
    "https://scholarportal.site",
).rstrip("/")

# ------------------------------------------------------------
# SAFE TEST OPPORTUNITY
# Replace these values later with a real opportunity from agent.py.
# ------------------------------------------------------------
TEST_OPPORTUNITY = {
    "title": "Global Excellence Doctoral Scholarship",
    "organization": "International Research University",
    "country": "Switzerland",
    "type": "PhD",
    "field": "Artificial Intelligence & Data Science",
    "funding_details": "Full tuition + monthly stipend + research support",
    "deadline": "2026-12-15",
    "eligibility": "International graduate applicants with a strong academic record",
    "documents": "CV, transcripts, research proposal, and recommendation letters",
    # You can replace this with a real official opportunity URL.
    "source_url": "https://scholarportal.site",
}


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/124 Safari/537.36"
    )
}

FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=90&w=1400",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f54a5a?auto=format&fit=crop&q=90&w=1400",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=90&w=1400",
]


def ensure_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "FFmpeg is not installed or is not on PATH.\n"
            "Install it with: winget install --id Gyan.FFmpeg -e"
        )
    return ffmpeg


def choose_video_encoder(ffmpeg: str):
    """
    Prefer NVIDIA NVENC only when it can actually start with the installed
    NVIDIA driver. Some FFmpeg builds list h264_nvenc even when the driver
    exposes an older NVENC API, so we run a tiny real encode test first.
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
            print("ℹ️ NVENC encoder not present in FFmpeg; using CPU H.264.")
            return cpu_encoder

        # Real one-frame test: catches driver/NVENC API incompatibility.
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
                "-"
            ],
            capture_output=True,
            text=True,
            timeout=20,
        )

        if probe.returncode == 0:
            print("🚀 NVIDIA NVENC test passed: GPU video encoding enabled.")
            return [
                "-c:v", "h264_nvenc",
                "-preset", "p5",
                "-tune", "hq",
                "-rc", "vbr",
                "-cq", "20",
                "-b:v", "0",
            ]

        print("⚠️ NVENC exists but cannot start with the current NVIDIA driver.")
        if probe.stderr.strip():
            first_line = probe.stderr.strip().splitlines()[0]
            print(f"   {first_line}")
        print("➡️ Automatically falling back to CPU H.264 for this test.")
        return cpu_encoder

    except Exception as exc:
        print(f"⚠️ NVENC check failed: {exc}")
        print("➡️ Using CPU H.264.")
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
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)

    return ImageFont.load_default()


def request(url: str, timeout: int = 60):
    try:
        response = requests.get(url, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
        return response
    except Exception as exc:
        print(f"      ⚠️ Image request failed: {exc}")
        return None


def official_image(source_url: str | None):
    if not source_url or not source_url.startswith(("http://", "https://")):
        return None

    response = request(source_url, timeout=20)
    if not response:
        return None

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        tags = [
            soup.find("meta", property="og:image"),
            soup.find("meta", attrs={"name": "twitter:image"}),
        ]
        for tag in tags:
            if tag and tag.get("content"):
                return urllib.parse.urljoin(source_url, tag["content"].strip())
    except Exception:
        return None

    return None


def image_prompt(opp: dict, scene_number: int):
    country = opp.get("country") or "international"
    organization = opp.get("organization") or "prestigious university"
    field = opp.get("field") or "academic research"
    opportunity_type = opp.get("type") or "scholarship"

    prompts = [
        (
            f"photorealistic prestigious university campus in {country}, "
            "international graduate students, grand architecture, golden hour, "
            "premium cinematic documentary photography, elegant, realistic, no text"
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
            f"photorealistic international {opportunity_type} applicant preparing documents, "
            "laptop, academic papers, notebook, modern university study room, "
            "focused optimistic mood, cinematic photography, no text"
        ),
        (
            f"photorealistic successful international graduate student walking on a university campus in {country}, "
            "confident future-focused mood, golden hour, premium university campaign photography, no text"
        ),
    ]

    return prompts[(scene_number - 1) % len(prompts)]


def save_image_from_url(url: str, target: Path) -> bool:
    response = request(url, timeout=120)
    if not response:
        return False

    try:
        image = Image.open(BytesIO(response.content)).convert("RGB")
        image.save(target, quality=95)
        return True
    except Exception as exc:
        print(f"      ⚠️ Could not decode image: {exc}")
        return False


def get_scene_photo(opp: dict, scene_number: int) -> Path:
    target = OUTPUT_DIR / f"cinematic_photo_{scene_number:02d}.jpg"

    # Scene 1: try the official opportunity/social image first.
    if scene_number == 1:
        source = (
            opp.get("source_url")
            or opp.get("url")
            or opp.get("original_link")
        )
        official = official_image(source)
        if official and save_image_from_url(official, target):
            print("      ✅ Using official/social opportunity image.")
            return target

    # AI-generated cinematic fallback.
    prompt = image_prompt(opp, scene_number)
    ai_url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(prompt)
        + f"?width=1200&height=1500&nologo=true&seed={9200 + scene_number}"
    )
    if save_image_from_url(ai_url, target):
        print("      ✅ AI cinematic image created.")
        return target

    # Guaranteed final fallback.
    fallback = FALLBACK_IMAGES[(scene_number - 1) % len(FALLBACK_IMAGES)]
    if save_image_from_url(fallback, target):
        print("      ✅ Using fallback university photo.")
        return target

    # Last-resort local image so rendering never fails solely on image download.
    Image.new("RGB", (1200, 1500), (24, 32, 55)).save(target)
    print("      ⚠️ Using local solid fallback image.")
    return target


def wrap_text(draw, text: str, font, max_width: int):
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


def scene_data(opp: dict):
    title = opp.get("title") or "Scholarship Opportunity"
    organization = opp.get("organization") or "Not specified"
    country = opp.get("country") or "Global"
    opportunity_type = opp.get("type") or "Scholarship"
    field = opp.get("field") or "Multidisciplinary"
    funding = opp.get("funding_details") or opp.get("funding") or "Funding not specified"
    deadline = opp.get("deadline") or "Check official page"
    eligibility = opp.get("eligibility") or "Check the official eligibility requirements"
    documents = opp.get("documents") or "Check the official application requirements"

    return [
        {
            "eyebrow": f"{opportunity_type} • {country}",
            "headline": title,
            "body": f"New opportunity highlighted by ScholarPortal",
            "footer": "Verified details • scholarportal.site",
        },
        {
            "eyebrow": "HOST & FIELD",
            "headline": organization,
            "body": field,
            "footer": f"Location • {country}",
        },
        {
            "eyebrow": "FUNDING",
            "headline": "WHAT IT SUPPORTS",
            "body": funding,
            "footer": "Always confirm funding on the official page",
        },
        {
            "eyebrow": "APPLICATION",
            "headline": f"Deadline • {deadline}",
            "body": f"Eligibility: {eligibility}\nDocuments: {documents}",
            "footer": "Prepare early • verify official requirements",
        },
        {
            "eyebrow": "SCHOLARPORTAL",
            "headline": "FULL DETAILS & APPLICATION GUIDE",
            "body": "Explore the opportunity, requirements, funding and official application link.",
            "footer": "scholarportal.site",
        },
    ]


def create_scene_image(
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

    # Cinematic dark gradient for readable text.
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)

    for y in range(HEIGHT):
        # Darker near bottom; subtle tint at top.
        bottom_ratio = max(0.0, min(1.0, (y - 520) / 1200))
        alpha = int(25 + 205 * (bottom_ratio ** 1.35))
        draw_overlay.line((0, y, WIDTH, y), fill=(3, 7, 17, alpha))

    draw_overlay.rectangle((0, 0, WIDTH, 230), fill=(3, 7, 17, 90))
    canvas = Image.alpha_composite(canvas, overlay)

    draw = ImageDraw.Draw(canvas)

    brand_font = get_font(44, bold=True)
    count_font = get_font(28)
    eyebrow_font = get_font(38, bold=True)
    headline_font = get_font(68, bold=True, serif=True)
    body_font = get_font(44, bold=True)
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

    # Main text block - larger labels/details for mobile Facebook viewing.
    y = 930

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

    for line in wrap_text(draw, scene["headline"], headline_font, 930)[:4]:
        draw.text((62, y), line, font=headline_font, fill=(255, 255, 255))
        y += 82

    y += 16
    draw.rounded_rectangle(
        (62, y, 320, y + 11),
        radius=6,
        fill=(239, 203, 115),
    )
    y += 42

    for line in wrap_text(draw, scene["body"], body_font, 930)[:6]:
        # Tiny shadow improves readability without changing the cinematic look.
        draw.text((64, y + 2), line, font=body_font, fill=(0, 0, 0, 135))
        draw.text((62, y), line, font=body_font, fill=(241, 244, 249))
        y += 57

    # Footer / CTA
    footer_y = 1800
    draw.text(
        (62, footer_y),
        str(scene["footer"]),
        font=footer_font,
        fill=(239, 203, 115),
    )

    canvas.convert("RGB").save(output_path, quality=95)


def render_scene_clip(
    image_path: Path,
    clip_path: Path,
    ffmpeg: str,
    encoder_args: list[str],
    scene_number: int,
):
    """
    Premium motion: very slow camera drift instead of the previous zoompan.
    The image is gently enlarged first, then a small animated crop moves across it.
    This avoids the aggressive/stuttery Ken Burns effect.
    """
    frames = int(round(SCENE_SECONDS * FPS))

    # Alternate direction very subtly between scenes.
    phase = scene_number * 0.75
    direction = 1 if scene_number % 2 else -1

    # Enlarge by ~7%, then move only a few pixels over the whole scene.
    # crop x/y are evaluated every frame and 't' is time in seconds.
    x_expr = (
        f"(iw-ow)/2+{direction}*14*sin(t*0.42+{phase:.2f})"
    )
    y_expr = (
        f"(ih-oh)/2+10*cos(t*0.34+{phase:.2f})"
    )

    vf = (
        f"scale=1156:2056,"
        f"crop={WIDTH}:{HEIGHT}:"
        f"x='{x_expr}':"
        f"y='{y_expr}',"
        "fade=t=in:st=0:d=0.18,"
        "format=yuv420p"
    )

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-loop",
        "1",
        "-framerate",
        str(FPS),
        "-i",
        str(image_path),
        "-vf",
        vf,
        "-frames:v",
        str(frames),
        "-r",
        str(FPS),
        *encoder_args,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(clip_path),
    ]

    subprocess.run(cmd, check=True)


def join_clips(
    clips: list[Path],
    ffmpeg: str,
    encoder_args: list[str],
):
    if len(clips) != 5:
        raise ValueError("Exactly 5 clips are required.")

    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]

    for clip in clips:
        cmd += ["-i", str(clip)]

    transitions = ["fade", "fade", "fade", "fade"]
    filter_parts = []
    previous = "[0:v]"

    # xfade offsets:
    # clip2 starts at 3.9
    # clip3 starts at 7.8
    # clip4 starts at 11.7
    # clip5 starts at 15.6
    # final = 20.0 sec
    for i in range(1, len(clips)):
        output = f"[v{i}]"
        offset = (SCENE_SECONDS - TRANSITION_SECONDS) * i
        transition = transitions[(i - 1) % len(transitions)]

        filter_parts.append(
            f"{previous}[{i}:v]"
            f"xfade=transition={transition}:"
            f"duration={TRANSITION_SECONDS}:"
            f"offset={offset:.3f}"
            f"{output}"
        )
        previous = output

    cmd += [
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        previous,
        "-t",
        "20.0",
        "-r",
        str(FPS),
        *encoder_args,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(OUTPUT_VIDEO),
    ]

    subprocess.run(cmd, check=True)


def build_facebook_caption(opp: dict) -> str:
    title = opp.get("title") or "Scholarship Opportunity"
    organization = opp.get("organization") or "Not specified"
    country = opp.get("country") or "Global"
    opportunity_type = opp.get("type") or "Scholarship"
    field = opp.get("field") or "Multidisciplinary"
    funding = opp.get("funding_details") or opp.get("funding") or "Not specified"
    deadline = opp.get("deadline") or "Check official page"

    return f"""🎓 {title}

🌍 Country: {country}
🎓 Type: {opportunity_type}
🏛️ Host: {organization}
📚 Field: {field}
💰 Funding: {funding}
📅 Deadline: {deadline}

✨ Watch this quick ScholarPortal cinematic overview.

🌐 Full details and official application information:
{SCHOLARPORTAL_BASE_URL}

#ScholarPortal #Scholarships #StudyAbroad #{opportunity_type.replace(" ", "")}""".strip()


def main():
    print("\n============================================================")
    print("🎬 ScholarPortal Cinematic Facebook Video Test — Improved Motion + Larger Text")
    print("============================================================")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ffmpeg = ensure_ffmpeg()
    encoder_args = choose_video_encoder(ffmpeg)

    scenes = scene_data(TEST_OPPORTUNITY)

    print("\nOpportunity used for the test:")
    print(json.dumps(TEST_OPPORTUNITY, indent=2, ensure_ascii=False))

    clips = []

    for i, scene in enumerate(scenes, start=1):
        print(f"\n🎞️ Scene {i}/5: {scene['eyebrow']}")

        photo_path = get_scene_photo(TEST_OPPORTUNITY, i)
        scene_image_path = OUTPUT_DIR / f"cinematic_scene_{i:02d}.jpg"
        clip_path = OUTPUT_DIR / f"cinematic_clip_{i:02d}.mp4"

        create_scene_image(
            scene,
            photo_path,
            i,
            len(scenes),
            scene_image_path,
        )
        print("      ✅ Cinematic information card created.")

        render_scene_clip(
            scene_image_path,
            clip_path,
            ffmpeg,
            encoder_args,
            i,
        )
        print("      ✅ Motion clip rendered.")

        clips.append(clip_path)

    print("\n🎬 Joining scenes with cinematic transitions...")
    join_clips(clips, ffmpeg, encoder_args)

    print("\n✅ SUCCESS")
    print(f"Video: {OUTPUT_VIDEO.resolve()}")
    print("\nFacebook caption preview:")
    print("------------------------------------------------------------")
    print(build_facebook_caption(TEST_OPPORTUNITY))
    print("------------------------------------------------------------")
    print("\nThis test generated the video only. Nothing was posted to Facebook.")


if __name__ == "__main__":
    main()
