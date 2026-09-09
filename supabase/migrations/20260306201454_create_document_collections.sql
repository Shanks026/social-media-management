
-- Phase 3: Document Collections

-- New table: document_collections
CREATE TABLE document_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collections"
  ON document_collections FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_document_collections_client_id ON document_collections(client_id);
CREATE INDEX idx_document_collections_user_id   ON document_collections(user_id);

-- Add collection_id FK to client_documents
ALTER TABLE client_documents
  ADD COLUMN collection_id UUID REFERENCES document_collections(id) ON DELETE SET NULL;

CREATE INDEX idx_client_documents_collection_id ON client_documents(collection_id);
;
