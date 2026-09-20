# ScholarPortal testing-phase upgrade — 17 September 2026

This release is based on the last supplied ZIP. It includes source changes, migration 202609170006, regression tests, deployment instructions, and separate blog workflows. It has not been deployed to your Supabase project or hosting account. No real recipients were contacted, no payments were made, and no account was deleted during validation.

## What changed and why

The following is the consolidated numbered testing backlog. “Implemented” means the change exists in this package; it does not mean the live site has been updated. See the validation section for the checks actually performed.

| # | Noted task | Implementation and reason |
|---|---|---|
| 1 | Profile skills expansion crashes | Normalize grouped skill objects and legacy arrays before rendering or PDF population. Prevents `.map is not a function` while retaining categories. |
| 2 | Blank screen after a rendering failure | Route error boundary offers recovery; navigation resets the boundary. |
| 3 | Senior career label falsely blocks PhD eligibility | Evaluate completed academic qualifications against explicit entry requirements. Career title, profile name and intended award are not completed degrees. |
| 4 | Match explanation contradicts evidence | Gateway supplies evidence-only deterministic checks and instructs the model to distinguish unknowns from conflicts. AI commentary remains advisory and requires review. |
| 5 | Fit disappears after refresh | Reload saved assessments for the selected user/profile. Versioned results and profile edits mark old assessments stale. Database write failures are surfaced. |
| 6 | Active profile is unclear | Visible profile selector on the opportunity feed. |
| 7 | Different pages choose different profiles | Shared per-user selection persists in the browser across Profiles, feed, Application Studio, Resume Studio, Sponsored Opportunities and Programs. Selection is not synchronized across devices. |
| 8 | Candidate contacts appear as opportunity contacts | Requirements extraction excludes the candidate profile and explicitly restricts contacts to opportunity evidence. |
| 9 | Degree qualification appears as a document | Requirements instructions distinguish eligibility from submission documents; missing facts stay unknown. |
| 10 | Apply/article links lead to general pages | Prefer official/source URLs; preserve application query identifiers. Source auditor flags generic destinations. It does not invent replacement URLs. |
| 11 | Unconfirmed funding/deadlines look certain | Source auditing records supporting quotations and flags weak/general sources for review. Unknown values are retained. Old records need an audit run and human source review. |
| 12 | Opportunity Blog Not Found after discovery | Opportunity reconciliation creates or repairs the article by `opportunity_id` and verifies the saved row before counting success. |
| 13 | No article progress/retry visibility | Durable content jobs track pending/running/published/failed, attempts and leases. Missing article UI distinguishes pending from failure; reruns retry failed work. |
| 14 | Countries, levels and fields are blank | Maintained taxonomy fallbacks merge with available opportunity data and saved choices. |
| 15 | Empty state hides a loading failure | Settings and Notifications expose loading failures and retry paths; function failures use their actual error messages. |
| 16 | Light/dark text is unreadable | Shared input styles, contrasting text, cards, focus styles and targeted light-theme corrections. |
| 17 | Application Studio overflows mobile | Shrinkable grid columns, wrapping controls and contained structured output. Kanban retains intentional local horizontal scrolling. |
| 18 | History previews display raw formatting | Strip Markdown markers from short history previews; structured results remain readable and copyable. |
| 19 | Blog disappears from mobile navigation | Blog and Degree Programs are available in the sidebar/drawer. |
| 20 | Boolean admin settings need toggles | Boolean settings render as switches/checkboxes, with numeric and text controls for other values. |
| 21 | Generic Edge Function alerts | Shared response parser displays server-provided messages such as `ai_disabled`; dismissible notices replace page alerts. |
| 22 | Audit records appear editable | Read-only detail views and an append-only database trigger protect audit content. FK identity cleanup may null the deleted actor ID while retaining evidence. |
| 23 | Users & Roles has no search | Email/name/ID/role search across auth pages with result pagination. |
| 24 | Admin can lock out their own account | Own role/suspend/delete controls are disabled; existing server checks retained; account deletion rejects admin self-deletion. |
| 25 | Paid plans do not show prices | New amount/currency/interval fields. Unconfigured prices are shown as unavailable, never invented. Configure them to match Stripe. |
| 26 | Product pages expose implementation jargon | Simplified plan gates, generation labels and billing copy. Technical setup remains in admin/docs. |
| 27 | Creation buttons stay active without entitlement | Sponsor/counselor creation is disabled without the required plan; backend/RLS checks remain. |
| 28 | Legacy profile fields are missing in PDF | Normalize school/university, company/employer and journal/conference aliases for the resume builder. |
| 29 | Large initial bundle and lint problems | Lazy route loading, a shared Supabase client and lint cleanup. PDF rendering remains a large on-demand bundle. |
| 30 | Country flags | Local SVG flags with country text and a global fallback. No runtime flag CDN dependency. |
| 31 | Cards need more information | Source-check status, field, freshness/check dates, deadline countdown, saved fit, configured logo or institution initial. |
| 32 | Visual consistency | Indigo/cyan accents, slate surfaces, shared input/button styling, rounded cards, focus and reduced-motion support. |
| 33 | NVIDIA, Mistral and OpenRouter fallback everywhere | Both Edge AI and all Python LLM tasks use configurable shared cascades. Empty/invalid structured output falls through to another configured provider. No private keys in frontend code. |

## Four specialist tasks and the indexing task

1. **Official Source Auditor** (`Agent/specialists.py`): fetches the destination, detects general/weak pages, checks that supporting quotations exist in source text, records an audit and queues weak records for review. It does not automatically assert that every fact is true.
2. **Opportunity Article Reconciliation** (`Agent/content_pipeline.py`): repairs missing/null opportunity articles, separates route identity from standalone slugs, avoids repeat inserts, tracks failures and resumes expired jobs. This replaces the old opportunity content-generation implementation.
3. **Eligibility Validator** (`Agent/specialists.py`): structured second opinion grounded in completed qualifications and source evidence. Integrated into completeness reviews and callable independently; it never silently overwrites deterministic scores.
4. **Application Completeness Agent** (`Agent/specialists.py`): compares the saved checklist with requirements. Only explicitly completed items count as complete. Creates deduplicated in-app reviews for users who opted into application updates. Uses the latest stored profile and records its ID; operators can select a specific profile with the CLI.
5. **Search Indexing Maintenance** (`Agent/indexing_agent.py`): generates a public sitemap, robots.txt and an SEO manifest for pre-rendered HTML; optionally submits the deployed sitemap to Search Console. Private workspace routes are excluded. Submission does not guarantee indexing.

## The two blog pipelines are separate

| | Standalone blog | Opportunity deep dive |
|---|---|---|
| Starting point | Independent research query and fetched sources | Verified opportunity record |
| Storage | `blog_posts` | `opportunity_blogs` |
| Identity | Stable source-derived `slug` | `opportunity_id` |
| Public route | `/blog/:slug` | `/opportunity/:id/blog` |
| Runner | `Blog_Agent/blog_agent.py` | `Agent/run_specialist.py articles`, also daily orchestrator |
| Schedule | `standalone_blog.yml` | `opp_agent.yml` |
| Failure state | `content_jobs`, kind `standalone` | `content_jobs`, kind `opportunity`; public pending/failure UI |

Publishing a database article is separate from Facebook/email/LINE delivery. Outbound delivery is disabled by default with `AGENT_ALLOW_OUTBOUND=false`. Set it deliberately after recipient and integration tests. Search, generation and database writes still run. Standalone blog publishing does not send messages.

Jobs use a 15-minute lease. Rerunning skips existing nonempty articles and retries failed/missing ones. Extremely long jobs beyond the lease or legacy duplicate rows require operator review; the public route chooses the newest nonempty record. Reconciliation processes a bounded batch per run; repeat to clear the backlog.

## Counts after this upgrade

**12 Supabase Edge Functions**, unchanged in count:
`otp-request`, `otp-verify`, `ai-gateway`, `admin-api`, `quality-admin`, `account-export`, `account-delete`, `billing-checkout`, `billing-portal`, `stripe-webhook`, `lead-consent`, `referral-consent`.

**21 operational agent roles/tasks**, counting wrappers only once: research discovery, opportunity verification, change monitoring, program discovery, program monitoring, campaign scoring, counselor tasks, growth analytics, cost/abuse checks, opportunity article reconciliation, social publishing, opportunity safety, freshness scoring, community moderation, deadline/application coaching, notifications, standalone blog research, source auditing, eligibility validation, application completeness, and search indexing maintenance. These are Python tasks/modules, not 21 additional hosted Edge Functions. Deterministic tasks do not need an LLM call.

## Validation completed

- Frontend lint: clean.
- Frontend unit tests: 6 passed (profile normalization, qualification matching, unknown evidence, official URLs).
- Python unit tests: 10 passed (fallback behavior, kill switch, separate article identity, idempotency, null-article repair, failed writes and public SEO inventory).
- Browser regression tests: 10 passed with mocked Supabase responses. Core profile/feed/settings/studio and 14 other routes were exercised at 390px and 1440px in light and dark themes, with uncaught-error and root-overflow checks; mobile Blog access and article pending state were checked separately.
- All 18 Edge TypeScript files passed syntax transpilation (not a deployed Deno integration test).
- Static SEO snapshot fixture passed title/canonical/content/escaping checks.
- Production Vite build: passed. Main JS approximately 641 KB / 193 KB gzip; resume/PDF route approximately 1.29 MB / 461 KB gzip. Build size warnings remain for large chunks.
- Local flags and dashboard screenshots inspected; hero contrast corrected after visual review.
- Release structure/secret scan and Python compilation are run on the clean packaged source.

Browser tests use fixtures, not your live database. They do not establish live RLS, delivery, billing, deployed migrations, AI factual accuracy, real PDF download, or Google indexing success. Those staging checks remain in DEPLOY_UPGRADE.md. Actual prices, institution logos and verified replacement application URLs require real source/configuration data.

## SEO and provider references

The implementation uses public HTML snapshots plus runtime metadata because JavaScript-only metadata is less useful to some crawlers/social previews. Run indexing generation before a production build; new content needs a rebuild to refresh snapshots.

Google's Indexing API is restricted to eligible job-posting/livestream pages; ordinary scholarship articles use sitemap/Search Console submission here. See [Indexing API prerequisites](https://developers.google.com/search/apis/indexing-api/v3/quickstart), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Provider adapters use the documented chat-completions interfaces: [NVIDIA NIM](https://docs.api.nvidia.com/nim/reference/llm-apis), [Mistral](https://docs.mistral.ai/api/), and [OpenRouter](https://openrouter.ai/docs/api-reference/overview). Model access depends on your account; model IDs and order are configurable in the environment templates.
