-- Supabase grants EXECUTE to `authenticated` via default privileges independently
-- of the PUBLIC grant revoked in the prior migration — that revoke alone wasn't
-- enough, confirmed by re-running the security advisor. These two are pure
-- trigger functions with no legitimate direct-call use case, unlike reassign_task
-- and is_task_participant (both intentionally callable by authenticated).
revoke execute on function public.enforce_task_assignment() from authenticated;
revoke execute on function public.tg_log_task_activity()    from authenticated;
;
