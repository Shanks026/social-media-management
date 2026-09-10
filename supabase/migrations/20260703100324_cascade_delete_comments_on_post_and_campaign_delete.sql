
create or replace function public.tg_delete_orphaned_comments()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.comments
  where entity_type = TG_ARGV[0]
    and entity_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists trg_delete_comments_on_post_delete on public.posts;
create trigger trg_delete_comments_on_post_delete
  after delete on public.posts
  for each row execute function public.tg_delete_orphaned_comments('post');

drop trigger if exists trg_delete_comments_on_campaign_delete on public.campaigns;
create trigger trg_delete_comments_on_campaign_delete
  after delete on public.campaigns
  for each row execute function public.tg_delete_orphaned_comments('campaign');
;
