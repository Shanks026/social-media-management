
-- Root cause: notes_select/notes_update queried note_shares inline, and
-- note_shares_author_manages queried notes inline. Both tables have RLS
-- enabled and are owned by `postgres`, so each cross-table EXISTS subquery
-- re-triggered the other table's RLS evaluation, forming an infinite loop.
-- Fix: route both cross-table checks through SECURITY DEFINER functions
-- (same pattern as get_my_agency_user_id/is_workspace_admin) — since they
-- execute as `postgres` (the table owner), they bypass RLS on the table
-- they query internally, breaking the recursive cycle.

CREATE OR REPLACE FUNCTION public.is_note_author(p_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM notes WHERE id = p_note_id AND created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.my_note_share_permission(p_note_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT permission FROM note_shares
  WHERE note_id = p_note_id AND member_user_id = auth.uid()
  LIMIT 1;
$$;

-- note_shares: author-management policy now checks authorship via the
-- definer function instead of an inline EXISTS on notes.
DROP POLICY "note_shares_author_manages" ON public.note_shares;
CREATE POLICY "note_shares_author_manages" ON public.note_shares
  FOR ALL USING (is_note_author(note_id))
  WITH CHECK (is_note_author(note_id));

-- notes: SELECT/UPDATE shared-branch now checks via the definer function
-- instead of an inline EXISTS on note_shares.
DROP POLICY "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND my_note_share_permission(id) IS NOT NULL)
    )
  );

DROP POLICY "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND my_note_share_permission(id) = 'write')
    )
  ) WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND my_note_share_permission(id) = 'write')
    )
  );

-- note_tag_links: same fix, mirror notes_select's shared branch.
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
          OR (n.visibility = 'shared' AND my_note_share_permission(n.id) IS NOT NULL)
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
;
