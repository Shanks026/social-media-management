
-- ============================================================
-- agency_members: all workspace participants (owners + members)
-- ============================================================
CREATE TABLE agency_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id  uuid REFERENCES auth.users NOT NULL,  -- workspace owner's UID
  member_user_id  uuid REFERENCES auth.users NOT NULL,  -- this user's UID
  functional_role text,                                  -- display-only (e.g. "Content Writer")
  system_role     text NOT NULL DEFAULT 'member'
                  CHECK (system_role IN ('admin', 'member')),
  joined_at       timestamptz DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (agency_user_id, member_user_id)
);

-- RLS for agency_members
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- Owners can see all members of their agency
CREATE POLICY "agency_members_select_owner"
  ON agency_members FOR SELECT
  USING (auth.uid() = agency_user_id);

-- Members can see their own row
CREATE POLICY "agency_members_select_self"
  ON agency_members FOR SELECT
  USING (auth.uid() = member_user_id);

-- Only owners can insert new members
CREATE POLICY "agency_members_insert_owner"
  ON agency_members FOR INSERT
  WITH CHECK (auth.uid() = agency_user_id);

-- Owners can update members in their agency
CREATE POLICY "agency_members_update_owner"
  ON agency_members FOR UPDATE
  USING (auth.uid() = agency_user_id);

-- ============================================================
-- agency_invites: pending invite links (7-day expiry)
-- ============================================================
CREATE TABLE agency_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id  uuid REFERENCES auth.users NOT NULL,
  token           text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     timestamptz  -- null until used
);

-- RLS for agency_invites
ALTER TABLE agency_invites ENABLE ROW LEVEL SECURITY;

-- Owners can see their own invites
CREATE POLICY "agency_invites_select_owner"
  ON agency_invites FOR SELECT
  USING (auth.uid() = agency_user_id);

-- Owners can create invites
CREATE POLICY "agency_invites_insert_owner"
  ON agency_invites FOR INSERT
  WITH CHECK (auth.uid() = agency_user_id);

-- Owners can update (revoke) their invites
CREATE POLICY "agency_invites_update_owner"
  ON agency_invites FOR UPDATE
  USING (auth.uid() = agency_user_id);
;
