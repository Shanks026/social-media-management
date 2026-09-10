
ALTER TABLE user_feedback
  ADD COLUMN dismissed_by_user boolean NOT NULL DEFAULT false;

-- Allow users to set dismissed_by_user = true on their own submissions only
CREATE POLICY "Users can dismiss own feedback"
  ON user_feedback FOR UPDATE
  USING (workspace_user_id = (SELECT get_my_agency_user_id()))
  WITH CHECK (dismissed_by_user = true);
;
