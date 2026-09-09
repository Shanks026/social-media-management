
CREATE POLICY "agency_members_delete_owner"
ON public.agency_members
FOR DELETE
USING (auth.uid() = agency_user_id);
;
