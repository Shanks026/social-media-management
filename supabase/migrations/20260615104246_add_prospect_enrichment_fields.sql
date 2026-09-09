
ALTER TABLE admin_prospects
  ADD COLUMN IF NOT EXISTS location             text,
  ADD COLUMN IF NOT EXISTS agency_size          text,
  ADD COLUMN IF NOT EXISTS years_in_business    text,
  ADD COLUMN IF NOT EXISTS contact_title        text,
  ADD COLUMN IF NOT EXISTS linkedin_url         text,
  ADD COLUMN IF NOT EXISTS services_offered     text,
  ADD COLUMN IF NOT EXISTS estimated_client_count text,
  ADD COLUMN IF NOT EXISTS industries_served    text,
  ADD COLUMN IF NOT EXISTS lead_score           integer,
  ADD COLUMN IF NOT EXISTS fit_reason           text;
;
