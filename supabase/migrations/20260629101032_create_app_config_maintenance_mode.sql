
-- Create a generic app config table
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated users) can read config
CREATE POLICY "Public read app_config"
  ON public.app_config FOR SELECT
  USING (true);

-- Only service role can write (no anon/authenticated write policy)

-- Seed the maintenance mode record
INSERT INTO public.app_config (key, value)
VALUES (
  'maintenance_mode',
  '{"is_active": false, "message": "The application is currently undergoing maintenance. We''ll be back shortly.", "started_at": null}'
)
ON CONFLICT (key) DO NOTHING;

-- Auto-update the updated_at column
CREATE OR REPLACE FUNCTION public.update_app_config_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_app_config_timestamp();
;
