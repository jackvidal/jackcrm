# Leadero

A Hebrew-first CRM SaaS demonstrating a complete modern product: Next.js frontend + backend, Supabase auth + Postgres, Prisma ORM, Anthropic Claude for AI website analysis, and a Cal.com webhook for booking automation.

## Stack
- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** + **shadcn/ui** primitives (own-the-code components)
- **Supabase** (Auth + Postgres + Row-Level Security)
- **Prisma** ORM
- **Anthropic Claude Sonnet 4.6** for website analysis (with structured tool-use + prompt caching)
- **Cal.com** webhook integration with HMAC signature verification + idempotency

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

### 3. Configure secrets
```powershell
copy .env.example .env.local
# Then edit .env.local with your real values
```

### 4. Push the database schema
```powershell
npx prisma generate
npx prisma db push
```

### 5. Apply RLS policies
Open the Supabase SQL editor and run the contents of `supabase/policies.sql`. This creates:
- The `auth.users → public.profiles` trigger (auto-creates a profile row on signup).
- RLS policies that restrict every table to the owner's rows only.

### 6. Run the dev server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Features
- Email + password authentication (Supabase)
- Hebrew RTL UI throughout the dashboard
- **Leads**: create, edit, delete, search, filter by status
- **Lead notes**: timeline of internal notes
- **Meetings**: attached to a lead, with status auto-updating the lead
- **AI Website Analysis**: paste a URL, Claude returns a structured Hebrew analysis (summary, issues, opportunities, recommended services, next steps) — saved to the lead
- **Cal.com webhook** at `/api/webhooks/cal`: HMAC-verified, idempotent — creates/updates a lead and meeting from a booking
- **Settings**: map your Cal.com organizer email to your Leadero account

## Cal.com webhook setup
1. In Cal.com → `Settings → Developer → Webhooks`, add a new subscription.
2. URL: `https://YOUR-DEPLOYED-DOMAIN/api/webhooks/cal`
3. Subscribe to: `Booking Created`, `Booking Rescheduled`, `Booking Cancelled`, `Meeting Ended`
4. Set a secret and copy it into `.env.local` as `CAL_WEBHOOK_SECRET`.
5. In Leadero Settings, enter the email that appears as the organizer of your Cal.com bookings.

For local testing, use [ngrok](https://ngrok.com): `ngrok http 3000` and use the public URL above.

## Security
- All secrets live in `.env.local` (gitignored). `.env.example` is the template.
- Row Level Security on every owned table — users see only their own rows even if app code has a bug.
- Cal.com webhook verifies HMAC SHA-256 with `timingSafeEqual` and dedupes via a `webhook_events.externalId` unique constraint.
- Anthropic + Supabase service-role keys are never imported in any file under `'use client'`.

## Project layout
See `CLAUDE.md` or the original plan at `~/.claude/plans/i-want-to-build-delightful-sketch.md` for the full architecture.
