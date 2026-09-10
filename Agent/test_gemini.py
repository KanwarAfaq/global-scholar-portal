from google import genai

# Initialize the Gemini client
# client = genai.Client(api_key="AQ.Ab8RN6IgNIz5D-KB0O5eI9CMSLnDZjJDDeDduNueYQvcppmROg")
client = genai.Client(api_key="AQ.Ab8RN6KPv4GwquEz0VNWrHTBoRlzhYdEwfEB9vBVFkQDIEl5Zw")

response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents="Confirm that the API is connected and functional."
)

print(f"🤖 Response: {response.text}")
    