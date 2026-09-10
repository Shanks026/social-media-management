
-- ============================================================
-- Helper: resolves the correct workspace owner UID for the
-- current session. Admins return their own UID; members return
-- their agency owner's UID.
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_agency_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT user_id FROM agency_subscriptions WHERE user_id = auth.uid()),
    (SELECT agency_user_id FROM agency_members
     WHERE member_user_id = auth.uid() AND is_active = true
     LIMIT 1)
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- CLIENTS
-- ============================================================
DROP POLICY IF EXISTS "clients are user scoped" ON clients;
DROP POLICY IF EXISTS "users_manage_own_clients" ON clients;
DROP POLICY IF EXISTS "Enforce Client Limit" ON clients;

CREATE POLICY "clients_workspace_scoped"
  ON clients FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

CREATE POLICY "clients_enforce_limit"
  ON clients FOR INSERT
  WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (
      SELECT count(*) FROM clients c WHERE c.user_id = get_my_agency_user_id()
    ) < (
      SELECT max_clients FROM agency_subscriptions WHERE user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- CAMPAIGNS
-- ============================================================
DROP POLICY IF EXISTS "Users manage own campaigns" ON campaigns;

CREATE POLICY "campaigns_workspace_scoped"
  ON campaigns FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- INVOICES
-- ============================================================
DROP POLICY IF EXISTS "Users manage own invoices" ON invoices;

CREATE POLICY "invoices_workspace_scoped"
  ON invoices FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- INVOICE ITEMS (scoped via invoices.user_id)
-- ============================================================
DROP POLICY IF EXISTS "Users manage own invoice items" ON invoice_items;

CREATE POLICY "invoice_items_workspace_scoped"
  ON invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- RECURRING INVOICES
-- ============================================================
DROP POLICY IF EXISTS "Users manage own recurring invoices" ON recurring_invoices;

CREATE POLICY "recurring_invoices_workspace_scoped"
  ON recurring_invoices FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- EXPENSES
-- ============================================================
DROP POLICY IF EXISTS "View own expenses" ON expenses;
DROP POLICY IF EXISTS "Insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Update own expenses" ON expenses;
DROP POLICY IF EXISTS "Delete own expenses" ON expenses;

CREATE POLICY "expenses_workspace_scoped"
  ON expenses FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- TRANSACTIONS
-- ============================================================
DROP POLICY IF EXISTS "Manage own transactions" ON transactions;

CREATE POLICY "transactions_workspace_scoped"
  ON transactions FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- CLIENT NOTES
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Users can insert their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Users can update their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Users can delete their own client notes" ON client_notes;

CREATE POLICY "client_notes_workspace_scoped"
  ON client_notes FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- CLIENT DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "Users manage own documents" ON client_documents;

CREATE POLICY "client_documents_workspace_scoped"
  ON client_documents FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- DOCUMENT COLLECTIONS
-- ============================================================
DROP POLICY IF EXISTS "Users manage own collections" ON document_collections;

CREATE POLICY "document_collections_workspace_scoped"
  ON document_collections FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());

-- ============================================================
-- MEETINGS (scoped via clients.user_id)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their clients' meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their clients' meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their clients' meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their clients' meetings" ON meetings;

CREATE POLICY "meetings_workspace_scoped"
  ON meetings FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- POSTS (scoped via clients.user_id)
-- ============================================================
DROP POLICY IF EXISTS "users_manage_posts_for_own_clients" ON posts;

CREATE POLICY "posts_workspace_scoped"
  ON posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = posts.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = posts.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- POST VERSIONS (scoped via clients.user_id)
-- ============================================================
DROP POLICY IF EXISTS "users_manage_versions_for_own_clients" ON post_versions;

CREATE POLICY "post_versions_workspace_scoped"
  ON post_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = post_versions.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = post_versions.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- APPROVALS (scoped via clients.user_id)
-- ============================================================
DROP POLICY IF EXISTS "users_manage_approvals_for_own_clients" ON approvals;

CREATE POLICY "approvals_workspace_scoped"
  ON approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = approvals.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = approvals.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- SCHEDULES (scoped via clients.user_id)
-- ============================================================
DROP POLICY IF EXISTS "users_manage_schedules_for_own_clients" ON schedules;

CREATE POLICY "schedules_workspace_scoped"
  ON schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = schedules.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = schedules.client_id
        AND clients.user_id = get_my_agency_user_id()
    )
  );

-- ============================================================
-- AGENCY SUBSCRIPTIONS — allow members to manage workspace settings
-- ============================================================
DROP POLICY IF EXISTS "Users can manage their own agency settings" ON agency_subscriptions;
DROP POLICY IF EXISTS "Agencies can view own subscription" ON agency_subscriptions;

CREATE POLICY "agency_subscriptions_workspace_scoped"
  ON agency_subscriptions FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());
;
