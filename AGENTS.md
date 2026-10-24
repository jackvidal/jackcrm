# JackCRM maintenance

This repository is maintained with Codex. Read README.md before making changes.

- Production: Convex `jack-vidal/jackcrm`, deployment `acrobatic-fox-775`; Vercel project `jackcrm`.
- Development: Convex `unique-porcupine-370`. Use development for synthetic test data.
- The owner approved starting with an empty Convex database on 2026-10-24. Do not restore the unavailable Supabase database without a new request.
- Authentication, CRM records and private call recordings use Convex. PostgreSQL/Prisma is not a runtime database.
- Preserve Hebrew copy, RTL behavior, existing screens, Claude analyses, Whisper transcription, Cal.com and Wassender capabilities.
- Authenticate and check ownership at every Convex public boundary. Check child ownership against its lead. Keep service identity use in verified webhook handlers.
- Keep meeting pipeline updates and webhook processing atomic. Do not replace a Convex transaction with separate server requests.
- Use `npm test`, `npm run typecheck` and `npm run build` for substantive backend changes. Use live development checks for auth and storage when needed.
- Do not print secrets or commit `.env*` files other than `.env.example`, local legacy copies, snapshots or key files.

## Owner's standing preferences

- Do not add cookie-consent requirements, banners or gates to requested Meta tracking without asking. This is the owner's implementation preference, not a legal claim.
- Preserve supplied or approved landing-page copy. Do not add headings, explanations, disclaimers, notices or marketing claims without approval.
- Ask before changing unrequested funnel content or tracking decisions; continue routine authorized implementation.
