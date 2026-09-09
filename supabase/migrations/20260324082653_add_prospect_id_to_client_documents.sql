
ALTER TABLE client_documents
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;

CREATE INDEX client_documents_prospect_id_idx ON client_documents (prospect_id);
;
