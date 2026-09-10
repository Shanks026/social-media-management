ALTER TABLE agency_subscriptions
ADD COLUMN campaigns BOOLEAN DEFAULT FALSE;

UPDATE agency_subscriptions SET campaigns = FALSE WHERE plan_name IN ('trial', 'ignite');
UPDATE agency_subscriptions SET campaigns = TRUE  WHERE plan_name IN ('velocity', 'quantum');;
