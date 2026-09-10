
-- Notes are now collaboratively editable (Workspace members, Shared write-
-- collaborators). Track who last touched a note, mirroring the existing
-- created_by/created_by_name denormalized-name pattern.
ALTER TABLE public.notes
  ADD COLUMN updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN updated_by_name text;
;
