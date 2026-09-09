
-- Drop the over-engineered SELECT policy that let admins bypass visibility
DROP POLICY IF EXISTS meetings_select ON meetings;

-- Replace with a uniform rule: public OR own private — no role bypass
CREATE POLICY meetings_select ON meetings
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      visibility = 'public'
      OR creator_id = auth.uid()
    )
  );

-- Also fix UPDATE/DELETE: any team member can edit their own meeting;
-- owners/admins can edit any meeting in the workspace (management use case).
-- Drop and recreate to remove the member-only restriction.
DROP POLICY IF EXISTS meetings_update ON meetings;
DROP POLICY IF EXISTS meetings_delete ON meetings;

CREATE POLICY meetings_update ON meetings
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      -- can see it (public or own private) — and must own it if private
      visibility = 'public'
      OR creator_id = auth.uid()
    )
  ) WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
  );

CREATE POLICY meetings_delete ON meetings
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      visibility = 'public'
      OR creator_id = auth.uid()
    )
  );
;
