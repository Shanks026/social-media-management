ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS documents_collections boolean DEFAULT false;

UPDATE agency_subscriptions
  SET documents_collections = TRUE
  WHERE plan_name IN ('velocity', 'quantum');

UPDATE agency_subscriptions
  SET documents_collections = FALSE
  WHERE plan_name IN ('trial', 'ignite') OR plan_name IS NULL;;
