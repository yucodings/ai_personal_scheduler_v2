-- 1. Enable pg_cron, pg_net, and vault in Database > Extensions.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- 2. Add secrets once (replace values before running these two statements):
-- select vault.create_secret('https://your-app.vercel.app', 'skyler_app_url', 'Skyler production base URL');
-- select vault.create_secret('replace-with-cron-secret', 'skyler_cron_secret', 'Skyler cron bearer secret');

-- 3. Idempotently replace the two jobs.
do $$
declare job record;
begin
  for job in select jobid from cron.job where jobname in ('skyler-morning-plan','skyler-evening-check') loop
    perform cron.unschedule(job.jobid);
  end loop;
end $$;

select cron.schedule('skyler-morning-plan','0 0 * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='skyler_app_url') || '/api/reminders/morning',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='skyler_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);

select cron.schedule('skyler-evening-check','0 12 * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='skyler_app_url') || '/api/reminders/evening',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='skyler_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);

-- Inspect: select * from cron.job; select * from cron.job_run_details order by start_time desc limit 20;
-- Remove: select cron.unschedule('skyler-morning-plan'); select cron.unschedule('skyler-evening-check');

