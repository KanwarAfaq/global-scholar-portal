import os
from supabase import create_client, Client
from dotenv import load_dotenv

# --- LINE SDK v3 IMPORTS ---
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    PushMessageRequest,
    TextMessage
)

# Load environment variables
load_dotenv()

LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not LINE_CHANNEL_ACCESS_TOKEN or not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing environment variables. Check your .env file.")

# Initialize Supabase and LINE client configuration
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)


def format_opportunity_message(user_name, matched_items):
    """Formats an opportunity list into a clean, readable LINE message."""
    count = len(matched_items)
    header = f"🎓 ScholarPortal Copilot\n\nHi {user_name or 'there'}! We found {count} new opportunity match{'es' if count > 1 else ''} for you:\n"
    
    body = ""
    for idx, item in enumerate(matched_items, start=1):
        title = item.get('title', 'Untitled Opportunity')
        org = item.get('organization', 'Unknown Organization')
        country = item.get('country', 'Global')
        level = item.get('type', 'General')
        deadline = item.get('deadline', 'Ongoing')
        link = item.get('url', '')

        body += (
            f"\n{idx}. 📌 {title}\n"
            f"   🏢 {org} ({country})\n"
            f"   🎯 Level: {level}\n"
            f"   ⏳ Deadline: {deadline}\n"
        )
        if link:
            body += f"   🔗 Link: {link}\n"

    footer = "\n✨ Log in to ScholarPortal to run full AI fit assessments and save these to your tracker."
    return header + body + footer


def matches_user_criteria(opportunity, settings):
    """Compares an opportunity against a user's alert rules."""
    target_country = settings.get('alert_countries') or 'All'
    target_level = settings.get('alert_levels') or 'All'
    target_field = settings.get('alert_fields') or 'All'

    # 1. Match Country
    if target_country != 'All':
        opp_country = (opportunity.get('country') or '').strip().lower()
        if target_country.strip().lower() not in opp_country:
            return False

    # 2. Match Level / Degree
    if target_level != 'All':
        opp_type = (opportunity.get('type') or '').strip().lower()
        if target_level.strip().lower() not in opp_type:
            return False

    # 3. Match Field / Discipline
    if target_field != 'All':
        opp_field = (opportunity.get('field') or '').strip().lower()
        opp_tags = [t.strip().lower() for t in (opportunity.get('tags') or [])]
        target = target_field.strip().lower()
        
        if target not in opp_field and not any(target in tag for tag in opp_tags):
            return False

    return True


def run_line_matchmaker(max_items_per_alert=3):
    """Finds matching opportunities and sends push alerts via LINE."""
    print("🔍 Fetching active subscribers from Supabase...")

    # 1. Query users who enabled LINE alerts and have a valid LINE ID linked
    users_res = supabase.table('user_settings') \
        .select('*') \
        .eq('line_alerts_enabled', True) \
        .not_.is_('line_user_id', 'null') \
        .execute()

    subscribers = users_res.data or []
    if not subscribers:
        print("ℹ️ No active LINE subscribers found.")
        return

    print(f"👥 Found {len(subscribers)} active LINE subscriber(s).")

    # 2. Fetch the latest opportunities
    opps_res = supabase.table('global_opportunities') \
        .select('*') \
        .order('created_at', desc=True) \
        .limit(25) \
        .execute()

    recent_opportunities = opps_res.data or []
    if not recent_opportunities:
        print("ℹ️ No opportunities available in the database.")
        return

    # 3. Iterate over subscribers and match
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)

        for user_setting in subscribers:
            user_id = user_setting.get('user_id')
            line_user_id = user_setting.get('line_user_id')

            # Fetch user profile to get their name
            profile_res = supabase.table('user_profiles') \
                .select('full_name') \
                .eq('user_id', user_id) \
                .limit(1) \
                .execute()
            
            user_name = profile_res.data[0].get('full_name') if profile_res.data else None

            # Filter opportunities for this specific subscriber
            matched = [
                opp for opp in recent_opportunities 
                if matches_user_criteria(opp, user_setting)
            ][:max_items_per_alert]

            if not matched:
                print(f"⏩ No matching opportunities for user {user_id}. Skipping.")
                continue

            # Format and send push notification
            message_text = format_opportunity_message(user_name, matched)

            try:
                print(f"📲 Sending alert to LINE ID: {line_user_id[:8]}... ({len(matched)} matches)")
                line_bot_api.push_message(
                    PushMessageRequest(
                        to=line_user_id,
                        messages=[TextMessage(text=message_text)]
                    )
                )
                print("✅ Alert delivered successfully.")
            except Exception as err:
                print(f"❌ Failed to deliver alert to {line_user_id}: {err}")


if __name__ == "__main__":
    print("🚀 Running ScholarPortal Matchmaker & Dispatcher...")
    run_line_matchmaker()