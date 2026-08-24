# RAKEEZ X — Codex Operating Contract

## Project
RAKEEZ X | رَكيز X
Arabic-first teacher SaaS / PWA.

Repository branch used for current stabilization:
preview/phase-5d

Do not merge main unless explicitly instructed by the user.

---

## Core Working Rule

Do not claim PASS because code exists.

PASS requires evidence.

For UI behavior:
1. Open the real screen.
2. Use the real control.
3. Perform the real action.
4. Observe the expected result.
5. Reload when relevant.
6. Verify persistence.
7. Check for runtime/console errors.

For data behavior:
verify the actual store/persistence path.

For sync behavior:
verify convergence and no duplicate/resurrected data.

---

## Scope Discipline

Work on one ticket or one tightly-related problem set at a time.

Do not expand scope without explicit instruction.

Do not start unrelated refactors.

Do not redesign unrelated screens.

Do not introduce new product features unless requested.

---

## Safety

Do not perform destructive Supabase operations.

Do not:
- delete live schemas
- delete unrelated cloud data
- run unsafe cleanup migrations
- force-push
- rewrite Git history
- merge main
- reset --hard
- git clean

without explicit user instruction.

Never use blanket:
Stop-Process -Name node

When cleaning stale test processes:
identify only RakeezX-related test processes.

---

## Git Rules

Before modifying code:
- verify branch
- inspect git status
- understand existing uncommitted changes

After a completed ticket:
- run relevant tests
- git diff --check
- commit logically
- push to preview/phase-5d
- verify no unpushed commits

Do not blindly use:
git add .

Prefer staging only intended files.

Generated test artifacts must remain ignored.

---

## Testing Rules

Use targeted tests during development.

Do not repeatedly run full suites while debugging.

Final gate for a significant ticket:

npm run test:sync
wait for full exit

npm run test:e2e
wait for full exit

npm run test:all
wait for full exit

Run stress only when persistence/data architecture changes materially.

Never launch duplicate Playwright/test runners.

Stale RakeezX test processes must be 0 before final handoff.

---

## Architecture Invariants

### Sections
section.id is logical immutable identity.

Editable metadata may include:
- grade
- section label/name

Editing a section must preserve:
- students
- enrollments
- teachings
- slots
- sessions
- attendance
- items
- scores
- reports/history

Never implement section edit as delete + recreate.

Duplicate rule:
same academic year + same grade + same section label is invalid.

### Grade Catalog
Use one canonical shared grade source everywhere.

Supported grade labels:

الأول الابتدائي
الثاني الابتدائي
الثالث الابتدائي
الرابع الابتدائي
الخامس الابتدائي
السادس الابتدائي
الأول المتوسط
الثاني المتوسط
الثالث المتوسط
الأول الثانوي
الثاني الثانوي
الثالث الثانوي

Do not duplicate grade arrays in views.

### Timetable Slots
slot.id is logical immutable identity.

Mutable timetable metadata may include:
- weekday
- period
- teaching reference

Editing a recurring timetable slot must not rewrite or destroy historical sessions or attendance.

Historical dated sessions remain historical.

Moving a slot must immediately free its old time position.

Duplicate current teacher schedule:
same weekday + same period must be rejected.

### Attendance
Attendance is session/date-specific historical data.

Do not derive historical attendance from the current timetable template after the fact.

### Offline-first
RAKEEZ X is offline-first.

Do not introduce required remote runtime dependencies for:
- fonts
- core UI
- core app behavior

---

## UI / UX

Primary language:
Arabic RTL.

Visual direction:
Modern Minimal SaaS + Saudi EdTech.

Identity:
رَكيز X | RAKEEZ X

Color roles:
- green: education/trust
- blue: primary action/information
- purple: AI/X accent only
- navy: strong text
- light neutral surfaces

Do not copy Madrasati layouts/assets.

Use it only as inspiration for:
- whitespace
- calm educational feel
- Arabic hierarchy
- light surfaces
- subtle green accents

Do not overuse gradients, shadows, glassmorphism, or decorative complexity.

---

## Timing Profiles

Built-in profiles:
- التوقيت الصيفي
- التوقيت الشتوي
- توقيت رمضان
- التوقيت المدمج

Remote timing is part of Hybrid behavior, not a standalone built-in profile.

Seasonal activation:
- start date required when enabled
- end date optional
- open-ended range continues until next later range
- explicit overlaps rejected
- adjacent ranges valid
- manual profile is fallback when no automatic range applies

Recess must render as a compact timeline row, not a giant settings card.

---

## Deferred Decisions

Do not resolve unless explicitly instructed:

D-11 participation no-rating
D-12 assignments
D-13 notes
D-17 data residency
D-18 same-field sync conflict
D-20 tombstone/hard-delete retention

Authentication changes are also deferred.

Do not implement:
OTP
Passkeys
new auth architecture

unless explicitly requested.

---

## Supabase

Project:
Teacher Tools Project

Current live schema:
rakeezx

Do not touch unrelated schemas/users.

Use test data only for automated validation.

Do not insert real student data during development.

---

## Handoff Format

At the end of every ticket, report only:

RAKEEZ X TICKET HANDOFF

Ticket:
Root cause:
Production fix:
Files changed:
Tests:
Browser verification:
Console/runtime errors:
Commit:
Pushed:
Unpushed:
Remaining issue:
Ready for user manual test:
YES/NO

Do not use marketing language like:
- fully completed
- perfectly stabilized
- everything is done

unless evidence actually supports it.

---

## Quality Priority

Correctness > speed
Evidence > confidence
Small verified commits > large speculative changes
Deterministic tests > narrative claims

The user prefers minimal interruptions and broad execution autonomy for safe routine work.

Ask only when:
- action is destructive
- architecture choice has irreversible consequences
- live cloud data/security could be affected
- requirements are genuinely ambiguous and cannot be resolved from repository context
