
-- Drop and recreate the category check without 'Proposal'
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_category_check;

ALTER TABLE client_documents ADD CONSTRAINT client_documents_category_check
  CHECK (category IN (
    -- Client categories
    'Contract', 'NDA', 'Brand Guidelines', 'Creative Brief',
    'Brand Assets', 'Meeting Notes', 'Invoice / Finance', 'SOP',
    -- Prospect categories (no 'Proposal' — those live in the proposals table)
    'Pitch Deck', 'Case Study', 'Discovery Notes',
    -- Shared
    'Other'
  ));
;
