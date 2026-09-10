CREATE TABLE public.client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'DONE', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client notes" ON public.client_notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own client notes" ON public.client_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own client notes" ON public.client_notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own client notes" ON public.client_notes
    FOR DELETE USING (auth.uid() = user_id);;
