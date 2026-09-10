CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  datetime timestamptz NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS setup
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Admins can only read/write meetings for clients they manage (where clients.user_id = auth.uid())
CREATE POLICY "Users can view their clients' meetings" 
ON meetings FOR SELECT 
USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their clients' meetings" 
ON meetings FOR INSERT 
WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their clients' meetings" 
ON meetings FOR UPDATE 
USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their clients' meetings" 
ON meetings FOR DELETE 
USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);;
