-- Add finance_accrual column to agency_subscriptions
ALTER TABLE agency_subscriptions ADD COLUMN IF NOT EXISTS finance_accrual boolean DEFAULT false;

-- Update existing plans
-- Ignite/Trial: false (already default, but explicit for clarity)
UPDATE agency_subscriptions 
SET finance_accrual = false 
WHERE plan_name IN ('ignite', 'trial');

-- Velocity/Quantum: true
UPDATE agency_subscriptions 
SET finance_accrual = true 
WHERE plan_name IN ('velocity', 'quantum');
;
