-- Trigger functions are invoked by triggers as the table owner; they never need a role
-- EXECUTE grant. Revoke direct invocation from PUBLIC/anon to remove needless attack surface.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription()   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_link_prospect_on_signup()  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_storage_usage()           FROM PUBLIC, anon;;
