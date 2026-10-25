# F09 — Portfolio visual prototype (Preview only)

Status: **prototype for PO visual review**, not a complete teacher portfolio, grading rubric, or Production feature.

## User-supplied visual research (private, not copied to Git)

1. **Tahdiri:** 72-page private reference PDF (unnamed in the repository). Use as structural inspiration for a strong branded cover (p.1), real task-description/evidence-photo pages (pp.6–12, 16–21), visual analytic records (pp.35–39), and detailed curriculum tables (pp.43–55). No photos, names, screenshot pixels, credentials, or personal contact data from this file enter this repository.
2. **Moalem:** 38-page private reference PDF (unnamed in the repository). Use as structural inspiration for a composed cover (p.1), eleven-criteria contents page (p.2), document-coverage board (p.3), numbered chapter spreads (pp.4, 11, 15), source-labelled evidence records (pp.12, 22), and a non-evaluation closing statement (p.37). Never copy the book's visual assets or personal data.

The eleven criterion names and weights are captured in `src/lib/portfolio-design-preview.js`. They organize the model only; they do not constitute an independently verified current official rubric or automated teacher appraisal.

## Delivered four-page concept

- **01 Cover:** unique Rakeez navy/teal + restrained gold. Ministry mark is the existing same-origin official artwork; teacher/school/year/term come from the active Rakeez workspace, never fixed user-example values.
- **02 Contents:** 11 criteria with page references only when the source section is actually included. Unrepresented sections display an em dash, not a fabricated page number.
- **03 Evidence coverage:** 11 criteria, number of sourced example witnesses, and missing/source state. “شاهد أولي” is never a “completed criterion”, professional score, or external approval.
- **04 Evidence layout:** attendance marks derived read-only from `store.executionReport` for a selected, dated teaching assignment. Excludes canceled sessions, rows without marks, future sessions, duplicates, and impossible overcounts. Shows only aggregate record coverage and at most three recent dates; no student names, attendance-status-by-student, grades, or private contacts. A manually chosen supporting image may be displayed via a browser-local object URL only for the current view; it is not uploaded or saved.

## Boundaries and acceptance

- Preview route: `#/reports/portfolio-preview`.
- Source-only ESM is served by Cloudflare Pages; stylesheet must be loaded via `<link rel=stylesheet>`, **not** imported as a JS module (avoids previous MIME failure).
- Print/save PDF uses the existing `printReport` helper, the pre-existing decoded Ministry logo, and A4 print CSS. Target **exactly four pages**, with searchable text and no split/open-ended content.
- Preview must function at desktop and 390px mobile, with no horizontal overflow; support navigation through the four chapters.
- After source loading, no grades, attendance, profile, or other user records may be modified; image import is browser-local and memory-only.
- Preserve F09's future capability to assemble a year-scoped, provenance-bearing record per criterion; distinguish auto-derived, teacher-attested, and externally confirmed evidence. Never infer training, parent-message delivery, curriculum execution, or performance gains without evidence.
- Production is explicitly outside this prototype.

## Next-stage decisions after PO review

Choose final typography/layout, decide whether a photo evidence placeholder should be omitted when empty on export, and design a real editable evidence collection with upload privacy/retention, multi-source matching, duplicate/version handling, and a year-scoped export manifest. None of these are implied delivered by this Preview.

## PO's second design review — implemented in Preview v2

1. Portfolio is scoped to **the teacher's academic year**, not a chosen class. The view aggregates all the year's terms and teaching assignments (including archived sections) through Rakeez's existing read-only execution reports. The only selector in the editor is the professional criterion being illustrated.
2. All eleven criteria remain present in the table of contents and in the professional domains page. No missing-evidence labels, made-up completion percentages, negative scorecards, lengthy source disclaimers or technical limitations are printed.
3. The inner-page overview emphasizes documented academic-year activities and the actual count of sections, subjects and attendance-recorded sessions; it does not claim measured student achievement or teacher appraisal.
4. The cover has been redesigned with the Ministry logo centered above a deep teal field, a calmer Arabic headline, restrained gold separators and annual teacher information.
5. Each criterion has its **own ephemeral gallery** in the prototype, independently storing picture order and 1-/2-/3-column presentation choices in memory. An editor can add multiple images, remove a specific picture, reorder it, and switch to a different criterion without mixing the image sets. Private photos stay off the repository and off the server.
6. A witness with too many photos for its first A4 page continues on additional A4 pages rather than clipping images in the PDF. PDF checks enforce the expected page count and photo/footer separation at each layout.
7. The original source-provenance identifiers and data-integrity guards remain available internally; they are not mandatory text in the exported portfolio. The printed content highlights actual evidence only. This is not a promise of an approved official appraisal.
8. Cloud saving and cross-device synchronization are a separate **documented architecture proposal**, not enabled in Preview. See `F09_PORTFOLIO_SYNC_ARCHITECTURE_AR.md`.

### Future evidence map — not delivered here

| Criterion | Suggested evidence source in Rakeez / manually reviewed additions |
| --- | --- |
| 01 Duties | timetable and confirmed work, teacher-supplied official records |
| 02 Professional community | training certificates, workshops, collegial visits |
| 03 Parents | authenticated communication receipts, redacted parent responses |
| 04 Strategies | planned strategies plus teacher-confirmed classroom uses and photos |
| 05 Improvement | comparable diagnostic/pre-post analysis anchored in dated actual assessments |
| 06 Learning plan | curriculum distribution, verified preparation and delivery confirmations |
| 07 Technology | executed digital activities/projects, classroom screenshots and photos |
| 08 Learning environment | class charter, incentives, environment photos reviewed for privacy |
| 09 Classroom management | attendance and participation saved in Rakeez, teacher-added support photos |
| 10 Results analysis | anonymized grade distributions and actual student-result comparisons |
| 11 Assessment diversity | actual assigned projects, exams, homework, performance tasks, rubrics |

This mapping is a product design suggestion, not a Ministry-authored evidence checklist.
