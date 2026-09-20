#!/usr/bin/env python3
"""Release-integrity checks for ScholarPortal.

This script intentionally avoids network access. It verifies the package structure,
checks for accidentally packaged secrets/private keys, confirms required commercial
modules are present, and compiles Python automation/admin utilities.

The authoritative frontend verification remains: npm ci && npm run lint && npm run build.
"""
from __future__ import annotations

import pathlib
import py_compile
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

REQUIRED = [
    "docs/UPGRADE.md",
    "docs/DEPLOY_UPGRADE.md",
    "Agent/content_pipeline.py",
    "Agent/specialists.py",
    "Agent/indexing_agent.py",
    "supabase/migrations/202609170006_upgrade.sql",
    "supabase/tests/upgrade_smoke.sql",
    ".github/workflows/standalone_blog.yml",
    "README.md",
    "docs/ADMIN.md",
    "docs/DATABASE_SETUP.md",
    "docs/DELIVERY_STATUS.md",
    "docs/IMPLEMENTATION_CHECKLIST.md",
    "docs/TESTING.md",
    "docs/UI_QA.md",
    "src/App.jsx",
    "src/components/SignupBenefitsBanner.jsx",
    "src/components/Engagement.jsx",
    "src/pages/Admin.jsx",
    "src/pages/Quality.jsx",
    "src/pages/Notifications.jsx",
    "src/pages/Pricing.jsx",
    "src/pages/SponsorWorkspace.jsx",
    "src/pages/SponsoredOpportunities.jsx",
    "src/pages/CounselorWorkspace.jsx",
    "src/pages/CounselorInvites.jsx",
    "src/pages/Programs.jsx",
    "src/pages/Copilot.jsx",
    "src/pages/ResumeBuilder.jsx",
    "src/pages/Analytics.jsx",
    "src/pages/Account.jsx",
    "src/pages/Terms.jsx",
    "src/lib/ai.js",
    "src/lib/sanitize.js",
    "Agent/agent.py",
    "Agent/core.py",
    "Agent/orchestrator.py",
    "Agent/dispatch_notifications.py",
    "Agent/facebook_publisher.py",
    "Agent/webhook.py",
    "Agent/check_integrations.py",
    "Blog_Agent/generate_sitemap.py",
    "scripts/promote_admin.py",
    "supabase/migrations/202609110000_base_schema_compat.sql",
    "supabase/migrations/202609110001_commercial_platform.sql",
    "supabase/migrations/202609110002_quality_and_program_intelligence.sql",
    "supabase/migrations/202609110003_admin_control_plane.sql",
    "supabase/migrations/202609110004_operational_hardening.sql",
    "supabase/migrations/202609130005_auth_community_notifications.sql",
    "supabase/tests/schema_smoke.sql",
    "supabase/functions/ai-gateway/index.ts",
    "supabase/functions/billing-checkout/index.ts",
    "supabase/functions/billing-portal/index.ts",
    "supabase/functions/stripe-webhook/index.ts",
    "supabase/functions/lead-consent/index.ts",
    "supabase/functions/referral-consent/index.ts",
    "supabase/functions/account-export/index.ts",
    "supabase/functions/account-delete/index.ts",
    "supabase/functions/quality-admin/index.ts",
    "supabase/functions/admin-api/index.ts",
    "supabase/functions/otp-request/index.ts",
    "supabase/functions/otp-verify/index.ts",
    "supabase/functions/_shared/smtp.ts",
    ".github/workflows/opp_agent.yml",
]

DISALLOWED_NAMES = {".env", "id_rsa", "id_ed25519"}
DISALLOWED_SUFFIXES = {".key", ".pem", ".p12", ".pfx"}
PRIVATE_KEY_RE = re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY")
FRONTEND_SECRET_RE = re.compile(
    r"VITE_(?:CGU|GROQ|OPENAI|GEMINI|GOOGLE_AI|OPENROUTER|NVIDIA|MISTRAL|CEREBRAS|SUPABASE_SERVICE_ROLE|STRIPE|SMTP|SERPER|TAVILY|BING)[A-Z0-9_]*"
)
OBVIOUS_SECRET_RE = re.compile(
    r"(?:sk_live_[A-Za-z0-9]{8,}|sk-proj-[A-Za-z0-9_-]{8,}|AIzaSy[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]{10,}\.)"
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def main() -> None:
    missing = [p for p in REQUIRED if not (ROOT / p).is_file()]
    if missing:
        fail("missing required release files:\n  " + "\n  ".join(missing))

    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if any(part in {"node_modules", ".git", "dist", "__pycache__", ".venv", ".venv-agent"} for part in rel.parts):
            continue
        if p.name in DISALLOWED_NAMES and p.name != ".env.example":
            fail(f"disallowed secret file packaged: {rel}")
        if p.suffix.lower() in DISALLOWED_SUFFIXES:
            fail(f"disallowed key/certificate file packaged: {rel}")
        # Skip lockfile for generic token scans; it contains dependency integrity data.
        if p.name == "package-lock.json":
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if PRIVATE_KEY_RE.search(text):
            fail(f"private-key marker found in {rel}")
        if OBVIOUS_SECRET_RE.search(text) and p.name != ".env.example":
            fail(f"possible live provider secret found in {rel}")
        if rel.parts and rel.parts[0] == "src" and FRONTEND_SECRET_RE.search(text):
            fail(f"private provider/service-role VITE variable referenced by frontend: {rel}")

    py_files = [
        p for p in ROOT.rglob("*.py")
        if not any(part in {"__pycache__", ".venv", ".venv-agent", "node_modules", "dist"} for part in p.relative_to(ROOT).parts)
    ]
    for p in py_files:
        try:
            py_compile.compile(str(p), doraise=True)
        except py_compile.PyCompileError as exc:
            fail(f"Python syntax error in {p.relative_to(ROOT)}: {exc.msg}")

    # Clean pycache produced by compilation so the working package stays clean.
    for cache in sorted(ROOT.rglob("__pycache__"), reverse=True):
        for child in cache.iterdir():
            child.unlink(missing_ok=True)
        cache.rmdir()

    print("PASS: ScholarPortal release structure/security checks completed.")
    print(f"PASS: {len(REQUIRED)} required release artifacts present.")
    print(f"PASS: {len(py_files)} Python files compiled.")
    print("NEXT: run `npm ci && npm run lint && npm run build` on a machine with npm registry access.")


if __name__ == "__main__":
    main()
