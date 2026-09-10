
CREATE OR REPLACE FUNCTION get_client_report(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object(
        'id', c.id, 'name', c.name, 'logo_url', c.logo_url,
        'industry', c.industry, 'email', c.email, 'website', c.website,
        'created_at', c.created_at
      )
      FROM clients c WHERE c.id = p_client_id
    ),
    'deliverables', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(cnt), 0),
        'by_status', COALESCE(jsonb_object_agg(status, cnt) FILTER (WHERE status IS NOT NULL), '{}'::jsonb)
      )
      FROM (
        SELECT pv.status::text AS status, COUNT(*) AS cnt
        FROM posts p
        JOIN post_versions pv ON pv.id = p.current_version_id
        WHERE p.client_id = p_client_id
        GROUP BY pv.status
      ) s
    ),
    'campaigns', (
      SELECT jsonb_build_object(
        'total', COALESCE(COUNT(*), 0),
        'budget_allocated', COALESCE(SUM(budget), 0)
      )
      FROM campaigns WHERE client_id = p_client_id
    ),
    'finance', (
      SELECT jsonb_build_object(
        'billed',      COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','PAID','OVERDUE')), 0),
        'collected',   COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
        'outstanding', COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','OVERDUE')), 0),
        'overdue',     COALESCE(SUM(total) FILTER (WHERE status = 'OVERDUE'), 0),
        'invoice_count', COALESCE(COUNT(*), 0)
      )
      FROM invoices WHERE client_id = p_client_id
    ),
    'proposals', (
      SELECT jsonb_build_object(
        'sent',      COALESCE(COUNT(*) FILTER (WHERE status <> 'draft'), 0),
        'accepted',  COALESCE(COUNT(*) FILTER (WHERE status = 'accepted'), 0),
        'value_won', COALESCE(SUM(total_value) FILTER (WHERE status = 'accepted'), 0)
      )
      FROM proposals WHERE client_id = p_client_id
    ),
    'documents', (
      SELECT jsonb_build_object(
        'count', COALESCE(COUNT(*), 0),
        'total_bytes', COALESCE(SUM(file_size_bytes), 0)
      )
      FROM client_documents WHERE client_id = p_client_id
    ),
    'pipeline', (
      SELECT jsonb_build_object('next_deliverable_at', next_post_at)
      FROM client_pipeline_analytics WHERE client_id = p_client_id
    )
  );
$$;
;
