alter table public.agency_subscriptions
  add column if not exists address text,
  add column if not exists website text;

comment on column public.agency_subscriptions.address is
  'Agency postal address. Rendered on invoice/proposal PDFs.';
comment on column public.agency_subscriptions.website is
  'Agency website. Rendered in the invoice PDF footer.';;
