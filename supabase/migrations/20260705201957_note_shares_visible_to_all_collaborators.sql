
-- note_shares_invitee_reads_own only exposed a collaborator's OWN row, so an
-- invitee could never see who else has access to the same note — breaking the
-- "who's involved" avatar group for non-authors. Widen it: any collaborator on
-- a note (author already covered separately by note_shares_author_manages)
-- can see every share row for that note, not just their own. Uses the same
-- SECURITY DEFINER helper (my_note_share_permission) rather than an inline
-- self-referencing subquery, avoiding the same class of RLS recursion fixed
-- earlier this session.
DROP POLICY "note_shares_invitee_reads_own" ON public.note_shares;
CREATE POLICY "note_shares_visible_to_collaborators" ON public.note_shares
  FOR SELECT USING (
    my_note_share_permission(note_id) IS NOT NULL
  );
;
