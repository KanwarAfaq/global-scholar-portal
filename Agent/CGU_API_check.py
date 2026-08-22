import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_cgu_key(api_key):
    # Using the exact Base URL from your screenshot
    url = "https://air.cgu.edu.tw/cgullmapi/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("\n✅ CGU API Key: VALID")
            
            models_data = response.json().get("data", [])
            print("🔍 Live Models Available on CGU Gateway:")
            for model in sorted([m["id"] for m in models_data]):
                print(f"   - {model}")
        else:
            print(f"\n❌ CGU API Key: INVALID (Status {response.status_code})")
    except Exception as e:
        print(f"\n❌ CGU Connection Error: {e}")

if __name__ == "__main__":
    cgu_key = os.getenv("CGU_API_KEY") or os.getenv("CGU_API_KEY")
    if cgu_key:
        test_cgu_key(cgu_key.strip())
    else:
        print("⚠️ CGU Key not found in .env")