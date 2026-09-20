"""Promote an existing ScholarPortal auth user to administrator.

Required environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ADMIN_EMAIL

This utility never prints the service-role key.
"""
import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
if not url or not key or not email:
    raise SystemExit("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL first.")

client = create_client(url, key)
page = 1
found = None
while True:
    result = client.auth.admin.list_users(page=page, per_page=1000)
    users = getattr(result, "users", None) or []
    found = next((u for u in users if (u.email or "").lower() == email), None)
    if found or len(users) < 1000:
        break
    page += 1
if not found:
    raise SystemExit(f"No auth user found for {email}")
metadata = dict(getattr(found, "app_metadata", None) or {})
metadata["role"] = "admin"
client.auth.admin.update_user_by_id(found.id, {"app_metadata": metadata})
print(f"Promoted {email} to ScholarPortal administrator.")
