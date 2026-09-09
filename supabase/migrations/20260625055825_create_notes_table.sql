
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes (user_id);
CREATE INDEX idx_notes_client_id ON notes (client_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace manages own notes"
  ON notes FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());
;
