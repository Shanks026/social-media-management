
-- 1. transactions.client_id: SET NULL → CASCADE
ALTER TABLE transactions DROP CONSTRAINT transactions_client_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 2. expenses.assigned_client_id: SET NULL → CASCADE
ALTER TABLE expenses DROP CONSTRAINT expenses_assigned_client_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_assigned_client_id_fkey
  FOREIGN KEY (assigned_client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 3. posts.current_version_id: NO ACTION → SET NULL
--    (avoids circular-delete conflict: both posts and post_versions cascade from client)
ALTER TABLE posts DROP CONSTRAINT fk_current_version;
ALTER TABLE posts ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES post_versions(id) ON DELETE SET NULL;
;
