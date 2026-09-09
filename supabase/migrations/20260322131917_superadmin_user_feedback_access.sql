-- Allow superadmins to read all user_feedback
CREATE POLICY "Superadmins can view all feedback"
ON user_feedback FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agency_members
    WHERE member_user_id = auth.uid()
    AND system_role = 'superadmin'
  )
);

-- Allow superadmins to update status and admin_notes on any feedback
CREATE POLICY "Superadmins can update feedback status"
ON user_feedback FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM agency_members
    WHERE member_user_id = auth.uid()
    AND system_role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agency_members
    WHERE member_user_id = auth.uid()
    AND system_role = 'superadmin'
  )
);;
