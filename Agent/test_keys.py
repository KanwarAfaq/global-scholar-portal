import os
import requests
from dotenv import load_dotenv

# Load the environment variables from the .env file
load_dotenv()

def analyze_tier_from_headers(headers, provider):
    """Dynamically reads the live server headers to determine billing tier limitations."""
    print("   [Live Server Billing/Rate Limit Data]")
    
    # Standard rate limit headers used by OpenAI and Groq
    req_limit = headers.get("x-ratelimit-limit-requests")
    tok_limit = headers.get("x-ratelimit-limit-tokens")
    
    if req_limit:
        print(f"   -> Max Requests allowed: {req_limit} per minute/day")
    if tok_limit:
        print(f"   -> Max Tokens allowed: {tok_limit} per minute/day")
        
    if provider == "OpenAI" and req_limit:
        # OpenAI restricts free/Tier 0 users to very low requests (usually 200/day or 3/min)
        if int(req_limit) <= 500:
            print("   -> 🛑 STATUS: Free Tier / Tier 0 (No active billing detected). Strict limits apply.")
        else:
            print("   -> 🟢 STATUS: Paid/Funded Tier. High capacity unlocked.")
            
    elif provider == "Groq" and req_limit:
        print("   -> 🟢 STATUS: Groq Beta/Free Tier is active and highly generous.")

def test_openai_key(api_key):
    url = "https://api.openai.com/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("\n✅ OpenAI API Key: VALID")
            analyze_tier_from_headers(response.headers, "OpenAI")
            
            # Dynamically parse models
            models_data = response.json().get("data", [])
            gpt_models = [m["id"] for m in models_data if "gpt" in m["id"]]
            
            print("\n   [Dynamic Model Recommendation]")
            if "gpt-4o-mini" in gpt_models:
                print("   -> Best for Free/Fast Tasks: 'gpt-4o-mini' (Found on live server)")
            if "gpt-4o" in gpt_models:
                print("   -> Best for Complex Tasks: 'gpt-4o' (Found on live server)")
            elif len(gpt_models) > 0:
                print(f"   -> Best available fallback: '{gpt_models[0]}'")
                
        else:
            print(f"\n❌ OpenAI API Key: INVALID (Status {response.status_code})")
    except Exception as e:
        print(f"\n❌ OpenAI Connection Error: {e}")

def test_groq_key(api_key):
    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("\n✅ Groq API Key: VALID")
            analyze_tier_from_headers(response.headers, "Groq")
            
            # Dynamically parse models
            models_data = response.json().get("data", [])
            all_models = [m["id"] for m in models_data]
            
            # Algorithmic selection from live data
            versatile = [m for m in all_models if "versatile" in m or "70b" in m]
            fast = [m for m in all_models if "instant" in m or "8b" in m]
            
            print("\n   [Dynamic Model Recommendation]")
            if versatile:
                print(f"   -> Most Capable Model Available: '{versatile[0]}'")
            if fast:
                print(f"   -> Fastest Model Available: '{fast[0]}'")
            if not versatile and not fast and all_models:
                print(f"   -> Top Available Fallback: '{all_models[0]}'")
                
        else:
            print(f"\n❌ Groq API Key: INVALID (Status {response.status_code})")
    except Exception as e:
        print(f"\n❌ Groq Connection Error: {e}")

def test_gemini_key(api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print("\n✅ Gemini API Key: VALID")
            
            # Gemini rate limits on the models endpoint aren't always explicit in headers,
            # but getting a 200 OK means the key is active.
            print("   [Live Server Billing/Rate Limit Data]")
            print("   -> 🟢 STATUS: Key is active. (Google offers 15 requests/min for free on Flash models)")
            
            # Dynamically parse models
            models_data = response.json().get("models", [])
            all_models = [m.get("name", "").replace("models/", "") for m in models_data]
            
            # Algorithmic selection for the latest 'flash' and 'pro' models
            flash_models = sorted([m for m in all_models if "flash" in m and "preview" not in m], reverse=True)
            pro_models = sorted([m for m in all_models if "pro" in m and "preview" not in m], reverse=True)
            
            print("\n   [Dynamic Model Recommendation]")
            if flash_models:
                print(f"   -> Best Free/Fast Model: '{flash_models[0]}' (Dynamically selected latest version)")
            if pro_models:
                print(f"   -> Best Advanced Model: '{pro_models[0]}'")
                
        else:
            print(f"\n❌ Gemini API Key: INVALID (Status {response.status_code})")
    except Exception as e:
        print(f"\n❌ Gemini Connection Error: {e}")

if __name__ == "__main__":
    print("-" * 60)
    print(" LIVE API ANALYZER & DYNAMIC MODEL SELECTOR")
    print("-" * 60)
    
    # Fetching keys directly from the .env file
    openai_key = os.getenv("VITE_OPENAI_API_KEY3") or os.getenv("OPENAI_API_KEY")
    groq_key = os.getenv("VITE_GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
    gemini_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")

    if openai_key:
        test_openai_key(openai_key.strip())
    else:
        print("\n⚠️ OpenAI Key not found in .env")

    if groq_key:
        test_groq_key(groq_key.strip())
    else:
        print("\n⚠️ Groq Key not found in .env")

    if gemini_key:
        test_gemini_key(gemini_key.strip())
    else:
        print("\n⚠️ Gemini Key not found in .env")
        
    print("\n" + "-" * 60)