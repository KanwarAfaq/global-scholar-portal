import os
import sys
import json
import time
import requests
from datetime import datetime
from dotenv import load_dotenv

# SDK Imports
from google import genai
from google.genai import types
from groq import Groq
from supabase import create_client, Client

# 1. Load environment variables
load_dotenv()

supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY")
gemini_key = os.environ.get("VITE_GEMINI_API_KEY")
groq_key = os.environ.get("VITE_GROQ_API_KEY") # NEW: Groq Key

if not supabase_url or not supabase_key or not gemini_key:
    print("❌ ERROR: Missing core environment variables!")
    sys.exit(1)

# 2. Initialize Clients
supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client(api_key=gemini_key)
# Initialize Groq conditionally so it doesn't crash if the key is missing
groq_client = Groq(api_key=groq_key) if groq_key else None

def send_line_notification(added_count):
    """Sends a push notification to your LINE account."""
    line_token = os.environ.get('LINE_ACCESS_TOKEN')
    line_user = os.environ.get('LINE_USER_ID')
    
    if not line_token or not line_user:
        print("⚠️ LINE credentials missing in .env, skipping notification.")
        return

    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {line_token}"
    }
    payload = {
        "to": line_user,
        "messages": [{
            "type": "text",
            "text": f"🤖 Copilot Agent Update\n\nI successfully scraped, verified, and inserted {added_count} new opportunities into your database."
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print("📱 LINE notification sent.")
    except Exception as e:
        print(f"❌ Failed to send LINE notification: {e}")

def run_agent():
    print(f"\n🚀 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Waking up agent... Searching the live web...")
    
    prompt = """
You are an elite academic and career opportunity curator. Your task is to analyze web data and extract high-value, fully-funded global opportunities into a strictly formatted JSON array.

CRITICAL INSTRUCTIONS FOR DATA STANDARDIZATION:
1. 'type' (Level): You MUST categorize the opportunity into exactly ONE of these specific strings: "PhD", "Master", "MPhil", "Bachelor", "Internship", "Course", or "Scholarship". Do not use any other variations.
2. 'country': Provide the standard short-form country name (e.g., "USA", "UK", "Canada", "Australia", "Taiwan", "Germany"). If it is a remote or worldwide opportunity, output exactly "Global".
3. 'deadline': Format precisely as "YYYY-MM-DD". If the exact day is unknown, use "YYYY-MM-XX". If the opportunity accepts applications year-round, output exactly "Rolling".
4. 'field': Provide the broad academic or professional discipline. Use standardized names (e.g., "Computer Science", "Artificial Intelligence", "Mathematics", "Chemistry", "Public Health", "Multidisciplinary").

JSON SCHEMA PER OPPORTUNITY:
{
  "title": "Full official name of the opportunity",
  "organization": "University, Company, or Government Body",
  "type": "MUST BE EXACTLY ONE OF: PhD, Master, MPhil, Bachelor, Internship, Course, Scholarship",
  "country": "Standardized Country Name or Global",
  "field": "Primary discipline (e.g., Computer Science, Engineering, Humanities)",
  "funding_details": "Concise, specific summary of stipend, tuition coverage, or salary (max 10 words)",
  "deadline": "YYYY-MM-DD or Rolling",
  "description": "2-3 sentences explaining the core focus, who it is for, and key requirements.",
  "tags": ["TargetDomain", "Skill1", "Skill2"], // Maximum 5 relevant tags
  "url": "Valid application or official information link"
}

Extract the top 30 most relevant opportunities. 
Return ONLY valid JSON. Start with [ and end with ]. Do not include markdown formatting or conversational text.
"""

    max_retries = 3
    raw_text = None

    for attempt in range(max_retries):
        try:
            print(f"🧠 Attempting data extraction with Gemini (Attempt {attempt + 1})...")
            # Create a Chat Session and enable Google Search
            chat = gemini_client.chats.create(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )
            response = chat.send_message(prompt)
            raw_text = response.text.strip()
            print("✅ Success with Gemini!")
            break # Break out of loop on success

        except Exception as gemini_error:
            error_msg = str(gemini_error)
            print(f"⚠️ Gemini failed or is busy: {error_msg}")
            
            # Initiate Groq Fallback
            if groq_client:
                print("🔄 Initiating fallback to Groq Llama 3...")
                try:
                    chat_completion = groq_client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": prompt},
                            {"role": "user", "content": "Extract the top 30 live global opportunities for this month based on the system schema."}
                        ],
                        model="llama3-70b-8192", 
                        temperature=0.2,
                    )
                    raw_text = chat_completion.choices[0].message.content.strip()
                    print("✅ Success with Groq!")
                    break # Break out of loop on Groq success
                except Exception as groq_error:
                    print(f"❌ Groq fallback also failed: {groq_error}")

            # If both fail (or if Groq isn't configured), apply Exponential Backoff
            wait_time = 10 * (2 ** attempt) # 10s, 20s, 40s
            print(f"⏳ Waiting {wait_time} seconds before next retry cycle...")
            time.sleep(wait_time)
            
    if not raw_text:
        print("🛑 Agent execution completely failed after all retries and fallbacks.")
        sys.exit(1)

    # Sanitize AI Output
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
        
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]

    try:
        opportunities = json.loads(raw_text.strip())
        print(f"🧩 JSON parsed successfully. Processing {len(opportunities)} opportunities...")
    except json.JSONDecodeError:
        print("🛑 Agent execution failed: AI did not return valid JSON.")
        print(f"Raw Output: {raw_text}")
        sys.exit(1)

    successful_inserts = 0

    # Save to Supabase matching your exact column names
    for opp in opportunities:
        if not opp.get("title") or not opp.get("organization") or not opp.get("url"):
            print(f"⚠️ Skipped invalid opportunity (missing core columns): {opp.get('title')}")
            continue

        payload = {
            "title": opp.get("title"),
            "organization": opp.get("organization"),
            "country": opp.get("country", "Global"),
            "type": opp.get("type", "Scholarship"),
            "field": opp.get("field", "Multidisciplinary"), # NEW: Crucial fix for your dashboard tags
            "funding_details": opp.get("funding_details", "Not specified"),
            "description": opp.get("description", "No description provided."),
            "tags": opp.get("tags", []), 
            "deadline": opp.get("deadline", "Not specified"),
            "url": opp.get("url"),
            "source_url": opp.get("source_url") or opp.get("url")
        }

        try:
            supabase.table("global_opportunities").insert(payload).execute()
            print(f"✅ Inserted: {payload['title']}")
            successful_inserts += 1
            
        except Exception as e:
            error_msg = str(e)
            if '23505' in error_msg or 'duplicate' in error_msg.lower():
                print(f"⚠️ Skipped duplicate: {payload['title']} at {payload['organization']}")
            else:
                print(f"❌ DB Insert Error for {payload['title']}: {error_msg}")

    # Notify the Admin
    if successful_inserts > 0:
        send_line_notification(successful_inserts)
    else:
        print("🤷‍♂️ No new unique opportunities to add this cycle.")

if __name__ == "__main__":
    run_agent()