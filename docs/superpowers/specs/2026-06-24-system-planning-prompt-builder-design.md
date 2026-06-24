# System Planning Prompt Builder — Skill Design

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan
**Author:** brainstormed with Claude

## Summary

A Claude Code skill that helps a **non-technical learner** turn a business idea into a
**professional system-planning prompt** — the kind of prompt that asks an AI to fully plan
a software system before any code is written. The skill runs a guided, plain-Hebrew
interview, explains each technical concept in one line as it goes, and assembles a complete
Hebrew planning prompt the learner can paste into Claude/another AI to receive a full
architectural plan.

It is the "Step 0" of Jack's vibe-coding course: the missing step where a learner who is
**not a developer** learns to produce a high-quality planning prompt (like the original
JackCRM planning prompt) for **any** system they want to build. The skill produces the
prompt only — it does not write code or build the system.

## Context / motivation

Jack teaches people how to build the JackCRM system. The course was missing the step that
comes *before* building: how a non-technical person arrives at a great planning prompt. This
skill fills that gap. It is generic — it works for any system idea, not only CRM.

## Locked decisions

- **Generic** — builds a planning prompt for any system the learner wants, not only CRM/SaaS.
- **All Hebrew** — both the interview/explanations and the produced prompt are in Hebrew.
- **Business questions + one-line teaching** — the learner answers only plain-language
  business questions; before each technical part the skill fills in, it gives a one-sentence
  explanation (educational, course-appropriate).
- **Approach A — guided interview → assembled prompt** — ordered, sectioned interview
  (not a fill-in template, not free-form chat), for reliable, consistent, complete output.
- **Output is the prompt only** — the skill produces a copy-paste-ready planning prompt and
  saves it to a file; it does NOT run the planning or build anything.

## Skill identity

- **Name:** `system-planning-prompt-builder-by-jack-vidal` (parallels
  `hebrew-saas-starter-by-jack-vidal`).
- **Trigger:** when a user wants to build a system/app/SaaS but doesn't know how to write a
  good planning prompt — e.g. "I have an app idea and don't know how to ask for it",
  "help me write a prompt to plan a system", "I'm not a developer and want to plan a product".
- **Role in the course:** Step 0 — the learner produces the planning prompt here, then (in a
  later lesson) pastes it into a fresh chat to get the plan, then moves on to building. This
  skill never touches code and never builds the system.
- **Guiding principle:** the learner answers only plain-language business questions; the skill
  translates answers into the technical structure, with a one-line explanation before each
  technical concept.

## The interview (Approach A)

Ordered sections. One question at a time, plain Hebrew, no unexplained jargon. The skill
summarizes and confirms each section before moving on. It offers examples when the learner is
unsure, and skips sections that are not relevant (not every system has AI or webhooks).

| # | Section | Plain-language question | One-line technical explanation |
|---|---------|--------------------------|--------------------------------|
| 1 | הרעיון (the idea) | What does the system do? For which business/problem? | — |
| 2 | המשתמשים (users) | Who uses it? Does each person see only their own data? | "Per-user separation = each user sees only their own (multi-tenant)" |
| 3 | הישויות (entities) | What "things" does the system manage info about? (customers, orders, products…) | "Each such 'thing' becomes a database table" |
| 4 | פעולות (operations) | What do you want to do with each? (add/edit/delete/search) | "These are the CRUD operations" |
| 5 | זרימת תהליך / סטטוסים (flow/statuses) | Is there a process with stages? (new → in progress → closed) | "We'll translate this into statuses and a pipeline" |
| 6 | פיצ'רים חכמים / AI | Do you want AI to do something? (analyze, summarize, draft) | "That's a call to an AI model like Claude" |
| 7 | אינטגרציות / אוטומציות (integrations) | Does it connect to external systems? (calendar, WhatsApp, payments) | "A webhook = an automatic message from another system when something happens" |
| 8 | ממשק ועיצוב (UI/design) | Hebrew? RTL? style (clean/modern)? mobile? | "RTL = a right-to-left interface" |
| 9 | אבטחה (security) | Any keys/secrets? (usually yes) | "Secrets live in `.env.local`, not in the code" |
| 10 | גרסה ראשונה (first version) | What MUST be in v1, and what can wait? | "That's the MVP — we'll save the rest for 'later'" |

**Interview principles:**
- One question per turn; plain language; zero jargon without an explanation.
- If the learner is unsure, the skill offers an example (e.g. "for an online store the entities
  are: products, orders, customers").
- Sections can be skipped when not relevant.
- The skill summarizes each section in one sentence and confirms before continuing.

## Output: the assembled prompt

After the interview, the skill assembles a complete Hebrew planning prompt in the proven
structure of the original JackCRM planning prompt. Two parts:

**Part A — system description** (built from the learner's answers):
1. Title + goal ("I want to build system X for purpose Y…")
2. Per-entity feature breakdown (CRUD, search, notes)
3. Statuses / process flow
4. AI features (if chosen)
5. Integrations / webhooks (if chosen)
6. User system + data separation
7. UI (Hebrew/RTL/mobile/style)
8. Security and environment variables (`.env.local` + `.env.example`)

**Part B — the planning request** (fixed boilerplate, appended automatically, mirroring the
original prompt):

> "At this stage, **do not write code**. Only plan, fully and professionally. I want you to plan:"
> 1. Full system architecture
> 2. Recommended tech stack and why
> 3. Folder and file structure
> 4. Data models and tables
> 5. Relationships between tables
> 6. API routes / backend functions
> 7. Environment-variable structure
> 8. Recommended development order
> 9. Expected technical challenges and solutions
> 10. What must be in the first version

**How the skill ends:**
1. Prints the full prompt inside a copy-ready block.
2. Saves it to a file (e.g. `my-system-prompt.md`) so the learner doesn't lose it.
3. Explains in one line: "Now paste this into Claude in a new chat to get the plan."
4. Does NOT run the planning itself — the prompt is the deliverable. (Optional future
   enhancement: offer "want me to run it now?" — not in v1.)

## The skill's internal layout

```
system-planning-prompt-builder-by-jack-vidal/
├── SKILL.md                    ← core: trigger, interview flow, principles, assembly logic
├── references/
│   ├── interview-sections.md   ← the 10 sections: questions + short explanations + per-domain examples
│   └── glossary.md             ← short Hebrew glossary (webhook, RLS, env, CRUD, MVP…)
└── assets/
    └── prompt-template.md      ← the produced-prompt template (Part A placeholders + fixed Part B)
```

## Scope guardrails

- Does not write code or build a system — produces a prompt only.
- Does not touch the existing JackCRM project (no edits needed at all).
- Does not invent business logic the learner didn't ask for — if info is missing, it asks; it
  does not guess.
- Does not force the learner through every section — skips what's irrelevant.

## Installation location

The skill files install under the global skills directory:
`C:\Users\Admin\.claude\skills\system-planning-prompt-builder-by-jack-vidal\`
(alongside the other `*-by-jack-vidal` skills). This is outside the jackCRM repo. Only this
spec lives in the repo under `docs/superpowers/specs/`. Confirmed acceptable by the user.

## Out of scope

- Writing code or scaffolding any system.
- Running the produced planning prompt (the prompt is the deliverable).
- Non-Hebrew output.
- A fixed per-domain library of pre-written prompts (the prompt is generated live from the
  interview each run).
