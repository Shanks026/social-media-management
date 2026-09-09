
-- ─── Tasks table ───────────────────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  assigned_to  UUID        REFERENCES auth.users(id),

  title        TEXT        NOT NULL,
  description  TEXT,

  status       TEXT        NOT NULL DEFAULT 'TODO'
               CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
  priority     TEXT        NOT NULL DEFAULT 'NORMAL'
               CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),

  due_at       TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  client_id    UUID        REFERENCES public.clients(id)   ON DELETE SET NULL,
  campaign_id  UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_workspace_idx   ON public.tasks(workspace_id);
CREATE INDEX tasks_assigned_to_idx ON public.tasks(assigned_to);
CREATE INDEX tasks_client_idx      ON public.tasks(client_id);
CREATE INDEX tasks_campaign_idx    ON public.tasks(campaign_id);
CREATE INDEX tasks_status_idx      ON public.tasks(status);

-- ─── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    workspace_id = public.get_my_agency_user_id()
    AND (
      created_by  = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_workspace_admin()
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    workspace_id = public.get_my_agency_user_id()
    AND created_by = auth.uid()
    AND (
      assigned_to IS NULL
      OR public.is_workspace_admin()
    )
  );

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  USING (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  )
  WITH CHECK (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  );

-- ─── update_task_status RPC (SECURITY DEFINER) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id UUID,
  p_new_status TEXT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task public.tasks;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  IF v_task.workspace_id <> public.get_my_agency_user_id() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF v_task.created_by <> auth.uid()
     AND (v_task.assigned_to IS NULL OR v_task.assigned_to <> auth.uid())
     AND NOT public.is_workspace_admin()
  THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF p_new_status NOT IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'invalid_status: %', p_new_status;
  END IF;

  UPDATE public.tasks SET
    status       = p_new_status,
    completed_at = CASE
                     WHEN p_new_status = 'COMPLETED' THEN now()
                     ELSE NULL
                   END,
    updated_at   = now()
  WHERE id = p_task_id;
END;
$$;
;
