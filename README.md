# Skyler Progress Butler

Skyler is a private, single-user project and progress workspace for university work, competitions, hackathons, final-year projects, and personal goals. It turns project files into reviewable plans, tracks weighted progress against schedule, explains risk, and shares one project context across the web and Telegram.

> Status: production-data application. Workspace state is loaded from Supabase and no sample records are injected by the frontend.

## Product flow

Login → create or edit a project → add tasks manually and/or upload evidence for AI planning → review AI proposals → work on tasks → update progress → risk recalculation → morning plan → evening check → archive completed work → restore it later if needed.

## Highlights

- Next.js 16 App Router, TypeScript, Tailwind CSS, responsive reusable components.
- Plain Vercel Python functions with shared framework-free Python business logic.
- Argon2 password, signed expiring sessions, HttpOnly/Strict cookies, and login cooldown.
- Full project/milestone/task/subtask/dependency/progress hierarchy.
- Editable project details, manual task creation, and a separate restorable project archive.
- PDF, DOCX, PPTX, XLSX, CSV, text, Markdown, JSON, images, and safe ZIP support.
- Browser Tesseract OCR with editable output; scanned-PDF page OCR fallback.
- Direct Skyler chat attachments with OCR/extraction, private indexing, and source-grounded answers.
- Private Supabase Storage and PostgreSQL full-text retrieval with source references.
- DeepSeek structured project planning, retry/repair, and proposal-only mutation path, with MiMo retained as an alternative provider.
- Deterministic weighted progress, expected progress, variance, capacity, and risk.
- Two-way Telegram commands, natural chat, inline progress/proposal buttons, and duplicate protection.
- Supabase Cron SQL for 08:00 and 20:00 Asia/Kuala_Lumpur workflows.
- Authenticated Supabase-backed projects, tasks, documents, proposals, Telegram workflows, and DeepSeek chat.

## Screenshots

- `docs/screenshots/dashboard.png` — placeholder for deployed dashboard capture.
- `docs/screenshots/project.png` — placeholder for project workspace capture.
- `docs/screenshots/assistant.png` — placeholder for assistant capture.

## Stack

| Surface | Technology |
|---|---|
| Web | Next.js App Router, React 19, TypeScript, Tailwind CSS |
| API | Vercel Python Functions (`BaseHTTPRequestHandler`) |
| Data/files | Supabase PostgreSQL, private Supabase Storage |
| Search | PostgreSQL `tsvector` + GIN |
| AI | DeepSeek API by default; Xiaomi MiMo remains selectable |
| OCR | Tesseract.js + PDF.js in the browser |
| Messaging | Telegram Bot API |
| Scheduling | Supabase `pg_cron`, `pg_net`, Vault |

## Local development

```bash
npm install
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env.local
npm run dev
```

Populate `.env.local`, run the Supabase migrations, and generate your password hash before signing in locally.

## Common commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
python -m pytest
python scripts/generate_secrets.py
python scripts/verify_environment.py
```

## Repository map

```text
app/                 Next.js routes and layouts
components/          reusable product and UI components
lib/                 typed frontend data, validation, OCR, and API client
api/                 plain Vercel Python function entrypoints
backend/             reusable Python business logic and parsers
supabase/            migrations, private storage, and cron SQL
scripts/             secret, environment, and Telegram utilities
tests/               Python and frontend test suites
```

Read [REFERENCE_REVIEW.md](REFERENCE_REVIEW.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SETUP.md](SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [FINAL_HANDOFF.md](FINAL_HANDOFF.md) next.
