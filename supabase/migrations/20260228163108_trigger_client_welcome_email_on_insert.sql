-- SECURITY: the Authorization header below originally embedded this project's
-- literal service_role JWT (full RLS bypass, expiring 2036). It is redacted so
-- the repository does not carry a live credential.
--
-- This migration is historical and already applied; the trigger exists in the
-- database with its original header. If replayed against a fresh project the
-- trigger is created with the placeholder and the welcome-email call fails
-- auth until set properly — read the key from Vault, do not paste it back.
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
