
-- ─── 30-day retention cleanup ─────────────────────────────────────────────────
create or replace function public.cleanup_old_notifications()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.notifications
  where created_at < now() - interval '30 days';
$$;

-- ─── Invoice overdue notifications ────────────────────────────────────────────
-- Finds invoices that are past due_date and not yet paid/cancelled,
-- skips any that already have an invoice_overdue notification (de-dup).
-- Fans out to workspace owner + admins for each workspace.
create or replace function public.notify_overdue_invoices()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  for r in
    select i.id, i.user_id, i.client_id, i.invoice_number
    from public.invoices i
    where i.due_date < now()
      and i.status not in ('PAID', 'CANCELLED', 'DRAFT')
      and not exists (
        select 1 from public.notifications n
        where n.entity_id = i.id
          and n.type = 'invoice_overdue'
      )
  loop
    perform public.emit_notifications(
      r.user_id,
      null,
      public.workspace_admin_uids(r.user_id),
      'invoice_overdue',
      'Invoice overdue',
      'Invoice ' || r.invoice_number || ' is past its due date',
      'invoice',
      r.id,
      '/finance/invoices'
    );
  end loop;
end;
$$;

-- Lock both down — only internal callers (cron/postgres) may execute
do $$
declare fn_name text;
begin
  for fn_name in values ('cleanup_old_notifications'), ('notify_overdue_invoices') loop
    execute format(
      $q$
        do $inner$
        declare r record;
        begin
          for r in
            select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname=%L
          loop
            execute format('revoke all on function %%s from public', r.oid::regprocedure);
          end loop;
        end $inner$;
      $q$, fn_name);
  end loop;
end $$;

-- ─── Cron jobs ────────────────────────────────────────────────────────────────
-- Cleanup: daily at 3:30 AM (30 min after existing purge job)
select cron.schedule(
  'cleanup-old-notifications',
  '30 3 * * *',
  $$ select public.cleanup_old_notifications(); $$
);

-- Invoice overdue check: daily at 8:00 AM (business hours)
select cron.schedule(
  'notify-overdue-invoices',
  '0 8 * * *',
  $$ select public.notify_overdue_invoices(); $$
);
;
