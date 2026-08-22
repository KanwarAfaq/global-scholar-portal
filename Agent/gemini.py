import os
from google import genai
from google.genai.errors import APIError
from dotenv import load_dotenv # 1. Import dotenv

# 2. Load the .env file into memory BEFORE trying to fetch variables
load_dotenv()

def check_gemini_api():
    # 3. Now os.getenv will successfully find the keys in your .env file
    api_key = os.getenv("VITE_GEMINI_API_KEY2") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        print("❌ Error: Gemini API Key not found in environment variables.")
        print("Please set it via: export VITE_GEMINI_API_KEY='your_key_here'")
        return

    print(True, f"🔑 API Key detected (Truncated): {api_key[:6]}...{api_key[-4:]}")

    try:
        # Initialize the modern GenAI Client
        client = genai.Client(api_key=api_key)

        print("\n🔄 Fetching available models and limitations...\n")
        print(f"{'Model Name':<30} | {'Input Limit':<12} | {'Output Limit':<13} | {'Supported Actions'}")
        print("-" * 90)

        # Query all available models and their technical constraints
        models = client.models.list()

        for model in models:
            # Clean up the model name display
            clean_name = model.name.replace("models/", "")

            # Format boundaries and capabilities
            input_token_limit = model.input_token_limit if hasattr(model, 'input_token_limit') else "N/A"
            output_token_limit = model.output_token_limit if hasattr(model, 'output_token_limit') else "N/A"
            methods = ", ".join(model.supported_generation_methods) if hasattr(model, 'supported_generation_methods') else "N/A"

            print(f"{clean_name:<30} | {input_token_limit:<12} | {output_token_limit:<13} | {methods}")

        print("\n✅ API Key verification successful! All accessible endpoints listed above.")

    except APIError as e:
        print(f"❌ API Authentication failed or service error encountered: {e}")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

if __name__ == "__main__":
    check_gemini_api()