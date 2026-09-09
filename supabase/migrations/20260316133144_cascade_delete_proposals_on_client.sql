
ALTER TABLE proposals
  DROP CONSTRAINT proposals_client_id_fkey,
  ADD CONSTRAINT proposals_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
;
