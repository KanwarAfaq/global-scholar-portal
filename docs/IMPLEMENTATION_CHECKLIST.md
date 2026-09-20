# ScholarPortal Implementation Checklist

This file maps **every requested capability** to the implementation included in this release. “Implemented” means the code/schema/UI path exists in the package. External integrations still require their real credentials and must be exercised in your staging environment using `docs/TESTING.md`.

## AI, research and verification

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Server-side AI gateway; no private frontend AI keys | Implemented | `supabase/functions/ai-gateway/index.ts`, `supabase/functions/_shared/ai.ts` | T01, T02 |
| 8-provider AI cascade: CGU → Groq → OpenRouter → NVIDIA NIM → Mistral → Google AI Studio → Cerebras → OpenAI | Implemented | `_shared/ai.ts`, `Agent/core.py` | T03 |
| Admin global AI on/off control | Implemented | `platform_settings.ai`, `ai-gateway/index.ts` | T04 |
| Optional AI generation-history switch | Implemented | `platform_settings.ai.save_generation_history`, `ai-gateway/index.ts` | T05 |
| AI monthly credit metering/quotas | Implemented | `ai_usage`, `plans`, `getEntitlement`, `ai-gateway` | T06 |
| Verified opportunity Research Agent uses web search | Implemented | `Agent/orchestrator.py::ResearchAgent` | T07 |
| 4 search fallbacks: Serper → Tavily → Bing → DuckDuckGo | Implemented | `Agent/core.py::SearchCascade` | T08 |
| Verification Agent fetches source pages | Implemented | `VerificationAgent`, `FetchCascade` | T09 |
| 4 fetch fallbacks: HTTP → browser headers → cache-bust → Jina Reader | Implemented | `Agent/core.py::FetchCascade` | T10 |
| Conservative official-source gate | Implemented | `Agent/orchestrator.py::likely_official_source` | T11 |
| Human Trust & Quality queue for uncertain sources | Implemented | `opportunity_review_queue`, `/quality` | T12 |
| Opportunity provenance | Implemented | `opportunity_sources` | T13 |
| Opportunity verification history/confidence | Implemented | `opportunity_verifications`, verification columns | T13 |
| Opportunity versions/change history | Implemented | `opportunity_versions` | T14 |
| Change Monitoring Agent | Implemented | `ChangeMonitorAgent` | T14 |
| Verified Program Discovery Agent | Implemented | `ProgramResearchAgent` / program verification pipeline in `orchestrator.py` | T15 |
| Degree-program change monitoring | Implemented | `ProgramMonitorAgent` | T16 |
| Admin-configurable opportunity/program publish thresholds | Implemented | `platform_settings.trust`, `Agent/core.py`, `orchestrator.py` | T17 |

## Student profile, matching and intelligence

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Expanded profile: citizenship | Implemented | `Profiles.jsx`, `user_profiles.citizenship` | T18 |
| Target countries | Implemented | `Profiles.jsx`, `desired_countries` | T18 |
| Target degree | Implemented | `desired_degree` | T18 |
| GPA and scale | Implemented | `gpa`, `gpa_scale` | T18 |
| English test/score | Implemented | `english_test` JSON | T18 |
| Budget/currency | Implemented | `budget_amount`, `budget_currency` | T18 |
| Deterministic eligibility before AI explanation | Implemented | `ai-gateway::deterministicMatch` | T19 |
| Explainable opportunity matching | Implemented | `deterministicMatch` + AI explanation | T19 |
| Stored match scores | Implemented | `user_match_scores` | T20 |
| Degree Program Matcher | Implemented | `/programs`, `programFit()` | T21 |
| Program fit includes destination, level, field, budget, GPA, citizenship, language | Implemented | `Programs.jsx` | T21 |

## Watchlists and notifications

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Opportunity watchlists | Implemented | `Intelligence.jsx`, `user_watchlists` | T22 |
| Database-enforced watchlist plan limits | Implemented | DB trigger/helper in commercial migration | T23 |
| Notification delivery ledger | Implemented | `notification_deliveries` | T24 |
| Deduplication | Implemented | unique delivery key + dispatcher checks | T24 |
| In-app notification center | Implemented | `/notifications`, `Notifications.jsx` | T25 |
| Daily/weekly/monthly digest frequency | Implemented | `dispatch_notifications.py` | T26 |
| Watchlist change/deadline alerts remain timely regardless digest frequency | Implemented | `NotificationAgent.run()` separation | T27 |
| Multi-country alert criteria | Implemented | Settings multi-select + `alert_countries_v2` | T28 |
| Multi-level alert criteria | Implemented | `alert_levels_v2` | T28 |
| Multi-field alert criteria | Implemented | `alert_fields_v2` | T28 |
| Deadline reminders | Implemented | NotificationAgent configured days | T29 |
| Admin-configurable reminder days/global channel switches | Implemented | `platform_settings.notifications` | T30 |
| SMTP-only email delivery | Implemented | `Agent/dispatch_notifications.py`, `Agent/check_integrations.py` | T31, T101 |
| LINE alerts | Implemented | `dispatch_notifications.py` | T32 |
| Secure expiring LINE account-link code | Implemented | `Settings.jsx`, `Agent/webhook.py`, migration 004 | T33 |

## AI Application Studio

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Requirements extraction | Implemented | `/copilot`, action `requirements` | T34 |
| Cover letter | Implemented | action `cover_letter` | T34 |
| Cold email | Implemented | action `cold_email` | T34 |
| Statement of purpose | Implemented | action `sop` | T34 |
| Personal statement | Implemented | action `personal_statement` | T34 |
| Research proposal | Implemented | action `research_proposal` | T34 |
| Recommendation brief | Implemented | action `recommendation_brief` | T34 |
| Interview practice | Implemented | action `interview_practice` | T34 |
| Application checklist | Implemented | action `checklist` | T34 |
| Resume tailoring | Implemented | `ResumeBuilder.jsx`, `resume_tailor` | T35 |
| AI generation history | Implemented | `ai_generations`, Copilot history | T36 |
| Grounding prompt: do not invent achievements | Implemented | `ai-gateway::prompts` | T37 |

## Plans and billing

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Free plan | Implemented | `plans` seed | T38 |
| Pro plan | Implemented | plan + Stripe mapping | T38 |
| Counselor plan | Implemented | plan + entitlement/RLS | T38 |
| Sponsor plan | Implemented | plan + entitlement/RLS | T38 |
| Stripe Checkout | Implemented | `billing-checkout` | T39 |
| Stripe customer billing portal | Implemented | `billing-portal` | T40 |
| Signed Stripe webhook | Implemented | `stripe-webhook`, `config.toml` | T41 |
| Server-controlled success/cancel return URL | Implemented | `SITE_URL` in billing-checkout | T39 |

## Sponsor / B2B platform

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Sponsor organization account | Implemented | `/sponsor`, `sponsor_accounts` | T42 |
| Sponsor plan required to create account | Implemented | UI + DB RLS | T42 |
| Sponsor verification by staff | Implemented | `/quality`, `quality-admin` | T43 |
| Campaign creation | Implemented | `SponsorWorkspace.jsx`, `sponsor_campaigns` | T44 |
| Campaign review/activation by staff | Implemented | Quality console | T45 |
| Student-specific sponsored matching | Implemented | `SponsoredOpportunities.jsx::campaignFit` | T46 |
| Explicit campaign consent before data transfer | Implemented | `lead-consent`, `lead_consents` | T47 |
| Only selected fields become lead data | Implemented | `lead-consent` allowlist | T47 |
| Admin can globally disable sponsor lead sharing | Implemented | `platform_settings.monetization`, `lead-consent` | T48 |
| Sponsor Lead Quality Agent | Implemented | `SponsorLeadQualityAgent` | T49 |
| Sponsor sees consented lead data, score and pipeline | Implemented | `SponsorWorkspace.jsx` | T50 |

## Counselor / agency platform

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Counselor/agency workspace | Implemented | `/counselor` | T51 |
| Counselor plan required | Implemented | UI + DB RLS | T51 |
| Invite student by email | Implemented | `counselor_students` | T52 |
| Student must accept/consent | Implemented | `/counselor-invites` | T53 |
| Counselor cannot read unconsented profile through AI review | Implemented | `ai-gateway` counselor authorization | T54 |
| Counselor task management | Implemented | `tasks`, CounselorWorkspace | T55 |
| AI student-readiness review after consent | Implemented | action `counselor_review` | T54 |
| Automated Counselor Deadline Agent | Implemented | `CounselorDeadlineAgent` | T56 |

## Referrals

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Disclosed partner referral system | Implemented | `/programs`, `referral-consent` | T57 |
| Referral consent record | Implemented | `program_referrals.consent_text/referral_data` | T57 |
| Referral requests only for verified + enabled partner programs | Implemented | `referral-consent` server checks | T58 |
| Admin can globally disable referrals | Implemented | `platform_settings.monetization` | T59 |
| Staff handles referral status | Implemented | `/quality`, `quality-admin` | T60 |

## Analytics, agents and content

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Expanded analytics funnel | Implemented | `Analytics.jsx` | T61 |
| Interview rate | Implemented | Analytics | T61 |
| Offer rate | Implemented | Analytics | T61 |
| Average match | Implemented | Analytics | T61 |
| Watchlist metrics | Implemented | Analytics | T61 |
| AI usage metric | Implemented | Analytics | T61 |
| Deadline risk | Implemented | Analytics | T61 |
| Growth Agent | Implemented | `GrowthAgent` | T62 |
| AI cost/abuse monitoring Agent | Implemented | `CostAbuseAgent` | T63 |
| Verified-only Content Agent | Implemented | `ContentAgent` | T64 |
| Optional verified-content Facebook publishing | Implemented | `SocialGrowthAgent`, `facebook_publisher.py` | T65 |
| Old mass-AI blog generator removed from active release | Implemented | legacy files/workflow removed; sitemap workflow only | T66 |
| Updated production agent GitHub workflow | Implemented | `.github/workflows/opp_agent.yml` | T67 |
| Verified DB-backed sitemap workflow | Implemented | `daily_scraper.yml`, `generate_sitemap.py` | T68 |

## Privacy, security and account controls

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Account data export | Implemented | `/account`, `account-export` | T69 |
| Account deletion | Implemented | `/account`, `account-delete` | T70 |
| Terms page | Implemented | `/terms` | T71 |
| Generated HTML sanitization | Implemented | `src/lib/sanitize.js`, blog renderers | T72 |
| Supabase RLS hardening | Implemented | migrations 000–004 | T73 |
| User-scoped application queries | Implemented | `Applications.jsx` + RLS | T74 |
| No private AI/service-role frontend variables | Implemented | frontend secret scan | T75 |
| Original private key / real env files excluded from release | Implemented | release verifier + packaging exclusions | T76 |

## Staff and administrator control planes

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Staff-only Trust & Quality Console | Implemented | `/quality`, `quality-admin` | T77 |
| Full admin panel | Implemented | `/admin`, `admin-api` | T78 |
| Admin users/roles/suspension/deletion | Implemented | `admin-api` | T79 |
| Prevent self-delete/self-ban/self-demotion | Implemented | `admin-api` | T80 |
| Manage opportunities/programs/provenance/verification | Implemented | Admin resources | T81 |
| Manage profiles/settings/applications/watchlists/matches | Implemented | Admin resources | T81 |
| Manage plans/subscriptions | Implemented | Admin resources | T81 |
| Manage sponsors/campaigns/leads/consents | Implemented | Admin resources | T81 |
| Manage counselor orgs/members/students/tasks | Implemented | Admin resources | T81 |
| Manage AI/agents/notifications/analytics | Implemented | Admin resources | T81 |
| Manage referrals/content/social records | Implemented | Admin resources | T81 |
| Manage platform settings | Implemented | Admin resources | T82 |
| Immutable admin audit trail | Implemented | `admin_audit_logs` | T83 |
| Manual agent/sitemap workflow triggers | Implemented | Admin → GitHub Actions dispatch | T84 |
| First-admin bootstrap utility | Implemented | `scripts/promote_admin.py` | T85 |

## UI / responsive / colors

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Responsive authenticated navigation | Implemented | Navbar/Sidebar/MainLayout | T86 |
| Mobile drawer instead of crowded desktop navigation | Implemented | layout components | T86 |
| Admin desktop tables | Implemented | `Admin.jsx` | T87 |
| Admin mobile cards | Implemented | `Admin.jsx` | T87 |
| Forms/actions stack on small screens | Implemented | pages + admin components | T88 |
| Scroll containment for wide tables/Kanban | Implemented | CSS/layout | T89 |
| Counselor invite mobile layout | Implemented | `CounselorInvites.jsx` | T90 |
| Consistent semantic color system | Implemented | `src/index.css` | T91 |
| Light/dark mode semantic colors | Implemented | `src/index.css`, theme provider | T91 |
| Keyboard `focus-visible` state | Implemented | `src/index.css` | T92 |
| Representative WCAG-AA color contrast target | Implemented at palette level | documented in `UI_QA.md` | T93 |

## Release documentation/testing

| Requested capability | Status | Location |
|---|---|---|
| Complete README | Implemented | `README.md` |
| DB update/query/function deployment steps | Implemented | `docs/DATABASE_SETUP.md` |
| Full module-by-module test steps | Implemented | `docs/TESTING.md` |
| Admin guide | Implemented | `docs/ADMIN.md` |
| Responsive/color QA guide | Implemented | `docs/UI_QA.md` |
| Release verification status | Implemented | `docs/DELIVERY_STATUS.md` |
| Offline release structural verifier | Implemented | `scripts/verify_release.py` |
| DB schema smoke SQL | Implemented | `supabase/tests/schema_smoke.sql` |



## 2026-09-13 authentication, community and agent extension

| Requested capability | Status | Primary implementation | Verification |
|---|---|---|---|
| Email/password login | Implemented | `AuthContext.jsx`, `Auth.jsx` | existing auth tests |
| 4-digit OTP-only login | Implemented | `otp-request`, `otp-verify`, migration 005 | T94 |
| 4-digit OTP password reset | Implemented | `PasswordReset.jsx`, OTP functions | T95 |
| OTP hashed/expired/throttled/attempt-limited | Implemented | migration 005 + OTP functions | T94 |
| Unknown OTP login email cannot create account | Implemented | service-role-only `auth_user_exists()` | T94 |
| OpenRouter | Implemented | shared AI router + Agent cascade | T96 |
| NVIDIA NIM | Implemented | shared AI router + Agent cascade | T96 |
| Mistral AI | Implemented | shared AI router + Agent cascade | T96 |
| Google AI Studio | Implemented | Gemini/Google AI provider | T96 |
| Cerebras | Implemented | shared AI router + Agent cascade | T96 |
| SMTP-only email | Implemented | `_shared/smtp.ts`, dispatcher | T31/T101 |
| Granular user notification topics/channels | Implemented | `Settings.jsx`, migration 005, dispatcher | T97 |
| Anonymous browsing + 10-second signup benefits banner | Implemented | `SignupBenefitsBanner.jsx`, `MainLayout.jsx` | T98 |
| Likes on blog/opportunity | Implemented | `Engagement.jsx`, `content_reactions` | T99 |
| Threaded comments/replies | Implemented | `Engagement.jsx`, `content_comments` | T99 |
| Opportunity Safety Agent | Implemented | `Agent/orchestrator.py` | T100 |
| Opportunity Freshness Agent | Implemented | `Agent/orchestrator.py` | T100 |
| Community Moderation Agent | Implemented | `Agent/orchestrator.py` | T100 |
| Application Coach Agent | Implemented | `Agent/orchestrator.py` | T100 |
| Responsive modern UI/motion | Implemented | layouts/auth/banner/index.css | T98 |
