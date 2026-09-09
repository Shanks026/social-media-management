
-- 1. Add creator_id and visibility columns
ALTER TABLE meetings
  ADD COLUMN creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('private', 'public'));

-- 2. Trigger: auto-set creator_id = auth.uid() on every INSERT
CREATE OR REPLACE FUNCTION set_meeting_creator_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meetings_set_creator
  BEFORE INSERT ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_meeting_creator_id();

-- 3. Drop the single ALL policy
DROP POLICY meetings_workspace_scoped ON meetings;

-- 4. SELECT: workspace + visibility filter for members
CREATE POLICY meetings_select ON meetings
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM agency_members
        WHERE member_user_id = auth.uid()
          AND is_active = true
          AND system_role = 'member'
      )
      OR visibility = 'public'
      OR creator_id = auth.uid()
    )
  );

-- 5. INSERT: workspace scoped (unchanged)
CREATE POLICY meetings_insert ON meetings
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
  );

-- 6. UPDATE: workspace scoped + (owner/admin OR own meeting)
CREATE POLICY meetings_update ON meetings
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM agency_members
        WHERE member_user_id = auth.uid()
          AND is_active = true
          AND system_role = 'member'
      )
      OR creator_id = auth.uid()
    )
  ) WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
  );

-- 7. DELETE: workspace scoped + (owner/admin OR own meeting)
CREATE POLICY meetings_delete ON meetings
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM agency_members
        WHERE member_user_id = auth.uid()
          AND is_active = true
          AND system_role = 'member'
      )
      OR creator_id = auth.uid()
    )
  );
;
