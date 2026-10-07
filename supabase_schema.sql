-- Supabase SQL Schema for Skill Gap Analyzer
-- Run this script in the Supabase Dashboard SQL Editor (https://app.supabase.com)

-- 1. Create the users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    github_id TEXT UNIQUE,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the user_data table for account-scoped state
CREATE TABLE IF NOT EXISTS public.user_data (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    schema_version INT DEFAULT 1 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users (github_id);
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data (user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- 5. Policies:
-- The Python backend uses the Supabase service role key or API key to access these tables.
-- The service role key automatically bypasses RLS in Supabase.
-- For anon access, you can define specific policies if direct client access is ever needed:
CREATE POLICY "Service role full access on users"
    ON public.users
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on user_data"
    ON public.user_data
    FOR ALL
    USING (true)
    WITH CHECK (true);
