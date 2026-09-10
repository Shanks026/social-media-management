
CREATE TABLE prospects (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Layer 1: Lead data
  business_name       text        NOT NULL,
  contact_name        text,
  email               text,
  phone               text,
  website             text,
  location            text,
  address             text,
  instagram           text,
  linkedin            text,

  -- Layer 2: CRM data
  industry            text,
  source              text        NOT NULL DEFAULT 'manual',
  status              text        NOT NULL DEFAULT 'new',
  last_contacted_at   timestamptz,
  next_followup_at    timestamptz,
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_workspace_policy" ON prospects
  FOR ALL USING (user_id = (SELECT get_my_agency_user_id()));

-- Indexes
CREATE INDEX prospects_user_id_idx   ON prospects (user_id);
CREATE INDEX prospects_status_idx    ON prospects (user_id, status);
CREATE INDEX prospects_followup_idx  ON prospects (user_id, next_followup_at);
;
