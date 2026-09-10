import os
import sys
import json
import time
import requests
import random
from dotenv import load_dotenv
import re
from datetime import datetime, date
from urllib.parse import urlparse
import urllib.parse
from bs4 import BeautifulSoup
import cloudinary
import cloudinary.uploader

# Optional local imports for post-scrape alerts
try:
    from dispatch_alerts import run_line_matchmaker
    from dispatch_email_alerts import run_email_matchmaker
except ImportError:
    run_line_matchmaker = None
    run_email_matchmaker = None

# SDK Imports
from google import genai
from google.genai import types
from groq import Groq
from supabase import create_client, Client
from facebook_publisher import publish_post, FacebookPublishError
try:
    from facebook_publisher import publish_photo
except ImportError:
    publish_photo = None

try:
    from facebook_publisher import publish_video
except ImportError:
    publish_video = None

try:
    from video_generator import (
        build_video_caption,
        cleanup_cinematic_video,
        generate_cinematic_video,
    )
except ImportError:
    build_video_caption = None
    cleanup_cinematic_video = None
    generate_cinematic_video = None

# 1. Load environment variables
load_dotenv()

supabase_url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
cgu_key = os.environ.get("VITE_CGU_API_KEY") or os.environ.get("CGU_API_KEY")
groq_key = os.environ.get("VITE_GROQ_API_KEY") or os.environ.get("VITE_GROQ_API_KEY2")
gemini_key = os.environ.get("VITE_GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY2")
hf_token = os.environ.get("HF_API_KEY") or os.environ.get("HF_API_KEY2")
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)
secure=True
if not supabase_url or not supabase_key:
    print("❌ ERROR: Missing Supabase environment variables!")
    sys.exit(1)

# 2. Initialize Clients
supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client(api_key=gemini_key) if gemini_key else None
groq_client = Groq(api_key=groq_key) if groq_key else None

# Facebook / ScholarPortal publishing settings
SCHOLARPORTAL_BASE_URL = os.environ.get("SCHOLARPORTAL_BASE_URL", "https://scholarportal.site").rstrip("/")
FACEBOOK_PUBLISH_ENABLED = os.environ.get("FACEBOOK_PUBLISH_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
FACEBOOK_USE_PHOTO_POST = os.environ.get("FACEBOOK_USE_PHOTO_POST", "true").strip().lower() in {"1", "true", "yes", "on"}
try:
    FACEBOOK_MAX_POSTS_PER_RUN = max(0, int(os.environ.get("FACEBOOK_MAX_POSTS_PER_RUN", "6")))
except ValueError:
    FACEBOOK_MAX_POSTS_PER_RUN = 6

FACEBOOK_VIDEO_ENABLED = os.environ.get(
    "FACEBOOK_VIDEO_ENABLED",
    "true",
).strip().lower() in {"1", "true", "yes", "on"}

try:
    FACEBOOK_MAX_VIDEOS_PER_RUN = max(
        0,
        int(os.environ.get("FACEBOOK_MAX_VIDEOS_PER_RUN", "4")),
    )
except ValueError:
    FACEBOOK_MAX_VIDEOS_PER_RUN = 4

ALLOWED_TYPES = {
    "Bachelor", "Master", "PhD", "MPhil", "Fellowship",
    "Internship", "Course", "Workshop", "Scholarship"
}

# Curated verified image pool
VERIFIED_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800"
]

# ---------------------------------------------------------
# 7-DAY SCHEDULED REGIONS (High-Stipend Global Rotation)
# ---------------------------------------------------------
SCHEDULED_REGIONS_BY_DAY = {
    # Monday: East Asia & Pacific Rim
    0: [
        "Taiwan (MOE Taiwan Scholarship, NSTC International Fellowships, Academia Sinica TIGP)",
        "Japan (MEXT Embassy & University Recommendation, JASSO, ADB-JSP)",
        "South Korea (Global Korea Scholarship GKS, KAIST, UNIST Graduate Fellowships)",
        "Hong Kong & Macau (Hong Kong PhD Fellowship Scheme HKPFS, University Fellowships)"
    ],

    # Tuesday: Southeast Asia & Greater China
    1: [
        "Singapore (SINGA PhD Award, NUS/NTU Research Scholarships, A*STAR Grants)",
        "China (Chinese Government Scholarship CSC, Belt and Road, Schwarzman Scholars)",
        "Malaysia & Brunei (MIS Malaysian International Scholarship, Brunei Darussalam Gov Award)",
        "Thailand & Vietnam (AIT King's Scholarships, Chulalongkorn Graduate Waivers)"
    ],

    # Wednesday: Middle East, Central Asia & South Asia
    2: [
        "Saudi Arabia (KAUST Fellowship, KFUPM Full MS/PhD, King Saud University)",
        "United Arab Emirates & Qatar (MBZUAI AI Fellowships, Qatar University Graduate Scholarships)",
        "Turkey & Central Asia (Türkiye Bursları Government Scholarships, IsDB Scholarships)",
        "South Asia (ICCR Scholarships, SAARC Fellowships, PIEAS/HEC International Stream)"
    ],

    # Thursday: Western & Central Europe (DACH & Benelux)
    3: [
        "Germany (DAAD Helmut Schmidt, Development-Related Postgraduate Courses EPOS, Max Planck)",
        "Switzerland & Austria (ETH Zurich Excellence, EPFL Fellowships, Swiss Gov Excellence, Ernst Mach)",
        "France & Benelux (Eiffel Excellence Scholarship, Holland Scholarship, Ghent University Grants)",
        "Central Europe (Visegrad Scholarship, Stipendium Hungaricum, Czech Republic Gov Awards)"
    ],

    # Friday: Nordics & Southern Europe
    4: [
        "Finland & Sweden (EDUFI Fellowships, Swedish Institute SI Scholarships, University Tuition Waivers)",
        "Norway & Denmark (Salaried PhD Fellowships, Danish Government Cultural Agreements)",
        "Italy (DSU Regional Grants, Invest Your Talent in Italy, Politecnico di Milano Fellowships)",
        "Spain & Portugal (Fundación Carolina Grants, Severo Ochoa PhD, FCT Portugal Fellowships)"
    ],

    # Saturday: North America & United Kingdom
    5: [
        "United States (Fulbright Foreign Student Program, Knight-Hennessy, Humphrey Fellowship)",
        "Canada (Vanier Canada Graduate Scholarships, Banting Fellowships, Lester B. Pearson)",
        "United Kingdom (Chevening Scholarships, Commonwealth Grants, Gates Cambridge, Rhodes Trust)",
        "Ireland (Government of Ireland Postgraduate GOIPG, Trinity & UCD Global Excellence)"
    ],

    # Sunday: Oceania, Latin America & Global Consortia
    6: [
        "Australia & New Zealand (Australia Awards, Research Training Program RTP, Manaaki New Zealand)",
        "Global Pan-European (Erasmus Mundus Joint Masters EMJM, Marie Skłodowska-Curie Actions MSCA)",
        "Latin America & Caribbean (OAS Academic Scholarships, Rotary Peace Fellowships)",
        "African Regional Bodies (African Union Mwalimu Nyerere, Mandela Washington Fellowship)"
    ]
}

def get_extraction_prompt(region: str) -> str:
    """Generates a targeted extraction prompt for a specific geographic region."""
    return f"""
You are an elite academic and scholarship intelligence extractor. Today's date is {datetime.now().strftime('%Y-%m-%d')}.
Your job is to search and extract live, high-value, fully-funded global scholarships and opportunities specifically located in or funded by: {region}.

CRITICAL INSTRUCTIONS:
1. 'type': Must be EXACTLY one of: "Bachelor", "Master", "PhD", "MPhil", "Fellowship", "Internship", "Course", "Workshop", "Scholarship". Do not invent new types.
2. 'country': Standard short country name (e.g., "USA", "UK", "Canada", "Germany", "Taiwan", "Japan", "Finland", "South Korea", "China", "Saudi Arabia", "Singapore", "Switzerland"). If worldwide/remote, output "Global".
3. 'field': The specific academic discipline or subject area (e.g., "Computer Science", "Engineering", "Mathematics", "Medicine", "Multidisciplinary").
4. 'funding_details': Precise financial value (e.g., "Full tuition + $1500/month", "Full scholarship + housing", "CHF 2000/month", "Fully Funded"). Output null if not specified.
5. 'deadline': Must be strictly in "YYYY-MM-DD" format. If rolling/ongoing, output "Rolling". Target active and upcoming intakes with deadlines on or after {datetime.now().strftime('%Y-%m-%d')}. Do NOT include expired opportunities.
6. 'description': Detailed summary outlining the research area, eligibility criteria (who it is suitable for), and specific required documents (e.g., "Requires IELTS/TOEFL, CV, and a research proposal.").
7. 'tags': Array of 3-5 keywords for database filtering (e.g., ["Fully Funded", "AI", "IELTS Required"]).
8. 'url': Direct application or official website URL strictly starting with http or https.

OUTPUT REQUIREMENT:
Return ONLY a valid JSON object with a single key "scholarships" containing an array of 3-5 extracted opportunities.
{{
  "scholarships": [
    {{
      "title": "Official Opportunity Name",
      "organization": "University or Host Organization",
      "type": "Master",
      "country": "Switzerland",
      "field": "Computer Science",
      "funding_details": "Full tuition + CHF 2,000/month",
      "deadline": "2026-12-01",
      "description": "Suitable for international students focusing on AI research. Required documents: Transcript, CV, and 2 recommendation letters.",
      "tags": ["AI", "Fully Funded", "Europe"],
      "url": "https://example.com/apply"
    }}
  ]
}}
"""



def get_official_image(url: str) -> str:
    """Attempts to scrape the official OpenGraph banner image from the URL."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for <meta property="og:image" content="...">
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            img_url = og_image['content']
            if img_url.startswith('http'):
                return img_url
    except Exception as e:
        print(f"      ⚠️ Failed to scrape official image: {e}")
    return None

def get_ai_generated_image(title: str, country: str) -> str:
    """Generates an AI image using a free, keyless API based on the opportunity."""
    clean_title = re.sub(r'[^a-zA-Z0-9\s]', '', title)
    prompt = f"Professional university campus banner, academic scholarship concept, {clean_title} in {country}, cinematic lighting, photorealistic, no text"
    encoded_prompt = urllib.parse.quote(prompt)
    
    # Pollinations.ai generates images on the fly via URL
    return f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=800&height=400&nologo=true"

def fetch_and_upload_image(source_url: str, title: str, country: str) -> str:
    """Pipelines the image from source (or AI) to Cloudinary and returns the secure URL."""
    # 1. Try scraping the official image
    target_img_url = get_official_image(source_url)
    source_type = "Official"
    
    # 2. Fallback to AI generation
    if not target_img_url:
        target_img_url = get_ai_generated_image(title, country)
        source_type = "AI-Generated"
        
    try:
        # 3. Upload to Cloudinary directly from the URL
        upload_result = cloudinary.uploader.upload(
            target_img_url,
            folder="scholarships",
            transformation=[
                {"width": 800, "height": 400, "crop": "fill", "gravity": "auto"}
            ]
        )
        print(f"      🖼️ Image secured via {source_type} and uploaded to Cloudinary.")
        return upload_result.get("secure_url")
    except Exception as e:
        print(f"      ⚠️ Cloudinary/AI upload failed: {e}")
        # 4. Absolute fallback: guaranteed high-quality Unsplash image
        fallback_img = random.choice(VERIFIED_IMAGES)
        print("      🔄 Using guaranteed fallback image from VERIFIED_IMAGES.")
        return fallback_img
def get_opportunity_blog_prompt(opp_data: dict) -> str:
    """Transforms verified opportunity data into an SEO HTML blog post."""
    return f"""
    You are an elite academic career strategist and SEO content writer. 
    Turn the following verified scholarship details into a complete, engaging blog post.
    
    Return ONLY a strictly valid JSON object. Do not include markdown formatting like ```json.
    
    CRITICAL: You MUST use single quotes for all HTML attributes (e.g. <h3 class='title'>) to prevent breaking the JSON string.
    
    {{
        "title": "A catchy, SEO-friendly title based on: {opp_data.get('title')}",
        "slug": "url-friendly-lowercase-title-with-dashes",
        "excerpt": "A punchy 2-sentence summary.",
        "content": "Full blog post content in HTML. Use <h3> for sections (Eligibility, Benefits, Deadline), <ul> and <li> for lists, and <strong> for emphasis.",
        "tags": ["{opp_data.get('country')}", "{opp_data.get('type')}", "Fully Funded"],
        "read_time": "3 min read",
        "original_link": "{opp_data.get('url')}"
    }}
    
    OPPORTUNITY DATA:
    {json.dumps(opp_data)}
    """
def clean_json_response(raw_text: str) -> str:
    """Sanitizes raw LLM output to extract pure JSON."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()

def validate_opportunity(opp: dict) -> tuple[bool, str]:
    """Strict validation gatekeeper before DB insertion."""
    if not isinstance(opp, dict):
        return False, "Item is not a valid JSON dictionary"

    title = (opp.get("title") or "").strip()
    if len(title) < 4:
        return False, f"Title missing or too short: '{title}'"

    org = (opp.get("organization") or "").strip()
    if len(org) < 2:
        return False, f"Organization missing for '{title}'"

    raw_url = (opp.get("url") or "").strip()
    parsed = urlparse(raw_url)
    if not (parsed.scheme in ("http", "https") and bool(parsed.netloc)):
        return False, f"Invalid URL structure: '{raw_url}'"
    if "example.com" in raw_url or raw_url.endswith("#"):
        return False, f"Placeholder URL detected: '{raw_url}'"

    opp_type = (opp.get("type") or "").strip()
    if opp_type not in ALLOWED_TYPES:
        return False, f"Invalid type '{opp_type}'. Must be one of {ALLOWED_TYPES}"

    country = (opp.get("country") or "").strip()
    if not country:
        return False, "Missing country field"

    field = (opp.get("field") or "").strip()
    if not field:
        return False, "Missing academic field/discipline"

    deadline = (opp.get("deadline") or "").strip()
    if not deadline:
        return False, "Missing deadline"
    
    if deadline.lower() != "rolling":
        date_match = re.match(r"^\d{4}-\d{2}-\d{2}$", deadline)
        if not date_match:
            return False, f"Invalid date format '{deadline}'. Must be YYYY-MM-DD or 'Rolling'"
        try:
            parsed_date = datetime.strptime(deadline, "%Y-%m-%d").date()
            if parsed_date < date.today():
                return False, f"Opportunity has expired ({deadline})"
        except ValueError:
            return False, f"Invalid calendar date '{deadline}'"

    desc = (opp.get("description") or "").strip()
    if len(desc) < 20:
        return False, f"Description incomplete or too short ({len(desc)} chars)"

    return True, "Valid"

def validate_blog_post(blog: dict) -> tuple[bool, str]:
    """Ensures the generated blog post meets UI and structural standards."""
    if not isinstance(blog, dict):
        return False, "Blog data is not a valid JSON dictionary."
    
    title = (blog.get("title") or "").strip()
    if len(title) < 10:
        return False, "Blog title is missing or too short."
        
    content = (blog.get("content") or "").strip()
    if len(content) < 150:
        return False, "Blog content is too short to be a dedicated post."
        
    if "<h" not in content and "<p" not in content and "<ul" not in content:
        return False, "Blog content is missing HTML formatting."
        
    return True, "Valid"

# ---------------------------------------------------------
# CGU MULTI-TIER EXTRACTION GATEWAY
# ---------------------------------------------------------
def call_cgu_endpoint(model_name: str, prompt: str, timeout: int = 60) -> str:
    url = "https://air.cgu.edu.tw/cgullmapi/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cgu_key}"
    }
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": "You are a real-time scholarship data extractor. Output ONLY a valid JSON object matching the requested schema without markdown."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]

def extract_with_cgu(prompt: str) -> str:
    """Tier 1 CGU Internal Waterfall (o3-deep-research -> gpt-4o -> gpt-oss:20b)."""
    if not cgu_key:
        raise ValueError("CGU API key not configured in environment.")

    try:
        print("   🟢 [CGU Tier 1A] Attempting o3-deep-research...")
        return call_cgu_endpoint("o3-deep-research", prompt, timeout=90)
    except Exception as e1:
        print(f"      ⚠️ CGU o3-deep-research failed: {e1}")

    try:
        print("   🟢 [CGU Tier 1B] Falling back to gpt-4o...")
        return call_cgu_endpoint("gpt-4o", prompt, timeout=45)
    except Exception as e2:
        print(f"      ⚠️ CGU gpt-4o failed: {e2}")

    try:
        print("   🟢 [CGU Tier 1C] Falling back to CGU Local Model (gpt-oss:20b)...")
        return call_cgu_endpoint("gpt-oss:20b", prompt, timeout=60)
    except Exception as e3:
        print(f"      ⚠️ CGU Local Model failed: {e3}")
        raise RuntimeError("All internal CGU models failed.")

# ---------------------------------------------------------
# EXTERNAL FALLBACK TIERS (Groq & Gemini)
# ---------------------------------------------------------
def extract_with_groq(prompt: str) -> str:
    """Tier 2: Groq Fast Fallback"""
    if not groq_key:
        raise ValueError("Groq API key not configured in environment.")
    
    print("   🟡 [Tier 2] Attempting Groq AI...")
    model_name = "openai/gpt-oss-120b"
    
    if groq_client:
        completion = groq_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a factual data parser. Output ONLY a valid JSON object. Do not include any explanations or markdown."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=4096,
            temperature=0.1
        )
        return completion.choices[0].message.content
    else:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {groq_key}"
        }
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": "You are a factual data parser. Output ONLY a valid JSON object."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 4096,
            "temperature": 0.1
        }
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]

def extract_with_gemini(prompt: str) -> str:
    """Tier 3: Gemini Search-Grounded Fallback"""
    if not gemini_client:
        raise ValueError("Gemini API key not configured in environment.")
    
    print("   🟠 [Tier 3] Attempting Gemini with Live Google Search...")
    chat = gemini_client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            response_mime_type="application/json",
            temperature=0.1
        )
    )
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = chat.send_message(prompt)
            return response.text
        except Exception as e:
            if "503" in str(e) and attempt < max_retries - 1:
                print(f"      ⚠️ Gemini server busy (503). Retrying in 5 seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(5)
            else:
                raise e


def extract_with_huggingface(prompt: str) -> str:
    """Tier 4: Hugging Face Router Fallback (High-capacity Open Weights)."""
    if not hf_token:
        raise ValueError("Hugging Face API key not configured in environment.")

    print("   🟣 [Tier 4] Attempting Hugging Face Router (gpt-oss-120b)...")
    url = "https://router.huggingface.co/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "application/json"
    }
    
    # You can easily toggle between "openai/gpt-oss-120b" and "zai-org/GLM-5.3-Flash"
    payload = {
        "model": "openai/gpt-oss-120b",
        "messages": [
            {
                "role": "system",
                "content": "You are a real-time scholarship data extractor. Output ONLY a valid JSON object matching the requested schema without markdown."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 4096
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]
# ---------------------------------------------------------
# UNIFIED WATERFALL GATEWAY (CGU -> Groq -> Gemini)
# ---------------------------------------------------------
def process_with_waterfall(prompt: str):
    """
    Cascades through CGU -> Groq -> Gemini -> Hugging Face.
    Validates JSON integrity inside the loop before accepting the response.
    """
    models = [
        ("CGU Gateway", extract_with_cgu),
        ("Groq AI", extract_with_groq),
        ("Gemini AI", extract_with_gemini),
        ("Hugging Face Router", extract_with_huggingface)
    ]
    
    for model_name, model_func in models:
        try:
            raw_text = model_func(prompt)
            if not raw_text or not raw_text.strip():
                raise ValueError("Received empty string response")
            
            cleaned = clean_json_response(raw_text)
            parsed_data = json.loads(cleaned)
            
            print(f"   ✅ {model_name} Succeeded and validated JSON structure!")
            return parsed_data

        except Exception as e:
            print(f"   ⚠️ {model_name} failed or produced malformed JSON: {e}")
            continue
            
    print("   ❌ All AI tiers failed to return valid JSON.")
    return None

# ---------------------------------------------------------
# FACEBOOK PUBLISHING
# ---------------------------------------------------------
def _hashtag(value: str) -> str:
    """Convert a label such as 'South Korea' into a safe hashtag token."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", value or "")
    return f"#{cleaned}" if cleaned else ""


def _country_flag(country: str) -> str:
    """Return a useful flag for the countries/regions commonly used by this agent."""
    flags = {
        "usa": "🇺🇸", "united states": "🇺🇸", "canada": "🇨🇦", "uk": "🇬🇧",
        "united kingdom": "🇬🇧", "ireland": "🇮🇪", "germany": "🇩🇪",
        "france": "🇫🇷", "switzerland": "🇨🇭", "austria": "🇦🇹",
        "italy": "🇮🇹", "spain": "🇪🇸", "portugal": "🇵🇹", "finland": "🇫🇮",
        "sweden": "🇸🇪", "norway": "🇳🇴", "denmark": "🇩🇰", "netherlands": "🇳🇱",
        "belgium": "🇧🇪", "hungary": "🇭🇺", "czech republic": "🇨🇿",
        "taiwan": "🇹🇼", "japan": "🇯🇵", "south korea": "🇰🇷", "korea": "🇰🇷",
        "hong kong": "🇭🇰", "china": "🇨🇳", "singapore": "🇸🇬", "malaysia": "🇲🇾",
        "brunei": "🇧🇳", "thailand": "🇹🇭", "vietnam": "🇻🇳", "saudi arabia": "🇸🇦",
        "united arab emirates": "🇦🇪", "uae": "🇦🇪", "qatar": "🇶🇦", "turkey": "🇹🇷",
        "india": "🇮🇳", "pakistan": "🇵🇰", "australia": "🇦🇺", "new zealand": "🇳🇿",
        "global": "🌍",
    }
    return flags.get((country or "").strip().lower(), "🌍")


def _format_deadline(deadline: str) -> str:
    """Make YYYY-MM-DD friendlier for Facebook without changing the stored DB value."""
    raw = (deadline or "").strip()
    if not raw:
        return "Not specified"
    if raw.lower() == "rolling":
        return "Rolling"
    try:
        return datetime.strptime(raw, "%Y-%m-%d").strftime("%B %d, %Y").replace(" 0", " ")
    except ValueError:
        return raw


def _facebook_banner(opp_type: str, funding: str, tags: list) -> str:
    """Choose a strong but factual headline. Never claim fully funded unless the data says so."""
    opp_lower = (opp_type or "").lower()
    funding_lower = (funding or "").lower()
    tag_text = " ".join(str(tag) for tag in (tags or [])).lower()
    fully_funded = "fully funded" in funding_lower or "fully funded" in tag_text

    if opp_lower == "internship":
        return "💼 PAID INTERNSHIP OPPORTUNITY" if "paid" in funding_lower else "💼 INTERNSHIP OPPORTUNITY"
    if opp_lower == "fellowship":
        return "🚀 FULLY FUNDED FELLOWSHIP" if fully_funded else "🚀 FELLOWSHIP OPPORTUNITY"
    if opp_lower in {"phd", "mphil", "master", "bachelor"}:
        level = opp_type.upper() if opp_lower == "phd" else opp_type
        return f"🎓 FULLY FUNDED {level} OPPORTUNITY" if fully_funded else f"🎓 {level} OPPORTUNITY"
    if opp_lower == "course":
        return "📚 COURSE OPPORTUNITY"
    if opp_lower == "workshop":
        return "🧠 WORKSHOP OPPORTUNITY"
    return "🎓 FULLY FUNDED SCHOLARSHIP" if fully_funded else "🎓 SCHOLARSHIP OPPORTUNITY"


def _build_highlights(payload: dict) -> list[str]:
    """Build short, factual scan-friendly highlights from fields already verified by the agent."""
    highlights = []
    funding = (payload.get("funding_details") or "").strip()
    field = (payload.get("field") or "").strip()
    tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []
    description = (payload.get("description") or "").lower()

    if funding and funding.lower() not in {"not specified", "n/a", "none"}:
        highlights.append(funding)
    if field:
        highlights.append(f"Field: {field}")
    if "international" in description or any("international" in str(tag).lower() for tag in tags):
        highlights.append("International applicants mentioned")

    # Add useful agent tags without repeating what we already displayed.
    for tag in tags:
        clean = str(tag).strip()
        if not clean:
            continue
        if any(clean.lower() in item.lower() or item.lower() in clean.lower() for item in highlights):
            continue
        highlights.append(clean)
        if len(highlights) >= 4:
            break

    return highlights[:4]


def build_facebook_message(payload: dict, blog_json: dict, article_url: str) -> str:
    """Build a visual, scan-friendly Facebook caption that drives readers to ScholarPortal."""
    title = (blog_json.get("title") or payload.get("title") or "Scholarship Opportunity").strip()
    country = (payload.get("country") or "Global").strip()
    opp_type = (payload.get("type") or "Scholarship").strip()
    organization = (payload.get("organization") or "Not specified").strip()
    funding = (payload.get("funding_details") or "Not specified").strip()
    field = (payload.get("field") or "Not specified").strip()
    deadline = _format_deadline(payload.get("deadline"))
    excerpt = (blog_json.get("excerpt") or payload.get("description") or "").strip()
    agent_tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []

    # Facebook readers scan quickly; keep the hook short and send detail traffic to ScholarPortal.
    if len(excerpt) > 220:
        excerpt = excerpt[:217].rstrip() + "..."

    flag = _country_flag(country)
    banner = _facebook_banner(opp_type, funding, agent_tags)
    highlights = _build_highlights(payload)
    highlight_block = "\n".join(f"✅ {item}" for item in highlights)

    hashtags = [
        "#ScholarPortal",
        "#Scholarships",
        "#StudyAbroad",
        _hashtag(country),
        _hashtag(opp_type),
    ]
    if "fully funded" in funding.lower() or any("fully funded" in str(tag).lower() for tag in agent_tags):
        hashtags.append("#FullyFunded")
    hashtags = " ".join(dict.fromkeys(tag for tag in hashtags if tag))

    return f"""{banner} {flag}

🎓 {title}

{excerpt}

━━━━━━━━━━━━━━━
📌 QUICK DETAILS
🌍 Country: {country} {flag}
🎓 Level/Type: {opp_type}
🏛️ Host: {organization}
🔬 Field: {field}
💰 Funding: {funding}
📅 Deadline: {deadline}
━━━━━━━━━━━━━━━

✨ AT A GLANCE
{highlight_block or '✅ Check the full opportunity details on ScholarPortal'}

📖 Full eligibility, benefits, required documents & application guide:
👉 {article_url}

🌐 Discover more scholarships, fellowships and global opportunities:
👉 {SCHOLARPORTAL_BASE_URL}

🔔 Follow ScholarHub for fresh opportunities and application updates.

{hashtags}""".strip()


def send_facebook_line_notification(
    payload: dict,
    blog_json: dict,
    article_url: str,
    facebook_post_id: str,
    post_mode: str = "Facebook post",
) -> None:
    """Send an immediate short LINE alert after a Facebook post succeeds."""
    line_token = os.environ.get("LINE_ACCESS_TOKEN")
    line_user = os.environ.get("LINE_USER_ID")

    if not line_token or not line_user:
        print("   ⚠️ LINE credentials missing; Facebook success alert skipped.")
        return

    title = (blog_json.get("title") or payload.get("title") or "Scholarship Opportunity").strip()
    country = (payload.get("country") or "Global").strip()
    opp_type = (payload.get("type") or "Scholarship").strip()
    deadline = _format_deadline(payload.get("deadline"))

    msg_text = (
        "📘 Facebook Post Published\n"
        "━━━━━━━━━━━━━━━\n"
        f"🎓 {title}\n"
        f"🌍 {country} | {opp_type}\n"
        f"📅 Deadline: {deadline}\n"
        f"🖼️ Format: {post_mode}\n"
        f"🔗 {article_url}\n"
        f"🆔 {facebook_post_id}"
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {line_token}",
    }
    body = {
        "to": line_user,
        "messages": [{"type": "text", "text": msg_text}],
    }

    try:
        response = requests.post(
            "https://api.line.me/v2/bot/message/push",
            headers=headers,
            json=body,
            timeout=20,
        )
        response.raise_for_status()
        print("   📱 LINE Facebook-success notification sent.")
    except Exception as exc:
        # Never fail the research/blog/Facebook pipeline just because LINE is unavailable.
        print(f"   ⚠️ Facebook posted, but LINE success alert failed: {exc}")


def publish_blog_to_facebook(payload: dict, blog_json: dict) -> str | None:
    """
    Publish a newly-created opportunity blog to Facebook.

    Primary mode: publish the generated/official Cloudinary image as a Facebook
    photo with a beautiful caption. The ScholarPortal article URL remains visible
    and clickable inside the caption.

    Fallback mode: standard feed/link post.
    """
    opportunity_id = blog_json.get("opportunity_id")
    if not opportunity_id:
        print("   ⚠️ Blog saved but no opportunity_id was available. Skipping Facebook.")
        return None

    article_url = f"{SCHOLARPORTAL_BASE_URL}/opportunity/{opportunity_id}/blog"
    message = build_facebook_message(payload, blog_json, article_url)
    image_url = (blog_json.get("image") or "").strip()

    try:
        post_mode = "Link post"

        # Prefer a photo post because the opportunity image occupies much more feed space
        # and makes the automated post look like a designed social card.
        if FACEBOOK_USE_PHOTO_POST and image_url and publish_photo is not None:
            try:
                post_id = publish_photo(image_url=image_url, message=message)
                post_mode = "Photo post"
                print(f"   🖼️ Facebook photo post published: {post_id}")
            except FacebookPublishError as photo_exc:
                print(f"   ⚠️ Facebook photo publish failed: {photo_exc}")
                print("   🔄 Falling back to a normal ScholarPortal link post...")
                post_id = publish_post(message, link=article_url)
        else:
            if FACEBOOK_USE_PHOTO_POST and publish_photo is None:
                print("   ℹ️ facebook_publisher.py has no publish_photo(); using link-post fallback.")
            elif FACEBOOK_USE_PHOTO_POST and not image_url:
                print("   ℹ️ No blog image available; using link-post fallback.")
            post_id = publish_post(message, link=article_url)

        print(f"   📘 Facebook post published: {post_id}")
        print(f"   🔗 ScholarPortal article: {article_url}")

        send_facebook_line_notification(
            payload=payload,
            blog_json=blog_json,
            article_url=article_url,
            facebook_post_id=post_id,
            post_mode=post_mode,
        )
        return post_id

    except FacebookPublishError as exc:
        # The blog remains published even if Facebook is temporarily unavailable.
        print(f"   ⚠️ Blog published, but Facebook failed: {exc}")
        return None
    except Exception as exc:
        print(f"   ⚠️ Unexpected Facebook publishing error: {exc}")
        return None


def publish_cinematic_video_to_facebook(
    payload: dict,
    blog_json: dict,
) -> str | None:
    """
    Generate a 20-second cinematic video from the REAL opportunity/blog data,
    upload it to Facebook, send the normal immediate LINE success alert,
    then remove all temporary render files.

    Any video failure is isolated: the opportunity, blog, photo/link Facebook
    post, and notification pipeline remain intact.
    """
    if (
        publish_video is None
        or generate_cinematic_video is None
        or build_video_caption is None
    ):
        print(
            "   ⚠️ Cinematic video modules are unavailable; "
            "skipping Facebook video."
        )
        return None

    opportunity_id = blog_json.get("opportunity_id")
    if not opportunity_id:
        print("   ⚠️ No opportunity_id available; skipping cinematic video.")
        return None

    article_url = (
        f"{SCHOLARPORTAL_BASE_URL}/opportunity/{opportunity_id}/blog"
    )

    video_path = None

    try:
        print(
            f"   🎬 Generating dynamic cinematic Facebook video for: "
            f"{payload.get('title')}"
        )

        video_path = generate_cinematic_video(
            payload=payload,
            blog_json=blog_json,
            opportunity_id=opportunity_id,
        )

        video_caption = build_video_caption(
            payload=payload,
            blog_json=blog_json,
            article_url=article_url,
        )

        video_title = (
            blog_json.get("title")
            or payload.get("title")
            or "ScholarPortal Opportunity"
        )

        video_id = publish_video(
            video_path=video_path,
            title=video_title,
            description=video_caption,
        )

        print(f"   🎥 Facebook cinematic video uploaded: {video_id}")

        send_facebook_line_notification(
            payload=payload,
            blog_json=blog_json,
            article_url=article_url,
            facebook_post_id=video_id,
            post_mode="Cinematic video",
        )

        return video_id

    except FacebookPublishError as exc:
        print(f"   ⚠️ Cinematic video Facebook upload failed: {exc}")
        return None
    except Exception as exc:
        print(f"   ⚠️ Cinematic video generation/upload failed: {exc}")
        return None
    finally:
        if video_path and cleanup_cinematic_video is not None:
            cleanup_cinematic_video(video_path)


# ---------------------------------------------------------
# ADMIN NOTIFICATION
# ---------------------------------------------------------
def send_line_notification(day_name, total, inserted, duplicates, rejected, blogs_created, inserted_titles):
    """Sends a detailed push notification to the Admin LINE account."""
    line_token = os.environ.get('LINE_ACCESS_TOKEN')
    line_user = os.environ.get('LINE_USER_ID')
    
    if not line_token or not line_user:
        print("⚠️ LINE credentials missing in .env, skipping admin notification.")
        return

    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {line_token}"
    }
    
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
    msg_text = (
        f"🌎 *ScholarPortal Exec Report*\n"
        f"📅 {day_name} Batch ({current_time})\n"
        f"───────────────\n"
        f"📊 *Scrape Summary:*\n"
        f"📥 Fetched: {total}\n"
        f"✅ Valid Added: {inserted}\n"
        f"✍️ Blogs Authored: {blogs_created}\n"
        f"───────────────\n"
        f"⏭️ Duplicates: {duplicates}\n"
        f"❌ Rejected: {rejected}\n"
    )
    
    if inserted > 0 and inserted_titles:
        msg_text += "\n✨ *Top Opportunities:*\n"
        for title in inserted_titles[:10]:
            msg_text += f"- {title}\n"
        if len(inserted_titles) > 10:
            msg_text += f"...and {len(inserted_titles) - 10} more."

    payload = {
        "to": line_user,
        "messages": [{
            "type": "text",
            "text": msg_text.strip()
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print("📱 Detailed Admin LINE notification sent.")
    except Exception as e:
        print(f"❌ Failed to send LINE notification: {e}")

# ---------------------------------------------------------
# MAIN EXECUTION
# ---------------------------------------------------------
def run_agent():
    now = datetime.now()
    day_index = now.weekday()  # 0=Monday, 6=Sunday
    day_name = now.strftime("%A")
    todays_targets = SCHEDULED_REGIONS_BY_DAY.get(day_index, [])

    print(f"\n🚀 [{now.strftime('%Y-%m-%d %H:%M:%S')}] ScholarPortal Agent starting {day_name} rotation...")
    print(f"🎯 Target Batches for Today: {len(todays_targets)}")

    total_fetched = 0
    total_inserted = 0
    total_duplicates = 0
    total_rejected = 0
    total_blogs_created = 0
    total_facebook_posts = 0
    total_facebook_videos = 0
    all_inserted_titles = []

    for idx, region in enumerate(todays_targets, start=1):
        print(f"\n========================================================")
        print(f"🌍 [{idx}/{len(todays_targets)}] Sweeping Region: {region}")
        print(f"========================================================")

        prompt = get_extraction_prompt(region)
        
        # Execute Unified Waterfall with JSON verification
        data = process_with_waterfall(prompt)
        
        if not data:
            print(f"🛑 Skipping region '{region}' because all AI tiers failed.")
            continue

        opportunities = data.get("scholarships", []) if isinstance(data, dict) else []
        print(f"🧩 Decoded {len(opportunities)} raw items for {region}.")
        total_fetched += len(opportunities)

        # Strict Validation & Database Upsert
        for opp in opportunities:
            is_valid, reason = validate_opportunity(opp)
            if not is_valid:
                print(f"❌ Rejected: {opp.get('title', 'Unknown')} | Reason: {reason}")
                total_rejected += 1
                continue

            payload = {
                "title": opp.get("title").strip(),
                "organization": opp.get("organization").strip(),
                "country": opp.get("country", "Global").strip(),
                "type": opp.get("type").strip(),
                "field": opp.get("field").strip(),
                "funding_details": opp.get("funding_details") or "Not specified",
                "description": opp.get("description").strip(),
                "tags": opp.get("tags") if isinstance(opp.get("tags"), list) else [],
                "deadline": opp.get("deadline").strip(),
                "url": opp.get("url").strip(),
                "source_url": opp.get("url").strip()
            }

            try:
                # 1. Insert Opportunity and capture ID
                db_response = supabase.table("global_opportunities").insert(payload).execute()
                inserted_opp_id = db_response.data[0]['id']
                
                print(f"✅ Verified & Inserted: {payload['title']} ({payload['country']})")
                total_inserted += 1
                all_inserted_titles.append(f"{payload['title']} ({payload['country']})")
                
                # ---------------------------------------------------------
                # 2. Immediately generate the dedicated Blog Post
                # ---------------------------------------------------------
                print(f"   ✍️ Generating dedicated blog post for: {payload['title']}...")
                blog_prompt = get_opportunity_blog_prompt(payload)
                blog_json = process_with_waterfall(blog_prompt)
                
                if blog_json and isinstance(blog_json, dict):
                    # 3. Validate Blog Post Structure
                    is_blog_valid, blog_reason = validate_blog_post(blog_json)
                    if is_blog_valid:
                        # 4. Process Dynamic Image & Save to opportunity_blogs
                        blog_json['opportunity_id'] = inserted_opp_id 
                        
                        print(f"      🔍 Searching for official image or generating AI fallback...")
                        secure_img = fetch_and_upload_image(payload['url'], payload['title'], payload['country'])
                        blog_json['image'] = secure_img
                        
                        try:
                            supabase.table("opportunity_blogs").insert(blog_json).execute()
                            print(f"   💾 Saved Dedicated Blog: {blog_json.get('title')}")
                            total_blogs_created += 1

                            # 5. Publish the new ScholarPortal article to Facebook.
                            # A per-run cap avoids flooding the Page if the research agent finds many items.
                            if FACEBOOK_PUBLISH_ENABLED and total_facebook_posts < FACEBOOK_MAX_POSTS_PER_RUN:
                                facebook_post_id = publish_blog_to_facebook(payload, blog_json)
                                if facebook_post_id:
                                    total_facebook_posts += 1
                            elif not FACEBOOK_PUBLISH_ENABLED:
                                print("   ℹ️ Facebook publishing is disabled by FACEBOOK_PUBLISH_ENABLED.")
                            elif FACEBOOK_MAX_POSTS_PER_RUN == 0:
                                print("   ℹ️ Facebook publishing cap is 0; skipping Facebook.")
                            else:
                                print(f"   ℹ️ Facebook cap reached ({FACEBOOK_MAX_POSTS_PER_RUN} posts this run). Blog remains published.")


                            # 6. Generate/upload ONE premium cinematic video from real data.
                            # This has its own cap and does not replace the existing photo/link posts.
                            if (
                                FACEBOOK_PUBLISH_ENABLED
                                and FACEBOOK_VIDEO_ENABLED
                                and total_facebook_videos < FACEBOOK_MAX_VIDEOS_PER_RUN
                            ):
                                facebook_video_id = publish_cinematic_video_to_facebook(
                                    payload,
                                    blog_json,
                                )
                                if facebook_video_id:
                                    total_facebook_videos += 1
                            elif not FACEBOOK_VIDEO_ENABLED:
                                print("   ℹ️ Cinematic Facebook video is disabled.")
                            elif FACEBOOK_MAX_VIDEOS_PER_RUN == 0:
                                print("   ℹ️ Cinematic Facebook video cap is 0; skipping video.")
                            elif total_facebook_videos >= FACEBOOK_MAX_VIDEOS_PER_RUN:
                                print(
                                    f"   ℹ️ Cinematic video cap reached "
                                    f"({FACEBOOK_MAX_VIDEOS_PER_RUN} this run)."
                                )
                        except Exception as blog_err:
                            print(f"   🛑 Database rejected blog insert. Check table columns! Error: {blog_err}")
                    else:
                        print(f"   ⚠️ Blog generation rejected: {blog_reason}")
                else:
                    print(f"   ❌ Blog generation failed across all AI tiers.")
                # ---------------------------------------------------------

            except Exception as e:
                err_str = str(e)
                if "23505" in err_str or "duplicate" in err_str.lower():
                    print(f"⏩ Skipped duplicate: {payload['title']}")
                    total_duplicates += 1
                else:
                    print(f"⚠️ DB Insert Notice for {payload['title']}: {err_str}")

        if idx < len(todays_targets):
            print("⏳ Pausing 5 seconds before next regional batch...")
            time.sleep(5)

    print(f"\n========================================================")
    print(
        f"📊 {day_name} Summary: {total_inserted} inserted, "
        f"{total_duplicates} duplicates, {total_rejected} rejected, "
        f"{total_blogs_created} blogs, "
        f"{total_facebook_posts} Facebook photo/link posts, "
        f"{total_facebook_videos} cinematic Facebook videos."
    )
    print(f"========================================================")
# ---------------------------------------------------------
    # AUTOMATED PRUNING (15 Days Past Deadline)
    # ---------------------------------------------------------
    print("\n🧹 Running database cleanup...")
    try:
        from datetime import timedelta
        threshold_date = (date.today() - timedelta(days=15)).strftime("%Y-%m-%d")
        
        # Deleting the parent opportunity will also delete the linked blog 
        # as long as your Supabase foreign key has "Cascade" enabled.
        prune_res = supabase.table("global_opportunities").delete().lt("deadline", threshold_date).execute()
        
        deleted_count = len(prune_res.data) if prune_res.data else 0
        print(f"✅ Pruned {deleted_count} expired opportunities (older than {threshold_date}).")
    except Exception as e:
        print(f"⚠️ Failed to prune old records: {e}")

    # Trigger Admin Notification
    send_line_notification(
        day_name=day_name,
        total=total_fetched,
        inserted=total_inserted,
        duplicates=total_duplicates,
        rejected=total_rejected,
        blogs_created=total_blogs_created,
        inserted_titles=all_inserted_titles
    )

    # Trigger Subscriber Alerts
    if run_line_matchmaker:
        print("\n📲 Running LINE Matchmaker...")
        run_line_matchmaker()
    if run_email_matchmaker:
        print("📧 Running Email Matchmaker...")
        run_email_matchmaker()

if __name__ == "__main__":
    run_agent()