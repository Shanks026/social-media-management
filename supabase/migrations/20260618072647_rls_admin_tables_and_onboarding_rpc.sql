
-- ── RLS on admin_outreach_notes ──────────────────────────────────────────────
alter table public.admin_outreach_notes enable row level security;

create policy "superadmin_only_outreach_notes"
  on public.admin_outreach_notes
  for all
  using (
    exists (
      select 1 from agency_members
      where agency_members.member_user_id = auth.uid()
        and agency_members.system_role = 'superadmin'
    )
  );

-- ── RLS on admin_prospect_activity ───────────────────────────────────────────
alter table public.admin_prospect_activity enable row level security;

create policy "superadmin_only_prospect_activity"
  on public.admin_prospect_activity
  for all
  using (
    exists (
      select 1 from agency_members
      where agency_members.member_user_id = auth.uid()
        and agency_members.system_role = 'superadmin'
    )
  );

-- ── Onboarding RPC ────────────────────────────────────────────────────────────
create or replace function admin_get_client_onboarding(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only superadmins may call this
  if not exists (
    select 1 from agency_members
    where member_user_id = auth.uid()
      and system_role = 'superadmin'
  ) then
    raise exception 'Access denied';
  end if;

  return (
    select jsonb_build_object(
      'profile_complete',
        coalesce(
          (select agency_name is not null and logo_url is not null
           from agency_subscriptions where user_id = p_user_id),
          false
        ),
      'first_client_added',
        exists (select 1 from clients where user_id = p_user_id),
      'first_prospect_added',
        exists (select 1 from prospects where user_id = p_user_id),
      'first_team_member_added',
        exists (select 1 from agency_members where agency_user_id = p_user_id),
      'first_proposal_created',
        exists (select 1 from proposals where agency_user_id = p_user_id),
      'first_post_created',
        exists (
          select 1 from posts p
          join clients c on c.id = p.client_id
          where c.user_id = p_user_id
        )
    )
  );
end;
$$;
;
