
ALTER TABLE public.agency_members
  DROP CONSTRAINT agency_members_system_role_check;

ALTER TABLE public.agency_members
  ADD CONSTRAINT agency_members_system_role_check
  CHECK (system_role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'superadmin'::text]));
;
