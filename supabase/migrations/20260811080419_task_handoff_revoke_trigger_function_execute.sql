-- Advisor flagged both new trigger functions as directly callable via
-- /rest/v1/rpc/... by anon/authenticated (they're only ever meant to run as
-- triggers on public.tasks). Same fix as security_revoke_trigger_functions_from_public.
revoke execute on function public.enforce_task_assignment() from public, anon;
revoke execute on function public.tg_log_task_activity()    from public, anon;
;
