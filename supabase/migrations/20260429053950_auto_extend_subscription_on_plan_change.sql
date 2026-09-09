
CREATE OR REPLACE FUNCTION set_subscription_ends_at_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_name IS DISTINCT FROM OLD.plan_name THEN
    NEW.subscription_ends_at := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_subscription_plan_change
BEFORE UPDATE ON agency_subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_subscription_ends_at_on_plan_change();
;
