import os
import sys
import json
import time
import requests
from dotenv import load_dotenv
import re
from datetime import datetime, date
from urllib.parse import urlparse

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

# 1. Load environment variables
load_dotenv()

supabase_url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
cgu_key = os.environ.get("VITE_CGU_API_KEY") or os.environ.get("CGU_API_KEY")
groq_key = os.environ.get("VITE_GROQ_API_KEY") or os.environ.get("GROQ_API_KEY")
gemini_key = os.environ.get("VITE_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")

if not supabase_url or not supabase_key:
    print("❌ ERROR: Missing Supabase environment variables!")
    sys.exit(1)

# 2. Initialize Clients
supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client(api_key=gemini_key) if gemini_key else None
groq_client = Groq(api_key=groq_key) if groq_key else None

ALLOWED_TYPES = {
    "Bachelor", "Master", "PhD", "MPhil", "Fellowship",
    "Internship", "Course", "Workshop", "Scholarship"
}

# ---------------------------------------------------------
# 7-DAY SCHEDULED REGIONS (High-Stipend Global Rotation)
# ---------------------------------------------------------
SCHEDULED_REGIONS_BY_DAY = {
    # Monday: East Asia Hubs
    0: [
        "Taiwan (MOE/NSTC, TIGP) and Macau (Macao SAR Fellowships)",
        "Japan (MEXT, JASSO, ADB-JSP) and South Korea (GKS/KGSP, POSCO)",
        "Hong Kong (HKPFS PhD Fellowships, University Grants)"
    ],
    # Tuesday: Asia-Pacific & High-Income Southeast Asia
    1: [
        "Singapore (SINGA, A*STAR, NUS/NTU Research Scholarships)",
        "China (CSC Chinese Government Scholarships, Silk Road, Schwarzman)",
        "Malaysia (MIS / MTCP) and Brunei Darussalam (BDGS Government Scholarship)"
    ],
    # Wednesday: Gulf & High-Stipend Middle East Hubs
    2: [
        "Saudi Arabia (KAUST Full Fellowships, KFUPM, KAU)",
        "United Arab Emirates (MBZUAI AI Fellowships, Khalifa University)",
        "Qatar (HBKU Scholarships, Qatar University Graduate Fellowships)"
    ],
    # Thursday: Western & Central European Excellence Hubs
    3: [
        "Switzerland (ETH Zurich, EPFL, Swiss Government Excellence Scholarships)",
        "Germany (DAAD, Heinrich Böll, Konrad Adenauer, Max Planck Fellowships)",
        "Austria (Ernst Mach), Luxembourg (Gov/Uni Scholarships), and France (Eiffel Excellence)"
    ],
    # Friday: Nordic & Southern European Funded Systems
    4: [
        "Finland (EDUFI, University Waivers) and Sweden (Swedish Institute SI Grants)",
        "Norway and Denmark (Government Full Tuition & Salaried PhD Positions)",
        "Spain (Carolina Foundation, Severo Ochoa) and Portugal (FCT PhD Fellowships)"
    ],
    # Saturday: UK, Ireland & North America
    5: [
        "United Kingdom (Chevening, Commonwealth, Gates Cambridge, Rhodes) and Ireland (GOI-IES)",
        "United States (Fulbright, NSF, High-Stipend Graduate Teaching/Research Assistantships)",
        "Canada (Vanier CGS, McCall MacBain, Banting Fellowships, Trudeu)"
    ],
    # Sunday: Oceania, Central/Eastern Europe & Global Bodies
    6: [
        "Australia (Research Training Program RTP, Australia Awards) and New Zealand (Manaaki)",
        "Hungary (Stipendium Hungaricum), Poland (NAWA Banach/Ulam), and Czech Republic (Government Grants)",
        "Global & International Bodies (Erasmus Mundus, UNESCO, World Bank, Rotary Peace)"
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
5. 'deadline': Must be strictly in "YYYY-MM-DD" format. If rolling/ongoing, output "Rolling". Do NOT include expired opportunities.
6. 'description': Detailed summary outlining the research area, eligibility criteria (who it is suitable for), and specific required documents (e.g., "Requires IELTS/TOEFL, CV, and a research proposal.").
7. 'tags': Array of 3-5 keywords for database filtering (e.g., ["Fully Funded", "AI", "IELTS Required"]).
8. 'url': Direct application or official website URL strictly starting with http or https.

OUTPUT REQUIREMENT:
Return ONLY a valid JSON object with a single key "scholarships" containing an array of the extracted data.
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

    # URL Validation
    raw_url = (opp.get("url") or "").strip()
    parsed = urlparse(raw_url)
    if not (parsed.scheme in ("http", "https") and bool(parsed.netloc)):
        return False, f"Invalid URL structure: '{raw_url}'"
    if "example.com" in raw_url or raw_url.endswith("#"):
        return False, f"Placeholder URL detected: '{raw_url}'"

    # Degree / Type Validation
    opp_type = (opp.get("type") or "").strip()
    if opp_type not in ALLOWED_TYPES:
        return False, f"Invalid type '{opp_type}'. Must be one of {ALLOWED_TYPES}"

    # Country & Field Validation
    country = (opp.get("country") or "").strip()
    if not country:
        return False, "Missing country field"

    field = (opp.get("field") or "").strip()
    if not field:
        return False, "Missing academic field/discipline"

    # Deadline & Expiration Validation
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

    # Description Quality Check
    desc = (opp.get("description") or "").strip()
    if len(desc) < 20:
        return False, f"Description incomplete or too short ({len(desc)} chars)"

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
        raise ValueError("CGU API key not configured.")

    try:
        print("🟢 [CGU Tier 1A] Attempting o3-deep-research...")
        return call_cgu_endpoint("o3-deep-research", prompt, timeout=90)
    except Exception as e1:
        print(f"   ⚠️ CGU o3-deep-research failed: {e1}")

    try:
        print("🟢 [CGU Tier 1B] Falling back to gpt-4o...")
        return call_cgu_endpoint("gpt-4o", prompt, timeout=45)
    except Exception as e2:
        print(f"   ⚠️ CGU gpt-4o failed: {e2}")

    try:
        print("🟢 [CGU Tier 1C] Falling back to CGU Local Model (gpt-oss:20b)...")
        return call_cgu_endpoint("gpt-oss:20b", prompt, timeout=60)
    except Exception as e3:
        print(f"   ⚠️ CGU Local Model failed: {e3}")
        raise RuntimeError("All internal CGU models failed.")

# ---------------------------------------------------------
# EXTERNAL FALLBACK TIERS (Groq & Gemini)
# ---------------------------------------------------------
def extract_with_groq(prompt: str) -> str:
    """Tier 2: Groq Fast Fallback"""
    if not groq_key:
        raise ValueError("Groq API key not configured.")
    
    print("🟡 [Tier 2] Attempting Groq AI...")
    model_name = "openai/gpt-oss-120b"
    
    if groq_client:
        completion = groq_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a factual data parser. Output ONLY a valid JSON object. Do not include any explanations or markdown."},
                {"role": "user", "content": prompt}
            ],
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
            "temperature": 0.1
        }
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]

def extract_with_gemini(prompt: str) -> str:
    """Tier 3: Gemini Search-Grounded Fallback"""
    if not gemini_client:
        raise ValueError("Gemini API key not configured.")
    
    print("🟠 [Tier 3] Attempting Gemini with Live Google Search...")
    chat = gemini_client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
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
                print(f"   ⚠️ Gemini server busy (503). Retrying in 5 seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(5)
            else:
                raise e

# ---------------------------------------------------------
# ADMIN NOTIFICATION
# ---------------------------------------------------------
def send_line_notification(day_name, total, inserted, duplicates, rejected, inserted_titles):
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
    msg_text = f"🤖 ScholarPortal Daily Dispatch\n📅 {day_name} Batch ({current_time})\n\n"
    msg_text += f"📊 Scrape Summary:\n"
    msg_text += f"• 📥 Total Fetched: {total}\n"
    msg_text += f"• ✅ New Added: {inserted}\n"
    msg_text += f"• ⏩ Duplicates: {duplicates}\n"
    msg_text += f"• ❌ Rejected (Quality): {rejected}\n"
    
    if inserted > 0 and inserted_titles:
        msg_text += "\n✨ New Opportunities Added:\n"
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
    all_inserted_titles = []

    for idx, region in enumerate(todays_targets, start=1):
        print(f"\n========================================================")
        print(f"🌍 [{idx}/{len(todays_targets)}] Sweeping Region: {region}")
        print(f"========================================================")

        prompt = get_extraction_prompt(region)
        raw_text = None

        # Execute Waterfall: CGU (Internal 3-tier) -> Groq -> Gemini
        try:
            raw_text = extract_with_cgu(prompt)
            print("✅ CGU Gateway Succeeded!")
        except Exception as err1:
            print(f"⚠️ CGU Gateway Failed: {err1}")
            try:
                raw_text = extract_with_groq(prompt)
                print("✅ Groq Succeeded!")
            except Exception as err2:
                print(f"⚠️ Groq Failed: {err2}")
                try:
                    raw_text = extract_with_gemini(prompt)
                    print("✅ Gemini Succeeded!")
                except Exception as err3:
                    print(f"❌ All AI tiers failed for region '{region}': {err3}")
                    continue

        # Sanitize and Parse JSON
        cleaned_json = clean_json_response(raw_text)
        try:
            opportunities = json.loads(cleaned_json)
            if isinstance(opportunities, dict) and "scholarships" in opportunities:
                opportunities = opportunities["scholarships"]
            print(f"🧩 Decoded {len(opportunities)} raw items for {region}.")
            total_fetched += len(opportunities)
        except Exception as e:
            print(f"🛑 JSON parsing error for {region}: {e}")
            continue

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
                supabase.table("global_opportunities").insert(payload).execute()
                print(f"✅ Verified & Inserted: {payload['title']} ({payload['country']})")
                total_inserted += 1
                all_inserted_titles.append(f"{payload['title']} ({payload['country']})")
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
    print(f"📊 {day_name} Summary: {total_inserted} inserted, {total_duplicates} duplicates, {total_rejected} rejected.")
    print(f"========================================================")

    # Trigger Admin Notification
    send_line_notification(
        day_name=day_name,
        total=total_fetched,
        inserted=total_inserted,
        duplicates=total_duplicates,
        rejected=total_rejected,
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