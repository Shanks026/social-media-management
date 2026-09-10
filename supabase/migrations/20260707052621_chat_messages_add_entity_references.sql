-- Phase 7 (feature-workspace-chat.md): lets a chat message point at a
-- specific deliverable or task instead of describing it in prose.
-- Ordered array of { type: 'post'|'task', id: uuid, title: text, client_id: uuid|null }.
-- title is a send-time snapshot (mirrors how mentions snapshot the display
-- name into body text rather than re-resolving on every render); client_id
-- is only populated for type='post' (needed for the
-- /clients/:clientId/posts/:postId route). Named entity_references, not
-- references — the latter is a reserved SQL keyword and would need quoting
-- in every query.
alter table public.chat_messages
  add column entity_references jsonb not null default '[]';;
