
ALTER TABLE client_documents
  DROP CONSTRAINT client_documents_category_check,
  ADD CONSTRAINT client_documents_category_check CHECK (
    category = ANY (ARRAY[
      'Contract', 'NDA', 'Brand Guidelines', 'Creative Brief', 'Brand Assets',
      'Meeting Notes', 'Invoice / Finance', 'SOP', 'Other',
      'Proposal', 'Pitch Deck', 'Case Study', 'Discovery Notes'
    ])
  );
;
