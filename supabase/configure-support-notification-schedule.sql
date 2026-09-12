-- Apply only after the Edge Function and both named Vault secrets exist.
-- Required Vault secrets:
--   support_notification_project_url
--   support_notification_scheduler_secret
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'rakeezx-support-notification-every-minute';

select cron.schedule(
  'rakeezx-support-notification-every-minute',
  '* * * * *',
  $schedule$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'support_notification_project_url')
        || '/functions/v1/support-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'support_notification_scheduler_secret'
        )
      ),
      body := jsonb_build_object('scheduledAt', pg_catalog.now()),
      timeout_milliseconds := 15000
    );
  $schedule$
);
