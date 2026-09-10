-- Drop the two dead get_clients_with_pipeline overloads.
--
-- Three existed: (uuid), (uuid,text,text,text,text) and
-- (uuid,text,text,text,text,text). Only the 6-arg one is called — clients.js
-- passes all six by name — and because the other two take DEFAULTs, calling
-- the function with a bare uuid was ambiguous and failed outright with
-- "function is not unique". Same class of stale duplicate as the 3-arg
-- join_team removed earlier.
--
-- They had also drifted apart, which is the real hazard: the 1-arg version
-- returns a TABLE that omits the `approved` count, while the 6-arg version
-- returns jsonb and includes it. Reading the wrong one gives a confidently
-- wrong answer about what the client card can display.
drop function if exists public.get_clients_with_pipeline(uuid);
drop function if exists public.get_clients_with_pipeline(uuid, text, text, text, text);;
