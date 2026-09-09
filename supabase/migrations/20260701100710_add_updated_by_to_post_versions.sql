
ALTER TABLE post_versions
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Auto-set updated_by on every row update
CREATE OR REPLACE FUNCTION set_post_version_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_versions_updated_by ON post_versions;
CREATE TRIGGER trg_post_versions_updated_by
  BEFORE UPDATE ON post_versions
  FOR EACH ROW EXECUTE FUNCTION set_post_version_updated_by();
;
