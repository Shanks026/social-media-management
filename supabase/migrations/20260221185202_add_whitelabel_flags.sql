
-- Add new whitelabel flag columns
ALTER TABLE public.agency_subscriptions
  ADD COLUMN IF NOT EXISTS basic_whitelabel_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_whitelabel_enabled BOOLEAN DEFAULT false;

-- Backfill existing rows based on current plan_name
UPDATE public.agency_subscriptions
  SET basic_whitelabel_enabled = true, full_whitelabel_enabled = false
  WHERE plan_name = 'VELOCITY';

UPDATE public.agency_subscriptions
  SET basic_whitelabel_enabled = false, full_whitelabel_enabled = true
  WHERE plan_name = 'QUANTUM';

UPDATE public.agency_subscriptions
  SET basic_whitelabel_enabled = false, full_whitelabel_enabled = false
  WHERE plan_name NOT IN ('VELOCITY', 'QUANTUM');

-- Drop old whitelabel_enabled column
ALTER TABLE public.agency_subscriptions
  DROP COLUMN IF EXISTS whitelabel_enabled;
;
