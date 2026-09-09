ALTER TABLE public.agency_subscriptions
  ADD COLUMN IF NOT EXISTS extra_seat_price_inr integer;
;
