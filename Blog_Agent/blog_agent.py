import os
import sys
import json
import time
import concurrent
import requests
import random
import urllib.request
from datetime import datetime, date
from urllib.parse import urlparse
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from ddgs import DDGS
from supabase import create_client, Client
from groq import Groq
from google import genai
from google.genai import types

# Import your sitemap generator
from generate_sitemap import create_sitemap

load_dotenv()

# Initialize Clients
supabase: Client = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
groq_client = Groq(api_key=os.getenv("VITE_GROQ_API_KEY"))
gemini_client = genai.Client(api_key=os.getenv("VITE_GEMINI_API_KEY"))

# Curated verified image pool to prevent broken 404 links
VERIFIED_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800"
]

# 7-Day Regional Schedule
SCHEDULED_REGIONS_BY_DAY = {
    0: ["Taiwan (MOE/NSTC)", "Japan (MEXT, JASSO)", "South Korea (GKS)"],
    1: ["Singapore (SINGA)", "China (CSC)", "Malaysia & Brunei"],
    2: ["Saudi Arabia (KAUST, KFUPM)", "UAE (MBZUAI)", "Qatar Scholarships"],
    3: ["Switzerland (ETH Zurich, Swiss Gov)", "Germany (DAAD)", "France (Eiffel)"],
    4: ["Finland (EDUFI)", "Sweden (SI Grants)", "Norway & Denmark"],
    5: ["United Kingdom (Chevening, Gates)", "United States (Fulbright)", "Canada"],
    6: ["Australia (RTP)", "New Zealand", "Erasmus Mundus Global Bodies"]
}

def get_regional_search_query(region: str) -> str:
    return f"fully funded scholarships and academic opportunities in {region} 2027"

def get_blog_prompt(opp_data):
    """Transforms raw structured opportunity data into a professional HTML blog post."""
    return f"""
    You are an elite academic career strategist and SEO content writer. 
    Turn the following verified scholarship details into a complete, engaging blog post.
    
    Return ONLY a strictly valid JSON object. Do not include markdown formatting like ```json.
    
    {{
        "title": "A catchy, SEO-friendly title based on: {opp_data.get('title')}",
        "slug": "url-friendly-lowercase-title-with-dashes",
        "excerpt": "A punchy 2-sentence summary for the blog grid.",
        "content": "Full blog post content in HTML. Use <h3> for sections (Eligibility, Benefits, Deadline), <ul> and <li> for lists, and <strong> for emphasis. Use single quotes for HTML attributes.",
        "tags": ["{opp_data.get('country')}", "{opp_data.get('type')}", "Fully Funded"],
        "read_time": "3 min read",
        "original_link": "{opp_data.get('url')}"
    }}
    
    OPPORTUNITY DATA:
    {json.dumps(opp_data)}
    """

def call_groq(prompt):
    res = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(res.choices[0].message.content)

def call_gemini(prompt):
    res = gemini_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(res.text)

def process_with_waterfall(prompt):
    models = [
        ("Groq", call_groq), 
        ("Gemini", call_gemini)
    ]
    
    for model_name, model_func in models:
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(model_func, prompt)
                return future.result(timeout=20)
        except Exception as e:
            # We are unmuting the error here to see exactly what is breaking
            print(f"   ⚠️ {model_name} failed: {e}")
            continue
            
    return None

def send_line_notification(day_name, published_titles):
    token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.getenv("LINE_USER_ID")
    if not token or not user_id:
        return
    
    count = len(published_titles)
    titles_str = "\n".join([f"✅ {t}" for t in published_titles]) if count > 0 else "No new posts today."
    message = f"🎉 *ScholarPortal Regional Dispatch*\n📅 {day_name} Batch\n\nPublished {count} new reports:\n\n{titles_str}"

    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    requests.post("https://api.line.me/v2/bot/message/push", headers=headers, json={"to": user_id, "messages": [{"type": "text", "text": message}]})

def ping_google_sitemap():
    try:
        urllib.request.urlopen("https://www.google.com/ping?sitemap=https://scholarportal.site/sitemap.xml")
        print("🌍 Google successfully notified of sitemap update.")
    except Exception as e:
        print(f"❌ Google ping failed: {e}")
if __name__ == "__main__":
    now = datetime.now()
    day_index = now.weekday()
    day_name = now.strftime("%A")
    regions = SCHEDULED_REGIONS_BY_DAY.get(day_index, [])

    print(f"🚀 Starting Regional Rotation for {day_name}...")
    successfully_published = []

    for region in regions:
        query = get_regional_search_query(region)
        print(f"\n🔍 Searching: {query}")
        
        try:
            # 1. Search DDGS
            results = list(DDGS().text(query, max_results=3))
            urls = [res['href'] for res in results]
            print(f"   🔗 Found {len(urls)} links.")
        except Exception as e:
            print(f"   ❌ Search failed: {e}")
            urls = []

        for url in urls:
            try:
                print(f"   🕵️ Scraping: {url}")
                response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
                
                if response.status_code != 200:
                    print(f"   ⚠️ Website blocked scraper (Status: {response.status_code})")
                    continue
                    
                soup = BeautifulSoup(response.text, 'html.parser')
                raw_text = soup.get_text(separator='\n', strip=True)[:6000]
                
                # 2. Strict Parse Prompt
                parse_prompt = f"""
                Extract the main scholarship from the text below. 
                Return ONLY a valid JSON object. Do not include markdown or explanations.
                {{
                    "title": "Scholarship Name",
                    "organization": "University or Sponsor",
                    "type": "Master/PhD",
                    "country": "{region.split(' ')[0]}",
                    "field": "Academic Field",
                    "deadline": "YYYY-MM-DD",
                    "description": "Short summary of eligibility and benefits."
                }}
                TEXT:
                {raw_text}
                """
                
                print("   🧠 Extracting data with AI...")
                opp_json = process_with_waterfall(parse_prompt)
                
                if opp_json and isinstance(opp_json, dict) and "title" in opp_json:
                    opp_json['url'] = url
                    
                    print("   ✍️ Writing SEO Blog Post...")
                    blog_prompt = get_blog_prompt(opp_json)
                    blog_data = process_with_waterfall(blog_prompt)
                    
                    if blog_data:
                        blog_data['image'] = random.choice(VERIFIED_IMAGES)
                        supabase.table('blog_posts').insert(blog_data).execute()
                        print(f"   💾 Published: {blog_data.get('title')}")
                        successfully_published.append(blog_data.get('title'))
                else:
                    print("   ❌ AI could not find a valid scholarship on this page.")
            except Exception as err:
                print(f"   ⚠️ Error processing URL: {err}")
        
        # 3. Rate Limit Protection
        print("   ⏳ Sleeping for 5 seconds to prevent search blocking...")
        time.sleep(5)

    # Finalize execution
    print("\n🏁 Pipeline complete. Sending alerts...")
    send_line_notification(day_name, successfully_published)
    if len(successfully_published) > 0:
        create_sitemap()
        ping_google_sitemap()
 