# Deployment

## Supabase

1. Apply both migrations and `storage_setup.sql` from [SETUP.md](SETUP.md).
2. Confirm `project-files` is private and no public URL exists.
3. Use SQL Editor to call `search_project_documents` with a seeded project before production.
4. Keep the database and Vercel region close; this repository selects Vercel `sin1`.

## Vercel

1. Push this new repository to GitHub; do not reuse or modify the reference repository.
2. Import the GitHub repository into Vercel.
3. Framework preset: Next.js. `vercel.json` registers plain Python functions and nested API rewrites.
4. Add every required server environment value from `.env.example`; set `NEXT_PUBLIC_MOCK_MODE=false`.
5. Deploy, then verify `/api/health`, password login, project CRUD, a private upload, project search, and a pending AI proposal.
6. Confirm response cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`.

Rollback by promoting the previous successful Vercel deployment. Database migrations are additive; take a Supabase backup before any future destructive migration and use a forward corrective migration rather than editing an applied file.

## Telegram

1. Create a bot with BotFather and copy its token.
2. Send the bot one message, retrieve the chat ID with Bot API `getUpdates`, and configure it as `TELEGRAM_ALLOWED_CHAT_ID`.
3. Set `TELEGRAM_WEBHOOK_SECRET` to the generated value.
4. After the production URL is live:

```powershell
.venv\Scripts\python scripts\set_telegram_webhook.py https://your-app.vercel.app
```

5. Check Settings → webhook status, then test `/start`, `/projects`, `/use`, `/today`, and a task progress button. Other chat IDs should receive no sensitive response.

## Supabase Cron and Vault

1. Enable `pg_cron`, `pg_net`, and Vault.
2. In `supabase/cron_setup.sql`, run the two commented `vault.create_secret` calls with the production URL and `CRON_SECRET`.
3. Run the rest of `cron_setup.sql`. It removes old named jobs before installing replacements.
4. `0 0 * * *` calls the morning endpoint at 08:00 Malaysia; `0 12 * * *` calls evening at 20:00.
5. Inspect `cron.job` and `cron.job_run_details`. Failed notifications also appear in `notification_logs`.
6. Manually test with `POST /api/reminders/morning` and `Authorization: Bearer <CRON_SECRET>`; repeat for evening.

## Production verification

- Mock mode false; no demo login.
- Health endpoint reports configured services without values.
- Wrong password cooldown works; expired/forged sessions fail.
- Service role and bot token do not appear in browser bundles or responses.
- Upload duplicate detection, size limits, OCR edit, ZIP traversal rejection, and signed downloads work.
- Project search never returns another project’s chunks.
- Malformed model output is advice-only.
- Full and partial approvals create one copy of each approved entity.
- Telegram rejects wrong secret/chat and ignores duplicate update IDs.
- Morning/evening jobs stay under daily capacity and log outcomes.

