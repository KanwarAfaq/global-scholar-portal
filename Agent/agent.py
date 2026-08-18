import os
import sys
import json
import time
import requests
from datetime import datetime
from dotenv import load_dotenv

# Import the new, supported Google GenAI SDK
from google import genai
from google.genai import types

from supabase import create_client, Client

# 1. Load environment variables
load_dotenv()

supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY")
gemini_key = os.environ.get("VITE_GEMINI_API_KEY")

if not supabase_url or not supabase_key or not gemini_key:
    print("❌ ERROR: Missing environment variables!")
    sys.exit(1)

# 2. Initialize Clients
supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client(api_key=gemini_key)

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
    You are an elite academic and career data extraction agent. Perform a comprehensive GLOBAL search of the live internet to extract exactly 30 highly credible, actively open opportunities.

    Your search MUST include a diverse mix of the following categories:
    - Fully Funded PhD, Master's, and Bachelor's Scholarships
    - Postdoctoral Fellowships
    - Short-term Academic Exchange Programs
    - Immersive Language Courses
    - High-value Internships

    Ensure extreme geographical diversity (spanning North America, Europe, Oceania, and Asia, including locations like Taiwan) and disciplinary diversity (STEM, Humanities, Arts, Social Sciences, and Business). You must prioritize highly authentic sources like official university portals, government scholarship boards, and verified institutional sites.

    You MUST extract data for EVERY SINGLE key listed below. Output STRICTLY as a valid JSON array of objects. Do not truncate the response. No markdown formatting. Keep descriptions highly concise to ensure the full 30-item JSON array generates successfully.
    
    Structure:
    [
        {
          "title": "Exact title (e.g., 'Fully Funded PhD in Robotics', 'Intensive Mandarin Language Course', 'Undergraduate Summer Internship')",
          "organization": "University, Government Body, or Company name",
          "country": "Specific country, e.g., UK, Taiwan, Australia, Japan, or Remote",
          "type": "Choose strictly one: Scholarship, Fellowship, Job, Internship, Short Program, Language Course",
          "funding_details": "Extract exact funding (e.g., 'Full tuition + $2000/mo stipend'). If none, write 'Not specified'",
          "description": "A concise 1-to-2 sentence summary detailing the core program focus and basic eligibility.",
          "tags": ["Extract 3-5 relevant fields as an array of strings, e.g., 'Machine Learning', 'Linguistics', 'Public Health'"],
          "deadline": "Format as YYYY-MM-DD or write 'Rolling' if no exact date is found",
          "url": "The exact, direct URL to the official application page",
          "source_url": "The link where you verified this posting"
        }
    ]
    """

    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Create a Chat Session and enable Google Search
            chat = gemini_client.chats.create(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )
            
            # Send the message
            response = chat.send_message(prompt)
            
            # Sanitize AI Output
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:]
                
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
                
            opportunities = json.loads(raw_text.strip())
            print(f"🧠 AI found and formatted {len(opportunities)} opportunities.")

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
                    "type": opp.get("type", "Job"),
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
            
            # If everything succeeded, break out of the retry loop
            break

        except json.JSONDecodeError:
            print("🛑 Agent execution failed: AI did not return valid JSON. Retrying...")
            print(f"Raw Output: {response.text}")
        except Exception as e:
            error_msg = str(e)
            if '503' in error_msg or 'UNAVAILABLE' in error_msg:
                print(f"⚠️ Google API is busy (503). Retrying in 10 seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(10)
            else:
                print(f"🛑 Agent execution failed: {e}")
                break

if __name__ == "__main__":
    run_agent()