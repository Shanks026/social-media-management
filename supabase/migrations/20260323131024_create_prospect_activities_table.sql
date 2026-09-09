
CREATE TABLE prospect_activities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid        NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL,
  type         text        NOT NULL DEFAULT 'note',
  -- type values: 'call' | 'email' | 'dm' | 'meeting' | 'note' | 'status_change'
  body         text,
  metadata     jsonb,
  -- metadata examples:
  -- status_change: { from_status: 'new', to_status: 'contacted' }
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospect_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_activities_workspace_policy" ON prospect_activities
  FOR ALL USING (user_id = (SELECT get_my_agency_user_id()));

CREATE INDEX prospect_activities_prospect_idx
  ON prospect_activities (prospect_id, occurred_at DESC);
;
