
-- Extend clients table with new optional fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS location     text;

-- Track conversion on prospects
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS converted_client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prospects_converted_client_id_idx ON prospects (converted_client_id);
;
