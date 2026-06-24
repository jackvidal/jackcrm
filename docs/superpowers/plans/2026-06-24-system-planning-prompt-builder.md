# System Planning Prompt Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Hebrew Claude Code skill that interviews a non-technical learner about their idea and produces a professional, copy-ready system-planning prompt (the "plan it, don't code it yet" prompt) for any system.

**Architecture:** A markdown skill (`SKILL.md` + `references/` + `assets/`) installed in the global skills directory. `SKILL.md` orchestrates a sectioned plain-Hebrew interview; `references/interview-sections.md` holds the questions/explanations/examples; `references/glossary.md` is a Hebrew jargon glossary; `assets/prompt-template.md` is the output template (learner-answer placeholders + a fixed planning-request tail). The skill assembles answers into the template and saves the result to a file. It produces the prompt only — it never writes code or builds a system.

**Tech Stack:** Markdown only (no build, no runtime). "Tests" are structural lint checks + a dogfooding eval that runs the interview against two sample personas and verifies the assembled prompt is complete.

**Medium note:** This is content authoring, not code. There is no pytest. Each task creates one file, then verifies it by (a) re-reading it against an explicit checklist and (b) — for the assembly tasks — a dogfood eval. Commits are frequent and atomic, one file per task where practical.

**Install location:** `C:\Users\Admin\.claude\skills\system-planning-prompt-builder-by-jack-vidal\`
This is **outside** the jackCRM repo. The spec and this plan live in the jackCRM repo under `docs/superpowers/`; the skill files live in the global skills dir. Git for the skill dir is handled in Task 1.

**Two reusable dogfood personas** (used by the eval steps in Tasks 5–6):
- **Persona A — online jewelry store ("חנות תכשיטים אונליין"):** entities = products, orders, customers; has a payments integration; multi-user (each shop owner sees only their data); no AI in v1.
- **Persona B — personal fitness coach ("מאמן כושר אישי"):** entities = clients, sessions, programs; Cal.com booking webhook; AI to summarize client session notes; single business owner.

**Definition of done for the whole skill (the eval target):** For each persona, walking `interview-sections.md` and filling `prompt-template.md` yields a Hebrew prompt that contains: a title+goal, every entity with CRUD, statuses (where relevant), AI section (only if chosen), integrations section (only if chosen), users + data-separation, UI/RTL, security/env, AND the fixed 10-point planning request with "אל תכתוב קוד".

---

### Task 1: Scaffold the skill directory and its git repo

**Files:**
- Create dir: `C:\Users\Admin\.claude\skills\system-planning-prompt-builder-by-jack-vidal\`
- Create: `…\.gitignore`

- [ ] **Step 1: Create the directory tree**

Run (Git Bash):
```bash
SKILL_DIR="/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal"
mkdir -p "$SKILL_DIR/references" "$SKILL_DIR/assets"
ls -la "$SKILL_DIR"
```
Expected: directory exists with `references/` and `assets/` subfolders.

- [ ] **Step 2: Create `.gitignore`**

Create `…\.gitignore` with:
```
.DS_Store
*.log
```

- [ ] **Step 3: Initialize git (skills are standalone repos here)**

Run:
```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git init && git add .gitignore && git commit -m "chore: scaffold system-planning-prompt-builder skill"
```
Expected: a new repo with one commit. (Mirrors the existing `hebrew-saas-starter-by-jack-vidal`, which is its own repo.)

---

### Task 2: Write `references/glossary.md` (Hebrew jargon glossary)

**Files:**
- Create: `…\references\glossary.md`

This is referenced by `SKILL.md` and reused for the one-line explanations. Write it first so later files can point to it.

- [ ] **Step 1: Write the glossary file**

Create `…\references\glossary.md` with exactly:
```markdown
# מילון מושגים (לשימוש פנימי של הסקיל)

הסבר כל מושג במשפט אחד, בעברית פשוטה, בלי ז'רגון נוסף. כשמושג עולה לראשונה
בראיון — הסבר אותו פעם אחת בעזרת השורה כאן.

- **ישות (Entity):** "דבר" שהמערכת מנהלת עליו מידע (לקוח, הזמנה, מוצר). כל ישות הופכת לטבלה בבסיס הנתונים.
- **טבלה (Table):** מקום בבסיס הנתונים שבו נשמר סוג מידע אחד, שורה לכל פריט.
- **CRUD:** ארבע הפעולות הבסיסיות על מידע — יצירה, קריאה, עדכון, מחיקה.
- **סטטוס / פייפליין (Pipeline):** השלבים שפריט עובר בתהליך (חדש → בטיפול → נסגר).
- **הפרדת משתמשים / Multi-tenant:** כל משתמש רואה ועורך רק את המידע שלו, לא של אחרים.
- **RLS (Row-Level Security):** כלל בבסיס הנתונים שמוודא שמשתמש ניגש רק לשורות שלו.
- **AI / מודל שפה:** קריאה למודל כמו Claude שמקבל טקסט ומחזיר ניתוח, סיכום או טיוטה.
- **Webhook:** הודעה אוטומטית שמערכת חיצונית שולחת למערכת שלך כשקורה משהו (למשל נקבעה פגישה ביומן).
- **אינטגרציה:** חיבור בין המערכת שלך למערכת חיצונית (יומן, וואטסאפ, תשלומים).
- **משתני סביבה / .env:** קובץ שבו נשמרים מפתחות וסודות, מחוץ לקוד, כדי שלא ידלפו.
- **MVP / גרסה ראשונה:** הגרסה המינimalית שכוללת רק מה שחייב כדי שהמערכת תעבוד ותהיה שימושית.
- **RTL:** ממשק מימין לשמאל, כמו בעברית.
- **API route / backend function:** נקודת קצה בצד השרת שמבצעת פעולה (שמירה, שליפה, קריאה ל-AI).
```

- [ ] **Step 2: Verify the file**

Run:
```bash
grep -c '^- \*\*' "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal/references/glossary.md"
```
Expected: `13` (one line per term). Confirm every term used later in the interview (entity, CRUD, multi-tenant, AI, webhook, env, MVP, RTL) appears.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git add references/glossary.md && git commit -m "docs: add Hebrew jargon glossary"
```

---

### Task 3: Write `assets/prompt-template.md` (the output template)

**Files:**
- Create: `…\assets\prompt-template.md`

This is the exact shape of the produced prompt. Placeholders use `{{...}}`. Sections marked OPTIONAL are omitted entirely when the learner skipped them. Part B (the planning request) is fixed and copied verbatim from the proven JackCRM prompt.

- [ ] **Step 1: Write the template file**

Create `…\assets\prompt-template.md` with exactly:
```markdown
<!--
תבנית הפרומפט המופק. כללי מילוי:
- החלף כל {{placeholder}} בתשובות הלומד.
- סקשן שמסומן OPTIONAL — אם הלומד דילג עליו, מחק את כל הסקשן (כותרת + תוכן).
- חלק ב' (בקשת התכנון) קבוע — אל תשנה אותו לעולם.
- התוצר הסופי הוא טקסט עברי נקי בלי ההערות האלה ובלי ה-placeholders.
-->

# בקשת תכנון מערכת — {{system_name}}

אני רוצה לבנות מערכת בשם **{{system_name}}** — {{one_line_purpose}}.

המטרה: {{goal_paragraph}}

## משתמשים
{{users_description}}
<!-- אם multi-tenant: --> כל משתמש רואה רק את המידע שלו.

## ישויות מרכזיות
המערכת מנהלת מידע על:
{{entities_bullets}}

## פעולות נדרשות
לכל ישות יש לאפשר:
{{operations_bullets}}

## זרימת תהליך וסטטוסים  <!-- OPTIONAL -->
{{statuses_bullets}}

## פיצ'רים חכמים (AI)  <!-- OPTIONAL -->
{{ai_features_bullets}}

## אינטגרציות ואוטומציות  <!-- OPTIONAL -->
{{integrations_bullets}}

## ממשק ועיצוב
{{ui_bullets}}

## אבטחה ומשתני סביבה
- כל המפתחות והסודות יישמרו בקובץ `.env.local`
- לא לשמור API keys בתוך הקוד
- ליצור גם קובץ `.env.example`

---

## מה אני מבקש שתעשה

בשלב הזה **אל תכתוב קוד**. רק תכנן את המערכת בצורה מלאה ומקצועית.

אני רוצה שתתכנן:
1. ארכיטקטורת מערכת מלאה
2. Stack טכנולוגי מומלץ ולמה
3. מבנה תיקיות וקבצים
4. מודלי נתונים וטבלאות
5. קשרים בין הטבלאות
6. API routes / backend functions
7. מבנה משתני הסביבה
8. סדר פיתוח מומלץ
9. אתגרים טכניים צפויים ופתרונות
10. מה צריך להיות בגרסה הראשונה של המערכת

התכנון צריך להיות מקצועי, ברור ומוכן לפרויקט אמיתי.
אל תכתוב עדיין קוד.
```

- [ ] **Step 2: Verify Part B is verbatim and complete**

Run:
```bash
grep -n "אל תכתוב קוד" "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal/assets/prompt-template.md"
grep -cE '^[0-9]+\. ' "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal/assets/prompt-template.md"
```
Expected: "אל תכתוב קוד" appears twice (intro + closing line); the numbered list has exactly `10` items matching the 10 planning deliverables from the spec.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git add assets/prompt-template.md && git commit -m "feat: add produced-prompt template with fixed planning request"
```

---

### Task 4: Write `references/interview-sections.md` (questions + explanations + examples)

**Files:**
- Create: `…\references\interview-sections.md`

One block per section. Each block has: the Hebrew question, when to give the glossary explanation, an example to offer if the learner is stuck, whether it's skippable, and which template placeholder it fills.

- [ ] **Step 1: Write the interview-sections file**

Create `…\references\interview-sections.md` with exactly:
```markdown
# סקשני הראיון

שאל שאלה אחת בכל פעם, בעברית פשוטה. לפני חלק טכני — תן את ההסבר במשפט אחד
(מתוך `glossary.md`). אם הלומד לא בטוח — הצע את הדוגמה. בסוף כל סקשן — סכם
במשפט אחד ובקש אישור לפני שממשיכים. סקשנים מסומנים "ניתן לדלג" — דלג אם לא רלוונטי.

## 1. הרעיון  → ממלא: {{system_name}}, {{one_line_purpose}}, {{goal_paragraph}}
- שאלה: "ספר לי במשפט-שניים — מה המערכת עושה, ולמי היא מיועדת?"
- המשך: "איך נקרא למערכת?" (שם)
- דוגמה אם נתקע: "למשל: 'מערכת לניהול הזמנות לחנות תכשיטים אונליין'."

## 2. המשתמשים  → ממלא: {{users_description}} + דגל multi-tenant
- הסבר קודם: "הפרדת משתמשים = כל אחד רואה רק את המידע שלו."
- שאלה: "מי ישתמש במערכת? והאם כל משתמש צריך לראות רק את המידע שלו, או שכולם רואים הכול?"
- דוגמה: "בחנות — כל בעל חנות רואה רק את ההזמנות שלו."

## 3. הישויות  → ממלא: {{entities_bullets}}
- הסבר קודם: "כל 'דבר' שהמערכת מנהלת עליו מידע הופך לטבלה בבסיס הנתונים."
- שאלה: "על אילו 'דברים' המערכת מנהלת מידע? תן לי רשימה."
- דוגמה: "בחנות אונליין: מוצרים, הזמנות, לקוחות."

## 4. פעולות  → ממלא: {{operations_bullets}}
- הסבר קודם: "אלה פעולות ה-CRUD: יצירה, עריכה, מחיקה, חיפוש."
- שאלה: "לכל אחד מהדברים שאמרת — מה תרצה לעשות איתו? (להוסיף / לערוך / למחוק / לחפש / להוסיף הערות)"
- ברירת מחדל: אם הלומד אומר "הכול" — סמן את כל ארבע הפעולות לכל ישות.

## 5. זרימת תהליך וסטטוסים  → ממלא: {{statuses_bullets}}  (ניתן לדלג)
- הסבר קודם: "סטטוסים = השלבים שפריט עובר בתהליך."
- שאלה: "האם יש תהליך עם שלבים שפריט עובר? (למשל: חדש → בטיפול → נסגר)"
- דוגמה: "בהזמנה: התקבלה → בהכנה → נשלחה → הושלמה."
- אם אין תהליך כזה — דלג על הסקשן הזה בתבנית.

## 6. פיצ'רים חכמים (AI)  → ממלא: {{ai_features_bullets}}  (ניתן לדלג)
- הסבר קודם: "AI = קריאה למודל כמו Claude שמנתח/מסכם/כותב טיוטה."
- שאלה: "האם תרצה ש-AI יעשה משהו חכם? (לנתח אתר, לסכם שיחה, לכתוב טיוטת תשובה, להמליץ)"
- דוגמה: "לנתח אתר של לקוח ולהציע שיפורים."
- אם לא — דלג על הסקשן הזה בתבנית.

## 7. אינטגרציות ואוטומציות  → ממלא: {{integrations_bullets}}  (ניתן לדלג)
- הסבר קודם: "Webhook = הודעה אוטומטית ממערכת חיצונית כשקורה משהו."
- שאלה: "האם המערכת מתחברת למשהו חיצוני? (יומן כמו Cal.com, וואטסאפ, מערכת תשלומים, מייל)"
- דוגמה: "כשנקבעת פגישה ב-Cal.com — נוצר ליד חדש אוטומטית."
- אם אין — דלג על הסקשן הזה בתבנית.

## 8. ממשק ועיצוב  → ממלא: {{ui_bullets}}
- הסבר קודם (אם רלוונטי): "RTL = ממשק מימין לשמאל, כמו בעברית."
- שאלות: "באיזו שפה הממשק? עברית/RTL? צריך לעבוד גם במובייל? יש סגנון שאתה אוהב (נקי/מודרני/יוקרתי)?"

## 9. אבטחה  → ממלא: סקשן האבטחה (קבוע ברובו)
- הסבר קודם: "סודות ומפתחות נשמרים בקובץ .env, מחוץ לקוד, כדי שלא ידלפו."
- שאלה: "האם המערכת תשתמש במפתחות/סודות חיצוניים? (בדרך כלל כן — למשל מפתח של בסיס הנתונים או של ה-AI)"
- הערה: גם אם הלומד לא בטוח — תמיד הוסף את סקשן ה-.env הסטנדרטי.

## 10. גרסה ראשונה  → משפיע על {{goal_paragraph}} והדגשים
- הסבר קודם: "MVP = הגרסה המינימלית שכוללת רק מה שחייב כדי שהמערכת תעבוד."
- שאלה: "מכל מה שאמרנו — מה *חייב* להיות בגרסה הראשונה, ומה יכול לחכות?"
- שימוש: הדגש את חובות ה-v1 בפרומפט; ציין את ה'אחר כך' כ"הרחבות עתידיות".
```

- [ ] **Step 2: Verify coverage**

Run:
```bash
grep -cE '^## [0-9]+\.' "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal/references/interview-sections.md"
```
Expected: `10` sections. Confirm every `{{placeholder}}` used in `assets/prompt-template.md` is produced by at least one section here (entities, operations, statuses, ai, integrations, users, ui, system_name, purpose, goal).

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git add references/interview-sections.md && git commit -m "feat: add interview sections (questions, explanations, examples)"
```

---

### Task 5: Write `SKILL.md` (the orchestrator)

**Files:**
- Create: `…\SKILL.md`

The entry point. Frontmatter `name` + a generous `description` for triggering (matching the style of `hebrew-saas-starter-by-jack-vidal`). Body: when to use, the run loop, principles, assembly, ending, guardrails.

- [ ] **Step 1: Write SKILL.md**

Create `…\SKILL.md` with exactly:
```markdown
---
name: system-planning-prompt-builder-by-jack-vidal
description: Help a non-technical person turn a business idea into a professional, copy-ready system-planning prompt in Hebrew — the "plan it fully, don't write code yet" prompt you paste into Claude to get a complete architecture plan. Use this skill whenever someone wants to build an app/system/SaaS but doesn't know how to ask for it, says things like "יש לי רעיון לאפליקציה ואני לא יודע איך לבקש", "תעזור לי לכתוב פרומפט לתכנון מערכת", "אני לא מתכנת ורוצה לתכנן מוצר", "how do I write a prompt to plan my system", or is a vibe-coding learner who needs the planning-prompt step before building. Trigger generously — even a vague "I want to build X, where do I start" from a non-developer should load this skill, because it runs a guided plain-Hebrew interview and assembles the technical prompt structure the learner can't write alone. Do NOT use this to actually build or code the system — it produces the planning prompt only.
---

# בונה פרומפט תכנון מערכת — by Jack Vidal

מטרת הסקיל: לקחת לומד **לא טכני** עם רעיון, ולהפיק עבורו **פרומפט תכנון מערכת
מקצועי בעברית** — מאותו סוג שמבקש מ-AI לתכנן מערכת לפני שכותבים קוד.

זהו "שלב 0" בקורס: הלומד מייצר כאן את הפרומפט, ואחר כך מדביק אותו בשיחה חדשה
כדי לקבל תכנון. **הסקיל הזה לא כותב קוד ולא בונה מערכת — הוא מפיק פרומפט בלבד.**

## מתי להשתמש

כשמישהו רוצה לבנות מערכת/אפליקציה אבל לא יודע איך לנסח בקשת תכנון טובה, או שהוא
לומד vibe coding בלי רקע טכני וצריך את שלב בניית הפרומפט.

## עיקרון על

הלומד עונה רק על **שאלות עסקיות בשפה פשוטה**. אתה (הסקיל) מתרגם את התשובות למבנה
הטכני. לפני כל מושג טכני — תן הסבר של **משפט אחד** מתוך `references/glossary.md`.
אל תניח שום ידע מוקדם. אל תמציא לוגיקה שהלומד לא ביקש — אם חסר מידע, שאל.

## תהליך הריצה

1. **פתח בעברית** והסבר בקצרה: "אני אשאל אותך כמה שאלות על הרעיון, ובסוף תקבל
   פרומפט מוכן להעתקה שתוכל לתת ל-Claude כדי שיתכנן לך את המערכת."
2. **טען את `references/interview-sections.md`** ועבור עליו סקשן-סקשן.
3. **לכל סקשן:** תן את ההסבר הקצר (אם יש מושג טכני), שאל את השאלה, הצע דוגמה אם
   הלומד מתלבט. **שאלה אחת בכל הודעה.** סכם כל סקשן במשפט ובקש אישור לפני שממשיכים.
4. **דלג** על סקשנים שמסומנים "ניתן לדלג" אם לא רלוונטיים ללומד (לא לכל מערכת יש
   AI או webhook).
5. **הרכב את הפרומפט:** טען את `assets/prompt-template.md`, החלף כל `{{placeholder}}`
   בתשובות, ומחק כל סקשן OPTIONAL שדולג. חלק ב' (בקשת התכנון, 10 הסעיפים +
   "אל תכתוב קוד") **קבוע — אל תשנה אותו.**
6. **הצג ושמור:**
   - הצג את הפרומפט המלא בתוך בלוק קוד מוקף ב-``` כדי שקל להעתיק.
   - שמור אותו כקובץ בפרויקט/בתיקייה הנוכחית בשם `my-system-prompt.md`.
   - אמור בשורה אחת: "סיימנו! פתח שיחה חדשה עם Claude, הדבק את הפרומפט הזה,
     ותקבל תכנון מלא של המערכת. רק אחרי שתאשר את התכנון — מתחילים לבנות."
7. **אל תריץ את התכנון בעצמך.** הפרומפט הוא התוצר.

## כללי ברזל

- שאלה אחת בכל פעם; שפה פשוטה; אפס ז'רגון בלי הסבר.
- אל תכתוב קוד ואל תבנה כלום — מפיק פרומפט בלבד.
- אל תיגע בפרויקטים קיימים.
- אם הלומד לא בטוח — תן דוגמה, אל תנחש במקומו.
- תמיד הוסף את סקשן האבטחה (.env) ואת חלק ב' הקבוע, גם אם לא נשאל עליהם.

## קבצים

- `references/interview-sections.md` — 10 הסקשנים: שאלות, הסברים, דוגמאות, ומיפוי ל-placeholders.
- `references/glossary.md` — הסברי משפט-אחד לכל מושג טכני.
- `assets/prompt-template.md` — תבנית הפרומפט המופק (חלק א' עם placeholders + חלק ב' קבוע).
```

- [ ] **Step 2: Verify frontmatter and structure**

Run:
```bash
SKILL="/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal/SKILL.md"
head -3 "$SKILL"
grep -n "references/interview-sections.md\|references/glossary.md\|assets/prompt-template.md" "$SKILL"
```
Expected: frontmatter opens with `---` then `name: system-planning-prompt-builder-by-jack-vidal`; all three referenced files are mentioned in the body. Confirm the `description` contains both Hebrew trigger phrases and the "produces the planning prompt only" guard.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git add SKILL.md && git commit -m "feat: add SKILL.md orchestrator for planning-prompt interview"
```

---

### Task 6: Dogfood eval against the two personas, fix gaps

**Files:**
- Temp: `…scratchpad\eval-persona-a.md`, `…scratchpad\eval-persona-b.md` (scratch, not committed)
- Possibly modify any of the four skill files if the eval surfaces gaps.

This is the real test: simulate a full run and confirm the output is complete and correct for both a no-AI/no-webhook system (A) and an AI+webhook system (B).

- [ ] **Step 1: Run the interview for Persona A on paper**

Using `references/interview-sections.md`, write sample learner answers for **Persona A (online jewelry store)** into `…/scratchpad/eval-persona-a.md`: entities = products/orders/customers; full CRUD; order statuses (received→preparing→shipped→done); NO AI; payments integration; multi-tenant; Hebrew/RTL/mobile; standard security; v1 = products+orders+customers+statuses.

- [ ] **Step 2: Assemble Persona A's prompt from the template**

Fill `assets/prompt-template.md` with those answers, deleting the AI section (skipped). Write the result at the bottom of `eval-persona-a.md`.

Verify (checklist — all must be true):
- Title + goal present and name = the store.
- All three entities listed with CRUD.
- Statuses section present (order pipeline).
- **AI section fully removed** (no empty header, no stray `{{ai_features_bullets}}`).
- Integrations section present (payments).
- Users + "כל משתמש רואה רק את המידע שלו" present.
- UI + security/env present.
- Part B: 10 numbered items + "אל תכתוב קוד" present and unchanged.

Expected: all true. If any placeholder `{{...}}` remains or an OPTIONAL section was left empty, fix `prompt-template.md` or `interview-sections.md` and re-run this step.

- [ ] **Step 3: Run the interview for Persona B on paper**

Repeat into `…/scratchpad/eval-persona-b.md` for **Persona B (fitness coach)**: entities = clients/sessions/programs; CRUD; session statuses optional; **AI = summarize session notes**; **webhook = Cal.com booking creates a client+session**; single-owner (still note data ownership); Hebrew/RTL/mobile; security; v1 scope.

- [ ] **Step 4: Assemble Persona B's prompt and verify the variable sections**

Fill the template; this time the AI and integrations sections are **present**. Verify:
- AI section present and describes "סיכום הערות מפגש".
- Integrations section present and describes the Cal.com webhook.
- Webhook explanation was available (glossary has it).
- Part B unchanged.

Expected: all true. Fix any gap inline in the skill files and re-run.

- [ ] **Step 5: Commit any fixes**

If Steps 2/4 required edits to the skill files:
```bash
cd "/c/Users/Admin/.claude/skills/system-planning-prompt-builder-by-jack-vidal" && git add -A && git commit -m "fix: address gaps found in two-persona dogfood eval"
```
If no fixes were needed, state that explicitly and skip the commit. (Scratch eval files are NOT committed.)

---

### Task 7: Register the skill in the jackCRM repo's spec/plan trail (optional bookkeeping)

**Files:**
- Modify: this plan's checkboxes (mark complete) in the jackCRM repo.

- [ ] **Step 1: Verify the skill loads**

Confirm the skill appears to Claude Code's skill loader (new skills in `~/.claude/skills/` are auto-discovered). In a fresh Claude Code session, check that `system-planning-prompt-builder-by-jack-vidal` is listed among available skills. If it does not appear, re-check the `SKILL.md` frontmatter (must start at line 1 with `---`).

- [ ] **Step 2: Final confirmation to the user**

Report: skill directory path, its git log (5 commits: scaffold, glossary, template, interview-sections, SKILL.md, + any eval fix), and that the spec/plan are committed in the jackCRM repo. Ask whether to push the skill repo to a GitHub remote (the user may want it published separately).

---

## Self-Review

**1. Spec coverage:**
- Generic / any system → interview-sections are domain-neutral with examples (Task 4). ✓
- All Hebrew → all user-facing strings and output are Hebrew (Tasks 2–5). ✓
- Business questions + one-line teaching → explanation line before each technical section, sourced from glossary (Tasks 2, 4, 5). ✓
- Approach A (guided sectioned interview) → SKILL.md run loop + interview-sections (Tasks 4, 5). ✓
- Output is the prompt only; saved to file; not executed → SKILL.md ending steps + guardrails (Task 5); reinforced in eval (Task 6). ✓
- Proven structure incl. fixed Part B (10 deliverables + "don't code yet") → prompt-template.md verbatim Part B (Task 3), verified in eval (Task 6). ✓
- Skill layout (SKILL.md + references/{interview-sections,glossary} + assets/prompt-template) → Tasks 1–5 create exactly these. ✓
- Install location outside repo → Task 1 + plan header. ✓
- Guardrails (no code, no touching JackCRM, ask don't guess, skip irrelevant sections) → SKILL.md "כללי ברזל" (Task 5). ✓

**2. Placeholder scan:** No "TBD/TODO/implement later" steps; every file's full content is inline. The `{{...}}` tokens are intentional template placeholders (the deliverable's fill points), not plan placeholders. ✓

**3. Type consistency:** Placeholder names are consistent between `assets/prompt-template.md` (Task 3) and `references/interview-sections.md` (Task 4): `{{system_name}}`, `{{one_line_purpose}}`, `{{goal_paragraph}}`, `{{users_description}}`, `{{entities_bullets}}`, `{{operations_bullets}}`, `{{statuses_bullets}}`, `{{ai_features_bullets}}`, `{{integrations_bullets}}`, `{{ui_bullets}}`. File paths are identical across all tasks. ✓
```
