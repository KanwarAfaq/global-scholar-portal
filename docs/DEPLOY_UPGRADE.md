# Deploy and accept this upgrade

## 1. Install into a fresh folder

Keep your current project and database backup. Extract the upgraded ZIP into a fresh folder, then copy your private environment files from the working project. The ZIP intentionally contains only templates, never your keys. Do not replace your database or delete existing profiles/articles.

Use Node 24+ for the included native TypeScript unit tests, Python 3.11+ for the agents, and the Supabase CLI through `npx`.

```powershell
npm ci
npm run lint
npm test
npm run build
py -m venv .venv-agent
.\.venv-agent\Scripts\python.exe -m pip install -r .\Agent\requirements.txt
.\.venv-agent\Scripts\python.exe -m unittest discover -s tests -p '*_test.py'
npx playwright install chromium
npx playwright test
```

The browser suite mocks Supabase; it does not write to your project. The source-package integrity checker is intended for a clean source copy without node_modules, dist or Python caches, not a populated development folder.

## 2. Environment configuration

- Frontend `.env`: public Supabase URL/key and `VITE_SITE_URL`. Production `VITE_SITE_URL` must be the real HTTPS origin, not localhost.
- Agent `.env`: copy `Agent/.env.example` into `Agent/.env`; set `SUPABASE_URL`, service-role key, search key(s), AI keys and real `SCHOLARPORTAL_BASE_URL`.
- Edge secrets: use `supabase/.env.example` as a reference. Supabase supplies reserved `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in hosted Edge Functions. Put only custom secrets in the file passed to `supabase secrets set`.
- Independent Blog CLI can run from the Agent directory to share `Agent/.env`, as shown below. If you run from Blog_Agent, provide the same backend/AI settings in its environment.

Your tested project is `wikbbpvhvevcbqkpnikj`. Do not reuse credentials from the old `nqhezydhuldvmovkazly` project.

Required new provider names:

```dotenv
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_MODEL=openai/gpt-oss-20b
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
AI_PROVIDER_ORDER=cgu,groq,nvidia-nim,mistral,openrouter,google-ai-studio,cerebras,openai
```

Existing CGU/Groq keys remain supported. No provider is guaranteed available for every account/model. Missing keys are skipped/fail through; exhausted providers return an error. Configure the same order and keys in Edge secrets and Python/GitHub Actions environments. Keep private keys out of all `VITE_*` variables.

## 3. Apply the migration before the new backend/frontend

The original six migrations must already be applied. For your existing manually prepared database, run only the contents of:

`supabase/migrations/202609170006_upgrade.sql`

in the Supabase SQL Editor, then run `supabase/tests/upgrade_smoke.sql` (read-only). If you use CLI migration history, inspect it first:

```powershell
npx supabase link --project-ref wikbbpvhvevcbqkpnikj
npx supabase migration list
```

Use `npx supabase db push` only when its pending migration list matches the changes you intend. Do not replay baseline migrations or repair migration history blindly.

The upgrade adds price/source-audit fields, content jobs and their RPCs, assessment versioning, nullable unknown competitiveness, and audit protection. Existing profile formats are normalized in the app; they do not need a destructive data conversion.

## 4. Configure secrets and deploy functions

Use your own uncommitted custom-secret file:

```powershell
npx supabase secrets set --project-ref wikbbpvhvevcbqkpnikj --env-file .\supabase\custom-secrets.env
.\scripts\deploy-functions.ps1 -ProjectRef wikbbpvhvevcbqkpnikj
npx supabase functions list --project-ref wikbbpvhvevcbqkpnikj
```

The script deploys all 12 functions and stops at the first error. It does not modify the database, upload secrets or invoke functions. OTP and Stripe webhook retain the JWT settings in `supabase/config.toml`; authenticated functions retain their normal auth checks.

`account-delete`, billing and webhook deployment does not mean those actions have been tested. Test deletion only with a disposable account. Use Stripe test-mode credentials and a test webhook until checkout, portal and signature validation pass.

## 5. Recover opportunity blogs and run independent blogs

```powershell
Push-Location .\Agent
..\.venv-agent\Scripts\python.exe run_specialist.py articles --limit 4
..\.venv-agent\Scripts\python.exe ..\Blog_Agent\blog_agent.py --limit 1
Pop-Location
```

The first command repairs opportunity deep dives; the second researches and publishes a standalone blog. Both write to your database and consume configured search/AI services. Inspect the output and the resulting public pages. Repeat the article command to clear the backlog. Do not enable scheduled runs until these checks pass.

Audit problematic destinations separately:

```powershell
Push-Location .\Agent
..\.venv-agent\Scripts\python.exe run_specialist.py source-audit --limit 4
Pop-Location
```

This can downgrade weak records and add review-queue entries. Review the exact application page, funding, eligibility and deadline yourself; a successful HTTP response or generic university page is not enough to establish an opportunity.

For a specific candidate/opportunity, `run_specialist.py eligibility` and `completeness` accept `--profile-id` and `--opportunity-id`. Output contains profile-derived information; keep it private.

## 6. Generate SEO and deploy the frontend

Set the same real origin in `VITE_SITE_URL`, Python `SCHOLARPORTAL_BASE_URL`, and Edge `SITE_URL`.

```powershell
Push-Location .\Agent
..\.venv-agent\Scripts\python.exe indexing_agent.py
Pop-Location
npm run build
npm run preview
```

Deploy `dist` through your existing hosting process. The build creates public article snapshots from `public/seo-pages.json`. A build without the manifest logs that snapshots were skipped. Vercel routing now prioritizes real static files before the SPA fallback; other hosts need the same behavior.

Check a deployed blog with View Page Source: its actual title, description, canonical URL, article text and JSON-LD should exist before JavaScript runs. Check `/sitemap.xml` returns XML, not the SPA HTML. Verify private routes have `noindex` and are absent from the sitemap. Rebuild after content changes to refresh snapshots.

Optional Search Console submission: add the service account as a permitted user of your verified Search Console property; configure `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_SEARCH_CONSOLE_SITE` (for example `sc-domain:your-domain.example`). Once the sitemap is deployed:

```powershell
Push-Location .\Agent
..\.venv-agent\Scripts\python.exe indexing_agent.py --submit
Pop-Location
```

This submits a sitemap, not a guarantee or instant indexing request. Do not use Google's restricted Indexing API for ordinary scholarship/blog pages.

## 7. Configure scheduled workflows

- `opp_agent.yml`: daily opportunity/program and operational pipeline, including article reconciliation and source/completeness checks.
- `standalone_blog.yml`: weekly independent blog research/publishing.
- `daily_scraper.yml`: daily sitemap/SEO manifest refresh; commit can trigger your connected site rebuild.

Configure GitHub secrets from the environment templates and repository variables for provider models/order and `SCHOLARPORTAL_BASE_URL`. The workflow branch currently assumes `main`; adjust if your repository uses another branch. Keep `AGENT_ALLOW_OUTBOUND=false` until email/LINE/social tests are approved. Facebook additionally requires `FACEBOOK_PUBLISH_ENABLED=true`.

## Final live acceptance checks

1. Switch between both real profiles, expand skills, edit/save, refresh and export a PDF; verify all categories and education survive.
2. Analyze the PhD again. Confirm no career-title failure, saved score after refresh, selected profile identity, and stale state after editing that profile.
3. Disable AI with the admin toggle, confirm the friendly disabled response, restore it. Test each configured fallback by choosing provider order in staging; do not expose keys in browser tools.
4. Open a recovered opportunity deep dive and an independent blog; compare the underlying table/route identity. Rerun generation and check it does not add a second article.
5. Test settings persistence, visible options, mobile layout and light/dark contrast with real long content. Fixture tests cover layout, not all possible production content.
6. Test lead/referral consent with owned and another user's profile: owned valid request succeeds; foreign profile fails; missing/all-unsupported fields fail; only selected fields are stored. Repeat submission and confirm one consent/lead or referral row.
7. Confirm non-admin gets 403 for admin APIs and RLS blocks other users' rows. Search a user outside the first 50, view audit details, and confirm own demote/ban/delete is blocked.
8. Configure plan display prices to match Stripe; validate checkout/portal/webhook with test mode. Confirm sponsor/counselor creation is blocked without entitlements.
9. Test account export and disposable-account deletion. Do not delete the administrator used for deployment.
10. Inspect agent_runs, content_jobs and review queues. Confirm error counts reflect failed tasks; do not treat generated counters as proof of publication without opening the saved pages.
11. Validate deployed static metadata, sitemap contents, actual source links and Search Console ownership. Google decides whether/when to index.

If migrations need rollback, restore from your backup or prepare a reviewed reverse migration; do not drop content_jobs or profile data as a generic troubleshooting step. The old frontend can be restored independently, but it will still have the original skills/eligibility defects.
