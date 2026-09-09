-- Phase 1 of Note Visibility & Sharing (.claude/features/05-note-visibility-sharing.md)
-- Adds Private/Workspace visibility to notes. 'shared' is added in Phase 2
-- once note_shares exists, so the CHECK constraint intentionally only allows
-- two values for now.

ALTER TABLE public.notes
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'workspace'));

DROP POLICY "Workspace manages own notes" ON public.notes;

-- SELECT: workspace-scoped, and either you're the author or it's shared with
-- the whole workspace. This is the entire privacy guarantee — no admin
-- override, by design.
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- INSERT: any workspace member may create a note, but must insert as themselves.
CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT WITH CHECK (
    user_id = get_my_agency_user_id() AND created_by = auth.uid()
  );

-- UPDATE: Workspace-visibility notes stay editable by any workspace member
-- (today's exact behavior, unchanged). Private notes are author-only.
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  ) WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- DELETE: same rule as UPDATE — preserves today's "anyone can delete a
-- workspace note" behavior; private notes only deletable by their author.
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- Authoritative guard: only the author may ever change a note's visibility,
-- even though workspace-visibility notes are otherwise editable by anyone.
CREATE OR REPLACE FUNCTION public.enforce_note_visibility_author_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only_the_author_can_change_note_visibility';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notes_visibility_author_only
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_visibility_author_only();

-- Fix the tag-link leak: note_tag_links previously only checked workspace
-- membership, not note visibility, so a Private note's tags were queryable
-- by anyone who knows/enumerates the note_id. Mirror the same visibility
-- check used on notes.
DROP POLICY "note_tag_links_workspace_scoped" ON public.note_tag_links;

CREATE POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (n.created_by = auth.uid() OR n.visibility = 'workspace')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (n.created_by = auth.uid() OR n.visibility = 'workspace')
    )
  );
;
