# Leadero

A Hebrew-first CRM SaaS demonstrating a complete modern product: Next.js frontend + backend, Supabase auth + Postgres + Storage, Prisma ORM, OpenAI Whisper for audio transcription, Anthropic Claude for AI analyses, and Cal.com + Wassender (WhatsApp) webhook integrations.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS** + **shadcn/ui** primitives (own-the-code components)
- **Supabase** — Auth + Postgres + Row-Level Security + Storage (for audio uploads)
- **Prisma** ORM
- **Anthropic Claude Sonnet 4.6** — website analysis, call analysis, WhatsApp draft replies (structured tool-use + prompt caching)
- **OpenAI Whisper** — audio/video → Hebrew transcript
- **Cal.com** webhook (HMAC SHA-256 signed)
- **Wassender** webhook for WhatsApp (raw shared-secret auth, WhatsApp Multi-Device payload)

## Features

### Leads
- Create, edit, delete, search, filter by status
- Top-level notes + a separate **lead notes timeline**
- **AI Website Analysis** — paste a URL, Claude returns a structured Hebrew analysis (summary, issues, opportunities, recommended services, next steps). Saved to the lead.

### Meetings
- Attached to a lead with status auto-updating the lead pipeline
- **Cal.com webhook** at `/api/webhooks/cal` — creates/updates a lead and meeting from a real Cal.com booking. HMAC-verified, idempotent.

### Tasks
- Tied to a lead with priority + due date + status
- Filters: status, priority, "overdue / today / this week"
- Quick complete/uncomplete toggle, due-date badges

### Calls
- Manual call logging (inbound/outbound, time, duration, notes, transcript)
- **AI Call Analysis** — Claude reads the transcript and returns: summary, key topics, sentiment, prospect commitments, my commitments, recommended next steps, red flags.
- **One-click "create tasks automatically"** from the analysis's recommended next steps
- **Audio upload + Whisper transcription** — drag a recording (MP3/WAV/M4A/MP4/WebM, ≤25MB), it lands in Supabase Storage, OpenAI Whisper transcribes it in Hebrew, then Claude auto-runs the analysis. All in one flow.

### WhatsApp (Wassender)
- **Outbound** — per-lead conversation thread on the lead detail page. Type, send, Wassender forwards via WhatsApp.
- **Inbound** — `/api/webhooks/wassender` receives real messages from contacts. Auto-creates a lead if the phone is new, or appends to the existing lead's thread.
- **AI Draft Reply** — "Generate AI draft" button reads the conversation and asks Claude for a short, friendly-professional Hebrew reply. User edits before sending.

### Settings
- Profile (name, email)
- Cal.com organizer email (routes Cal webhooks to your account)
- Wassender phone number + Personal Access Token (routes WhatsApp webhooks + sends outbound)

## Getting started

### 1. Install dependencies
```powershell
npm install
```

### 2. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. From `Project Settings → API`, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (server-only!) → `SUPABASE_SERVICE_ROLE_KEY`
3. From `Project Settings → Database`, copy the connection strings:
   - **Connection pooling** (Transaction mode, port 6543) → `DATABASE_URL` (append `?pgbouncer=true&connection_limit=1`)
   - **Direct connection** (port 5432) → `DIRECT_URL`
4. Create a **private Storage bucket** named `call-audio` (used for audio uploads before Whisper).

### 3. Configure secrets
```powershell
copy .env.example .env.local
# Then edit .env.local with your real values
```

You'll need:
- Supabase URL + keys (above)
- `OPENAI_API_KEY` (for Whisper)
- `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL=claude-sonnet-4-6`
- `CAL_WEBHOOK_SECRET` (only if using Cal.com)
- `WASSENDER_WEBHOOK_SECRET` (only if using WhatsApp inbound — the secret comes from Wassender's webhook config)

### 4. Push the database schema
```powershell
npx prisma generate
npm run db:push
```

### 5. Apply RLS policies
Open the Supabase SQL editor and run the contents of `supabase/policies.sql`. This creates:
- The `auth.users → public.profiles` trigger (auto-creates a profile row on signup).
- RLS policies that restrict every owned table (leads, meetings, lead_notes, tasks, calls, whatsapp_messages, website_analyses) to the owner's rows only.
- Storage RLS policy on the `call-audio` bucket (users can only read/write `{userId}/...` paths).

### 6. Run the dev server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Webhook setup

### Cal.com
1. In Cal.com → `Settings → Developer → Webhooks`, add a new subscription.
2. URL: `https://YOUR-DEPLOYED-DOMAIN/api/webhooks/cal`
3. Subscribe to: `Booking Created`, `Booking Rescheduled`, `Booking Cancelled`, `Meeting Ended`
4. Set a secret and copy it into `.env.local` as `CAL_WEBHOOK_SECRET`.
5. In Leadero Settings, enter the email that appears as the organizer of your Cal.com bookings.

### Wassender (WhatsApp)
1. Sign up at [wasenderapi.com](https://wasenderapi.com), create a session, scan the QR with your WhatsApp.
2. Copy your **Personal Access Token** and paste it in Leadero Settings (along with your WhatsApp number in international format, digits only, e.g. `972501234567`).
3. In Wassender → Manage Webhook, set the URL to `https://YOUR-DEPLOYED-DOMAIN/api/webhooks/wassender` and subscribe to `messages.received` and `message.sent`.
4. Copy the **auto-generated Webhook Secret** from Wassender into your env as `WASSENDER_WEBHOOK_SECRET`.
5. **Important:** Vercel Deployment Protection must be disabled (or set to "Only Preview Deployments") so the public webhook URL is reachable.

For local webhook testing, use [ngrok](https://ngrok.com): `ngrok http 3000` and use the public URL above.

## Security
- All secrets live in `.env.local` (gitignored). `.env.example` is the template.
- Row Level Security on every owned table — users see only their own rows even if app code has a bug.
- Cal.com webhook verifies HMAC SHA-256 with `timingSafeEqual` and dedupes via a `webhook_events.externalId` unique constraint.
- Wassender webhook verifies the shared secret via constant-time comparison (Wassender sends the raw secret in `X-Webhook-Signature`, not HMAC), and dedupes via the same `webhook_events` table.
- Per-user Wassender tokens live on `Profile.wassenderToken` — never in env. The webhook routes events to the right user by matching `sessionId === Profile.wassenderToken`.
- OpenAI + Anthropic + Supabase service-role keys are never imported in any file under `'use client'`.

## Project layout
```
src/
├── app/
│   ├── (auth)/                    # login, signup
│   ├── (dashboard)/               # protected routes
│   │   ├── dashboard/             # home
│   │   ├── leads/                 # list, [id], new, edit
│   │   ├── meetings/              # list
│   │   ├── tasks/                 # list
│   │   ├── calls/                 # actions only — UI lives in lead detail
│   │   ├── whatsapp/              # actions only — UI lives in lead detail
│   │   └── settings/
│   └── api/
│       ├── calls/[id]/transcribe/ # POST → download from Storage → Whisper
│       ├── calls/[id]/analyze/    # POST → Claude call analysis
│       ├── leads/[id]/analyze/    # POST → Claude website analysis
│       ├── whatsapp/draft/        # POST → Claude WhatsApp reply draft
│       └── webhooks/
│           ├── cal/               # POST → Cal.com booking events
│           └── wassender/         # POST → WhatsApp messages.received etc.
├── components/
│   ├── ui/                        # shadcn primitives (RTL-corrected)
│   ├── leads/, meetings/, tasks/, calls/, whatsapp/, analysis/, settings/, layout/
│   └── theme-toggle.tsx
├── lib/
│   ├── ai/
│   │   ├── analyze-website.ts     # Claude + web_fetch
│   │   ├── analyze-call.ts        # Claude tool_use on transcript
│   │   ├── transcribe-audio.ts    # OpenAI Whisper
│   │   ├── draft-whatsapp-reply.ts # Claude → suggested reply
│   │   └── prompts.ts, call-prompts.ts
│   ├── supabase/{client,server,middleware}.ts
│   ├── webhooks/{cal,wassender}.ts
│   ├── whatsapp/send.ts           # Wassender outbound API
│   ├── auth.ts, prisma.ts, utils.ts
├── schemas/                       # Zod schemas (cal-webhook, wassender-webhook, lead, call, ...)
└── i18n/he.ts                     # Every UI string in one place
```

## Built across 5 sessions
1. **Foundation + Leads + AI website analysis + Cal.com webhook** — the original V1
2. **Tasks** — full CRUD with status/priority/due-date filters
3. **Calls** — manual logging + AI call analysis with auto-task creation
4. **Audio upload + Whisper transcription** — drag a recording → transcript + analysis in one flow
5. **WhatsApp via Wassender** — outbound send + inbound webhook + AI draft replies

The full architecture and patterns are captured as a reusable Claude Code skill: [hebrew-saas-starter-by-jack-vidal](https://github.com/jackvidal/hebrew-saas-starter-by-jack-vidal).
