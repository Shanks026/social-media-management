
CREATE TABLE user_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_user_id   uuid NOT NULL REFERENCES auth.users(id),
  submitter_user_id   uuid NOT NULL REFERENCES auth.users(id),
  type                text NOT NULL CHECK (type IN ('bug_report', 'suggestion')),

  -- Shared fields
  title               text NOT NULL,
  description         text NOT NULL,

  -- Bug-only
  severity            text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  feature_area        text,
  steps_to_reproduce  text,

  -- Suggestion-only
  category            text CHECK (category IN ('feature_request', 'ux_improvement', 'performance', 'general')),
  expected_benefit    text,

  -- Status
  -- Bug statuses:        open | in_progress | resolved | closed | wont_fix
  -- Suggestion statuses: received | under_review | planned | implemented | declined
  status              text NOT NULL DEFAULT 'open',

  -- Metadata (auto-captured)
  plan_name           text,

  -- Admin use (written from admin portal via service role)
  admin_notes         text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_feedback_workspace ON user_feedback(workspace_user_id);
CREATE INDEX idx_user_feedback_type      ON user_feedback(type);
CREATE INDEX idx_user_feedback_status    ON user_feedback(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_feedback_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW EXECUTE FUNCTION update_user_feedback_updated_at();

-- RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own workspace feedback"
  ON user_feedback FOR SELECT
  USING (workspace_user_id = (SELECT get_my_agency_user_id()));

CREATE POLICY "Users insert own feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (
    workspace_user_id = (SELECT get_my_agency_user_id())
    AND submitter_user_id = auth.uid()
  );
;
