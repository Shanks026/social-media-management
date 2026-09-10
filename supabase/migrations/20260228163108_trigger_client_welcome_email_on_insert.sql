-- NOTE: the Authorization header below originally carried this project's literal
-- service_role JWT. That key has since been rotated, so the original value is
-- dead, but it is redacted here anyway rather than left in the repo.
--
-- `supabase migration fetch` regenerates this file from
-- supabase_migrations.schema_migrations, which still holds the original
-- statement, so the old key reappears on every sync. Re-check this file after
-- any fetch.
--

CREATE OR REPLACE TRIGGER trigger_client_welcome_email
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://ockvcyevnozuczzngrwg.supabase.co/functions/v1/send-client-welcome',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY_REDACTED>"}',
  '{}',
  '5000'
);
;
