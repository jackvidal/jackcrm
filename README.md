# Leadero / JackCRM

Hebrew CRM built with Next.js 16, React 19 and TypeScript. Convex runs the CRM database, password authentication and private call recording storage.

## Capabilities

- Leads: list and board views, search, status filters, editing, deletion and note timelines.
- Meetings: scheduling, statuses and automatic lead pipeline updates; signed Cal.com webhooks.
- Tasks: priorities, due dates, filters, completion and creation from AI call analysis.
- Calls: manual logging, private audio/video uploads up to 25 MB, Hebrew Whisper transcription and Claude analysis.
- Website analysis: structured Hebrew summaries, issues, opportunities and recommended services.
- WhatsApp: Wassender outbound messages, inbound threads, delivery statuses and editable Claude reply drafts.
- Settings: profile name, Cal.com organizer email, WhatsApp number and Wassender token.

## Local development

```sh
npm ci
cp .env.example .env.local
npx convex dev
```

Convex writes the development deployment URLs to `.env.local`. Configure its authentication keys without printing them:

```sh
node scripts/configure-convex-auth.mjs YOUR_DEV_DEPLOYMENT
node scripts/configure-user-auth.mjs YOUR_DEV_DEPLOYMENT http://localhost:3000
npx convex dev --once
npm run dev
```

Set the AI and webhook secrets in `.env.local`. Create a new account at `/signup`. No Supabase project or PostgreSQL connection is required.

```sh
npm test
npm run typecheck
npm run build
```

## Deployment

Production Convex deployment: `acrobatic-fox-775` in the `jack-vidal/jackcrm` project. Development: `unique-porcupine-370`. Keep development test accounts and records out of production.

Vercel needs `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, the server-only `CRM_AUTH_PRIVATE_KEY`, and the existing AI/webhook variables listed in `.env.example`. Convex needs `CRM_AUTH_JWKS`, `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`; the configuration scripts set these on the explicitly named deployment.

Deploy Convex with `npx convex deploy`, then deploy Next.js to Vercel using the production Convex URLs. Never copy development URLs into production configuration. Auth keys are deployment-specific; rerunning the scripts reuses their local key files.

## Integration setup

In the new account's Settings, enter the Cal.com organizer email and the WhatsApp number/Wassender token. Since the owner requested an empty system, previous per-user settings and messages are not imported.

- Cal.com endpoint: `https://jackcrm.vercel.app/api/webhooks/cal`. Use the same `CAL_WEBHOOK_SECRET` in Cal.com and Vercel. Subscribe to booking creation, rescheduling, cancellation and meeting-ended events.
- Wassender endpoint: `https://jackcrm.vercel.app/api/webhooks/wassender`. Set `WASSENDER_WEBHOOK_SECRET` in Vercel to the provider's shared secret. The webhook requires a valid signature.
- OpenAI powers Whisper transcription; Anthropic powers website analysis, call analysis and draft replies. Live provider delivery requires valid credentials and configured provider accounts.

## Architecture and maintenance

- `convex/schema.ts`: CRM, auth and audio metadata tables with indexes.
- `convex/auth.ts`: password authentication and atomic profile creation.
- `convex/crm.ts`, `convex/lib/store.ts`: bounded reads, ownership checks and atomic writes.
- `convex/webhooks.ts`: transactional event deduplication and processing. Failed processing rolls back and returns a retryable error.
- `convex/audio.ts`: authenticated upload/download, file ownership checks and the 25 MB limit. Storage URLs are not exposed publicly.
- `src/lib/db`: server-only data access. Preserves existing form/component shapes and converts numeric database timestamps to `Date` values.
- `src/proxy.ts`: Convex Auth session refresh and route protection.
- `src/lib/ai`: existing AI provider implementations.

Prisma remains only as a generated TypeScript contract for the existing components and as an optional legacy export tool. The app does not instantiate Prisma or read PostgreSQL. `prisma/schema.prisma` is the legacy shape; keep it synchronized if changing the compatibility contract. Native Convex schemas validate all persisted documents.

Each database request reads indexed pages of at most 100 records. The current server-rendered lists assemble pages to retain the existing filtering and enum ordering. Very large accounts will benefit from pushing list-specific ordering/filtering and dashboard aggregates into dedicated Convex functions.

Lead deletion immediately removes access, then deletes related history and audio in bounded scheduled batches. Password reset/email verification were not present in the original UI and are not configured by this migration.

## Legacy recovery tools

`scripts/export-postgres.mjs` can take a read-only consistent snapshot of an accessible old database. `scripts/import-convex.mjs` provides insert-only, resumable import and exact record verification on an explicitly named deployment. These tools were not used for the fresh production system. Restoring old Supabase owners into Convex Auth additionally requires an explicit identity mapping; do not import old users directly into this fresh system.

The original PostgreSQL seed and diagnostic scripts are archived under `legacy/scripts/`. `old/`, `backups/`, `.env.local` and auth key files are ignored by Git. Never commit them.
