DROP INDEX IF EXISTS idx_unique_internal_client;
DROP INDEX IF EXISTS one_internal_client_per_user;
-- Keep unique_internal_client_per_user as the single source of truth for internal workspace uniqueness.;
