begin;

create or replace function recalculate_project_progress(p_project_id uuid) returns projects language plpgsql security definer set search_path=public as $$
declare p projects; calc numeric; expected numeric; shown numeric; remaining numeric; overdue_count integer; blocked_critical integer; available_days integer; required_daily numeric; reason text; risk text;
begin
  select coalesce(sum(progress_percent*effort_weight)/nullif(sum(effort_weight),0),0),
         coalesce(sum((case when planned_start is null or due_date is null then 0 when current_date < planned_start then 0 when current_date >= due_date then 100 else 100.0*(current_date-planned_start)/greatest(1,due_date-planned_start) end)*effort_weight)/nullif(sum(case when planned_start is not null and due_date is not null then effort_weight else 0 end),0),0),
         coalesce(sum(estimated_hours*(1-progress_percent/100.0)) filter (where status not in ('completed','cancelled')),0),
         count(*) filter (where status not in ('completed','cancelled') and due_date < current_date),
         count(*) filter (where status='blocked' and priority in ('high','critical'))
    into calc, expected, remaining, overdue_count, blocked_critical from tasks where project_id=p_project_id and status<>'cancelled';
  select * into p from projects where id=p_project_id for update;
  shown := coalesce(p.manual_progress,calc); available_days := greatest(0,p.final_deadline-current_date+1); required_daily := remaining/greatest(1,available_days);
  if p.status='completed' or shown>=100 then risk:='completed'; reason:='Project work is complete.';
  elsif blocked_critical>0 then risk:='blocked'; reason:='A high-priority or critical task is blocked.';
  elsif p.final_deadline<current_date then risk:='delayed'; reason:='The final deadline has passed.';
  elsif overdue_count>0 then risk:='delayed'; reason:=overdue_count||' incomplete task(s) are overdue.';
  elsif shown-expected<=-20 then risk:='delayed'; reason:='Progress is at least 20 points behind plan.';
  elsif shown-expected<=-10 then risk:='at_risk'; reason:='Progress is at least 10 points behind plan.';
  elsif required_daily>(select daily_working_hour_limit*1.15 from app_settings where id='singleton') then risk:='at_risk'; reason:='The remaining daily workload exceeds configured capacity.';
  else risk:='on_track'; reason:='Progress and workload are within plan.'; end if;
  update projects set calculated_progress=round(calc,2), displayed_progress=round(shown,2), expected_progress=round(expected,2), progress_variance=round(shown-expected,2), risk_status=risk, risk_reason=reason where id=p_project_id returning * into p;
  update milestones m set progress=coalesce((select round(sum(t.progress_percent*t.effort_weight)/nullif(sum(t.effort_weight),0),2) from tasks t where t.milestone_id=m.id and t.status<>'cancelled'),0) where m.project_id=p_project_id;
  return p;
end $$;

create or replace function record_task_progress(task_id uuid, status text, progress_percent numeric, actual_hours_added numeric default 0, note text default null, source text default 'web') returns jsonb language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare old_task tasks; new_task tasks; project projects;
begin
  select * into old_task from tasks where id=task_id for update; if not found then raise exception 'Task not found'; end if;
  if progress_percent<0 or progress_percent>100 then raise exception 'Progress must be between 0 and 100'; end if;
  if status='completed' then progress_percent:=100; end if; if status='not_started' then progress_percent:=0; end if;
  update tasks set status=status, progress_percent=progress_percent, actual_hours=actual_hours+greatest(actual_hours_added,0), completed_at=case when status='completed' then coalesce(completed_at,now()) else null end where id=task_id returning * into new_task;
  insert into progress_updates(project_id,task_id,source,old_status,new_status,old_progress,new_progress,note,actual_hours_added) values(old_task.project_id,task_id,source,old_task.status,new_task.status,old_task.progress_percent,new_task.progress_percent,note,greatest(actual_hours_added,0));
  project:=recalculate_project_progress(old_task.project_id); return jsonb_build_object('task',to_jsonb(new_task),'project',to_jsonb(project));
end $$;

create or replace function assert_dependency_acyclic() returns trigger language plpgsql as $$
begin
  if exists(with recursive walk(id) as (select new.dependent_task_id union all select d.dependent_task_id from task_dependencies d join walk w on d.predecessor_task_id=w.id) select 1 from walk where id=new.predecessor_task_id) then raise exception 'Dependency cycle detected'; end if;
  if (select project_id from tasks where id=new.predecessor_task_id)<>(select project_id from tasks where id=new.dependent_task_id) then raise exception 'Dependencies must stay inside one project'; end if; return new;
end $$;
drop trigger if exists dependency_acyclic on task_dependencies; create trigger dependency_acyclic before insert or update on task_dependencies for each row execute function assert_dependency_acyclic();

create or replace function apply_proposal_milestone(p_project_id uuid, p_milestone jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid:=gen_random_uuid(); task jsonb; tid uuid; dep text; cid text;
begin
  create temp table if not exists skyler_proposal_map(client_id text primary key, entity_id uuid not null) on commit drop;
  insert into milestones(id,project_id,title,description,sequence,start_date,due_date,estimated_hours,is_ai_generated) values(mid,p_project_id,p_milestone->>'title',coalesce(p_milestone->>'description',''),coalesce((p_milestone->>'sequence')::int,0),nullif(p_milestone->>'start_date','')::date,nullif(p_milestone->>'due_date','')::date,coalesce((p_milestone->>'estimated_hours')::numeric,0),true);
  insert into skyler_proposal_map values(p_milestone->>'client_id',mid) on conflict(client_id) do nothing;
  for task in select value from jsonb_array_elements(coalesce(p_milestone->'tasks','[]')) loop
    tid:=gen_random_uuid(); cid:=task->>'client_id';
    insert into tasks(id,project_id,milestone_id,title,description,priority,effort_weight,estimated_hours,planned_start,due_date,is_ai_generated) values(tid,p_project_id,mid,task->>'title',coalesce(task->>'description',''),coalesce(task->>'priority','medium'),coalesce((task->>'effort_weight')::numeric,1),coalesce((task->>'estimated_hours')::numeric,0),nullif(task->>'planned_start','')::date,nullif(task->>'due_date','')::date,true);
    insert into skyler_proposal_map values(cid,tid) on conflict(client_id) do update set entity_id=excluded.entity_id;
  end loop;
  for task in select value from jsonb_array_elements(coalesce(p_milestone->'tasks','[]')) loop
    if nullif(task->>'parent_client_id','') is not null then update tasks set parent_task_id=(select entity_id from skyler_proposal_map where client_id=task->>'parent_client_id') where id=(select entity_id from skyler_proposal_map where client_id=task->>'client_id'); end if;
    for dep in select jsonb_array_elements_text(coalesce(task->'depends_on','[]')) loop
      insert into task_dependencies(predecessor_task_id,dependent_task_id) select p.entity_id,d.entity_id from skyler_proposal_map p,skyler_proposal_map d where p.client_id=dep and d.client_id=task->>'client_id' on conflict do nothing;
    end loop;
  end loop; return mid;
end $$;

create or replace function approve_ai_proposal(p_proposal_id uuid, p_edited_payload jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare proposal ai_proposals; payload jsonb; milestone jsonb;
begin
  select * into proposal from ai_proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found'; end if; if proposal.status not in ('pending','partially_approved') then raise exception 'Proposal already reviewed'; end if;
  payload:=coalesce(p_edited_payload,proposal.proposed_payload); create temp table if not exists skyler_proposal_map(client_id text primary key,entity_id uuid not null) on commit drop; truncate skyler_proposal_map;
  if proposal.proposal_type='project_plan' then for milestone in select value from jsonb_array_elements(coalesce(payload->'milestones','[]')) loop perform apply_proposal_milestone(proposal.project_id,milestone); end loop; end if;
  if proposal.proposal_type='reschedule' then update projects set internal_deadline=coalesce(nullif(payload->>'internal_deadline','')::date,internal_deadline),final_deadline=coalesce(nullif(payload->>'final_deadline','')::date,final_deadline) where id=proposal.project_id; end if;
  update ai_proposals set status='approved',proposed_payload=payload,reviewed_at=now() where id=p_proposal_id; perform recalculate_project_progress(proposal.project_id); return jsonb_build_object('proposal_id',p_proposal_id,'status','approved');
end $$;

create or replace function approve_proposal_milestone(p_proposal_id uuid,p_milestone_client_id text,p_edited_payload jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare proposal ai_proposals; payload jsonb; milestone jsonb; reviewed jsonb;
begin
  select * into proposal from ai_proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found'; end if; reviewed:=coalesce(proposal.review_state->'reviewed_milestones','[]'); if reviewed ? p_milestone_client_id then raise exception 'Milestone already reviewed'; end if;
  payload:=coalesce(p_edited_payload,proposal.proposed_payload); select value into milestone from jsonb_array_elements(payload->'milestones') where value->>'client_id'=p_milestone_client_id; if milestone is null then raise exception 'Milestone not found in proposal'; end if;
  create temp table if not exists skyler_proposal_map(client_id text primary key,entity_id uuid not null) on commit drop; truncate skyler_proposal_map; perform apply_proposal_milestone(proposal.project_id,milestone); reviewed:=reviewed||to_jsonb(p_milestone_client_id);
  update ai_proposals set review_state=jsonb_set(review_state,'{reviewed_milestones}',reviewed),status=case when jsonb_array_length(reviewed)>=jsonb_array_length(payload->'milestones') then 'approved' else 'partially_approved' end,reviewed_at=case when jsonb_array_length(reviewed)>=jsonb_array_length(payload->'milestones') then now() else reviewed_at end where id=p_proposal_id;
  perform recalculate_project_progress(proposal.project_id); return jsonb_build_object('proposal_id',p_proposal_id,'reviewed_milestones',reviewed);
end $$;

do $$ declare table_name text; begin foreach table_name in array array['projects','milestones','tasks','task_dependencies','project_documents','document_chunks','progress_updates','daily_plans','daily_plan_items','ai_conversations','ai_messages','ai_proposals','reminders','notification_logs','app_settings','telegram_updates','login_attempts'] loop execute format('alter table %I enable row level security',table_name); execute format('drop policy if exists deny_anon on %I',table_name); execute format('create policy deny_anon on %I for all to anon using (false) with check (false)',table_name); end loop; end $$;
revoke all on all tables in schema public from anon,authenticated;
revoke all on all functions in schema public from anon,authenticated;
commit;
