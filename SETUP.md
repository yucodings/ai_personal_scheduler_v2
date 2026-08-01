# Setup

## Prerequisites

- Node.js 20.9 or newer and npm.
- Python 3.11 or newer.
- A Supabase project (Singapore region is a practical choice for this app).
- A DeepSeek API key for production AI chat and planning.
- Optional alternative: Xiaomi MiMo API key. Telegram is optional until its workflows are enabled.

## 1. Install locally

```powershell
npm install
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env.local
```

Complete the environment and Supabase steps below before running the app. The frontend does not inject sample projects or accept a shared demonstration password.

## 2. Generate application secrets

```powershell
.venv\Scripts\python scripts\generate_secrets.py
```

Copy the printed Argon2 hash, JWT secret, cron secret, and Telegram webhook secret into `.env.local`. The script never writes the plaintext password or generated values to disk.

## 3. Create Supabase data and storage

In Supabase SQL Editor, run in order:

1. `supabase/migrations/202607190001_initial.sql`
2. `supabase/migrations/202607190002_workflow_functions.sql`
3. `supabase/storage_setup.sql`

The migrations create UUID keys, constraints, indexes, update triggers, full-text search, atomic proposal approval, progress history/recalculation, Telegram idempotency, and deny direct anonymous/authenticated table access. The `project-files` bucket is private.

## 4. Complete `.env.local`

Use `.env.example` as the source of truth. Set `AI_PROVIDER=deepseek` and add `DEEPSEEK_API_KEY`; the existing MiMo variables can remain and are used only when `AI_PROVIDER=mimo`. Prefer `SUPABASE_SECRET_KEY` with the current `sb_secret_...` key from Supabase. `SUPABASE_SERVICE_ROLE_KEY` remains a legacy fallback. All API keys are server-only; never prefix them with `NEXT_PUBLIC_`. Validate names without exposing values:

`CHAT_RETENTION_DAYS=7` removes older Skyler messages and inactive conversations whenever the workspace or chat API is used. Recent history remains available across devices until it expires.

```powershell
.venv\Scripts\python scripts\verify_environment.py
```

## 5. Run

```powershell
npm run dev
```

Use `vercel dev` for local testing because it runs both the Next.js frontend and consolidated Python API function.

## OCR notes

- PNG/JPG/JPEG run through Tesseract.js in the browser and show editable output.
- PDFs can be rendered by PDF.js and OCR’d page by page when scanned.
- English is configured first. Add trained languages via `OCR_LANGUAGES` and the adapter later.
- Original images/PDFs are uploaded privately; the selected AI provider receives extracted text, never raw images.
