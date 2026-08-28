import requests

# 1. Put your copied token here
HF_TOKEN = "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" 

 

def test_huggingface_api():
    # Using Hugging Face's newest OpenAI-compatible router URL
    url = "https://router.huggingface.co/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        # Testing with Llama 3.1 8B (extremely fast and reliable on the free tier)
        "model": "zai-org/GLM-5.3-Flash",
        "messages": [
            {"role": "system", "content": "You are a helpful AI."},
            {"role": "user", "content": "Write a one-sentence summary of what a scholarship is."}
        ],
        "max_tokens": 100,
        "temperature": 0.1
    }
    
    print("⏳ Sending request to Hugging Face...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        answer = response.json()["choices"][0]["message"]["content"]
        print("\n✅ Success! The AI says:")
        print(f"\"{answer.strip()}\"")
        
    except Exception as e:
        print(f"\n❌ Failed to connect: {e}")
        # This safely checks for the error details without crashing
        if 'response' in locals() and response is not None:
            print(f"Error Details: {response.text}")

if __name__ == "__main__":
    test_huggingface_api()