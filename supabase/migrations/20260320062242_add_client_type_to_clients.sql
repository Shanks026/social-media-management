
ALTER TABLE clients
ADD COLUMN client_type TEXT CHECK (
  client_type IN ('monthly_retainer', 'project_based', 'campaign_based', 'one_off', 'advisory')
);
;
