
-- Add prospect_id FK to proposals table
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;

-- Index for efficient prospect-based lookups
CREATE INDEX IF NOT EXISTS proposals_prospect_id_idx ON proposals(prospect_id);
;
