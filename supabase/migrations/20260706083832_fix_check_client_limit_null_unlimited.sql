
CREATE OR REPLACE FUNCTION public.check_client_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  current_plan_limit INTEGER;
  has_subscription BOOLEAN;
  current_client_count INTEGER;
BEGIN
  -- CASE 1: If it's an INTERNAL client, just let it pass.
  IF NEW.is_internal = true THEN
    RETURN NEW;
  END IF;

  -- CASE 2: It's a PAYING CLIENT. Check the limit.

  -- A. Get the user's limit from their subscription, and whether a row exists at all
  -- (distinct from max_clients being NULL, which means "unlimited" on Trial/Quantum).
  SELECT true, max_clients INTO has_subscription, current_plan_limit
  FROM public.agency_subscriptions
  WHERE user_id = NEW.user_id;

  -- B. If no subscription row at all, block everything (Safety Net)
  IF has_subscription IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for this user.';
  END IF;

  -- C. NULL max_clients means unlimited (Trial/Quantum) — skip the count check entirely.
  IF current_plan_limit IS NOT NULL THEN
    SELECT count(*) INTO current_client_count
    FROM public.clients
    WHERE user_id = NEW.user_id
    AND is_internal = false; -- crucial: ignores their internal agency

    IF current_client_count >= current_plan_limit THEN
      RAISE EXCEPTION 'Upgrade Required: You have reached the limit of % clients for your plan.', current_plan_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
;
