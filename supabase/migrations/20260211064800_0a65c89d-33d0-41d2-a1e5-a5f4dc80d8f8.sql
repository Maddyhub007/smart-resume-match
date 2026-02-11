
-- User roles enum
CREATE TYPE public.app_role AS ENUM ('candidate', 'recruiter');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Resumes table
CREATE TABLE public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT,
  file_url TEXT,
  parsed_name TEXT,
  parsed_email TEXT,
  parsed_phone TEXT,
  parsed_location TEXT,
  parsed_summary TEXT,
  parsed_skills TEXT[] DEFAULT '{}',
  parsed_experience JSONB DEFAULT '[]',
  parsed_education JSONB DEFAULT '[]',
  overall_score INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Resume templates (ATS-friendly templates)
CREATE TABLE public.resume_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User-created resumes from templates
CREATE TABLE public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.resume_templates(id),
  title TEXT NOT NULL DEFAULT 'Untitled Resume',
  resume_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs table (posted by recruiters)
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  description TEXT,
  requirements TEXT[] DEFAULT '{}',
  skills_required TEXT[] DEFAULT '{}',
  experience_level TEXT,
  salary_range TEXT,
  job_type TEXT DEFAULT 'full-time',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Job applications
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id UUID REFERENCES public.resumes(id),
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'reviewing', 'shortlisted', 'interview', 'rejected', 'hired')),
  match_score INTEGER DEFAULT 0,
  cover_letter TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

-- Saved jobs by candidates
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, job_id)
);

-- Conversations (for chat between recruiter and candidate)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, recruiter_id, candidate_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'interview_invite', 'system')),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_resumes_ts BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_user_resumes_ts BEFORE UPDATE ON public.user_resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_jobs_ts BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_applications_ts BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS POLICIES

-- Profiles: users see own, recruiters can see candidate profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Recruiters can view candidate profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'recruiter'));

-- User roles: users see own roles, can insert own role
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Resumes: candidates manage own, recruiters can view via applications
CREATE POLICY "Users manage own resumes" ON public.resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Recruiters view resumes via applications" ON public.resumes FOR SELECT USING (
  public.has_role(auth.uid(), 'recruiter') AND id IN (
    SELECT resume_id FROM public.job_applications ja 
    JOIN public.jobs j ON ja.job_id = j.id 
    WHERE j.recruiter_id = auth.uid()
  )
);

-- Resume templates: public read
CREATE POLICY "Anyone can view templates" ON public.resume_templates FOR SELECT USING (true);

-- User resumes: own only
CREATE POLICY "Users manage own user_resumes" ON public.user_resumes FOR ALL USING (auth.uid() = user_id);

-- Jobs: public read, recruiters manage own
CREATE POLICY "Anyone can view active jobs" ON public.jobs FOR SELECT USING (is_active = true);
CREATE POLICY "Recruiters manage own jobs" ON public.jobs FOR ALL USING (auth.uid() = recruiter_id);

-- Applications: candidates manage own, recruiters view for their jobs
CREATE POLICY "Candidates manage own applications" ON public.job_applications FOR ALL USING (auth.uid() = candidate_id);
CREATE POLICY "Recruiters view applications for their jobs" ON public.job_applications FOR SELECT USING (
  job_id IN (SELECT id FROM public.jobs WHERE recruiter_id = auth.uid())
);
CREATE POLICY "Recruiters update application status" ON public.job_applications FOR UPDATE USING (
  job_id IN (SELECT id FROM public.jobs WHERE recruiter_id = auth.uid())
);

-- Saved jobs
CREATE POLICY "Users manage saved jobs" ON public.saved_jobs FOR ALL USING (auth.uid() = user_id);

-- Conversations: participants only
CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT USING (auth.uid() IN (recruiter_id, candidate_id));
CREATE POLICY "Participants create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IN (recruiter_id, candidate_id));

-- Messages: conversation participants
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() IN (recruiter_id, candidate_id))
);
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() IN (recruiter_id, candidate_id))
);
CREATE POLICY "Recipients mark messages read" ON public.messages FOR UPDATE USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() IN (recruiter_id, candidate_id))
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Insert default resume templates
INSERT INTO public.resume_templates (name, description, is_system, template_data) VALUES
('Professional', 'Clean, professional layout ideal for corporate roles', true, '{"sections": ["header", "summary", "experience", "education", "skills"], "style": "professional"}'),
('Modern', 'Contemporary design with sidebar for skills', true, '{"sections": ["header", "summary", "skills", "experience", "education"], "style": "modern"}'),
('ATS-Optimized', 'Plain text-focused format that passes ATS systems', true, '{"sections": ["header", "summary", "experience", "education", "skills"], "style": "ats"}'),
('Creative', 'Visually distinctive layout for creative roles', true, '{"sections": ["header", "summary", "skills", "experience", "education", "projects"], "style": "creative"}');

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

CREATE POLICY "Users upload own resumes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own resumes" ON storage.objects FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own resumes" ON storage.objects FOR DELETE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
