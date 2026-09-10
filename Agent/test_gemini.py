from google import genai

# Initialize the Gemini client
# client = genai.Client(api_key="")
client = genai.Client(api_key="")

response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents="Confirm that the API is connected and functional."
)

print(f"🤖 Response: {response.text}")
    