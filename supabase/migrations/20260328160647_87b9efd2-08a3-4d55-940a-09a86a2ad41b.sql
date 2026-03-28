
CREATE TABLE public.chatbot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  collected_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step text NOT NULL DEFAULT 'greeting',
  resume_generated boolean NOT NULL DEFAULT false,
  generated_resume_id uuid REFERENCES public.user_resumes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chatbot sessions" ON public.chatbot_sessions
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
