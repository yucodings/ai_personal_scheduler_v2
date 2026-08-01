# Architecture

## Information hierarchy

```mermaid
mindmap
  root((Project))
    Documents
      Private originals
      Extracted text
      Searchable chunks
    Milestones
      Tasks
        Subtasks
        Dependencies
        Progress updates
    Daily plans
    AI proposals
      Full plan review
      Milestone review
    AI conversations
      Web
      Telegram
```

## Components and trust boundaries

```mermaid
flowchart LR
  B["Browser"] -->|"HttpOnly session + JSON"| P["Vercel Python functions"]
  B -->|"OCR text after user review"| P
  T["Telegram"] -->|"Secret-token webhook"| P
  C["Supabase Cron"] -->|"Bearer cron secret"| P
  P -->|"Service role; server only"| DB["Supabase PostgreSQL"]
  P -->|"Private objects / signed URLs"| ST["Supabase Storage"]
  P -->|"Bounded project context"| M["DeepSeek (default) or Xiaomi MiMo"]
  P -->|"Bot token; allowed chat only"| T
```

The browser never receives the Supabase server key, DeepSeek/MiMo keys, bot token, webhook secret, cron secret, or login hash. Exposed tables enable RLS and deny `anon`/`authenticated`; Python functions use the server key after their own session/cron/webhook checks.

## Request flows

### Document and analysis

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web
  participant P as Python functions
  participant S as Supabase
  participant M as Selected AI provider
  U->>W: Select project file
  alt Image or scanned PDF
    W->>W: Tesseract/PDF.js OCR
    W->>U: Editable extracted text
  else Text-bearing document
    W->>P: Private upload
    P->>P: Lightweight parser / safe ZIP inspection
  end
  P->>S: Private original + document metadata
  P->>S: Project chunks + tsvector index
  U->>P: Analyse project
  P->>S: Ranked project-only retrieval
  P->>M: Bounded evidence + structured schema
  M-->>P: Validated proposal envelope
  P->>S: Pending AI proposal
  P-->>U: Review card with citations
```

### Proposal approval

Free-form AI output never mutates data. Pydantic validates model intent, dates, percentages, UUIDs, statuses, priorities, project ID, and proposal shape. `approve_ai_proposal` applies the full plan atomically. `approve_proposal_milestone` persists review state and one milestone at a time. Rescheduling stays pending until an explicit approval call.

### Progress and risk

Calculated progress is `sum(task progress × effort weight) / sum(effort weight)`, excluding cancelled work. Displayed progress uses a manual override when present. Expected progress interpolates each scheduled task between planned start and due date, weighted by effort. Risk precedence is completed → critical blocker → past deadline → overdue/≤−20 variance → ≤−10 variance/capacity overload → on track.

### Telegram

Telegram validates `X-Telegram-Bot-Api-Secret-Token`, then compares the chat ID to the single allowed ID without revealing match details. A unique `update_id` insert prevents duplicate application. Commands and natural messages use the same project data and conversation tables as the web. Important date changes return inline approval controls.
