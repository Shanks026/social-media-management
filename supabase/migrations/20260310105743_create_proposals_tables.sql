
-- 1. Add proposals_limit to agency_subscriptions
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS proposals_limit integer DEFAULT 5;

-- Set correct values per plan for existing rows
UPDATE agency_subscriptions SET proposals_limit = 5   WHERE plan_name IN ('trial', 'ignite');
UPDATE agency_subscriptions SET proposals_limit = NULL WHERE plan_name IN ('velocity', 'quantum');

-- 2. Create proposals table
CREATE TABLE proposals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id    uuid        NOT NULL REFERENCES auth.users,
  client_id         uuid        REFERENCES clients,
  prospect_name     text,
  prospect_email    text,
  title             text        NOT NULL,
  status            text        NOT NULL DEFAULT 'draft',
  introduction      text,
  scope_notes       text,
  payment_terms     text,
  contract_duration text,
  valid_until       date,
  share_token       text        UNIQUE,
  first_viewed_at   timestamptz,
  sent_at           timestamptz,
  accepted_at       timestamptz,
  declined_at       timestamptz,
  decline_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 3. Create proposal_line_items table
CREATE TABLE proposal_line_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid    NOT NULL REFERENCES proposals ON DELETE CASCADE,
  description text    NOT NULL,
  amount      numeric NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- 4. Enable RLS
ALTER TABLE proposals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS for proposals — uses get_my_agency_user_id() so team members get transparent access
CREATE POLICY "proposals_access" ON proposals
  FOR ALL USING (get_my_agency_user_id() = agency_user_id);

-- 6. RLS for proposal_line_items — access via proposal ownership
CREATE POLICY "proposal_line_items_access" ON proposal_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_line_items.proposal_id
        AND get_my_agency_user_id() = p.agency_user_id
    )
  );
;
