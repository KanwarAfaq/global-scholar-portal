import os
import json
import random
import requests
import concurrent.futures
from bs4 import BeautifulSoup
from ddgs import DDGS
from dotenv import load_dotenv

# Database & AI SDKs
from supabase import create_client, Client
from groq import Groq
from google import genai
from google.genai import types

load_dotenv()

# --- INITIALIZATION ---
supabase: Client = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
groq_client = Groq(api_key=os.getenv("VITE_GROQ_API_KEY"))
gemini_client = genai.Client(api_key=os.getenv("VITE_GEMINI_API_KEY"))

CURATED_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800", # Campus students
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800", # University building
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=800", # Library study
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800", # Graduation cap
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800", # Collaborative study
]

def get_verified_image():
    """Returns a random valid academic photo URL."""
    return random.choice(CURATED_IMAGES)

# --- 1. DYNAMIC SEARCH ---
def get_dynamic_urls(query, max_results=10):
    """Searches DuckDuckGo and returns the top URLs."""
    print(f"🔍 Searching the web for: '{query}'")
    try:
        # DDGS provides an efficient way to programmatically search DuckDuckGo
        results = DDGS().text(query, max_results=max_results) 
        return [res['href'] for res in results]
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return []

# --- 2. WEBSCRAPER ---
def scrape_website(url):
    print(f"🕵️ Scraping: {url}")
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        # Limiting to 8000 characters to fit context windows comfortably
        return soup.get_text(separator='\n', strip=True)[:8000]
    except Exception as e:
        print(f"❌ Scrape failed for {url}: {e}")
        return None

# --- 3. THE PROMPT ---
def get_prompt(raw_text, source_url):
    """A highly precise, academic-focused prompt."""
    return f"""
    You are an elite academic career strategist and SEO content writer. 
    Extract the key scholarship, grant, or academic opportunity details from the provided text.
    
    Return ONLY a strictly valid JSON object with the following structure. Do not include markdown formatting like ```json.
    
    {{
        "title": "A clear, SEO-friendly title (e.g., 'Fully Funded 2027 Global Scholarship')",
        "slug": "url-friendly-lowercase-title",
        "excerpt": "A punchy, engaging 2-sentence summary.",
        "content": "The full blog post content formatted in HTML. Use <h3> for sections (like Eligibility, Benefits, Deadline), <ul> and <li> for lists, and <strong> for emphasis. Use single quotes for HTML attributes.",
        "image": "[https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800](https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800)",
        "tags": ["Scholarship", "Fully Funded", "2027"],
        "read_time": "3 min read",
        "original_link": "{source_url}"
    }}
    
    TEXT TO PROCESS:
    {raw_text}
    """

# --- 4. THE AI WATERFALL ---
def call_groq(prompt):
    print("   ⚡ Trying Groq (Llama-3)...")
    res = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b", 
        messages=[{"role": "user", "content": prompt}], 
        response_format={"type": "json_object"}
    )
    return json.loads(res.choices[0].message.content)

def call_gemini(prompt):
    print("   🧠 Trying Gemini (2.5 Flash)...")
    res = gemini_client.models.generate_content(
        model='gemini-2.5-flash', 
        contents=prompt, 
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(res.text)

def process_with_waterfall(prompt):
    """Executes the waterfall with a 20-second timeout per model."""
    models = [call_groq, call_gemini]
    
    for model_func in models:
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(model_func, prompt)
                return future.result(timeout=20) 
        except concurrent.futures.TimeoutError:
            print("   ⏳ Timeout reached. Moving to fallback model...")
        except Exception as e:
            print(f"   ❌ Model failed: {e}. Moving to fallback model...")
            
    print("🚨 All models in the waterfall failed or timed out.")
    return None

# --- 5. ADMIN LINE NOTIFICATION ---
def send_line_notification(published_titles):
    """Sends a beautiful admin summary to your LINE application."""
    token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.getenv("LINE_USER_ID")  # Ensure you have the correct user ID for notifications
    
    if not token or not user_id:
        print("⚠️ LINE credentials missing. Skipping notification.")
        return

    success_count = len(published_titles)
    if success_count == 0:
        message = "🤖 *Scholar Portal Agent*\n\nRun completed, but no new opportunities were successfully published today."
    else:
        titles_str = "\n".join([f"✅ {t}" for t in published_titles])
        message = f"🎉 *Scholar Portal Update*\n\nSuccessfully scraped and published {success_count} new opportunities!\n\n{titles_str}\n\n🌐 Check your dashboard to view them."

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    payload = {
        "to": user_id,
        "messages": [{"type": "text", "text": message}]
    }
    
    try:
        requests.post("https://api.line.me/v2/bot/message/push", headers=headers, json=payload)
        print("📱 LINE notification sent successfully!")
    except Exception as e:
        print(f"❌ Failed to send LINE message: {e}")

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    search_query = "latest fully funded international scholarships 2027"
    
    # Grab the top 10 URLs dynamically
    target_urls = get_dynamic_urls(search_query, max_results=10)
    successfully_published = []
    
    for url in target_urls:
        raw_text = scrape_website(url)
        if raw_text:
            prompt = get_prompt(raw_text, url)
            blog_data = process_with_waterfall(prompt)
            
            if blog_data:
                try:
                    blog_data['image'] = get_verified_image()
                    # Save to database
                    supabase.table('blog_posts').insert(blog_data).execute()
                    print(f"💾 Saved '{blog_data.get('title')}' to Supabase!")
                    successfully_published.append(blog_data.get('title'))
                except Exception as e:
                    # Catch duplicate slugs or database restrictions
                    print(f"❌ Database insert error: {e}")
                    
    print(f"\n🎉 Pipeline Complete! {len(successfully_published)} new posts published.")
    
    # Trigger the LINE Webhook
    send_line_notification(successfully_published)