
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
;
