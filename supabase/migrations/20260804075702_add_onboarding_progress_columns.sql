alter table public.agency_subscriptions
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_skipped_steps text[] default '{}';

comment on column public.agency_subscriptions.onboarding_completed_at is
  'Set when the owner finishes or dismisses the onboarding wizard. Replaces the per-device localStorage has_seen_welcome_* flag.';
comment on column public.agency_subscriptions.onboarding_skipped_steps is
  'Step keys the owner skipped (signatory | horizontal_logo | invite_team | first_client). Gates which rows the dashboard setup checklist may show; done-ness itself is derived from live data.';

-- Backfill: any workspace that already has a name has effectively onboarded,
-- so the wizard must not reappear for them. skipped_steps stays empty, which
-- means the setup checklist never nags an established workspace.
update public.agency_subscriptions
   set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
 where agency_name is not null
   and trim(agency_name) <> ''
   and onboarding_completed_at is null;;
