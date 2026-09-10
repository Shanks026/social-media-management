
alter table public.comment_reactions
  drop constraint comment_reactions_emoji_check;

alter table public.comment_reactions
  add constraint comment_reactions_emoji_check
  check (emoji in ('👍','👎','❤️','😂','😮','😢','🎉','🙌','🔥','👀','✅','🤔','➕','➖'));
;
