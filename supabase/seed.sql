-- Optional demo seed. Never run automatically in production.
do $$
declare subject_id uuid:=gen_random_uuid(); assignment_id uuid:=gen_random_uuid(); competition_id uuid:=gen_random_uuid(); milestone_id uuid:=gen_random_uuid(); task_a uuid:=gen_random_uuid(); task_b uuid:=gen_random_uuid(); proposal_id uuid:=gen_random_uuid(); plan_id uuid:=gen_random_uuid();
begin
  insert into projects(id,title,project_type,description,status,priority,start_date,final_deadline,internal_deadline,estimated_total_hours,calculated_progress,displayed_progress,expected_progress,progress_variance,risk_status,risk_reason,is_active_context)
  values
  (subject_id,'Data Engineering','subject','Semester subject with labs and a final assessment.','active','high',current_date-30,current_date+50,current_date+43,80,52,52,48,4,'on_track','Progress is within plan.',false),
  (assignment_id,'Distributed Systems Assignment','assignment','Design and evaluate a fault-tolerant service.','active','critical',current_date-12,current_date+9,current_date+6,28,38,38,58,-20,'delayed','Testing work is overdue.',true),
  (competition_id,'AMD Innovation Challenge','competition','Prototype, pitch deck, demo video, and technical report.','active','high',current_date-20,current_date+18,current_date+14,72,61,61,55,6,'at_risk','A hardware dependency is blocked.',false);
  insert into milestones(id,project_id,title,description,sequence,start_date,due_date,status,progress,estimated_hours,is_ai_generated) values(milestone_id,assignment_id,'Implementation and evidence','Build the service, test it, and prepare evidence.',1,current_date-8,current_date+5,'active',42,20,true);
  insert into tasks(id,project_id,milestone_id,title,status,progress_percent,priority,effort_weight,estimated_hours,actual_hours,planned_start,due_date,blocked_reason,sequence,is_ai_generated) values
  (task_a,assignment_id,milestone_id,'Complete Supabase schema','completed',100,'critical',3,4,4,current_date-7,current_date-4,null,1,true),
  (task_b,assignment_id,milestone_id,'Run failure-mode tests','blocked',15,'high',4,6,1,current_date-3,current_date+1,'Required test device is not available.',2,true);
  insert into task_dependencies(predecessor_task_id,dependent_task_id) values(task_a,task_b);
  insert into progress_updates(project_id,task_id,source,old_status,new_status,old_progress,new_progress,note,actual_hours_added) values(assignment_id,task_a,'web','in_progress','completed',80,100,'Schema migration verified.',1);
  insert into ai_proposals(id,proposal_type,project_id,proposed_payload,human_summary,approval_mode,status,fingerprint) values(proposal_id,'reschedule',competition_id,jsonb_build_object('type','reschedule','project_id',competition_id,'summary','Move internal demo review one day earlier to protect submission buffer.','changes',jsonb_build_array()),'Protect the final submission buffer by moving the internal demo review.','milestone_by_milestone','pending',encode(digest(proposal_id::text,'sha256'),'hex'));
  insert into daily_plans(id,plan_date,period,generated_summary,total_planned_hours,completion_percentage,risk_summary) values(plan_id,current_date,'morning','Prioritise testing because it blocks the report.',5.5,36,'One delayed and one at-risk project.');
  insert into daily_plan_items(daily_plan_id,task_id,ordering,planned_duration_minutes,is_completed) values(plan_id,task_b,1,120,false);
end $$;
