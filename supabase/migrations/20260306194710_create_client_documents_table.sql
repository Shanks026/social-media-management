
-- ============================================================
-- client_documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS client_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL,
  mime_type         TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'Other'
                      CHECK (category IN (
                        'Contract',
                        'NDA',
                        'Brand Guidelines',
                        'Creative Brief',
                        'Brand Assets',
                        'Meeting Notes',
                        'Invoice / Finance',
                        'SOP',
                        'Other'
                      )),
  status            TEXT NOT NULL DEFAULT 'Active'
                      CHECK (status IN ('Active', 'Archived')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents"
  ON client_documents FOR ALL
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_user_id   ON client_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_category  ON client_documents(category);
CREATE INDEX IF NOT EXISTS idx_client_documents_status    ON client_documents(status);
;
