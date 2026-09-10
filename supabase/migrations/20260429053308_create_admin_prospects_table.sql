
CREATE TABLE IF NOT EXISTS admin_prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  agency_name     text,
  email           text NOT NULL,
  source          text,
  status          text DEFAULT 'trial_started',
  tercero_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_prospects_email_idx ON admin_prospects (email);
CREATE INDEX IF NOT EXISTS admin_prospects_tercero_user_id_idx ON admin_prospects (tercero_user_id);
;
