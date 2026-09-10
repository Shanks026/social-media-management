CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily at 03:00 UTC: invoke the delete-workspace edge function, which purges
-- every workspace whose 14-day grace period has elapsed. Auth uses the
-- service-role key stored in Vault under the name 'service_role_key'.
SELECT cron.schedule(
  'purge-scheduled-workspaces',
  '0 3 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://ockvcyevnozuczzngrwg.supabase.co/functions/v1/delete-workspace',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
          ''
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);;
