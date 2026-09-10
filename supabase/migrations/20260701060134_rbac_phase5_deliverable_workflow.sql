
-- ── 1. Extend post_status enum ────────────────────────────────────────────────
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'READY';

-- ── 2. Track who submitted (for approval queue display) ───────────────────────
ALTER TABLE public.post_versions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);

-- ── 3. Status transition enforcement trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_post_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  allowed text[] := CASE OLD.status::text
    WHEN 'DRAFT'             THEN ARRAY['SUBMITTED','PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'SUBMITTED'         THEN ARRAY['READY','CHANGES_REQUESTED','ARCHIVED']
    WHEN 'CHANGES_REQUESTED' THEN ARRAY['SUBMITTED','ARCHIVED']
    WHEN 'READY'             THEN ARRAY['PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'PENDING_APPROVAL'  THEN ARRAY['SCHEDULED','NEEDS_REVISION','ARCHIVED']
    WHEN 'NEEDS_REVISION'    THEN ARRAY['ARCHIVED']
    WHEN 'SCHEDULED'         THEN ARRAY['PUBLISHED','ARCHIVED']
    WHEN 'APPROVED'          THEN ARRAY['DELIVERED','ARCHIVED']
    WHEN 'DELIVERED'         THEN ARRAY[]::text[]
    WHEN 'PUBLISHED'         THEN ARRAY[]::text[]
    WHEN 'ARCHIVED'          THEN ARRAY[]::text[]
    ELSE                          ARRAY[]::text[]
  END;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'Invalid post status transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_version_status_transition ON public.post_versions;
CREATE TRIGGER trg_post_version_status_transition
  BEFORE UPDATE OF status ON public.post_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_status_transition();

-- ── 4. Update send_post_for_approval to accept DRAFT or READY ─────────────────
CREATE OR REPLACE FUNCTION public.send_post_for_approval(p_post_version_id uuid)
RETURNS void LANGUAGE plpgsql AS $function$
DECLARE
  v_post_id uuid;
BEGIN
  -- Owner/admin-authored posts come from DRAFT; member-submitted posts come from READY
  SELECT post_id INTO v_post_id
  FROM post_versions
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'READY');

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Only DRAFT or READY versions can be sent for client approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_versions
    WHERE id = p_post_version_id AND (content IS NULL OR content = '')
  ) THEN
    RAISE EXCEPTION 'Post must have content before sending for approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_versions
    WHERE post_id = v_post_id AND status IN ('PENDING_APPROVAL', 'APPROVED', 'SCHEDULED')
  ) THEN
    RAISE EXCEPTION 'Post already has an active approval lifecycle';
  END IF;

  UPDATE post_versions SET status = 'PENDING_APPROVAL' WHERE id = p_post_version_id;
END;
$function$;

-- ── 5. New internal approval RPCs ────────────────────────────────────────────

-- Member submits for internal review (DRAFT → SUBMITTED or CHANGES_REQUESTED → SUBMITTED)
CREATE OR REPLACE FUNCTION public.submit_for_internal_approval(p_post_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE post_versions
  SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;
END;
$$;

-- Owner/Admin approves internally: SUBMITTED → READY
CREATE OR REPLACE FUNCTION public.approve_internally(p_post_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can approve posts internally';
  END IF;

  UPDATE post_versions SET status = 'READY'
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only approve SUBMITTED posts';
  END IF;
END;
$$;

-- Owner/Admin requests changes: SUBMITTED → CHANGES_REQUESTED (same version, no bump)
CREATE OR REPLACE FUNCTION public.request_internal_changes(p_post_version_id uuid, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can request changes';
  END IF;

  UPDATE post_versions
  SET status = 'CHANGES_REQUESTED', admin_notes = p_notes
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only request changes on SUBMITTED posts';
  END IF;
END;
$$;
;
