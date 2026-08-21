import os
import requests
from dotenv import load_dotenv

# Load the environment variables from the .env file
load_dotenv()

def test_openai_key(api_key):
    url = "https://api.openai.com/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("\n✅ OpenAI API Key: VALID")
            print("🔍 Live Models Fetched from API (Showing 'gpt' models):")
            
            # Parse the JSON response
            models_data = response.json().get("data", [])
            
            # Filter and sort the models dynamically
            gpt_models = sorted([model["id"] for model in models_data if "gpt" in model["id"]])
            
            for model_id in gpt_models:
                print(f"   - {model_id}")
        else:
            print(f"\n❌ OpenAI API Key: INVALID (Status Code: {response.status_code})")
    except Exception as e:
        print(f"\n❌ OpenAI Connection Error: {e}")

def test_groq_key(api_key):
    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("\n✅ Groq API Key: VALID")
            print("🔍 Live Models Fetched from API:")
            
            # Parse the JSON response
            models_data = response.json().get("data", [])
            
            # Print all available Groq models dynamically
            for model in sorted([m["id"] for m in models_data]):
                print(f"   - {model}")
        else:
            print(f"\n❌ Groq API Key: INVALID (Status Code: {response.status_code})")
    except Exception as e:
        print(f"\n❌ Groq Connection Error: {e}")

def test_gemini_key(api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print("\n✅ Gemini API Key: VALID")
            print("🔍 Live Models Fetched from API:")
            
            # Parse the JSON response
            models_data = response.json().get("models", [])
            
            # Gemini returns models with a "name" field (e.g., "models/gemini-1.5-flash")
            for model in models_data:
                model_name = model.get("name", "").replace("models/", "")
                print(f"   - {model_name}")
        else:
            print(f"\n❌ Gemini API Key: INVALID (Status Code: {response.status_code})")
    except Exception as e:
        print(f"\n❌ Gemini Connection Error: {e}")

if __name__ == "__main__":
    print("-" * 40)
    print(" DYNAMIC API KEY TESTER & MODEL FETCHER ")
    print("-" * 40)
    
    # Fetching keys directly from the .env file
    openai_key = os.getenv("VITE_OPENAI_API_KEY")
    groq_key = os.getenv("VITE_GROQ_API_KEY")
    gemini_key = os.getenv("VITE_GEMINI_API_KEY")

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
        
    print("\n" + "-" * 40)
    print("Testing Complete.")