
CREATE OR REPLACE FUNCTION set_post_version_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only track edits to actual content/schedule columns.
  -- Ignores status transitions and the post-insert bookkeeping update from create_post_draft_v3.
  IF (
    OLD.title       IS DISTINCT FROM NEW.title       OR
    OLD.content     IS DISTINCT FROM NEW.content     OR
    OLD.platform    IS DISTINCT FROM NEW.platform    OR
    OLD.media_urls  IS DISTINCT FROM NEW.media_urls  OR
    OLD.target_date IS DISTINCT FROM NEW.target_date OR
    OLD.admin_notes IS DISTINCT FROM NEW.admin_notes
  ) THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
;
