
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS reports boolean NOT NULL DEFAULT false;

UPDATE agency_subscriptions SET reports = TRUE  WHERE plan_name IN ('trial','velocity','quantum');
UPDATE agency_subscriptions SET reports = FALSE WHERE plan_name = 'ignite';
;
