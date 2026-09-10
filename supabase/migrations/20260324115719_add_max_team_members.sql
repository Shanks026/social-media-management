
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS max_team_members integer DEFAULT NULL;
;
