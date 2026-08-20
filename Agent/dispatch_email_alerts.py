import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

# SMTP Configuration
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", SMTP_USERNAME)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env.")

if not SMTP_USERNAME or not SMTP_PASSWORD:
    raise ValueError("Missing SMTP credentials in .env. Cannot send emails.")

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def build_html_email_template(user_name, matched_items):
    """Builds a responsive, dark-mode-styled HTML email digest."""
    items_html = ""
    for idx, item in enumerate(matched_items, start=1):
        title = item.get('title', 'Untitled Opportunity')
        org = item.get('organization', 'Unknown Organization')
        country = item.get('country', 'Global')
        level = item.get('type', 'General')
        field = item.get('field', 'Multidisciplinary')
        funding = item.get('funding_details', 'Funding Unspecified')
        deadline = item.get('deadline', 'Ongoing')
        link = item.get('url', '#')

        items_html += f"""
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
            <div style="margin-bottom: 12px;">
                <span style="background-color: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">{level}</span>
                <span style="background-color: rgba(148, 163, 184, 0.1); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; margin-left: 8px;">📍 {country}</span>
            </div>
            
            <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">{title}</h2>
            <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">🏛️ {org} • <strong style="color: #cbd5e1;">{field}</strong></p>
            
            <div style="background-color: #0f172a; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;">
                <p style="font-size: 13px; color: #34d399; margin: 0 0 6px 0;"><strong>💰 Funding:</strong> {funding}</p>
                <p style="font-size: 13px; color: #fb923c; margin: 0;"><strong>⏳ Deadline:</strong> {deadline}</p>
            </div>
            
            <a href="{link}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;">View Opportunity &rarr;</a>
        </div>
        """

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 30px 15px; color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 12px; border-radius: 16px; margin-bottom: 12px;">
                    <span style="font-size: 24px;">🎓</span>
                </div>
                <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 6px 0;">ScholarPortal Copilot</h1>
                <p style="font-size: 14px; color: #94a3b8; margin: 0;">New verified opportunities matching your profile</p>
            </div>

            <!-- Greeting -->
            <p style="font-size: 15px; color: #e2e8f0; margin-bottom: 24px;">
                Hi <strong>{user_name or 'Scholar'}</strong>,<br>
                Our AI Matchmaker found <strong>{len(matched_items)} new opportunities</strong> aligned with your target criteria:
            </p>

            <!-- Cards -->
            {items_html}

            <!-- Footer -->
            <div style="text-align: center; margin-top: 35px; padding-top: 20px; border-top: 1px solid #1e293b; color: #64748b; font-size: 12px;">
                <p style="margin: 0 0 8px 0;">Log in to ScholarPortal to perform live AI fit analyses or manage your notification preferences.</p>
                <p style="margin: 0;">© 2026 ScholarPortal Inc. All rights reserved.</p>
            </div>
            
        </div>
    </body>
    </html>
    """
    return full_html


def matches_user_criteria(opportunity, settings):
    """Compares an opportunity against a user's alert rules."""
    target_country = settings.get('alert_countries') or 'All'
    target_level = settings.get('alert_levels') or 'All'
    target_field = settings.get('alert_fields') or 'All'

    # Match Country
    if target_country != 'All':
        opp_country = (opportunity.get('country') or '').strip().lower()
        if target_country.strip().lower() not in opp_country:
            return False

    # Match Level / Degree
    if target_level != 'All':
        opp_type = (opportunity.get('type') or '').strip().lower()
        if target_level.strip().lower() not in opp_type:
            return False

    # Match Field / Discipline
    if target_field != 'All':
        opp_field = (opportunity.get('field') or '').strip().lower()
        opp_tags = [t.strip().lower() for t in (opportunity.get('tags') or [])]
        target = target_field.strip().lower()
        if target not in opp_field and not any(target in tag for tag in opp_tags):
            return False

    return True


def run_email_matchmaker(max_items_per_alert=5):
    """Fetches users subscribed to email alerts, matches opportunities, and sends HTML digests."""
    print("🔍 Fetching active email subscribers from Supabase...")

    # 1. Fetch users with email alerts enabled
    settings_res = supabase.table('user_settings') \
        .select('*') \
        .eq('email_alerts_enabled', True) \
        .execute()

    subscribers = settings_res.data or []
    if not subscribers:
        print("ℹ️ No active email subscribers found.")
        return

    print(f"👥 Found {len(subscribers)} user(s) with email alerts enabled.")

    # 2. Fetch latest opportunities
    opps_res = supabase.table('global_opportunities') \
        .select('*') \
        .order('created_at', desc=True) \
        .limit(30) \
        .execute()

    recent_opportunities = opps_res.data or []
    if not recent_opportunities:
        print("ℹ️ No opportunities available to dispatch.")
        return

    # 3. Setup SMTP Server Connection
    try:
        print(f"🔌 Connecting to SMTP server {SMTP_SERVER}:{SMTP_PORT}...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls() # Secure the connection
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
    except Exception as e:
        print(f"❌ Failed to connect to SMTP server: {e}")
        return

    # 4. Iterate through subscribers
    for user_setting in subscribers:
        user_id = user_setting.get('user_id')

        # Retrieve user email from Supabase Auth admin API
        try:
            user_auth = supabase.auth.admin.get_user_by_id(user_id)
            user_email = user_auth.user.email if user_auth and user_auth.user else None
        except Exception as e:
            print(f"⚠️ Could not fetch email for user {user_id}: {e}")
            continue

        if not user_email:
            print(f"⚠️ Skipping user {user_id}: No email on file.")
            continue

        # Retrieve full name from user_profiles
        profile_res = supabase.table('user_profiles') \
            .select('full_name') \
            .eq('user_id', user_id) \
            .limit(1) \
            .execute()
        
        user_name = profile_res.data[0].get('full_name') if profile_res.data else None

        # Filter opportunities
        matched = [
            opp for opp in recent_opportunities 
            if matches_user_criteria(opp, user_setting)
        ][:max_items_per_alert]

        if not matched:
            print(f"⏩ No matching opportunities for {user_email}. Skipping.")
            continue

        # Build the Email Message
        html_content = build_html_email_template(user_name, matched)
        subject_line = f"🎓 ScholarPortal Digest: {len(matched)} New Opportunities Matched For You"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject_line
        msg["From"] = f"ScholarPortal <{SENDER_EMAIL}>"
        msg["To"] = user_email
        msg.attach(MIMEText(html_content, "html"))

        # Dispatch via SMTP
        try:
            print(f"📧 Dispatching email digest to {user_email} ({len(matched)} matches)...")
            server.sendmail(SENDER_EMAIL, user_email, msg.as_string())
            print(f"✅ Email delivered successfully.")
        except Exception as err:
            print(f"❌ Failed sending to {user_email}: {err}")

    # Close SMTP connection
    server.quit()
    print("🔌 SMTP connection closed.")


if __name__ == "__main__":
    print("🚀 Running ScholarPortal Standard SMTP Email Dispatcher...")
    run_email_matchmaker()