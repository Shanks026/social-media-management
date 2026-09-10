
create or replace function admin_get_client_onboarding(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
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
        exists (
          select 1 from agency_members
          where agency_user_id = p_user_id
            and member_user_id != p_user_id
        ),
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
