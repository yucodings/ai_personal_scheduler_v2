# Reference review

Reference: [yucodings/personal_event_butler](https://github.com/yucodings/personal_event_butler), inspected read-only on 19 July 2026.

## Retained ideas

- A compact left navigation and mobile drawer make the assistant easy to orient around.
- Card-based overviews work well for fast scanning.
- Drag-and-drop uploads and browser-side Tesseract OCR keep image recognition free-tier compatible.
- Human confirmation cards are the right interaction for AI-suggested changes.
- Malaysia-time morning and evening Telegram touchpoints fit the product rhythm.

## Replaced

- Flat `events` become projects → milestones → tasks/subtasks → dependencies → immutable progress updates.
- Browser-only reminder timers become Supabase Cron calls to authenticated Python functions.
- Local-storage chat becomes shared Supabase conversations/messages for web and Telegram.
- Plaintext password comparison becomes Argon2 verification plus signed, expiring HttpOnly sessions.
- Client-side/direct Supabase access becomes server-only service-role access with denied anonymous RLS.
- Hard-coded MiMo settings become environment-configured model, URL, timeouts, retry, and strict Pydantic envelopes.
- One-way Telegram notifications become a secret-validated, chat-ID-restricted, idempotent two-way webhook.
- Whole-table keyword filtering becomes project-scoped PostgreSQL full-text ranking and source citations.
- Automatic AI event creation becomes proposal review with full-plan and milestone-by-milestone approval.

## Improved

- Weighted and manual-override progress are shown together with expected progress and variance.
- Risk is deterministic and testable; AI only explains it.
- ZIP files are inspected without extraction or execution, with traversal/size limits and secret redaction.
- Images and scanned PDF pages use editable browser OCR before indexing.
- Private original files and searchable extracted chunks are separate security/data boundaries.
- Daily plans respect dependencies and configured capacity.

