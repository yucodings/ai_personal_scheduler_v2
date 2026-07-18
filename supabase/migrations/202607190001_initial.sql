begin;
create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(), title text not null check (length(title) between 2 and 160),
  project_type text not null check (project_type in ('subject','assignment','examination','competition','hackathon','final_year_project','internship','event','personal','other')),
  description text not null default '', status text not null default 'planned' check (status in ('planned','active','paused','completed','archived')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')), start_date date not null, final_deadline date not null,
  internal_deadline date, estimated_total_hours numeric(10,2) not null default 0 check (estimated_total_hours >= 0), calculated_progress numeric(5,2) not null default 0 check (calculated_progress between 0 and 100),
  manual_progress numeric(5,2) check (manual_progress between 0 and 100), displayed_progress numeric(5,2) not null default 0 check (displayed_progress between 0 and 100), expected_progress numeric(5,2) not null default 0 check (expected_progress between 0 and 100),
  progress_variance numeric(6,2) not null default 0, risk_status text not null default 'on_track' check (risk_status in ('on_track','at_risk','delayed','blocked','completed')), risk_reason text,
  is_active_context boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (final_deadline >= start_date), check (internal_deadline is null or internal_deadline between start_date and final_deadline)
);
create unique index if not exists one_active_project on projects (is_active_context) where is_active_context;
create index if not exists projects_deadline_idx on projects(final_deadline) where status not in ('completed','archived');
create index if not exists projects_filters_idx on projects(status, priority, risk_status);

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade, title text not null, description text not null default '', sequence integer not null default 0,
  start_date date, due_date date, status text not null default 'planned' check (status in ('planned','active','completed','blocked')), progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  estimated_hours numeric(10,2) not null default 0 check (estimated_hours >= 0), is_ai_generated boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id, sequence, title)
);
create index if not exists milestones_project_idx on milestones(project_id, sequence);

create table if not exists project_documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade, original_filename text not null, storage_path text not null unique, extension text not null, mime_type text not null,
  file_size bigint not null check (file_size >= 0), sha256_hash text not null check (length(sha256_hash) = 64), extraction_method text, extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','completed','failed')),
  extracted_text text, processed_summary text, detected_deadlines jsonb not null default '[]', detected_deliverables jsonb not null default '[]', ocr_confidence numeric(5,2) check (ocr_confidence between 0 and 100),
  uploaded_at timestamptz not null default now(), processed_at timestamptz, error_message text, unique(project_id, sha256_hash)
);
create index if not exists documents_project_idx on project_documents(project_id, uploaded_at desc);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade, milestone_id uuid references milestones(id) on delete set null, parent_task_id uuid references tasks(id) on delete cascade,
  title text not null, description text not null default '', status text not null default 'not_started' check (status in ('not_started','started','in_progress','nearly_complete','completed','blocked','cancelled')),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100), priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  effort_weight numeric(10,2) not null default 1 check (effort_weight > 0), estimated_hours numeric(10,2) not null default 0 check (estimated_hours >= 0), actual_hours numeric(10,2) not null default 0 check (actual_hours >= 0),
  planned_start date, due_date date, completed_at timestamptz, blocked_reason text, sequence integer not null default 0, is_ai_generated boolean not null default false, source_document_id uuid references project_documents(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (parent_task_id is null or parent_task_id <> id), check (status <> 'blocked' or blocked_reason is not null), check (due_date is null or planned_start is null or due_date >= planned_start)
);
create index if not exists tasks_project_idx on tasks(project_id, status, due_date);
create index if not exists tasks_milestone_idx on tasks(milestone_id, sequence);
create index if not exists tasks_parent_idx on tasks(parent_task_id) where parent_task_id is not null;

create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(), predecessor_task_id uuid not null references tasks(id) on delete cascade, dependent_task_id uuid not null references tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check (dependency_type in ('finish_to_start','start_to_start','finish_to_finish')), created_at timestamptz not null default now(),
  check (predecessor_task_id <> dependent_task_id), unique(predecessor_task_id, dependent_task_id, dependency_type)
);
create index if not exists dependencies_dependent_idx on task_dependencies(dependent_task_id);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references project_documents(id) on delete cascade, project_id uuid not null references projects(id) on delete cascade, chunk_index integer not null check (chunk_index >= 0),
  content text not null, reference text, character_count integer not null default 0, search_vector tsvector generated always as (to_tsvector('english', coalesce(content,''))) stored, created_at timestamptz not null default now(), unique(document_id, chunk_index)
);
create index if not exists chunks_project_idx on document_chunks(project_id, document_id);
create index if not exists chunks_fts_idx on document_chunks using gin(search_vector);

create table if not exists progress_updates (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade, task_id uuid references tasks(id) on delete set null,
  source text not null check (source in ('web','telegram','system','ai')), old_status text, new_status text, old_progress numeric(5,2), new_progress numeric(5,2), note text, actual_hours_added numeric(10,2) not null default 0 check (actual_hours_added >= 0), created_at timestamptz not null default now()
);
create index if not exists progress_history_idx on progress_updates(project_id, created_at desc);

create table if not exists daily_plans (
  id uuid primary key default gen_random_uuid(), plan_date date not null, period text not null check (period in ('morning','evening')), generated_summary text not null, total_planned_hours numeric(8,2) not null default 0,
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage between 0 and 100), risk_summary text, created_at timestamptz not null default now(), unique(plan_date, period)
);
create table if not exists daily_plan_items (
  id uuid primary key default gen_random_uuid(), daily_plan_id uuid not null references daily_plans(id) on delete cascade, task_id uuid not null references tasks(id) on delete cascade, ordering integer not null default 0,
  planned_duration_minutes integer not null check (planned_duration_minutes > 0), is_completed boolean not null default false, created_at timestamptz not null default now(), unique(daily_plan_id, task_id)
);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(), channel text not null check (channel in ('web','telegram')), project_id uuid references projects(id) on delete set null, title text not null default 'Skyler conversation', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists conversations_channel_idx on ai_conversations(channel, updated_at desc);
create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references ai_conversations(id) on delete cascade, role text not null check (role in ('system','user','assistant')), content text not null, structured_action_data jsonb,
  channel text not null check (channel in ('web','telegram')), created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on ai_messages(conversation_id, created_at);

create table if not exists ai_proposals (
  id uuid primary key default gen_random_uuid(), proposal_type text not null check (proposal_type in ('project_plan','reschedule','task_breakdown')), project_id uuid not null references projects(id) on delete cascade,
  source_document_id uuid references project_documents(id) on delete set null, proposed_payload jsonb not null, human_summary text not null, approval_mode text not null check (approval_mode in ('full_plan','milestone_by_milestone')),
  status text not null default 'pending' check (status in ('pending','partially_approved','approved','rejected','expired')), review_state jsonb not null default '{"reviewed_milestones":[]}', fingerprint text not null,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index if not exists pending_proposal_fingerprint_idx on ai_proposals(fingerprint) where status in ('pending','partially_approved');
create index if not exists proposals_project_idx on ai_proposals(project_id, created_at desc);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade, task_id uuid references tasks(id) on delete cascade, reminder_at timestamptz not null, channel text not null default 'telegram' check (channel in ('telegram','web')),
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','cancelled')), last_sent_at timestamptz, created_at timestamptz not null default now(), check (project_id is not null or task_id is not null)
);
create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(), channel text not null, notification_type text not null, status text not null check (status in ('sent','failed','skipped')), error_message text, created_at timestamptz not null default now()
);
create table if not exists app_settings (
  id text primary key default 'singleton' check (id = 'singleton'), timezone text not null default 'Asia/Kuala_Lumpur', morning_reminder_time time not null default '08:00', evening_reminder_time time not null default '20:00',
  daily_working_hour_limit numeric(4,2) not null default 6 check (daily_working_hour_limit > 0 and daily_working_hour_limit <= 24), default_task_duration_minutes integer not null default 60 check (default_task_duration_minutes > 0),
  default_project_approval_mode text not null default 'full_plan' check (default_project_approval_mode in ('full_plan','milestone_by_milestone')), current_active_project uuid references projects(id) on delete set null, updated_at timestamptz not null default now()
);
insert into app_settings(id) values ('singleton') on conflict do nothing;
create table if not exists telegram_updates (update_id bigint primary key, received_at timestamptz not null default now());
create table if not exists login_attempts (id bigint generated always as identity primary key, fingerprint_hash text not null, succeeded boolean not null, created_at timestamptz not null default now());
create index if not exists login_attempts_recent_idx on login_attempts(fingerprint_hash, created_at desc);

create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists projects_updated_at on projects; create trigger projects_updated_at before update on projects for each row execute function set_updated_at();
drop trigger if exists milestones_updated_at on milestones; create trigger milestones_updated_at before update on milestones for each row execute function set_updated_at();
drop trigger if exists tasks_updated_at on tasks; create trigger tasks_updated_at before update on tasks for each row execute function set_updated_at();
drop trigger if exists conversations_updated_at on ai_conversations; create trigger conversations_updated_at before update on ai_conversations for each row execute function set_updated_at();

create or replace function set_active_project(p_project_id uuid) returns projects language plpgsql security definer set search_path=public as $$
declare result projects; begin update projects set is_active_context=false where is_active_context and id<>p_project_id; update projects set is_active_context=true where id=p_project_id returning * into result; update app_settings set current_active_project=p_project_id where id='singleton'; return result; end $$;

create or replace function search_project_documents(p_project_id uuid, p_query text, p_limit integer default 8)
returns table(chunk_id uuid, document_id uuid, original_filename text, chunk_index integer, reference text, content text, rank real) language sql stable security definer set search_path=public as $$
  select c.id, c.document_id, d.original_filename, c.chunk_index, c.reference, c.content, ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query))
  from document_chunks c join project_documents d on d.id=c.document_id where c.project_id=p_project_id and c.search_vector @@ websearch_to_tsquery('english', p_query)
  order by 7 desc, c.chunk_index asc limit least(greatest(p_limit,1),20)
$$;

commit;
