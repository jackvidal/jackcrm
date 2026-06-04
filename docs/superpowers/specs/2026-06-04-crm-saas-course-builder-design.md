# CRM SaaS Course Builder — Skill Design

**Date:** 2026-06-04
**Status:** Approved (design); pending implementation plan
**Author:** brainstormed with Claude

## Summary

A Claude Code skill that acts as a **live build tutor**: when invoked, it drives Claude
to build an English / LTR, US-market CRM SaaS step by step, and at every step emits a
complete teaching package (lesson docs, video/recording scripts, and narrated git
commits). Each run produces both a working app **and** a course showing how it was built.

It is the English/US, course-producing counterpart to the existing
`hebrew-saas-starter-by-jack-vidal` skill. It **borrows** that skill's proven patterns
(RLS recipe, signed-webhook handler, cached Claude prompts) but does **not** depend on it
(no RTL coupling).

## Locked decisions

- **One skill, teaches as it builds** — a single skill produces both the app and the course.
- **Three teaching artifacts per step:** lesson markdown files, narrated per-lesson commits,
  and video/recording scripts.
- **Faithful port + Twilio SMS:** keep the exact proven feature set and integrations
  (Cal.com + WhatsApp/Wassender, Whisper, Claude), translated to English/LTR with US copy,
  **plus** add Twilio SMS as a second messaging channel.
- **Audience: beginners** — lessons explain fundamentals before each feature.
- **Mode: live build tutor** — builds step-by-step in a real session, generating code,
  commits, lessons, and scripts live against a fixed curriculum spine.
- **Structure: orchestrator + per-module playbooks** (Approach B).

## Skill identity

- **Name:** `crm-saas-course-builder-by-jack-vidal` (parallels `hebrew-saas-starter-by-jack-vidal`).
- **Trigger:** when the user wants to build the US CRM SaaS as a teaching course / film a
  "build a full AI SaaS from scratch" series for beginners.
- **Owns:** a fixed curriculum spine (module order + learning objectives + teaching
  standards). Code and lesson prose are generated live against that spine each run.

## Curriculum spine (modules)

Each module = one course module = one resumable build step.

| # | Module | Builds | Key beginner concepts |
|---|--------|--------|------------------------|
| 0 | Setup & accounts | Tooling, repo, env, accounts (Supabase, OpenAI, Anthropic, Twilio, Cal.com, Wassender) | What each service is, env vars, secrets stay server-side |
| 1 | Foundation + Auth | Next.js 16 app, Tailwind+shadcn (LTR), Supabase auth, login/signup, protected routes | Components, App Router, client vs server, auth basics |
| 2 | Leads + AI website analysis | Leads CRUD, Prisma schema, RLS, Claude `web_fetch` structured analysis | Databases/SQL basics, ORM, Row-Level Security, first Claude call |
| 3 | Meetings + Cal.com webhook | Meetings, pipeline status, HMAC-signed webhook | What a webhook is, HMAC verification, idempotency |
| 4 | Tasks | Tasks CRUD, filters, due-date badges | State, filtering, derived UI |
| 5 | Calls + AI analysis + Whisper | Call logging, Claude tool-use analysis, audio upload → Whisper (en-US) → auto-tasks | Tool-use, prompt caching, file storage, async flows |
| 6 | WhatsApp (Wassender) | Outbound/inbound threads, AI draft replies, signed webhook | Messaging integration, shared-secret auth |
| 7 | Twilio SMS (new channel) | SMS send + inbound webhook, unified conversation, AI draft | Second integration; comparing two providers |
| 8 | Polish, deploy & ship the course | Settings, Vercel deploy, recap | Deployment, env in prod, wrap-up |

9 modules total.

## Output: the course package

Produced in the target project as the app is built:

```
/                         ← the working CRM app (src/, prisma/, etc.)
course/
├── README.md             ← course outline, prerequisites, how to follow along
├── glossary.md           ← running beginner glossary (appended each module)
├── lessons/
│   ├── lesson-00-setup.md
│   ├── lesson-01-foundation-auth.md
│   └── … one per module
├── scripts/              ← video/recording scripts
│   ├── script-00-setup.md
│   └── … one per module
└── checkpoints.md        ← maps each module → the git commit(s) that complete it
```

- **Lessons** — written walkthrough: what we're building & why, concepts (with "What is X?"
  beginner sidebars), code walkthrough, common mistakes, recap.
- **Scripts** — filming guide per module: scene/segment list, *what to say* (narration),
  *what to show on screen*, callouts. Written to be spoken, not just reformatted lesson text.
- **Narrated commits** — each lesson maps to one or a few small commits with teaching commit
  messages; `checkpoints.md` indexes them so a learner can `git checkout` any point.

## The skill's internal layout

```
crm-saas-course-builder-by-jack-vidal/
├── SKILL.md                      ← orchestrator: spine, per-module loop, teaching standards, resume logic
├── references/
│   ├── module-00-setup.md        ← one playbook per module: exact build steps + teaching points
│   ├── module-01-foundation.md
│   ├── … through module-08
│   ├── us-adaptation.md          ← LTR/English/US copy rules, en-US Whisper, English prompts
│   ├── twilio-sms.md             ← the new integration guide (the one part not in the proven app)
│   └── borrowed-patterns.md      ← RLS recipe, signed-webhook handler, cached Claude prompts (from proven app)
└── assets/
    ├── lesson-template.md
    ├── script-template.md
    └── commit-style.md           ← how to write teaching commit messages
```

## The per-module run loop

`SKILL.md` orchestrates this loop, one module at a time:

1. **Announce the module** — "Module N: <title>. Here's what we'll build and learn."
   (chapter intro for the camera/learner).
2. **Load that module's playbook** from `references/module-NN.md`.
3. **Teach-then-build, in small steps** — for each step: explain the concept (beginner
   sidebar if new), write the code, briefly show it works.
4. **Verify it works** — run the relevant check (build/typecheck/dev server or a quick manual
   check) before declaring the step done. Confirm, don't assume.
5. **Commit** with a teaching commit message (per `commit-style.md`); record in `checkpoints.md`.
6. **Write `lesson-NN.md`** (from `lesson-template.md`) and **`script-NN.md`** (from
   `script-template.md`); append new terms to `glossary.md`.
7. **Checkpoint & pause option** — summarize, then ask whether to continue or stop.
   Resumable: re-invoking detects the last completed module from `checkpoints.md` and offers
   to resume.

## Beginner-teaching standards (enforced by SKILL.md)

- Define every new term on first use; never assume prior knowledge of webhooks, RLS, ORMs,
  env vars, async.
- One concept at a time; short code chunks with plain-English explanation.
- Each lesson ends with recap + "you can now…", common mistakes, and what's next.
- Scripts are written to be spoken, with on-screen cues — not the lesson text reformatted.

## Scope guardrail

The skill builds the exact proven feature set (faithful port) + Twilio. It does not invent
new features mid-build; any deviation is surfaced to the user, not silently added.

## US / English / Twilio specifics

**English / LTR / US adaptations** (`references/us-adaptation.md`):
- Layout: LTR throughout — `<html lang="en">`, no `dir="rtl"`, standard Tailwind. One
  `i18n/en.ts` string file (same architecture as the Hebrew `he.ts`).
- AI language: Claude prompts instruct English output (website analysis, call analysis,
  draft replies); Whisper set to en-US transcription.
- Copy/branding: US-flavored product copy, US phone formatting (`+1`), US date/time formatting.
- Channels: WhatsApp/Wassender kept as-is; Twilio SMS added as a parallel channel.

**Twilio SMS module** (`references/twilio-sms.md` — the only genuinely new code vs. the proven app):
- Outbound send via Twilio REST API; inbound via `/api/webhooks/twilio` with signature
  validation (`X-Twilio-Signature`), mirroring the existing signed-webhook + idempotency pattern.
- Unified per-lead conversation thread shows both WhatsApp and SMS messages (channel-tagged),
  reusing the message timeline UI.
- AI draft reply works across both channels.
- Taught as "second integration": notice what's the same (webhook security, idempotency,
  threading) and what differs (provider API, signature scheme).

**Verification baked into the build:** each module's playbook lists concrete checks
(typecheck/build pass, dev-server smoke check, webhook payload test where relevant) that must
pass before the module's commit — so the course never teaches a broken step.

**Relationship to the existing skill:** `borrowed-patterns.md` lifts the proven RLS recipe,
signed-webhook handler, and cached-Claude-prompt patterns from `hebrew-saas-starter-by-jack-vidal`
— copied/adapted, not depended on. No RTL coupling.

## Out of scope

- New product features beyond the proven app + Twilio SMS.
- A pre-authored "course-in-a-box" (content is generated live each run against the spine).
- Non-US localizations.
