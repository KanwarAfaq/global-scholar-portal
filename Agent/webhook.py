import os
from flask import Flask, request, abort
from supabase import create_client, Client
from dotenv import load_dotenv

# --- LINE SDK v3 IMPORTS ---
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent

# Load environment variables
load_dotenv()

app = Flask(__name__)

# --- CONFIGURATION ---
LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
LINE_CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') 

# Validate that the env variables actually loaded
if not LINE_CHANNEL_ACCESS_TOKEN or not LINE_CHANNEL_SECRET:
    raise ValueError("CRITICAL: LINE environment variables are missing. Check your .env file!")

# Initialize LINE v3 Configurations
configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(LINE_CHANNEL_SECRET)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- WEBHOOK ROUTE ---
@app.route("/callback", methods=['POST'])
def callback():
    # Get X-Line-Signature header value
    signature = request.headers['X-Line-Signature']

    # Get request body as text
    body = request.get_data(as_text=True)

    # Handle webhook body
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        print("Invalid signature. Please check your channel access token/channel secret.")
        abort(400)

    return 'OK'

# --- MESSAGE HANDLING LOGIC ---
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_message = event.message.text.strip()
    line_user_id = event.source.user_id

    # Helper function to send replies using the v3 ApiClient
    def send_reply(text_to_send):
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    reply_token=event.reply_token,
                    messages=[TextMessage(text=text_to_send)]
                )
            )

    # Check if the message is exactly a 6-digit code
    if user_message.isdigit() and len(user_message) == 6:
        try:
            # 1. Search Supabase for this code
            response = supabase.table('user_settings').select('*').eq('line_verification_code', user_message).execute()
            
            if response.data and len(response.data) > 0:
                # 2. Match found! Get the user's UUID
                db_user_id = response.data[0]['user_id']
                
                # 3. Update the database to link the LINE ID and wipe the temporary code
                supabase.table('user_settings').update({
                    'line_user_id': line_user_id,
                    'line_verification_code': None
                }).eq('user_id', db_user_id).execute()

                # 4. Reply with success
                send_reply("✅ Success! Your LINE account is now linked to ScholarPortal. You will receive AI match alerts right here.")
            else:
                # Code not found in database
                send_reply("❌ Invalid or expired code. Please check your Settings page and try again.")
                
        except Exception as e:
            print(f"Database error: {e}")
            send_reply("⚠️ An error occurred while verifying your code. Please try again.")
    else:
        # Default response for non-code messages
        welcome_msg = (
            "🤖 Welcome to ScholarPortal!\n\n"
            "To link your account, please send the 6-digit verification code found in your web Settings page."
        )
        send_reply(welcome_msg)

if __name__ == "__main__":
    print("Starting LINE Webhook Server on port 5000...")
    app.run(port=5000)