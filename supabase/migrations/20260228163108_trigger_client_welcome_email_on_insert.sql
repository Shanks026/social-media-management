-- SECURITY: this trigger originally embedded the project's literal service_role
-- JWT (full RLS bypass, expiring 2036) in its Authorization header. Redacted
-- so the repository does not carry a live credential.
--
-- NOTE: `supabase migration fetch` regenerates this file from
-- supabase_migrations.schema_migrations, which still holds the original SQL,
-- so it WILL restore the key. Re-check this file after any fetch until the
-- key is rotated and the stored statement is corrected at source.
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
