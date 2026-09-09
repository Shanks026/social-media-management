
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS category TEXT;
-- Backfill existing invoices with 'Monthly Retainer' or 'Other' as a default
UPDATE public.invoices SET category = 'Other' WHERE category IS NULL;
;
