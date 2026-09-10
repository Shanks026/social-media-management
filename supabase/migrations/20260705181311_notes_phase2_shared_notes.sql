
-- Allow the third visibility state now that note_shares will exist to back it.
ALTER TABLE public.notes DROP CONSTRAINT notes_visibility_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_visibility_check
  CHECK (visibility IN ('private', 'shared', 'workspace'));

CREATE TABLE public.note_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission     text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
  invited_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, member_user_id)
);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Only the note's author manages its share list (add/remove/change permission).
-- A write-collaborator editing the note's content does NOT get to re-share it.
CREATE POLICY "note_shares_author_manages" ON public.note_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM notes n WHERE n.id = note_shares.note_id AND n.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM notes n WHERE n.id = note_shares.note_id AND n.created_by = auth.uid())
  );

-- An invited member can see their own share row (to know their permission level
-- and to power the "Shared with me" filter).
CREATE POLICY "note_shares_invitee_reads_own" ON public.note_shares
  FOR SELECT USING (member_user_id = auth.uid());

-- Extend notes SELECT: add the shared branch.
DROP POLICY "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid()
      ))
    )
  );

-- Extend notes UPDATE: shared + write permission can edit content, but the
-- visibility-change trigger from Phase 1 still blocks them from touching
-- `visibility` itself — only the author can do that.
DROP POLICY "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns
        WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid() AND ns.permission = 'write'
      ))
    )
  ) WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns
        WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid() AND ns.permission = 'write'
      ))
    )
  );

-- DELETE is intentionally NOT extended to shared write-access — deleting a
-- note stays author-only-or-workspace-visibility, same as Phase 1.

-- Extend the tag-link visibility policy the same way.
DROP POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links;
CREATE POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (
          n.created_by = auth.uid()
          OR n.visibility = 'workspace'
          OR (n.visibility = 'shared' AND EXISTS (
            SELECT 1 FROM note_shares ns WHERE ns.note_id = n.id AND ns.member_user_id = auth.uid()
          ))
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND n.created_by = auth.uid()
    )
  );

-- Notify an invited member when they're added to a note's share list.
CREATE OR REPLACE FUNCTION public.tg_notify_note_shared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id uuid;
  v_note_title text;
BEGIN
  SELECT user_id, title INTO v_workspace_id, v_note_title
  FROM notes WHERE id = NEW.note_id;

  PERFORM emit_notifications(
    v_workspace_id,
    NEW.invited_by,
    ARRAY[NEW.member_user_id],
    'note_shared',
    'Note shared with you',
    COALESCE(v_note_title, 'A note') || ' was shared with you (' || NEW.permission || ' access)',
    'note',
    NEW.note_id,
    '/operations/notes/' || NEW.note_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_note_shared
  AFTER INSERT ON public.note_shares
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_note_shared();
;
