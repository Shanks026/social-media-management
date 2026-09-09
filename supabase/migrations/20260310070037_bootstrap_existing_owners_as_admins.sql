
-- Insert an admin row in agency_members for every existing agency owner.
-- agency_user_id = member_user_id = owner's UID (self-referential, signals "I am the workspace admin")
INSERT INTO agency_members (agency_user_id, member_user_id, system_role)
SELECT user_id, user_id, 'admin'
FROM agency_subscriptions
ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;
;
