-- Add invoice_id to transactions so we can link auto-created transactions to invoices
ALTER TABLE public.transactions 
ADD COLUMN invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE;

-- Index for fast lookups when deleting/querying by invoice
CREATE INDEX idx_transactions_invoice_id ON public.transactions(invoice_id) WHERE invoice_id IS NOT NULL;;
