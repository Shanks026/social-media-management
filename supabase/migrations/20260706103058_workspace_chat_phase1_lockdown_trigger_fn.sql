-- Trigger functions should never be directly callable via RPC — matches emit_notifications.
revoke execute on function public.tg_notify_chat_message() from public, anon, authenticated;;
